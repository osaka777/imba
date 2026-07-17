import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { PrismaService } from '~/prisma/prisma.service';

import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';
import { extractOlimpbetHeadToHeadId } from '../olimpbet-wc/olimpbet-head-to-head.util';
import { buildWcOddsEventDto } from './wc-event-dto.util';
import { getWcEventPhase, isWcBettingOpen, wcLineEventWhere, wcLiveEventWhere } from './wc-betting.util';
import { fingerprintWcEventDetail, fingerprintWcListCache, fingerprintWcListEvent } from './wc-feed-fingerprint.util';
import { filterVisibleWcLiveListEvents, isWcEventVisibleInLiveList, isWcLiveListTerminal } from './wc-live-visibility.util';
import type { WcEventStatsPayload } from './wc-odds-statistics.types';
import { mergeWcParsedScore, pickRicherStatList, statListNeedsEnrichment, enrichTennisParsedScoreLiveGame } from './wc-odds-statistics.util';
import {
  findOutcomeOdds,
  mergeFullGroupedMarketsPreservingOdds,
  markGroupedMarketsSuspended,
  patchGroupedMarketsOdds,
  type WcGroupedMarkets,
} from './wc-odds-markets.util';
import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';
import { filterFinalizedScopeMarkets } from './wc-scope-market-filter.util';
import type { WcOddsEventDetailDto, WcOddsEventDto } from './wc-odds.types';
import { overlayEventDetailFromList } from './wc-event-detail-overlay.util';
import { WcOddsGateway } from './wc-odds.gateway';
import { WcOddsSettlementService } from './wc-odds-settlement.service';
import { WcEventMatchStateService } from './wc-event-match-state.service';
import { isWcEventId, olimpbetIdFromWcEventId } from './wc-slug.util';
import { resolveEventRef, toPublicEventId } from './wc-public.util';
import { wcSportKeyToSlug } from './wc-sport.util';

const BROADCAST_TICK_MS = 500;
const INGEST_TICK_MS = 2_000;
/** Match detail page (`SUB_EVENT`): fast Olimpbet pull + immediate WS push. */
const FOCUSED_INGEST_TICK_MS = 1_000;
const FOCUSED_ODDS_MIN_MS = 1_500;
const LINE_DB_REFRESH_MS = 3000;
const LIVE_DB_REFRESH_MS = 2_000;
const LIVE_INGEST_BATCH = 3;
const LINE_INGEST_BATCH = 2;
const STATS_REFRESH_MS = 5_000;
const SUBSCRIBED_STATS_REFRESH_MS = 500;

type CachedStructuredStats = {
  statList: WcEventStatsPayload['statList'];
  parsedScore: WcEventStatsPayload['parsedScore'];
};

type RefreshEventOptions = {
  fullMarkets?: boolean;
  oddsOnly?: boolean;
  statsOnly?: boolean;
  skipStructuredStats?: boolean;
  persistOdds?: boolean;
  /** Bypass Olimpbet event-detail cache (focused match page). */
  forceFetch?: boolean;
};

export type WcBetPlacementSnapshot = {
  groupedMarkets: WcGroupedMarkets;
  bettingOpen: boolean;
  main: OlimpbetEventDetail | null;
};

function mergeLiveStatsFields(
  prev: Pick<WcOddsEventDto, 'parsedScore' | 'statList' | 'homeScore' | 'awayScore'> | undefined,
  next: WcOddsEventDto,
  statsPayload: WcEventStatsPayload | null,
  cachedStructured?: CachedStructuredStats | null,
  options?: { preserveParsedScore?: boolean },
): WcOddsEventDto {
  let statList = pickRicherStatList(
    pickRicherStatList(prev?.statList, cachedStructured?.statList),
    next.statList,
  );

  const payloadForScore = options?.preserveParsedScore && statsPayload
    ? { ...statsPayload, parsedScore: null }
    : statsPayload;

  let parsedScore = mergeWcParsedScore(
    cachedStructured?.parsedScore ?? prev?.parsedScore,
    payloadForScore?.parsedScore ?? next.parsedScore,
  );

  if (payloadForScore?.structuredFetched) {
    if (payloadForScore.statList.length > 0) {
      statList = payloadForScore.statList;
    }
    if (payloadForScore.parsedScore) {
      parsedScore = mergeWcParsedScore(parsedScore, payloadForScore.parsedScore);
    }
  }

  if (options?.preserveParsedScore && prev?.parsedScore && parsedScore) {
    parsedScore = {
      ...parsedScore,
      seconds: prev.parsedScore.seconds ?? parsedScore.seconds,
      text: {
        ...parsedScore.text,
        time: prev.parsedScore.text?.time ?? parsedScore.text?.time,
        currentScore: parsedScore.text?.currentScore ?? prev.parsedScore.text?.currentScore,
        liveScore: parsedScore.text?.liveScore ?? prev.parsedScore.text?.liveScore,
      },
      period: parsedScore.period ?? prev.parsedScore.period,
      currentTimeInPeriodSec:
        prev.parsedScore.currentTimeInPeriodSec ?? parsedScore.currentTimeInPeriodSec,
      remainingTimeInPeriodSec:
        prev.parsedScore.remainingTimeInPeriodSec ?? parsedScore.remainingTimeInPeriodSec,
      details: parsedScore.details?.length ? parsedScore.details : prev.parsedScore.details,
      currentScore: parsedScore.currentScore ?? prev.parsedScore.currentScore,
    };
  } else if (options?.preserveParsedScore && prev?.parsedScore) {
    parsedScore = prev.parsedScore;
  }

  return {
    ...next,
    parsedScore: parsedScore ?? next.parsedScore,
    statList: statList ?? next.statList,
    homeScore: statsPayload?.homeScore ?? next.homeScore ?? prev?.homeScore ?? null,
    awayScore: statsPayload?.awayScore ?? next.awayScore ?? prev?.awayScore ?? null,
  };
}

