import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { PrismaService } from '~/prisma/prisma.service';

import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';
import type { WcOddsEventDetailDto, WcOddsEventDto } from './wc-odds.types';
import type { WcEventStatsPayload } from './wc-odds-statistics.types';

import { extractOlimpbetHeadToHeadId } from '../olimpbet-wc/olimpbet-head-to-head.util';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';
import { OneWinWcService } from '../onewin-wc/onewin-wc.service';
import {
  getWcEventPhase,
  isWcBettingOpen,
  wcLineEventWhere,
  wcLiveEventWhere,
} from './wc-betting.util';
import { overlayEventDetailFromList } from './wc-event-detail-overlay.util';
import { buildWcOddsEventDto } from './wc-event-dto.util';
import { WcEventMatchStateService } from './wc-event-match-state.service';
import {
  fingerprintWcEventDetail,
  fingerprintWcListCache,
  fingerprintWcListEvent,
} from './wc-feed-fingerprint.util';
import {
  filterVisibleWcLiveListEvents,
  isWcEventVisibleInLiveList,
  isWcLiveListTerminal,
} from './wc-live-visibility.util';
import { parseMatchState, emptyMatchState } from './wc-match-state.types';
import { WcOddsGateway } from './wc-odds.gateway';
import {
  type WcGroupedMarkets,
  findOutcomeOdds,
  markGroupedMarketsSuspended,
  mergeFullGroupedMarketsPreservingOdds,
  patchGroupedMarketsOdds,
} from './wc-odds-markets.util';
import { WcOddsSettlementService } from './wc-odds-settlement.service';
import {
  enrichTennisParsedScoreLiveGame,
  mergeWcParsedScore,
  pickRicherStatList,
  statListNeedsEnrichment,
} from './wc-odds-statistics.util';
import { resolveEventRef, toPublicEventId } from './wc-public.util';
import { filterFinalizedScopeMarkets } from './wc-scope-market-filter.util';
import { isWcEventId, olimpbetIdFromWcEventId, oneWinMatchIdFromWcEventId } from './wc-slug.util';
import { wcSportKeyToSlug } from './wc-sport.util';
import { mapOneWinOddsToGroupedMarkets } from '../onewin-wc/onewin-esports-markets.util';
import { isOneWinBookOpen } from '../onewin-wc/onewin-esports-book.util';
import { resolveOneWinBestOf } from '../onewin-wc/onewin-esports-bestof-resolve.util';
import { resolveOneWinEsportsResult } from '../onewin-wc/onewin-esports-settlement.util';

const BROADCAST_TICK_MS = 500;
const INGEST_TICK_MS = 2_000;
/** Match detail page (`SUB_EVENT`): fast Olimpbet pull + immediate WS push. */
const FOCUSED_INGEST_TICK_MS = 1_000;
const FOCUSED_ODDS_MIN_MS = 1_000;
const LINE_DB_REFRESH_MS = 3000;
const LIVE_DB_REFRESH_MS = 2_000;
const LIVE_INGEST_BATCH = 8;
const LINE_INGEST_BATCH = 2;
const STATS_REFRESH_MS = 5_000;
const SUBSCRIBED_STATS_REFRESH_MS = 500;

type CachedStructuredStats = {
  parsedScore: WcEventStatsPayload['parsedScore'];
  statList: WcEventStatsPayload['statList'];
};

type RefreshEventOptions = {
  /** Bypass Olimpbet event-detail cache (focused match page). */
  forceFetch?: boolean;
  fullMarkets?: boolean;
  oddsOnly?: boolean;
  persistOdds?: boolean;
  skipStructuredStats?: boolean;
  statsOnly?: boolean;
};

export type WcBetPlacementSnapshot = {
  bettingOpen: boolean;
  groupedMarkets: WcGroupedMarkets;
  main: OlimpbetEventDetail | null;
};

function mergeLiveStatsFields(
  prev:
    | Pick<
        WcOddsEventDto,
        'awayScore' | 'homeScore' | 'parsedScore' | 'statList'
      >
    | undefined,
  next: WcOddsEventDto,
  statsPayload: WcEventStatsPayload | null,
  cachedStructured?: CachedStructuredStats | null,
  options?: { preserveParsedScore?: boolean },
): WcOddsEventDto {
  let statList = pickRicherStatList(
    pickRicherStatList(prev?.statList, cachedStructured?.statList),
    next.statList,
  );

  const payloadForScore =
    options?.preserveParsedScore && statsPayload
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
      parsedScore = mergeWcParsedScore(
        parsedScore,
        payloadForScore.parsedScore,
      );
    }
  }

  if (options?.preserveParsedScore && prev?.parsedScore && parsedScore) {
    parsedScore = {
      ...parsedScore,
      currentScore: parsedScore.currentScore ?? prev.parsedScore.currentScore,
      currentTimeInPeriodSec:
        prev.parsedScore.currentTimeInPeriodSec ??
        parsedScore.currentTimeInPeriodSec,
      details: parsedScore.details?.length
        ? parsedScore.details
        : prev.parsedScore.details,
      period: parsedScore.period ?? prev.parsedScore.period,
      remainingTimeInPeriodSec:
        prev.parsedScore.remainingTimeInPeriodSec ??
        parsedScore.remainingTimeInPeriodSec,
      seconds: prev.parsedScore.seconds ?? parsedScore.seconds,
      text: {
        ...parsedScore.text,
        currentScore:
          parsedScore.text?.currentScore ?? prev.parsedScore.text?.currentScore,
        liveScore:
          parsedScore.text?.liveScore ?? prev.parsedScore.text?.liveScore,
        time: prev.parsedScore.text?.time ?? parsedScore.text?.time,
      },
    };
  } else if (options?.preserveParsedScore && prev?.parsedScore) {
    parsedScore = prev.parsedScore;
  }

  return {
    ...next,
    awayScore:
      statsPayload?.awayScore ?? next.awayScore ?? prev?.awayScore ?? null,
    homeScore:
      statsPayload?.homeScore ?? next.homeScore ?? prev?.homeScore ?? null,
    parsedScore: parsedScore ?? next.parsedScore,
    statList: statList ?? next.statList,
  };
}

@Injectable()
export class WcOddsRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly eventCache = new Map<string, WcOddsEventDetailDto>();

  private readonly eventSubscribers = new Map<string, number>();
  private focusedHeavyTick = 0;
  private focusedHeavyTimer?: NodeJS.Timeout;
  private focusedOddsTimer?: NodeJS.Timeout;
  private readonly heavyRefreshInFlight = new Set<string>();
  private ingestReadyAt = 0;
  private ingestTimer?: NodeJS.Timeout;
  private readonly lastEventHash = new Map<string, string>();

  private readonly lastFocusedOddsRefreshMs = new Map<string, number>();
  private lastLineDbRefreshMs = 0;
  private readonly lastLineHash = new Map<string, string>();

  private lastLiveDbRefreshMs = 0;
  private readonly lastLiveHash = new Map<string, string>();
  private readonly lastSentLineFp = new Map<string, string>();
  private readonly lastSentLineIds = new Set<string>();
  private readonly lastSentLiveFp = new Map<string, string>();
  private readonly lastSentLiveIds = new Set<string>();
  private readonly lastStatsRefreshMs = new Map<string, number>();
  private lineCache: WcOddsEventDto[] = [];
  private lineIngestCursor = 0;
  private lineIngestIds: string[] = [];
  private lineSubscribers = 0;
  private liveCache: WcOddsEventDto[] = [];

  private liveIngestCursor = 0;
  private liveIngestIds: string[] = [];
  private liveSubscribers = 0;
  private readonly logger = new Logger(WcOddsRealtimeService.name);
  private readonly oddsRefreshInFlight = new Set<string>();
  private oddsUpdatedHandler: ((eventId: string) => void) | null = null;
  private readonly structuredStatsCache = new Map<
    string,
    CachedStructuredStats
  >();

  private tickTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly onewin: OneWinWcService,
    private readonly gateway: WcOddsGateway,
    private readonly matchState: WcEventMatchStateService,
    private readonly settlement: WcOddsSettlementService,
  ) {}

  private applyLiveCacheEntry(
    dto: WcOddsEventDto,
    dbEvent: { commenceTime: Date; completed: boolean; id: string },
  ): void {
    const liveIdx = this.liveCache.findIndex(
      (event) => event.id === dbEvent.id,
    );
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
      visible &&
      !dbEvent.completed &&
      dbEvent.commenceTime.getTime() <= Date.now()
    ) {
      this.liveCache.push(next);
    }
  }

  private broadcastTick(): void {
    if (this.lineSubscribers > 0) {
      const hash = this.hashPayload(this.lineCache);
      const prev = this.lastLineHash.get('line') ?? '';
      if (hash !== prev) {
        this.lastLineHash.set('line', hash);
        const { changed, nextIds, removedPublicIds } = this.computeListDelta(
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
        const { changed, nextIds, removedPublicIds } = this.computeListDelta(
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

  private computeListDelta(
    events: WcOddsEventDto[],
    lastIds: Set<string>,
    lastFp: Map<string, string>,
  ): {
    changed: WcOddsEventDto[];
    nextIds: Set<string>;
    removedPublicIds: string[];
  } {
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

    return { changed, nextIds, removedPublicIds };
  }

  private eventToDto(event: {
    awayCompetitorId?: null | number;
    awayScore: null | number;
    awayTeam: string;
    bookmakerTitle: null | string;
    commenceTime: Date;
    completed: boolean;
    hasBroadcast?: boolean;
    homeCompetitorId?: null | number;
    homeScore: null | number;
    homeTeam: string;
    id: string;
    leagueName?: null | string;
    marketsJson?: unknown;
    matchStateJson?: unknown;
    oddsAway: Decimal | null;
    oddsDraw: Decimal | null;
    oddsHome: Decimal | null;
    oddsUpdatedAt?: Date | null;
    slug: null | string;
    sportKey: string;
    tournamentId?: null | number;
  }): WcOddsEventDto {
    return buildWcOddsEventDto(event);
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

  /** Stats / full linked markets — never runs concurrently with odds refresh for same ref. */
  private focusedHeavyStep(): void {
    if (this.eventSubscribers.size === 0) return;
    if (Date.now() < this.ingestReadyAt) return;
    const olimpbetOk =
      this.olimpbet.isEnabled() && !this.olimpbet.isFetchBlocked();
    const onewinOk = this.onewin.isEnabled();
    // Cyber `ow-*` uses 1win push — keep refreshing even if Olimpbet is rate-blocked.
    if (!olimpbetOk && !onewinOk) return;

    this.focusedHeavyTick += 1;
    const fullMarkets = this.focusedHeavyTick % 4 === 0;

    for (const ref of this.eventSubscribers.keys()) {
      if (
        this.oddsRefreshInFlight.has(ref) ||
        this.heavyRefreshInFlight.has(ref)
      )
        continue;

      this.heavyRefreshInFlight.add(ref);
      void this.refreshEvent(
        ref,
        false,
        fullMarkets
          ? { fullMarkets: true, persistOdds: true }
          : { statsOnly: true },
      )
        .catch((err) => {
          this.logger.warn(
            `WC focused heavy failed for ${ref}: ${(err as Error).message}`,
          );
        })
        .finally(() => {
          this.heavyRefreshInFlight.delete(ref);
        });
    }
  }

  /** Odds from Olimpbet main event — skip when odds or heavy refresh already in flight. */
  private focusedOddsStep(): void {
    if (this.eventSubscribers.size === 0) return;
    if (Date.now() < this.ingestReadyAt) return;
    const olimpbetOk =
      this.olimpbet.isEnabled() && !this.olimpbet.isFetchBlocked();
    const onewinOk = this.onewin.isEnabled();
    if (!olimpbetOk && !onewinOk) return;

    const now = Date.now();
    for (const ref of this.eventSubscribers.keys()) {
      // Don't race a fullMarkets/stats refresh — that was flashing stale ↔ fresh odds.
      if (
        this.oddsRefreshInFlight.has(ref) ||
        this.heavyRefreshInFlight.has(ref)
      )
        continue;
      const last = this.lastFocusedOddsRefreshMs.get(ref) ?? 0;
      if (now - last < FOCUSED_ODDS_MIN_MS) continue;

      this.lastFocusedOddsRefreshMs.set(ref, now);
      this.oddsRefreshInFlight.add(ref);
      void this.refreshEvent(ref, false, {
        forceFetch: true,
        oddsOnly: true,
        // Keep DB/list 1X2 in sync while the match page is open.
        persistOdds: true,
        skipStructuredStats: true,
      })
        .catch((err) => {
          this.logger.warn(
            `WC focused odds failed for ${ref}: ${(err as Error).message}`,
          );
        })
        .finally(() => {
          this.oddsRefreshInFlight.delete(ref);
        });
    }
  }

  private hasEventSubscriber(
    ref: string,
    dbEvent: { id: string; slug: null | string },
  ): boolean {
    return (
      this.eventSubscribers.has(ref) ||
      this.eventSubscribers.has(dbEvent.id) ||
      Boolean(dbEvent.slug && this.eventSubscribers.has(dbEvent.slug))
    );
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

  private async ingestEventOdds(
    eventId: string,
    options?: RefreshEventOptions,
  ): Promise<void> {
    const dbEvent = await this.prisma.wcOddsEvent.findUnique({
      where: { id: eventId },
    });
    if (!dbEvent) return;

    const ref = dbEvent.slug ?? dbEvent.id;
    const wantsStats =
      Date.now() - (this.lastStatsRefreshMs.get(eventId) ?? 0) >=
      STATS_REFRESH_MS;
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
    if (
      this.liveSubscribers > 0 &&
      now - this.lastLiveDbRefreshMs >= LIVE_DB_REFRESH_MS
    ) {
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
            this.logger.warn(
              `WC realtime live ingest failed for ${eventId}: ${(err as Error).message}`,
            );
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
            this.logger.warn(
              `WC realtime line ingest failed for ${eventId}: ${(err as Error).message}`,
            );
          }),
        );
      }
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  private notifyOddsUpdated(eventId: string): void {
    if (this.oddsUpdatedHandler) {
      this.oddsUpdatedHandler(eventId);
    }
  }

  private overlayDetailFromListCaches(
    detail: WcOddsEventDetailDto,
  ): WcOddsEventDetailDto {
    const list = this.findListCacheEvent(detail.id);
    const structured = this.structuredStatsCache.get(detail.id);
    let next = overlayEventDetailFromList(detail, list);
    if (structured) {
      const merged = mergeLiveStatsFields(undefined, next, null, structured);
      next = {
        ...next,
        awayScore: merged.awayScore,
        homeScore: merged.homeScore,
        parsedScore: merged.parsedScore,
        statList: merged.statList,
      };
    }
    return next;
  }

  private pickRotatingBatch(
    ids: string[],
    cursor: number,
    batchSize: number,
  ): { batch: string[]; nextCursor: number } {
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

  /** Push event delta immediately — do not wait for broadcast tick (match page UX). */
  private pushEventIfChanged(ref: string, detail: WcOddsEventDetailDto): void {
    const hash = this.hashPayload(detail);
    const prev = this.lastEventHash.get(ref) ?? '';
    if (hash === prev) return;
    this.lastEventHash.set(ref, hash);
    this.gateway.sendEventUpdate(ref, detail);
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

  private async refreshLineFromDb(): Promise<void> {
    const now = Date.now();
    if (
      now - this.lastLineDbRefreshMs < LINE_DB_REFRESH_MS &&
      this.lineCache.length > 0
    ) {
      return;
    }

    const rows = await this.prisma.wcOddsEvent.findMany({
      orderBy: [
        { priorityLevel: 'desc' },
        { leagueName: 'asc' },
        { commenceTime: 'asc' },
        { id: 'asc' },
      ],
      where: wcLineEventWhere(),
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
    if (
      now - this.lastLiveDbRefreshMs < LIVE_DB_REFRESH_MS &&
      this.liveCache.length > 0
    ) {
      return;
    }

    const rows = await this.prisma.wcOddsEvent.findMany({
      orderBy: [
        { priorityLevel: 'desc' },
        { leagueName: 'asc' },
        { commenceTime: 'desc' },
        { id: 'asc' },
      ],
      where: wcLiveEventWhere(),
    });

    const prevById = new Map(this.liveCache.map((event) => [event.id, event]));

    const enriched = filterVisibleWcLiveListEvents(
      (
        await this.olimpbet.enrichEventDtos(
          rows.map((e) => {
            const dto = this.eventToDto(e);
            if (!e.completed) dto.phase = 'live';
            return dto;
          }),
          rows,
        )
      ).map((dto) =>
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

  private rememberStructuredStats(
    eventId: string,
    statsPayload: WcEventStatsPayload | null,
  ): void {
    if (!statsPayload?.structuredFetched) return;

    const prev = this.structuredStatsCache.get(eventId);
    const statList =
      statsPayload.statList.length > 0
        ? statsPayload.statList
        : (prev?.statList ?? []);
    const parsedScore = statsPayload.parsedScore ?? prev?.parsedScore ?? null;

    if (!statList.length && !parsedScore) return;

    this.structuredStatsCache.set(eventId, { parsedScore, statList });
  }

  private resetLineSentState(): void {
    this.lastSentLineIds.clear();
    this.lastSentLineFp.clear();
    for (const event of this.lineCache) {
      this.lastSentLineIds.add(event.id);
      this.lastSentLineFp.set(event.id, fingerprintWcListEvent(event));
    }
  }

  private resetLiveSentState(): void {
    this.lastSentLiveIds.clear();
    this.lastSentLiveFp.clear();
    for (const event of this.liveCache) {
      this.lastSentLiveIds.add(event.id);
      this.lastSentLiveFp.set(event.id, fingerprintWcListEvent(event));
    }
  }

  private syncLineCacheEntry(
    dto: WcOddsEventDto,
    dbEvent: { commenceTime: Date; completed: boolean; id: string },
  ): void {
    const lineIdx = this.lineCache.findIndex(
      (event) => event.id === dbEvent.id,
    );
    if (lineIdx < 0) return;

    const stillInLine =
      !dbEvent.completed && dbEvent.commenceTime.getTime() > Date.now();
    if (!stillInLine) {
      this.lineCache.splice(lineIdx, 1);
      return;
    }

    this.lineCache[lineIdx] = dto;
  }

  findListCacheEvent(eventId: string): WcOddsEventDto | null {
    const fromLive = this.liveCache.find((event) => event.id === eventId);
    if (fromLive) return fromLive;
    return this.lineCache.find((event) => event.id === eventId) ?? null;
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

  getLineCache(): WcOddsEventDto[] {
    return this.lineCache;
  }

  getLiveCache(): WcOddsEventDto[] {
    return this.liveCache;
  }

  /** Best-effort media badge updates for list cards (broadcast / live tracker). */
  patchLiveCacheMediaFlags(
    eventId: string,
    flags: { hasBroadcast?: boolean; hasLiveTracker?: boolean },
  ): void {
    const idx = this.liveCache.findIndex((event) => event.id === eventId);
    if (idx < 0) return;
    const prev = this.liveCache[idx]!;
    this.liveCache[idx] = {
      ...prev,
      ...(flags.hasBroadcast != null
        ? { hasBroadcast: flags.hasBroadcast }
        : {}),
      ...(flags.hasLiveTracker != null
        ? { hasLiveTracker: flags.hasLiveTracker }
        : {}),
    };
  }

  getStructuredStatsCache(eventId: string): CachedStructuredStats | null {
    return this.structuredStatsCache.get(eventId) ?? null;
  }

  onModuleDestroy() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.ingestTimer) clearInterval(this.ingestTimer);
    if (this.focusedOddsTimer) clearInterval(this.focusedOddsTimer);
    if (this.focusedHeavyTimer) clearInterval(this.focusedHeavyTimer);
  }

  onModuleInit() {
    this.gateway.bindRealtimeService(this);
    // Avoid boot storm against Olimpbet right after container start/deploy.
    this.ingestReadyAt = Date.now() + 45_000;
    this.tickTimer = setInterval(() => this.broadcastTick(), BROADCAST_TICK_MS);
    this.ingestTimer = setInterval(
      () => void this.ingestStep(),
      INGEST_TICK_MS,
    );
    this.focusedOddsTimer = setInterval(
      () => void this.focusedOddsStep(),
      FOCUSED_INGEST_TICK_MS,
    );
    this.focusedHeavyTimer = setInterval(
      () => void this.focusedHeavyStep(),
      FOCUSED_INGEST_TICK_MS * 2,
    );
    void this.refreshLineFromDb();
  }

  /**
   * Live score + odds for cybersport `ow-*` events from the 1win push feed.
   * Without this, match pages keep stale DB scores (often 0:0) while the
   * broadcast already shows the real map/round score.
   */
  private async refreshOneWinEvent(
    ref: string,
    dbEvent: {
      awayScore: null | number;
      awayTeam: string;
      bookmakerTitle: null | string;
      commenceTime: Date;
      completed: boolean;
      hasBroadcast: boolean;
      homeScore: null | number;
      homeTeam: string;
      id: string;
      leagueName: null | string;
      marketsJson: unknown;
      matchStateJson: unknown;
      oddsAway: Decimal | null;
      oddsDraw: Decimal | null;
      oddsHome: Decimal | null;
      slug: null | string;
      sportKey: string;
      tournamentId: null | number;
    },
    matchId: number,
    options?: RefreshEventOptions,
  ): Promise<WcOddsEventDetailDto | null> {
    this.onewin.warmMatchIds([matchId]);
    const waitMs =
      options?.forceFetch ||
      options?.oddsOnly ||
      this.hasEventSubscriber(ref, dbEvent)
        ? 1_200
        : 0;
    const [snapWait, oddsWait] =
      waitMs > 0
        ? await Promise.all([
            this.onewin.waitForSnapshot(matchId, waitMs),
            this.onewin.waitForOdds(matchId, waitMs),
          ])
        : [null, null];
    const snap = snapWait ?? this.onewin.getCachedSnapshot(matchId);
    const oddsSnap = oddsWait ?? this.onewin.getOddsSnapshot(matchId);

    const prevState = parseMatchState(dbEvent.matchStateJson) ?? emptyMatchState();
    const bestOf = resolveOneWinBestOf({
      leagueName: dbEvent.leagueName,
      oddsGroups: oddsSnap?.oddsGroups ?? [],
      prevState,
    });

    const result = resolveOneWinEsportsResult(
      {
        hasOpenOdds: snap?.hasOpenOdds ?? null,
        matchScore: snap?.matchScore ?? null,
        periodsScore: snap?.periodsScore ?? null,
        status: snap?.status ?? null,
      },
      { bestOf: bestOf ?? undefined },
    );

    // Never invent 0:0 when push has no matchScore yet — keep previous series score.
    const homeScore = snap?.matchScore
      ? result.homeScore
      : (dbEvent.homeScore ?? 0);
    const awayScore = snap?.matchScore
      ? result.awayScore
      : (dbEvent.awayScore ?? 0);

    const prevGrouped = (dbEvent.marketsJson ?? {}) as WcGroupedMarkets;
    const mapped = mapOneWinOddsToGroupedMarkets(
      oddsSnap?.oddsGroups ?? [],
      dbEvent.homeTeam,
      dbEvent.awayTeam,
    );
    const nextGrouped = mapped.groupedMarkets;
    const nextEmpty = Object.keys(nextGrouped).length === 0;
    // Prefer a fresh 1win book wholesale — patching kept stale `*_spreads` /
    // `HOME_2.5` rows beside the corrected `*_handicap` / `HOME_HCP_*` keys.
    const groupedMarkets =
      nextEmpty && Object.keys(prevGrouped).length > 0
        ? prevGrouped
        : Object.keys(nextGrouped).length > 0
          ? nextGrouped
          : prevGrouped;

    const oddsHome =
      mapped.oddsHome != null
        ? new Decimal(mapped.oddsHome)
        : dbEvent.oddsHome;
    const oddsDraw =
      mapped.oddsDraw != null
        ? new Decimal(mapped.oddsDraw)
        : dbEvent.oddsDraw;
    const oddsAway =
      mapped.oddsAway != null
        ? new Decimal(mapped.oddsAway)
        : dbEvent.oddsAway;

    const periodScores = result.periodScores;
    const details = periodScores.map(
      (p) => [p.home, p.away] as [number, number],
    );
    const parsedScore =
      details.length > 0 || snap?.matchScore
        ? {
            currentScore: [homeScore, awayScore] as [number, number],
            details: details.length > 0 ? details : undefined,
            period: details.length || undefined,
            text: {
              currentScore: `${homeScore}:${awayScore}`,
              details:
                details.length > 0
                  ? details.map((d) => `${d[0]}:${d[1]}`).join(', ')
                  : undefined,
            },
          }
        : null;

    const matchStateJson = {
      ...prevState,
      v: 1 as const,
      updatedAt: new Date().toISOString(),
      ...(bestOf != null
        ? { esports: { ...prevState.esports, bestOf } }
        : {}),
      result: {
        ...prevState.result,
        capturedAt: new Date().toISOString(),
        parsedScore: parsedScore ?? prevState.result?.parsedScore ?? null,
        periodScores:
          periodScores.length > 0
            ? periodScores.map((p) => ({ away: p.away, home: p.home }))
            : prevState.result?.periodScores,
      },
    };

    const completed = Boolean(dbEvent.completed) || result.completed;
    const bookOpen = isOneWinBookOpen(snap, completed);
    const marketsForClient = bookOpen
      ? groupedMarkets
      : markGroupedMarketsSuspended(groupedMarkets);
    const hasBroadcast =
      Boolean(snap?.broadcastUrl) || Boolean(dbEvent.hasBroadcast);

    const dto = this.eventToDto({
      ...dbEvent,
      awayScore,
      bookmakerTitle: '1win',
      completed,
      hasBroadcast,
      homeScore,
      marketsJson: marketsForClient,
      matchStateJson,
      oddsAway,
      oddsDraw,
      oddsHome,
      oddsUpdatedAt: new Date(),
    });
    dto.bookmaker = '1win';
    dto.hasBroadcast = hasBroadcast;
    if (parsedScore) dto.parsedScore = parsedScore;
    if (completed) {
      dto.phase = 'finished';
      dto.bettingOpen = false;
    } else {
      dto.phase = getWcEventPhase(false, dbEvent.commenceTime);
      dto.bettingOpen = bookOpen;
    }
    if (snap?.status) dto.feedStatus = snap.status;

    const detail: WcOddsEventDetailDto = {
      ...dto,
      groupedMarkets: marketsForClient,
    };

    this.eventCache.set(ref, detail);
    this.eventCache.set(dbEvent.id, detail);
    if (dbEvent.slug) this.eventCache.set(dbEvent.slug, detail);
    this.syncLineCacheEntry(dto, dbEvent);
    this.applyLiveCacheEntry(dto, dbEvent);
    this.pushEventIfChanged(ref, detail);

    const shouldPersist =
      options?.persistOdds === true ||
      options?.forceFetch === true ||
      Boolean(snap?.matchScore) ||
      Object.keys(nextGrouped).length > 0;

    if (shouldPersist) {
      await this.prisma.wcOddsEvent.update({
        data: {
          ...(Object.keys(nextGrouped).length > 0
            ? { marketsJson: groupedMarkets as object }
            : {}),
          awayScore,
          bookmakerKey: 'onewin',
          bookmakerTitle: '1win',
          completed,
          hasBroadcast,
          homeScore,
          matchStateJson: matchStateJson as object,
          oddsAway,
          oddsDraw,
          oddsHome,
          oddsUpdatedAt: new Date(),
        },
        where: { id: dbEvent.id },
      });
    }

    return detail;
  }

  async refreshEvent(
    ref: string,
    force = false,
    options?: RefreshEventOptions,
  ): Promise<WcOddsEventDetailDto | null> {
    const dbEvent = await this.findDbEvent(ref);
    if (!dbEvent) return null;

    let groupedMarkets = (dbEvent.marketsJson ??
      {}) as WcOddsEventDetailDto['groupedMarkets'];
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
        const useFullMarkets =
          !oddsOnly && !statsOnly && options?.fullMarkets === true;
        const skipStructuredStats =
          options?.skipStructuredStats === true || oddsOnly;
        const statsInterval = dbEvent.completed
          ? 10 * 60_000
          : hasEventSubscribers
            ? SUBSCRIBED_STATS_REFRESH_MS
            : STATS_REFRESH_MS;
        const lastStatsRefresh = this.lastStatsRefreshMs.get(dbEvent.id) ?? 0;
        const cachedStructuredBefore =
          this.structuredStatsCache.get(dbEvent.id) ?? null;
        const cacheEmpty = statListNeedsEnrichment(
          sportSlug,
          cachedStructuredBefore?.statList,
        );
        const fetchStructuredStats =
          !skipStructuredStats &&
          ((force && !dbEvent.completed) ||
            (cacheEmpty && lastStatsRefresh === 0) ||
            Date.now() - lastStatsRefresh >= statsInterval);

        const statsPayload = main
          ? await this.olimpbet.fetchEventStatsPayload(
              sportSlug,
              olimpbetId,
              main,
              {
                includeLinkedStats: hasEventSubscribers && fetchStructuredStats,
                skipStructuredFetch: !fetchStructuredStats,
              },
            )
          : null;

        if (fetchStructuredStats) {
          this.lastStatsRefreshMs.set(dbEvent.id, Date.now());
        }
        this.rememberStructuredStats(dbEvent.id, statsPayload);
        const cachedStructured =
          this.structuredStatsCache.get(dbEvent.id) ?? null;

        const prevCached =
          this.eventCache.get(ref) ?? this.eventCache.get(dbEvent.id) ?? null;

        const readLatestGrouped = (): WcGroupedMarkets =>
          (this.eventCache.get(ref)?.groupedMarkets ??
            this.eventCache.get(dbEvent.id)?.groupedMarkets ??
            prevCached?.groupedMarkets ??
            groupedMarkets) as WcGroupedMarkets;

        const prevGrouped = readLatestGrouped();

        const snapshot =
          main && !statsOnly
            ? useFullMarkets
              ? await this.olimpbet.buildFullSnapshotFromDetail(
                  main,
                  olimpbetId,
                )
              : oddsOnly
                ? await this.olimpbet.buildLineSnapshotFromDetail(
                    main,
                    olimpbetId,
                    { skipLogos: true },
                  )
                : null
            : null;

        if (snapshot) {
          const latestGrouped = readLatestGrouped();
          const snapshotEmpty =
            Object.keys(snapshot.groupedMarkets).length === 0;
          // Feed suspend often returns zero tradable markets — keep the last
          // known markets (they get marked suspended below) instead of wiping.
          if (
            snapshotEmpty &&
            !dbEvent.completed &&
            Object.keys(latestGrouped).length > 0
          ) {
            groupedMarkets = latestGrouped;
          } else {
            groupedMarkets = useFullMarkets
              ? mergeFullGroupedMarketsPreservingOdds(
                  snapshot.groupedMarkets,
                  latestGrouped,
                )
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

        let feedBettingOpen = isWcBettingOpen(
          dbEvent.completed,
          dbEvent.commenceTime,
        );
        let liveMatchState = parseMatchState(dbEvent.matchStateJson);

        // Olimpbet snapshot says no stream — cheap, cached check against the
        // 1win fixture index/push-feed before we hide the broadcast badge.
        // Cold 1win cache must NOT wipe a previously confirmed badge.
        let effectiveHasBroadcast = snapshot?.hasBroadcast;
        if (snapshot && !snapshot.hasBroadcast) {
          const likely = await this.onewin.hasLikelyBroadcast(
            dbEvent.commenceTime,
            dbEvent.homeTeam,
            dbEvent.awayTeam,
          );
          effectiveHasBroadcast = likely || Boolean(dbEvent.hasBroadcast);
        }

        // Cheap tracker badge from already-warm 1win snapshot (no wait).
        // Missing snapshot must not clear a previously confirmed tracker badge.
        const prevHasLiveTracker = Boolean(
          parseMatchState(dbEvent.matchStateJson)?.result?.hasLiveTracker,
        );
        let effectiveHasLiveTracker = prevHasLiveTracker;
        if (this.onewin.isEnabled()) {
          const owDirect = oneWinMatchIdFromWcEventId(dbEvent.id);
          const matchId =
            owDirect ??
            (
              await this.onewin.resolveFixture(
                dbEvent.commenceTime,
                dbEvent.homeTeam,
                dbEvent.awayTeam,
              )
            )?.matchId;
          if (matchId != null) {
            const snap = this.onewin.getCachedSnapshot(matchId);
            if (snap) {
              effectiveHasLiveTracker = Boolean(
                snap.liveTrackerUrl || snap.statisticsTrackerUrl,
              );
            }
          }
        }

        if (main) {
          const wasCompleted = dbEvent.completed;
          const homeScore =
            statsPayload?.homeScore ??
            this.olimpbet.extractScore(main).homeScore;
          const awayScore =
            statsPayload?.awayScore ??
            this.olimpbet.extractScore(main).awayScore;
          const completed = this.olimpbet.isEventCompleted(main);
          feedBettingOpen = this.olimpbet.isFeedBettingOpen(main);

          if (wasCompleted && !completed) {
            await this.settlement.reopenPrematureStandardBets(dbEvent.id);
          }

          const scorePatch =
            homeScore != null && awayScore != null
              ? { awayScore, completed, homeScore }
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
          if (effectiveHasBroadcast != null) {
            dbEvent.hasBroadcast = effectiveHasBroadcast;
          }

          if (!oddsOnly || force) {
            await this.prisma.wcOddsEvent.update({
              data: {
                ...scorePatch,
                awayCompetitorId: snapshot?.awayCompetitorId ?? undefined,
                hasBroadcast: effectiveHasBroadcast ?? undefined,
                homeCompetitorId: snapshot?.homeCompetitorId ?? undefined,
              },
              where: { id: dbEvent.id },
            });

            try {
              const matchState = await this.matchState.refreshAndSettle(
                dbEvent.id,
                dbEvent.sportKey,
                main,
                dbEvent.matchStateJson,
                statsPayload,
              );
              if (matchState) {
                liveMatchState = matchState;
                dbEvent.matchStateJson = matchState as object;
              }
              if (
                effectiveHasLiveTracker !== prevHasLiveTracker ||
                (effectiveHasLiveTracker &&
                  !Boolean(
                    parseMatchState(dbEvent.matchStateJson)?.result
                      ?.hasLiveTracker,
                  ))
              ) {
                const base =
                  parseMatchState(dbEvent.matchStateJson) ?? emptyMatchState();
                const patched = {
                  ...base,
                  result: {
                    ...base.result,
                    capturedAt:
                      base.result?.capturedAt ?? new Date().toISOString(),
                    hasLiveTracker: effectiveHasLiveTracker,
                  },
                  updatedAt: new Date().toISOString(),
                };
                await this.prisma.wcOddsEvent.update({
                  data: { matchStateJson: patched as object },
                  where: { id: dbEvent.id },
                });
                dbEvent.matchStateJson = patched as object;
                liveMatchState = patched;
              }
              if (statsPayload?.parsedScore && matchState) {
                enrichTennisParsedScoreLiveGame(
                  statsPayload.parsedScore,
                  main,
                  matchState,
                );
              }
              if (completed) {
                await this.settlement.trySettleEvent(dbEvent.id, main);
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              this.logger.warn(
                `Match state refresh failed for ${dbEvent.id}: ${message}`,
              );
            }
          }
        }

        if (main && phase === 'live' && !dbEvent.completed) {
          groupedMarkets = filterFinalizedScopeMarkets(
            groupedMarkets,
            main,
            liveMatchState,
          );
        }

        const dto = this.eventToDto({
          ...dbEvent,
          bookmakerTitle,
          marketsJson: groupedMarkets,
          oddsAway,
          oddsDraw,
          oddsHome,
          oddsUpdatedAt:
            statsOnly && prevCached?.oddsUpdatedAt
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
            awayTeamIcon: prevCached.awayTeamIcon,
            homeTeamIcon: prevCached.homeTeamIcon,
          };
        } else {
          [enrichedDto] = await this.olimpbet.enrichEventDtos(
            [dto],
            [
              {
                awayCompetitorId:
                  snapshot?.awayCompetitorId ?? dbEvent.awayCompetitorId,
                homeCompetitorId:
                  snapshot?.homeCompetitorId ?? dbEvent.homeCompetitorId,
              },
            ],
          );
        }

        const latestCached =
          this.eventCache.get(ref) ??
          this.eventCache.get(dbEvent.id) ??
          prevCached;

        const prevCachedList = this.liveCache.find(
          (event) => event.id === dbEvent.id,
        );

        const mergedDto = mergeLiveStatsFields(
          latestCached ?? prevCachedList,
          enrichedDto,
          statsPayload,
          cachedStructured,
          { preserveParsedScore: statsOnly },
        );

        if (snapshot?.homeTeamIcon)
          mergedDto.homeTeamIcon = snapshot.homeTeamIcon;
        if (snapshot?.awayTeamIcon)
          mergedDto.awayTeamIcon = snapshot.awayTeamIcon;
        if (effectiveHasBroadcast != null)
          mergedDto.hasBroadcast = effectiveHasBroadcast;
        mergedDto.hasLiveTracker = effectiveHasLiveTracker;
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
          const fresh =
            this.eventCache.get(ref) ?? this.eventCache.get(dbEvent.id);
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
            const concurrent =
              this.eventCache.get(ref) ?? this.eventCache.get(dbEvent.id);
            const startedAt = prevCached?.oddsUpdatedAt
              ? Date.parse(prevCached.oddsUpdatedAt)
              : 0;
            const concurrentAt = concurrent?.oddsUpdatedAt
              ? Date.parse(concurrent.oddsUpdatedAt)
              : 0;
            // If oddsOnly landed fresher prices while fullMarkets was in flight, keep them.
            if (concurrent?.groupedMarkets && concurrentAt > startedAt) {
              groupedMarkets = patchGroupedMarketsOdds(
                groupedMarkets,
                concurrent.groupedMarkets as WcGroupedMarkets,
              );
              if (concurrent.oddsHome != null)
                oddsHome = new Decimal(concurrent.oddsHome);
              if (concurrent.oddsDraw != null)
                oddsDraw = new Decimal(concurrent.oddsDraw);
              if (concurrent.oddsAway != null)
                oddsAway = new Decimal(concurrent.oddsAway);
            } else {
              if (snapshot.oddsHome) oddsHome = new Decimal(snapshot.oddsHome);
              if (snapshot.oddsDraw) oddsDraw = new Decimal(snapshot.oddsDraw);
              if (snapshot.oddsAway) oddsAway = new Decimal(snapshot.oddsAway);
            }
          } else {
            groupedMarkets = patchGroupedMarketsOdds(
              latestGrouped,
              snapshot.groupedMarkets,
            );
            if (snapshot.oddsHome) oddsHome = new Decimal(snapshot.oddsHome);
            if (snapshot.oddsDraw) oddsDraw = new Decimal(snapshot.oddsDraw);
            if (snapshot.oddsAway) oddsAway = new Decimal(snapshot.oddsAway);
          }
          mergedDto.oddsHome = oddsHome != null ? Number(oddsHome) : null;
          mergedDto.oddsDraw = oddsDraw != null ? Number(oddsDraw) : null;
          mergedDto.oddsAway = oddsAway != null ? Number(oddsAway) : null;
          mergedDto.oddsUpdatedAt = new Date().toISOString();
        }

        if (
          main &&
          !feedBettingOpen &&
          Object.keys(groupedMarkets).length > 0
        ) {
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

        // Persist even on oddsOnly — list cards read 1X2 from DB, and ingest is oddsOnly.
        // Skipping persist here left live rows with null oddsHome while eventCache had prices.
        const persistOdds =
          options?.persistOdds === true || force || useFullMarkets;
        if (persistOdds) {
          const marketsEmpty = Object.keys(groupedMarkets).length === 0;
          await this.prisma.wcOddsEvent.update({
            data: {
              bookmakerKey: bookmakerKey ?? undefined,
              bookmakerTitle: bookmakerTitle ?? undefined,
              oddsAway,
              oddsDraw,
              oddsHome,
              // oddsOnly patches into existing books — still write when we have content.
              // Never wipe a non-empty DB book with an empty snapshot.
              ...(!marketsEmpty || !oddsOnly
                ? { marketsJson: groupedMarkets as object }
                : {}),
              oddsUpdatedAt: new Date(),
            },
            where: { id: dbEvent.id },
          });
        }

        return detail;
      }
    }

    const oneWinMatchId = oneWinMatchIdFromWcEventId(dbEvent.id);
    if (oneWinMatchId && this.onewin.isEnabled()) {
      return this.refreshOneWinEvent(ref, dbEvent, oneWinMatchId, options);
    }

    const dto = this.eventToDto({
      ...dbEvent,
      bookmakerTitle,
      marketsJson: groupedMarkets,
      oddsAway,
      oddsDraw,
      oddsHome,
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
        data: {
          bookmakerKey: bookmakerKey ?? undefined,
          bookmakerTitle: bookmakerTitle ?? undefined,
          marketsJson: groupedMarkets as object,
          oddsAway,
          oddsDraw,
          oddsHome,
          oddsUpdatedAt: new Date(),
        },
        where: { id: dbEvent.id },
      });
    }

    return detail;
  }

  registerOddsUpdatedHandler(handler: (eventId: string) => void): void {
    this.oddsUpdatedHandler = handler;
  }

  /**
   * Lightweight odds read for bet placement — one Olimpbet detail fetch + line snapshot,
   * without stats ingest, match-state refresh, or DB writes.
   */
  async resolveBetPlacementSnapshot(
    ref: string,
    dbEvent: {
      awayTeam?: string;
      commenceTime: Date;
      completed: boolean;
      homeTeam?: string;
      id: string;
      leagueName?: null | string;
      marketsJson: unknown;
      matchStateJson?: unknown;
    },
    options?: {
      groupKey?: null | string;
      line?: null | string;
      marketKey?: string;
      outcomeKey?: null | string;
    },
  ): Promise<WcBetPlacementSnapshot | null> {
    const cached = this.eventCache.get(ref) ?? this.eventCache.get(dbEvent.id);
    let groupedMarkets = (cached?.groupedMarkets ??
      dbEvent.marketsJson ??
      {}) as WcGroupedMarkets;

    // Cybersport `ow-*`: book state comes from 1win push, not Olimpbet.
    const oneWinMatchId = oneWinMatchIdFromWcEventId(dbEvent.id);
    if (oneWinMatchId && this.onewin.isEnabled()) {
      this.onewin.warmMatchIds([oneWinMatchId]);
      const [snap, oddsSnap] = await Promise.all([
        this.onewin.waitForSnapshot(oneWinMatchId, 1_500),
        this.onewin.waitForOdds(oneWinMatchId, 1_500),
      ]);
      const info = snap ?? this.onewin.getCachedSnapshot(oneWinMatchId);
      const odds =
        oddsSnap ?? this.onewin.getOddsSnapshot(oneWinMatchId);
      if (
        odds?.oddsGroups?.length &&
        dbEvent.homeTeam &&
        dbEvent.awayTeam
      ) {
        const mapped = mapOneWinOddsToGroupedMarkets(
          odds.oddsGroups,
          dbEvent.homeTeam,
          dbEvent.awayTeam,
        );
        if (Object.keys(mapped.groupedMarkets).length > 0) {
          groupedMarkets = mapped.groupedMarkets;
        }
      }
      const bookOpen = isOneWinBookOpen(info, dbEvent.completed);
      if (!bookOpen && Object.keys(groupedMarkets).length > 0) {
        groupedMarkets = markGroupedMarketsSuspended(groupedMarkets);
      }
      return { bettingOpen: bookOpen, groupedMarkets, main: null };
    }

    const fallbackBettingOpen = isWcBettingOpen(
      dbEvent.completed,
      dbEvent.commenceTime,
    );

    if (!this.olimpbet.isEnabled()) {
      return { bettingOpen: fallbackBettingOpen, groupedMarkets, main: null };
    }

    const olimpbetId = olimpbetIdFromWcEventId(dbEvent.id);
    if (!olimpbetId) {
      return { bettingOpen: fallbackBettingOpen, groupedMarkets, main: null };
    }

    const main = await this.olimpbet.fetchEventDetail(olimpbetId, {
      force: true,
      locale: 'ru',
    });
    if (!main) {
      return { bettingOpen: fallbackBettingOpen, groupedMarkets, main: null };
    }

    const bettingOpen = this.olimpbet.isFeedBettingOpen(main);
    const lineSnapshot = await this.olimpbet.buildLineSnapshotFromDetail(
      main,
      olimpbetId,
      { skipLogos: true },
    );
    groupedMarkets = patchGroupedMarketsOdds(
      groupedMarkets,
      lineSnapshot.groupedMarkets,
    );

    const needsFullMarkets =
      Boolean(options?.outcomeKey) &&
      Boolean(options?.marketKey) &&
      findOutcomeOdds(
        groupedMarkets,
        options!.marketKey!,
        options!.outcomeKey!,
        options?.line ?? null,
        options?.groupKey ?? null,
      ) == null;

    if (needsFullMarkets) {
      const fullSnapshot = await this.olimpbet.buildFullSnapshotFromDetail(
        main,
        olimpbetId,
      );
      groupedMarkets = mergeFullGroupedMarketsPreservingOdds(
        fullSnapshot.groupedMarkets,
        groupedMarkets,
      );
    }

    if (main.live && !dbEvent.completed) {
      groupedMarkets = filterFinalizedScopeMarkets(
        groupedMarkets,
        main,
        parseMatchState(dbEvent.matchStateJson),
      );
    }
    if (!bettingOpen && Object.keys(groupedMarkets).length > 0) {
      groupedMarkets = markGroupedMarketsSuspended(groupedMarkets);
    }

    return { bettingOpen, groupedMarkets, main };
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
      forceFetch: true,
      oddsOnly: true,
      persistOdds: true,
      skipStructuredStats: true,
    }).then(() => {
      void this.refreshEvent(ref, false, {
        fullMarkets: true,
        persistOdds: true,
      });
    });
  }

  subscribeLine(): void {
    this.lineSubscribers += 1;
    void this.refreshLineFromDb();
    this.resetLineSentState();
    this.gateway.sendLineSnapshot(this.lineCache);
  }

  subscribeLive(): void {
    this.liveSubscribers += 1;
    void this.refreshLiveFromDb();
    this.resetLiveSentState();
    this.gateway.sendLiveSnapshot(this.liveCache);
  }

  unsubscribeEvent(ref: string): void {
    const n = (this.eventSubscribers.get(ref) ?? 1) - 1;
    if (n <= 0) this.eventSubscribers.delete(ref);
    else this.eventSubscribers.set(ref, n);
    this.rebuildIngestQueue();
  }

  unsubscribeLine(): void {
    this.lineSubscribers = Math.max(0, this.lineSubscribers - 1);
  }

  unsubscribeLive(): void {
    this.liveSubscribers = Math.max(0, this.liveSubscribers - 1);
  }
}