@Injectable()
export class WcOddsRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WcOddsRealtimeService.name);

  private tickTimer?: NodeJS.Timeout;
  private ingestTimer?: NodeJS.Timeout;
  private focusedOddsTimer?: NodeJS.Timeout;
  private focusedHeavyTimer?: NodeJS.Timeout;
  private focusedHeavyTick = 0;
  private readonly oddsRefreshInFlight = new Set<string>();
  private readonly heavyRefreshInFlight = new Set<string>();
  private readonly lastFocusedOddsRefreshMs = new Map<string, number>();

  private lineSubscribers = 0;
  private liveSubscribers = 0;
  private readonly eventSubscribers = new Map<string, number>();

  private lineCache: WcOddsEventDto[] = [];
  private liveCache: WcOddsEventDto[] = [];
  private readonly eventCache = new Map<string, WcOddsEventDetailDto>();
  private readonly structuredStatsCache = new Map<string, CachedStructuredStats>();
  private readonly lastLineHash = new Map<string, string>();
  private readonly lastLiveHash = new Map<string, string>();
  private readonly lastEventHash = new Map<string, string>();
  private readonly lastSentLiveIds = new Set<string>();
  private readonly lastSentLineIds = new Set<string>();
  private readonly lastSentLiveFp = new Map<string, string>();
  private readonly lastSentLineFp = new Map<string, string>();
  private readonly lastStatsRefreshMs = new Map<string, number>();

  private liveIngestIds: string[] = [];
  private lineIngestIds: string[] = [];
  private liveIngestCursor = 0;
  private lineIngestCursor = 0;
  private lastLineDbRefreshMs = 0;
  private lastLiveDbRefreshMs = 0;
  private oddsUpdatedHandler: ((eventId: string) => void) | null = null;

  registerOddsUpdatedHandler(handler: (eventId: string) => void): void {
    this.oddsUpdatedHandler = handler;
  }

  private notifyOddsUpdated(eventId: string): void {
    if (this.oddsUpdatedHandler) {
      this.oddsUpdatedHandler(eventId);
    }
  }

  private ingestReadyAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly gateway: WcOddsGateway,
    private readonly matchState: WcEventMatchStateService,
    private readonly settlement: WcOddsSettlementService,
  ) {}

  onModuleInit() {
    this.gateway.bindRealtimeService(this);
    // Avoid boot storm against Olimpbet right after container start/deploy.
    this.ingestReadyAt = Date.now() + 45_000;
    this.tickTimer = setInterval(() => this.broadcastTick(), BROADCAST_TICK_MS);
    this.ingestTimer = setInterval(() => void this.ingestStep(), INGEST_TICK_MS);
    this.focusedOddsTimer = setInterval(() => void this.focusedOddsStep(), FOCUSED_INGEST_TICK_MS);
    this.focusedHeavyTimer = setInterval(() => void this.focusedHeavyStep(), FOCUSED_INGEST_TICK_MS * 2);
    void this.refreshLineFromDb();
  }

  onModuleDestroy() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.ingestTimer) clearInterval(this.ingestTimer);
    if (this.focusedOddsTimer) clearInterval(this.focusedOddsTimer);
    if (this.focusedHeavyTimer) clearInterval(this.focusedHeavyTimer);
  }

  subscribeLine(): void {
    this.lineSubscribers += 1;
    void this.refreshLineFromDb();
    this.resetLineSentState();
    this.gateway.sendLineSnapshot(this.lineCache);
  }

  unsubscribeLine(): void {
    this.lineSubscribers = Math.max(0, this.lineSubscribers - 1);
  }

  subscribeLive(): void {
    this.liveSubscribers += 1;
    void this.refreshLiveFromDb();
    this.resetLiveSentState();
    this.gateway.sendLiveSnapshot(this.liveCache);
  }

  unsubscribeLive(): void {
    this.liveSubscribers = Math.max(0, this.liveSubscribers - 1);
  }

  getLiveCache(): WcOddsEventDto[] {
    return this.liveCache;
  }

  getStructuredStatsCache(eventId: string): CachedStructuredStats | null {
    return this.structuredStatsCache.get(eventId) ?? null;
  }

  private rememberStructuredStats(eventId: string, statsPayload: WcEventStatsPayload | null): void {
    if (!statsPayload?.structuredFetched) return;

    const prev = this.structuredStatsCache.get(eventId);
    const statList = statsPayload.statList.length > 0
      ? statsPayload.statList
      : (prev?.statList ?? []);
    const parsedScore = statsPayload.parsedScore ?? prev?.parsedScore ?? null;

    if (!statList.length && !parsedScore) return;

    this.structuredStatsCache.set(eventId, { statList, parsedScore });
  }

  subscribeEvent(ref: string): void {
    this.eventSubscribers.set(ref, (this.eventSubscribers.get(ref) ?? 0) + 1);
    const snapshot = this.getEventDetailSnapshot(ref);
    if (snapshot) {
      this.gateway.sendEventSnapshot(ref, snapshot);
    }
    // Odds-only force for unlock speed — skip heavy Prisma/settle (force=false).
    // Linked fullMarkets catch up in background without blocking UPD.
    void this.refreshEvent(ref, false, {
      oddsOnly: true,
      forceFetch: true,
      skipStructuredStats: true,
      persistOdds: true,
    }).then(() => {
      void this.refreshEvent(ref, false, {
        fullMarkets: true,
        persistOdds: true,
      });
    });
  }

  unsubscribeEvent(ref: string): void {
    const n = (this.eventSubscribers.get(ref) ?? 1) - 1;
    if (n <= 0) this.eventSubscribers.delete(ref);
    else this.eventSubscribers.set(ref, n);
    this.rebuildIngestQueue();
  }

  getLineCache(): WcOddsEventDto[] {
    return this.lineCache;
  }

  getEventCache(ref: string): WcOddsEventDetailDto | null {
    return this.eventCache.get(ref) ?? null;
  }

  /** List-cache overlay for first paint — keeps match page aligned with live/line cards. */
  getEventDetailSnapshot(ref: string): WcOddsEventDetailDto | null {
    const cached = this.eventCache.get(ref);
    if (!cached) return null;
    return this.overlayDetailFromListCaches(cached);
  }

  findListCacheEvent(eventId: string): WcOddsEventDto | null {
    const fromLive = this.liveCache.find((event) => event.id === eventId);
    if (fromLive) return fromLive;
    return this.lineCache.find((event) => event.id === eventId) ?? null;
  }

  private overlayDetailFromListCaches(detail: WcOddsEventDetailDto): WcOddsEventDetailDto {
    const list = this.findListCacheEvent(detail.id);
    const structured = this.structuredStatsCache.get(detail.id);
    let next = overlayEventDetailFromList(detail, list);
    if (structured) {
      const merged = mergeLiveStatsFields(undefined, next, null, structured);
      next = {
        ...next,
        statList: merged.statList,
        parsedScore: merged.parsedScore,
        homeScore: merged.homeScore,
        awayScore: merged.awayScore,
      };
    }
    return next;
  }

  private hashPayload(payload: unknown): string {
    if (Array.isArray(payload)) {
      return fingerprintWcListCache(payload as WcOddsEventDto[]);
    }
    if (payload && typeof payload === 'object' && 'id' in (payload as object)) {
      return fingerprintWcEventDetail(payload as WcOddsEventDetailDto);
    }
    return JSON.stringify(payload);
  }

  /** Push event delta immediately — do not wait for broadcast tick (match page UX). */
  private pushEventIfChanged(ref: string, detail: WcOddsEventDetailDto): void {
    const hash = this.hashPayload(detail);
    const prev = this.lastEventHash.get(ref) ?? '';
    if (hash === prev) return;
    this.lastEventHash.set(ref, hash);
    this.gateway.sendEventUpdate(ref, detail);
  }

  private resetLiveSentState(): void {
    this.lastSentLiveIds.clear();
    this.lastSentLiveFp.clear();
    for (const event of this.liveCache) {
      this.lastSentLiveIds.add(event.id);
      this.lastSentLiveFp.set(event.id, fingerprintWcListEvent(event));
    }
  }

  private resetLineSentState(): void {
    this.lastSentLineIds.clear();
    this.lastSentLineFp.clear();
    for (const event of this.lineCache) {
      this.lastSentLineIds.add(event.id);
      this.lastSentLineFp.set(event.id, fingerprintWcListEvent(event));
    }
  }

  private computeListDelta(
    events: WcOddsEventDto[],
    lastIds: Set<string>,
    lastFp: Map<string, string>,
  ): { changed: WcOddsEventDto[]; removedPublicIds: string[]; nextIds: Set<string> } {
    const nextIds = new Set(events.map((event) => event.id));
    const changed: WcOddsEventDto[] = [];

    for (const event of events) {
      const fp = fingerprintWcListEvent(event);
      if (lastFp.get(event.id) !== fp) {
        changed.push(event);
        lastFp.set(event.id, fp);
      }
    }

    const removedPublicIds: string[] = [];
    for (const id of lastIds) {
      if (!nextIds.has(id)) {
        removedPublicIds.push(toPublicEventId(id));
        lastFp.delete(id);
      }
    }

    return { changed, removedPublicIds, nextIds };
  }

  private syncLineCacheEntry(
    dto: WcOddsEventDto,
    dbEvent: { id: string; commenceTime: Date; completed: boolean },
  ): void {
    const lineIdx = this.lineCache.findIndex((event) => event.id === dbEvent.id);
    if (lineIdx < 0) return;

    const stillInLine =
      !dbEvent.completed && dbEvent.commenceTime.getTime() > Date.now();
    if (!stillInLine) {
      this.lineCache.splice(lineIdx, 1);
      return;
    }

    this.lineCache[lineIdx] = dto;
  }

  private applyLiveCacheEntry(
    dto: WcOddsEventDto,
    dbEvent: { id: string; completed: boolean; commenceTime: Date },
  ): void {
    const liveIdx = this.liveCache.findIndex((event) => event.id === dbEvent.id);
    const phase = dbEvent.completed ? 'finished' : 'live';
    const terminal = isWcLiveListTerminal({ ...dto, phase });
    const visible = isWcEventVisibleInLiveList({ ...dto, phase });

    if (terminal) {
      if (liveIdx >= 0) this.liveCache.splice(liveIdx, 1);
      return;
    }

    const cachedStructured = this.structuredStatsCache.get(dbEvent.id) ?? null;
    const next: WcOddsEventDto = {
      ...mergeLiveStatsFields(
        liveIdx >= 0 ? this.liveCache[liveIdx] : undefined,
        dto,
        null,
        cachedStructured,
      ),
      phase: 'live',
    };

    if (liveIdx >= 0) {
      this.liveCache[liveIdx] = next;
      return;
    }

    if (
      visible
      && !dbEvent.completed
      && dbEvent.commenceTime.getTime() <= Date.now()
    ) {
      this.liveCache.push(next);
    }
  }

  private eventToDto(event: {
    id: string;
    slug: string | null;
    sportKey: string;
    homeTeam: string;
    awayTeam: string;
    commenceTime: Date;
    oddsHome: Decimal | null;
    oddsDraw: Decimal | null;
    oddsAway: Decimal | null;
    bookmakerTitle: string | null;
    completed: boolean;
    homeScore: number | null;
    awayScore: number | null;
    marketsJson?: unknown;
    oddsUpdatedAt?: Date | null;
  }): WcOddsEventDto {
    return buildWcOddsEventDto(event);
  }

  private async refreshLineFromDb(): Promise<void> {
    const now = Date.now();
    if (now - this.lastLineDbRefreshMs < LINE_DB_REFRESH_MS && this.lineCache.length > 0) {
      return;
    }

    const rows = await this.prisma.wcOddsEvent.findMany({
      where: wcLineEventWhere(),
      orderBy: [
        { priorityLevel: 'desc' },
        { leagueName: 'asc' },
        { commenceTime: 'asc' },
        { id: 'asc' },
      ],
    });

    this.lineCache = await this.olimpbet.enrichEventDtos(
      rows.map((e) => this.eventToDto(e)),
      rows,
    );
    this.lastLineDbRefreshMs = now;
    this.rebuildIngestQueue();
  }

  private async refreshLiveFromDb(): Promise<void> {
    const now = Date.now();
    if (now - this.lastLiveDbRefreshMs < LIVE_DB_REFRESH_MS && this.liveCache.length > 0) {
      return;
    }

    const rows = await this.prisma.wcOddsEvent.findMany({
      where: wcLiveEventWhere(),
      orderBy: [
        { priorityLevel: 'desc' },
        { leagueName: 'asc' },
        { commenceTime: 'desc' },
        { id: 'asc' },
      ],
    });

    const prevById = new Map(this.liveCache.map((event) => [event.id, event]));

    const enriched = filterVisibleWcLiveListEvents(
      (await this.olimpbet.enrichEventDtos(
        rows.map((e) => {
          const dto = this.eventToDto(e);
          if (!e.completed) dto.phase = 'live';
          return dto;
        }),
        rows,
      )).map((dto) =>
        mergeLiveStatsFields(
          prevById.get(dto.id),
          dto,
          null,
          this.structuredStatsCache.get(dto.id) ?? null,
        ),
      ),
    );

    const freshById = new Map(enriched.map((dto) => [dto.id, dto]));

    const merged: WcOddsEventDto[] = [];
    const seen = new Set<string>();

    for (const prev of this.liveCache) {
      if (isWcLiveListTerminal(prev)) continue;
      const next = freshById.get(prev.id);
      if (next) {
        if (isWcLiveListTerminal(next)) continue;
        merged.push(next);
      } else {
        merged.push(prev);
      }
      seen.add(prev.id);
    }

    for (const dto of freshById.values()) {
      if (seen.has(dto.id) || isWcLiveListTerminal(dto)) continue;
      merged.push(dto);
    }

    this.liveCache = merged;
    this.lastLiveDbRefreshMs = now;
    this.rebuildIngestQueue();
  }

  private rebuildIngestQueue(): void {
    const liveIds = new Set<string>();
    const lineIds = new Set<string>();

    if (this.liveSubscribers > 0) {
      for (const e of this.liveCache) liveIds.add(e.id);
    }

    if (this.lineSubscribers > 0) {
      for (const e of this.lineCache) {
        if (!liveIds.has(e.id)) lineIds.add(e.id);
      }
    }

    this.liveIngestIds = [...liveIds];
    this.lineIngestIds = [...lineIds];

    if (this.liveIngestCursor >= this.liveIngestIds.length) {
      this.liveIngestCursor = 0;
    }
    if (this.lineIngestCursor >= this.lineIngestIds.length) {
      this.lineIngestCursor = 0;
    }
  }

  private pickRotatingBatch(ids: string[], cursor: number, batchSize: number): { batch: string[]; nextCursor: number } {
    if (ids.length === 0) {
      return { batch: [], nextCursor: 0 };
    }

    const size = Math.min(batchSize, ids.length);
    const batch: string[] = [];
    let next = cursor;

    for (let i = 0; i < size; i += 1) {
      batch.push(ids[next % ids.length]);
      next += 1;
    }

    return { batch, nextCursor: next % ids.length };
  }

  private hasEventSubscriber(ref: string, dbEvent: { id: string; slug: string | null }): boolean {
    return this.eventSubscribers.has(ref)
      || this.eventSubscribers.has(dbEvent.id)
      || Boolean(dbEvent.slug && this.eventSubscribers.has(dbEvent.slug));
  }

  private async findDbEvent(ref: string) {
    const decoded = resolveEventRef(ref);
    if (isWcEventId(decoded)) {
      return this.prisma.wcOddsEvent.findUnique({ where: { id: decoded } });
    }
    return this.prisma.wcOddsEvent.findFirst({
      where: { OR: [{ slug: decoded }, { id: decoded }] },
    });
  }

  /**
   * Lightweight odds read for bet placement — one Olimpbet detail fetch + line snapshot,
   * without stats ingest, match-state refresh, or DB writes.
   */
  async resolveBetPlacementSnapshot(
    ref: string,
    dbEvent: {
      id: string;
      marketsJson: unknown;
      completed: boolean;
      commenceTime: Date;
    },
    options?: {
      marketKey?: string;
      outcomeKey?: string | null;
      line?: string | null;
      groupKey?: string | null;
    },
  ): Promise<WcBetPlacementSnapshot | null> {
    const cached = this.eventCache.get(ref) ?? this.eventCache.get(dbEvent.id);
    let groupedMarkets = (cached?.groupedMarkets ?? dbEvent.marketsJson ?? {}) as WcGroupedMarkets;
    const fallbackBettingOpen = isWcBettingOpen(dbEvent.completed, dbEvent.commenceTime);

    if (!this.olimpbet.isEnabled()) {
      return { groupedMarkets, bettingOpen: fallbackBettingOpen, main: null };
    }

    const olimpbetId = olimpbetIdFromWcEventId(dbEvent.id);
    if (!olimpbetId) {
      return { groupedMarkets, bettingOpen: fallbackBettingOpen, main: null };
    }

    const main = await this.olimpbet.fetchEventDetail(olimpbetId, {
      force: true,
      locale: 'ru',
    });
    if (!main) {
      return { groupedMarkets, bettingOpen: fallbackBettingOpen, main: null };
    }

    const bettingOpen = this.olimpbet.isFeedBettingOpen(main);
    const lineSnapshot = await this.olimpbet.buildLineSnapshotFromDetail(main, olimpbetId, { skipLogos: true });
    groupedMarkets = patchGroupedMarketsOdds(groupedMarkets, lineSnapshot.groupedMarkets);

    const needsFullMarkets =
      Boolean(options?.outcomeKey)
      && Boolean(options?.marketKey)
      && findOutcomeOdds(
        groupedMarkets,
        options!.marketKey!,
        options!.outcomeKey!,
        options?.line ?? null,
        options?.groupKey ?? null,
      ) == null;

    if (needsFullMarkets) {
      const fullSnapshot = await this.olimpbet.buildFullSnapshotFromDetail(main, olimpbetId);
      groupedMarkets = mergeFullGroupedMarketsPreservingOdds(fullSnapshot.groupedMarkets, groupedMarkets);
    }

    if (main.live && !dbEvent.completed) {
      groupedMarkets = filterFinalizedScopeMarkets(groupedMarkets, main);
    }
    if (!bettingOpen && Object.keys(groupedMarkets).length > 0) {
      groupedMarkets = markGroupedMarketsSuspended(groupedMarkets);
    }

    return { groupedMarkets, bettingOpen, main };
  }

  async refreshEvent(
    ref: string,
    force = false,
    options?: RefreshEventOptions,
  ): Promise<WcOddsEventDetailDto | null> {
    const dbEvent = await this.findDbEvent(ref);
    if (!dbEvent) return null;

    let groupedMarkets = (dbEvent.marketsJson ?? {}) as WcOddsEventDetailDto['groupedMarkets'];
    let oddsHome = dbEvent.oddsHome;
    let oddsDraw = dbEvent.oddsDraw;
    let oddsAway = dbEvent.oddsAway;
    let bookmakerTitle = dbEvent.bookmakerTitle;
    let bookmakerKey = dbEvent.bookmakerKey;
    let phase = getWcEventPhase(dbEvent.completed, dbEvent.commenceTime);

    if (this.olimpbet.isEnabled()) {
      const olimpbetId = olimpbetIdFromWcEventId(dbEvent.id);
      if (olimpbetId) {
        const main = await this.olimpbet.fetchEventDetail(olimpbetId, {
          force: options?.forceFetch === true,
          locale: 'ru',
        });
        const sportSlug = wcSportKeyToSlug(dbEvent.sportKey);
        const hasEventSubscribers = this.hasEventSubscriber(ref, dbEvent);
        const statsOnly = options?.statsOnly === true;
        const oddsOnly = options?.oddsOnly === true;
        const useFullMarkets = !oddsOnly && !statsOnly && options?.fullMarkets === true;
        const skipStructuredStats =
          options?.skipStructuredStats === true
          || oddsOnly;
        const statsInterval = dbEvent.completed
          ? 10 * 60_000
          : hasEventSubscribers
            ? SUBSCRIBED_STATS_REFRESH_MS
            : STATS_REFRESH_MS;
        const lastStatsRefresh = this.lastStatsRefreshMs.get(dbEvent.id) ?? 0;
        const cachedStructuredBefore = this.structuredStatsCache.get(dbEvent.id) ?? null;
        const cacheEmpty = statListNeedsEnrichment(
          sportSlug,
          cachedStructuredBefore?.statList,
        );
        const fetchStructuredStats =
          !skipStructuredStats
          && (
            (force && !dbEvent.completed)
            || (cacheEmpty && lastStatsRefresh === 0)
            || Date.now() - lastStatsRefresh >= statsInterval
          );

        const statsPayload = main
          ? await this.olimpbet.fetchEventStatsPayload(
            sportSlug,
            olimpbetId,
            main,
            {
              skipStructuredFetch: !fetchStructuredStats,
              includeLinkedStats: hasEventSubscribers && fetchStructuredStats,
            },
          )
          : null;

        if (fetchStructuredStats) {
          this.lastStatsRefreshMs.set(dbEvent.id, Date.now());
        }
        this.rememberStructuredStats(dbEvent.id, statsPayload);
        const cachedStructured = this.structuredStatsCache.get(dbEvent.id) ?? null;

        const prevCached = this.eventCache.get(ref)
          ?? this.eventCache.get(dbEvent.id)
          ?? null;

        const readLatestGrouped = (): WcGroupedMarkets => (
          this.eventCache.get(ref)?.groupedMarkets
          ?? this.eventCache.get(dbEvent.id)?.groupedMarkets
          ?? prevCached?.groupedMarkets
          ?? groupedMarkets
        ) as WcGroupedMarkets;

        const prevGrouped = readLatestGrouped();

        const snapshot = main && !statsOnly
          ? useFullMarkets
            ? await this.olimpbet.buildFullSnapshotFromDetail(main, olimpbetId)
            : oddsOnly
              ? await this.olimpbet.buildLineSnapshotFromDetail(main, olimpbetId, { skipLogos: true })
              : null
          : null;

        if (snapshot) {
          const latestGrouped = readLatestGrouped();
          const snapshotEmpty = Object.keys(snapshot.groupedMarkets).length === 0;
          // Feed suspend often returns zero tradable markets — keep the last
          // known markets (they get marked suspended below) instead of wiping.
          if (
            snapshotEmpty
            && !dbEvent.completed
            && Object.keys(latestGrouped).length > 0
          ) {
            groupedMarkets = latestGrouped;
          } else {
            groupedMarkets = useFullMarkets
              ? mergeFullGroupedMarketsPreservingOdds(snapshot.groupedMarkets, latestGrouped)
              : patchGroupedMarketsOdds(latestGrouped, snapshot.groupedMarkets);
          }
          bookmakerKey = 'olimpbet';
          bookmakerTitle = 'Olimpbet';
          // Always take scalar 1X2 from the Olimpbet snapshot — never freeze
          // prevCached odds here (that made live prices flash old ↔ new).
          if (snapshot.oddsHome) oddsHome = new Decimal(snapshot.oddsHome);
          if (snapshot.oddsDraw) oddsDraw = new Decimal(snapshot.oddsDraw);
          if (snapshot.oddsAway) oddsAway = new Decimal(snapshot.oddsAway);
          if (snapshot.live && !dbEvent.completed) phase = 'live';
        }

        let feedBettingOpen = isWcBettingOpen(dbEvent.completed, dbEvent.commenceTime);

        if (main) {
          const wasCompleted = dbEvent.completed;
          const homeScore = statsPayload?.homeScore ?? this.olimpbet.extractScore(main).homeScore;
          const awayScore = statsPayload?.awayScore ?? this.olimpbet.extractScore(main).awayScore;
          const completed = this.olimpbet.isEventCompleted(main);
          feedBettingOpen = this.olimpbet.isFeedBettingOpen(main);

          if (wasCompleted && !completed) {
            await this.settlement.reopenPrematureStandardBets(dbEvent.id);
          }

          const scorePatch =
            homeScore != null && awayScore != null
              ? { homeScore, awayScore, completed }
              : { completed };

          if (homeScore != null) dbEvent.homeScore = homeScore;
          if (awayScore != null) dbEvent.awayScore = awayScore;
          dbEvent.completed = completed;
          if (completed) {
            phase = 'finished';
          } else {
            phase = getWcEventPhase(false, dbEvent.commenceTime);
          }
          if (snapshot?.homeCompetitorId != null) {
            dbEvent.homeCompetitorId = snapshot.homeCompetitorId;
          }
          if (snapshot?.awayCompetitorId != null) {
            dbEvent.awayCompetitorId = snapshot.awayCompetitorId;
          }
          if (snapshot?.hasBroadcast != null) {
            dbEvent.hasBroadcast = snapshot.hasBroadcast;
          }

          if (!oddsOnly || force) {
            await this.prisma.wcOddsEvent.update({
              where: { id: dbEvent.id },
              data: {
                ...scorePatch,
                homeCompetitorId: snapshot?.homeCompetitorId ?? undefined,
                awayCompetitorId: snapshot?.awayCompetitorId ?? undefined,
                hasBroadcast: snapshot?.hasBroadcast ?? undefined,
              },
            });

            try {
              const matchState = await this.matchState.refreshAndSettle(
                dbEvent.id,
                dbEvent.sportKey,
                main,
                dbEvent.matchStateJson,
                statsPayload,
              );
              if (statsPayload?.parsedScore && matchState) {
                enrichTennisParsedScoreLiveGame(statsPayload.parsedScore, main, matchState);
              }
              if (completed) {
                await this.settlement.trySettleEvent(dbEvent.id, main);
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              this.logger.warn(`Match state refresh failed for ${dbEvent.id}: ${message}`);
            }
          }
        }

        if (main && phase === 'live' && !dbEvent.completed) {
          groupedMarkets = filterFinalizedScopeMarkets(groupedMarkets, main);
        }

        const dto = this.eventToDto({
          ...dbEvent,
          oddsHome,
          oddsDraw,
          oddsAway,
          bookmakerTitle,
          marketsJson: groupedMarkets,
          oddsUpdatedAt: statsOnly && prevCached?.oddsUpdatedAt
            ? new Date(prevCached.oddsUpdatedAt)
            : new Date(),
        });

        if (dbEvent.completed) {
          dto.phase = 'finished';
          dto.bettingOpen = false;
        } else if (phase === 'live' && !dbEvent.completed) {
          dto.phase = 'live';
        }
        if (!dbEvent.completed) {
          dto.bettingOpen = feedBettingOpen;
        }

        dto.olimpbetEventId = olimpbetId;
        dto.hasHeadToHead = Boolean(extractOlimpbetHeadToHeadId(main));

        let enrichedDto: WcOddsEventDto;
        if (oddsOnly && prevCached) {
          enrichedDto = {
            ...dto,
            homeTeamIcon: prevCached.homeTeamIcon,
            awayTeamIcon: prevCached.awayTeamIcon,
          };
        } else {
          [enrichedDto] = await this.olimpbet.enrichEventDtos([dto], [{
            homeCompetitorId: snapshot?.homeCompetitorId ?? dbEvent.homeCompetitorId,
            awayCompetitorId: snapshot?.awayCompetitorId ?? dbEvent.awayCompetitorId,
          }]);
        }

        const latestCached = this.eventCache.get(ref)
          ?? this.eventCache.get(dbEvent.id)
          ?? prevCached;

        const prevCachedList = this.liveCache.find((event) => event.id === dbEvent.id);

        const mergedDto = mergeLiveStatsFields(
          latestCached ?? prevCachedList,
          enrichedDto,
          statsPayload,
          cachedStructured,
          { preserveParsedScore: statsOnly },
        );

        if (snapshot?.homeTeamIcon) mergedDto.homeTeamIcon = snapshot.homeTeamIcon;
        if (snapshot?.awayTeamIcon) mergedDto.awayTeamIcon = snapshot.awayTeamIcon;
        if (snapshot?.hasBroadcast != null) mergedDto.hasBroadcast = snapshot.hasBroadcast;
        if (main?.status) mergedDto.feedStatus = main.status;

        if (dbEvent.completed) {
          mergedDto.phase = 'finished';
          mergedDto.bettingOpen = false;
        } else {
          mergedDto.phase = getWcEventPhase(false, dbEvent.commenceTime);
          mergedDto.bettingOpen = main
            ? this.olimpbet.isFeedBettingOpen(main)
            : isWcBettingOpen(false, dbEvent.commenceTime);
        }

        // Re-read cache after long async work — concurrent odds-only ticks must not be overwritten.
        if (statsOnly) {
          const fresh = this.eventCache.get(ref) ?? this.eventCache.get(dbEvent.id);
          if (fresh?.groupedMarkets) {
            groupedMarkets = fresh.groupedMarkets as WcGroupedMarkets;
            if (fresh.oddsHome != null) oddsHome = new Decimal(fresh.oddsHome);
            if (fresh.oddsDraw != null) oddsDraw = new Decimal(fresh.oddsDraw);
            if (fresh.oddsAway != null) oddsAway = new Decimal(fresh.oddsAway);
          }
          if (fresh?.parsedScore) {
            mergedDto.parsedScore = fresh.parsedScore;
          }
        } else if (snapshot) {
          const latestGrouped = readLatestGrouped();
          if (useFullMarkets) {
            // Structure from full snapshot; prices from full (not stale cache).
            groupedMarkets = mergeFullGroupedMarketsPreservingOdds(
              snapshot.groupedMarkets,
              latestGrouped,
            );
            const concurrent = this.eventCache.get(ref) ?? this.eventCache.get(dbEvent.id);
            const startedAt = prevCached?.oddsUpdatedAt
              ? Date.parse(prevCached.oddsUpdatedAt)
              : 0;
            const concurrentAt = concurrent?.oddsUpdatedAt
              ? Date.parse(concurrent.oddsUpdatedAt)
              : 0;
            // If oddsOnly landed fresher prices while fullMarkets was in flight, keep them.
            if (
              concurrent?.groupedMarkets
              && concurrentAt > startedAt
            ) {
              groupedMarkets = patchGroupedMarketsOdds(
                groupedMarkets,
                concurrent.groupedMarkets as WcGroupedMarkets,
              );
              if (concurrent.oddsHome != null) oddsHome = new Decimal(concurrent.oddsHome);
              if (concurrent.oddsDraw != null) oddsDraw = new Decimal(concurrent.oddsDraw);
              if (concurrent.oddsAway != null) oddsAway = new Decimal(concurrent.oddsAway);
            } else {
              if (snapshot.oddsHome) oddsHome = new Decimal(snapshot.oddsHome);
              if (snapshot.oddsDraw) oddsDraw = new Decimal(snapshot.oddsDraw);
              if (snapshot.oddsAway) oddsAway = new Decimal(snapshot.oddsAway);
            }
          } else {
            groupedMarkets = patchGroupedMarketsOdds(latestGrouped, snapshot.groupedMarkets);
            if (snapshot.oddsHome) oddsHome = new Decimal(snapshot.oddsHome);
            if (snapshot.oddsDraw) oddsDraw = new Decimal(snapshot.oddsDraw);
            if (snapshot.oddsAway) oddsAway = new Decimal(snapshot.oddsAway);
          }
          mergedDto.oddsHome = oddsHome != null ? Number(oddsHome) : null;
          mergedDto.oddsDraw = oddsDraw != null ? Number(oddsDraw) : null;
          mergedDto.oddsAway = oddsAway != null ? Number(oddsAway) : null;
          mergedDto.oddsUpdatedAt = new Date().toISOString();
        }

        if (main && !feedBettingOpen && Object.keys(groupedMarkets).length > 0) {
          groupedMarkets = markGroupedMarketsSuspended(groupedMarkets);
        }

        const detail: WcOddsEventDetailDto = {
          ...mergedDto,
          groupedMarkets,
        };

        this.eventCache.set(ref, detail);
        this.eventCache.set(dbEvent.id, detail);
        if (dbEvent.slug) this.eventCache.set(dbEvent.slug, detail);

        if (snapshot && !statsOnly) {
          this.notifyOddsUpdated(dbEvent.id);
        }

        if (hasEventSubscribers) {
          this.pushEventIfChanged(ref, detail);
        }

        this.syncLineCacheEntry(mergedDto, dbEvent);

        this.applyLiveCacheEntry(mergedDto, dbEvent);

        const persistOdds = options?.persistOdds === true || force || useFullMarkets;
        if (persistOdds && !oddsOnly) {
          await this.prisma.wcOddsEvent.update({
            where: { id: dbEvent.id },
            data: {
              oddsHome,
              oddsDraw,
              oddsAway,
              bookmakerKey: bookmakerKey ?? undefined,
              bookmakerTitle: bookmakerTitle ?? undefined,
              marketsJson: groupedMarkets as object,
              oddsUpdatedAt: new Date(),
            },
          });
        }

        return detail;
      }
    }

    const dto = this.eventToDto({
      ...dbEvent,
      oddsHome,
      oddsDraw,
      oddsAway,
      bookmakerTitle,
      marketsJson: groupedMarkets,
      oddsUpdatedAt: new Date(),
    });

    if (dbEvent.completed) {
      dto.phase = 'finished';
      dto.bettingOpen = false;
    } else {
      dto.phase = getWcEventPhase(false, dbEvent.commenceTime);
      dto.bettingOpen = isWcBettingOpen(false, dbEvent.commenceTime);
    }

    const [enrichedDto] = await this.olimpbet.enrichEventDtos([dto], [dbEvent]);

    const detail: WcOddsEventDetailDto = {
      ...enrichedDto,
      groupedMarkets,
    };

    this.eventCache.set(ref, detail);
    this.eventCache.set(dbEvent.id, detail);
    if (dbEvent.slug) this.eventCache.set(dbEvent.slug, detail);

    this.syncLineCacheEntry(enrichedDto, dbEvent);

    this.applyLiveCacheEntry(enrichedDto, dbEvent);

    if (force) {
      await this.prisma.wcOddsEvent.update({
        where: { id: dbEvent.id },
        data: {
          oddsHome,
          oddsDraw,
          oddsAway,
          bookmakerKey: bookmakerKey ?? undefined,
          bookmakerTitle: bookmakerTitle ?? undefined,
          marketsJson: groupedMarkets as object,
          oddsUpdatedAt: new Date(),
        },
      });
    }

    return detail;
  }

  private async ingestEventOdds(eventId: string, options?: RefreshEventOptions): Promise<void> {
    const dbEvent = await this.prisma.wcOddsEvent.findUnique({ where: { id: eventId } });
    if (!dbEvent) return;

    const ref = dbEvent.slug ?? dbEvent.id;
    const wantsStats = Date.now() - (this.lastStatsRefreshMs.get(eventId) ?? 0) >= STATS_REFRESH_MS;
    await this.refreshEvent(ref, false, {
      oddsOnly: true,
      skipStructuredStats: !wantsStats,
      ...options,
    });
  }

  private async ingestStep(): Promise<void> {
    if (!this.olimpbet.isEnabled()) return;
    if (Date.now() < this.ingestReadyAt) return;
    if (this.olimpbet.isFetchBlocked()) return;

    const now = Date.now();
    if (now - this.lastLineDbRefreshMs >= LINE_DB_REFRESH_MS) {
      await this.refreshLineFromDb();
    }
    if (this.liveSubscribers > 0 && now - this.lastLiveDbRefreshMs >= LIVE_DB_REFRESH_MS) {
      await this.refreshLiveFromDb();
    }

    this.rebuildIngestQueue();

    const subscribedEventIds = new Set<string>();
    for (const ref of this.eventSubscribers.keys()) {
      const cached = this.eventCache.get(ref);
      if (cached?.id) subscribedEventIds.add(cached.id);
    }

    const tasks: Array<Promise<void>> = [];

    if (this.liveSubscribers > 0 && this.liveIngestIds.length > 0) {
      const { batch, nextCursor } = this.pickRotatingBatch(
        this.liveIngestIds,
        this.liveIngestCursor,
        LIVE_INGEST_BATCH,
      );
      this.liveIngestCursor = nextCursor;

      for (const eventId of batch) {
        if (subscribedEventIds.has(eventId)) continue;

        tasks.push(
          this.ingestEventOdds(eventId).catch((err) => {
            this.logger.warn(`WC realtime live ingest failed for ${eventId}: ${(err as Error).message}`);
          }),
        );
      }
    }

    if (this.lineSubscribers > 0 && this.lineIngestIds.length > 0) {
      const { batch, nextCursor } = this.pickRotatingBatch(
        this.lineIngestIds,
        this.lineIngestCursor,
        LINE_INGEST_BATCH,
      );
      this.lineIngestCursor = nextCursor;

      for (const eventId of batch) {
        tasks.push(
          this.ingestEventOdds(eventId).catch((err) => {
            this.logger.warn(`WC realtime line ingest failed for ${eventId}: ${(err as Error).message}`);
          }),
        );
      }
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  /** Odds from Olimpbet main event — skip when odds or heavy refresh already in flight. */
  private focusedOddsStep(): void {
    if (!this.olimpbet.isEnabled() || this.eventSubscribers.size === 0) return;
    if (Date.now() < this.ingestReadyAt) return;
    if (this.olimpbet.isFetchBlocked()) return;

    const now = Date.now();
    for (const ref of this.eventSubscribers.keys()) {
      // Don't race a fullMarkets/stats refresh — that was flashing stale ↔ fresh odds.
      if (this.oddsRefreshInFlight.has(ref) || this.heavyRefreshInFlight.has(ref)) continue;
      const last = this.lastFocusedOddsRefreshMs.get(ref) ?? 0;
      if (now - last < FOCUSED_ODDS_MIN_MS) continue;

      this.lastFocusedOddsRefreshMs.set(ref, now);
      this.oddsRefreshInFlight.add(ref);
      void this.refreshEvent(ref, false, {
        oddsOnly: true,
        skipStructuredStats: true,
        forceFetch: true,
      })
        .catch((err) => {
          this.logger.warn(`WC focused odds failed for ${ref}: ${(err as Error).message}`);
        })
        .finally(() => {
          this.oddsRefreshInFlight.delete(ref);
        });
    }
  }

  /** Stats / full linked markets — never runs concurrently with odds refresh for same ref. */
  private focusedHeavyStep(): void {
    if (!this.olimpbet.isEnabled() || this.eventSubscribers.size === 0) return;
    if (Date.now() < this.ingestReadyAt) return;
    if (this.olimpbet.isFetchBlocked()) return;

    this.focusedHeavyTick += 1;
    const fullMarkets = this.focusedHeavyTick % 4 === 0;

    for (const ref of this.eventSubscribers.keys()) {
      if (this.oddsRefreshInFlight.has(ref) || this.heavyRefreshInFlight.has(ref)) continue;

      this.heavyRefreshInFlight.add(ref);
      void this.refreshEvent(ref, false, fullMarkets
        ? { fullMarkets: true, persistOdds: true }
        : { statsOnly: true })
        .catch((err) => {
          this.logger.warn(`WC focused heavy failed for ${ref}: ${(err as Error).message}`);
        })
        .finally(() => {
          this.heavyRefreshInFlight.delete(ref);
        });
    }
  }

  private broadcastTick(): void {
    if (this.lineSubscribers > 0) {
      const hash = this.hashPayload(this.lineCache);
      const prev = this.lastLineHash.get('line') ?? '';
      if (hash !== prev) {
        this.lastLineHash.set('line', hash);
        const { changed, removedPublicIds, nextIds } = this.computeListDelta(
          this.lineCache,
          this.lastSentLineIds,
          this.lastSentLineFp,
        );
        this.lastSentLineIds.clear();
        for (const id of nextIds) this.lastSentLineIds.add(id);
        if (changed.length > 0 || removedPublicIds.length > 0) {
          this.gateway.sendLineDelta(changed, removedPublicIds);
        }
      } else {
        this.gateway.sendLineHeartbeat();
      }
    }

    if (this.liveSubscribers > 0) {
      const hash = this.hashPayload(this.liveCache);
      const prev = this.lastLiveHash.get('live') ?? '';
      if (hash !== prev) {
        this.lastLiveHash.set('live', hash);
        const { changed, removedPublicIds, nextIds } = this.computeListDelta(
          this.liveCache,
          this.lastSentLiveIds,
          this.lastSentLiveFp,
        );
        this.lastSentLiveIds.clear();
        for (const id of nextIds) this.lastSentLiveIds.add(id);
        if (changed.length > 0 || removedPublicIds.length > 0) {
          this.gateway.sendLiveDelta(changed, removedPublicIds);
        }
      } else {
        this.gateway.sendLiveHeartbeat();
      }
    }

    for (const ref of this.eventSubscribers.keys()) {
      const detail = this.eventCache.get(ref);
      if (!detail) continue;
      const hash = this.hashPayload(detail);
      const prev = this.lastEventHash.get(ref) ?? '';
      if (hash !== prev) {
        this.lastEventHash.set(ref, hash);
        this.gateway.sendEventUpdate(ref, detail);
      } else {
        this.gateway.sendEventHeartbeat(ref);
      }
    }
  }
}
