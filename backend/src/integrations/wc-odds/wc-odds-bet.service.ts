import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OperationSource,
  OperationStatus,
  OperationType,
  WcOddsBetStatus,
  WcOddsEvent,
  WcOddsPick,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import type { OlimpbetApiLocale } from '~/common/locale/olimpbet-locale.util';

import { assertBonusMarketAllowed } from '~/main/bonus-balance/bonus-allowed-markets.util';
import { isBonusExpired } from '~/main/bonus-balance/bonus-expiry.util';
import {
  assertBonusOddsInRange,
  assertBonusStakeWithinLimit,
} from '~/main/bonus-balance/bonus-wager-limits.util';
import { completeBonusWageringIfNeeded } from '~/main/bonus-balance/complete-bonus-wagering.util';
import { OperationService } from '~/main/operation/operation.service';
import { PrismaService } from '~/prisma/prisma.service';
import {
  computeMainAccountBetDebit,
  toStakeNumber,
} from '~/shared/utils/balance-fractional-reserve.util';

import type {
  WcOddsEventDetailDto,
  WcOddsEventDto,
  WcTournamentDto,
} from './wc-odds.types';
import type { WcStatListItem } from './wc-odds-statistics.types';

import { CybersportService } from '../cybersport/cybersport.service';
import {
  isCyberGameRef,
  olimpbetIdFromCyberGameRef,
} from '../cybersport/cybersport-mask.util';
import {
  extractOlimpbetHeadToHeadId,
  sportRadarMatchNumericId,
} from '../olimpbet-wc/olimpbet-head-to-head.util';
import {
  compareOlimpbetPriority,
  isOlimpbetPriorityLevel,
} from '../olimpbet-wc/olimpbet-priority.util';
import { isMarketScopeFinalized } from '../olimpbet-wc/olimpbet-score-scope.util';
import {
  isOlimpbetEsportsSportId,
  olimpbetSportKeyToSlug,
} from '../olimpbet-wc/olimpbet-sport.util';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';
import { OneWinWcService } from '../onewin-wc/onewin-wc.service';
import {
  buildKickPlayerUrl,
  extractKickChannelFromPlayerUrl,
  isKickPlayerUrl,
  kickChannelFromStreamUrl,
} from './kick-broadcast.util';
import {
  buildTwitchPlayerUrl,
  extractTwitchLoginFromUrl,
  isTwitchPlayerUrl,
} from './twitch-en-broadcast.util';
import { buildBetPlacementContext } from './wc-bet-placement-context.util';
import { buildWcBetShareSvg, buildWcBetShareText } from './wc-bet-share.util';
import {
  isWcBettingOpen,
  wcLineEventWhere,
  wcLiveEventWhere,
} from './wc-betting.util';
import { WcBroadcastProxyService } from './wc-broadcast-proxy.service';
import { buildWcOddsEventDto } from './wc-event-dto.util';
import {
  type HomepageWidgetItem,
  buildHomepageWidgets,
} from './wc-home-widgets.util';
import {
  WC_LINE_HOUR_OPTIONS,
  type WcLineHoursFilter,
  parseWcLineHoursFilter,
  wcLineCommenceTimeRange,
} from './wc-line-time.util';
import { isWcEventVisibleInLiveList } from './wc-live-visibility.util';
import { emptyMatchState, parseMatchState } from './wc-match-state.types';
import { advanceMatchState } from './wc-match-state-tracker.util';
import {
  type WcGroupedMarkets,
  findMarketGroup,
  findMarketOutcome,
  findOutcomeOdds,
  isTotalsMarketKey,
  isWcBetPlacementAllowed,
  normalizeWcMarketKey,
  outcomeKeyToPick,
} from './wc-odds-markets.util';
import { WcOddsRealtimeService } from './wc-odds-realtime.service';
import {
  wcOddsMaxStakeForCurrency,
  wcOddsMinStakeForCurrency,
} from './wc-odds-stake.util';
import { pickRicherStatList } from './wc-odds-statistics.util';
import {
  publicIdToInternal,
  resolveEventRef,
  sanitizePublicEventDetail,
  sanitizePublicEventDto,
  sanitizePublicEventList,
  toPublicEventId,
  toPublicRef,
} from './wc-public.util';
import { resolveBetPlacementScope } from './wc-scope-market-filter.util';
import {
  isWcEventId,
  olimpbetIdFromSlugHint,
  olimpbetIdFromWcEventId,
  oneWinMatchIdFromWcEventId,
  stripLegacyHashFromSlug,
  wcEventIdFromOlimpbet,
} from './wc-slug.util';
import {
  wcLeagueNameFromSportKey,
  wcSlugToSportKey,
  wcSportKeyToSlug,
} from './wc-sport.util';
import {
  buildH2hStandalonePage,
  fetchStatshubAsset,
  fetchStatshubMatchEmbedHtml,
} from './wc-statshub-embed.util';
import { buildTotalsOutcomeName } from './wc-totals-outcome-name.util';

const HOMEPAGE_WIDGETS_CACHE_MS = 15_000;

@Injectable()
export class WcOddsBetService {
  private homepageWidgetsCache: {
    expiresAt: number;
    payload: { items: HomepageWidgetItem[] };
  } | null = null;
  private readonly lineOrderBy = [
    { priorityLevel: 'desc' as const },
    { leagueName: 'asc' as const },
    { commenceTime: 'asc' as const },
    { id: 'asc' as const },
  ];

  private readonly liveOrderBy = [
    { priorityLevel: 'desc' as const },
    { leagueName: 'asc' as const },
    { commenceTime: 'desc' as const },
    { id: 'asc' as const },
  ];

  private readonly logger = new Logger(WcOddsBetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly realtime: WcOddsRealtimeService,
    private readonly config: ConfigService,
    private readonly broadcastProxy: WcBroadcastProxyService,
    private readonly cybersport: CybersportService,
    private readonly onewin: OneWinWcService,
  ) {}

  private aggregateTournaments(
    rows: Array<{
      leagueName: null | string;
      priorityLevel?: null | number;
      tournamentId: null | number;
    }>,
  ): WcTournamentDto[] {
    const map = new Map<string, { priorityLevel: number } & WcTournamentDto>();

    for (const row of rows) {
      const leagueName = row.leagueName?.trim() || 'Imba';
      const key =
        row.tournamentId != null
          ? `id:${row.tournamentId}`
          : `name:${leagueName}`;
      const rowPriority = row.priorityLevel ?? 0;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.priorityLevel = Math.max(existing.priorityLevel, rowPriority);
        existing.isPriority = isOlimpbetPriorityLevel(existing.priorityLevel);
        continue;
      }
      map.set(key, {
        count: 1,
        isPriority: isOlimpbetPriorityLevel(rowPriority),
        leagueName,
        priorityLevel: rowPriority,
        tournamentId: row.tournamentId,
      });
    }

    return [...map.values()].sort(
      (a, b) =>
        compareOlimpbetPriority(a.priorityLevel, b.priorityLevel) ||
        b.count - a.count ||
        a.leagueName.localeCompare(b.leagueName, 'ru'),
    );
  }

  private assertEnabled() {
    if (!this.olimpbet.isEnabled()) {
      throw new ForbiddenException('WC odds module is disabled');
    }
  }

  private buildBetListEventPayload(
    internalId: string,
    slug: null | string,
    base: import('./wc-odds.types').WcOddsEventDto,
  ) {
    const merged = this.mergeBetEventFromCache(internalId, slug, base);
    return {
      awayScore: merged.awayScore,
      awayTeam: merged.awayTeam,
      awayTeamIcon: merged.awayTeamIcon ?? null,
      commenceTime: merged.commenceTime,
      completed: merged.completed,
      homeScore: merged.homeScore,
      homeTeam: merged.homeTeam,
      homeTeamIcon: merged.homeTeamIcon ?? null,
      id: merged.id,
      leagueName: merged.leagueName,
      parsedScore: merged.parsedScore ?? null,
      phase: merged.phase,
      slug: merged.slug,
      sport: merged.sport,
    };
  }

  private buildLineWhere(
    hoursFilter: WcLineHoursFilter = 'all',
    date?: string,
    sportKey?: null | string,
  ) {
    const now = new Date();
    const range = wcLineCommenceTimeRange(now, hoursFilter, sportKey);
    const commenceTime: { gt: Date; gte?: Date; lt?: Date; lte: Date } = {
      gt: range.gt,
      lte: range.lte,
    };

    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      commenceTime.gte = start;
      commenceTime.lt = end;
    }

    return {
      commenceTime,
      completed: false as const,
    };
  }

  private buildTournamentFilter(tournamentId?: string, league?: string) {
    if (tournamentId) {
      const id = parseInt(tournamentId, 10);
      if (Number.isFinite(id)) return { tournamentId: id };
    }
    if (league) return { leagueName: decodeURIComponent(league) };
    return {};
  }

  private async fetchVisibleLiveEvents(
    where: Record<string, unknown>,
    needed: number,
    locale: OlimpbetApiLocale = 'ru',
  ): Promise<WcOddsEventDto[]> {
    const visible: WcOddsEventDto[] = [];
    let dbSkip = 0;
    const batchSize = 50;
    const maxBatches = 8; // never scan more than 400 rows for a list request
    let batches = 0;

    while (visible.length < needed && batches < maxBatches) {
      const events = await this.prisma.wcOddsEvent.findMany({
        orderBy: this.liveOrderBy,
        skip: dbSkip,
        take: batchSize,
        where,
      });
      if (events.length === 0) break;
      dbSkip += events.length;
      batches += 1;

      const dtos = this.mergeLiveEventStatsFromCache(
        await this.toDtos(events, { locale, logosCacheOnly: true }),
      );
      for (const dto of dtos) {
        if (isWcEventVisibleInLiveList(dto)) visible.push(dto);
      }

      if (events.length < batchSize) break;
    }

    return visible;
  }

  private async mapBetsToPublicDtos(
    rows: Array<
      { event: WcOddsEvent | null } & import('@prisma/client').WcOddsBet
    >,
  ) {
    const uniqueEvents = [
      ...new Map(
        rows
          .map((bet) => bet.event)
          .filter((event): event is WcOddsEvent => Boolean(event))
          .map((event) => [event.id, event]),
      ).values(),
    ];

    const publicDtos = uniqueEvents.length
      ? await this.toPublicDtos(uniqueEvents)
      : [];
    const dtoByInternalId = new Map(
      uniqueEvents.map((event, index) => [event.id, publicDtos[index]!]),
    );

    return rows.map((bet) => {
      const eventRow = bet.event;
      const baseDto = eventRow ? dtoByInternalId.get(eventRow.id) : undefined;
      const event =
        baseDto && eventRow
          ? this.buildBetListEventPayload(eventRow.id, eventRow.slug, baseDto)
          : eventRow
            ? {
                awayScore: eventRow.awayScore,
                awayTeam: eventRow.awayTeam,
                commenceTime: eventRow.commenceTime.toISOString(),
                completed: eventRow.completed,
                homeScore: eventRow.homeScore,
                homeTeam: eventRow.homeTeam,
                id: toPublicEventId(eventRow.id),
                leagueName: eventRow.leagueName ?? undefined,
                slug: eventRow.slug ?? undefined,
                sport: undefined,
              }
            : null;

      return {
        cashoutAmount:
          bet.cashoutAmount != null
            ? Number(bet.cashoutAmount).toFixed(2)
            : null,
        createdAt: bet.createdAt.toISOString(),
        currencyCode: bet.currencyCode,
        event,
        id: bet.id,
        line: bet.line,
        marketKey: bet.marketKey,
        odds: Number(bet.odds).toFixed(2),
        outcomeKey: bet.outcomeKey,
        outcomeName: bet.outcomeName,
        pick: bet.pick,
        potentialPayout: Number(bet.potentialPayout).toFixed(2),
        stake: Number(bet.stake).toFixed(2),
        status: bet.status,
      };
    });
  }

  private mergeBetEventFromCache(
    internalId: string,
    slug: null | string,
    base: import('./wc-odds.types').WcOddsEventDto,
  ): import('./wc-odds.types').WcOddsEventDto {
    const fromLive = this.realtime
      .getLiveCache()
      .find((event) => event.id === internalId);
    const fromLine = fromLive
      ? null
      : this.realtime.getLineCache().find((event) => event.id === internalId);
    const cachedDetail =
      this.realtime.getEventCache(slug ?? internalId) ??
      this.realtime.getEventCache(base.slug) ??
      null;
    const structured = this.realtime.getStructuredStatsCache(internalId);
    const source = fromLive ?? fromLine ?? cachedDetail;

    if (source) {
      return sanitizePublicEventDto({
        ...base,
        ...source,
        awayScore: source.awayScore ?? base.awayScore,
        awayTeamIcon: source.awayTeamIcon ?? base.awayTeamIcon,
        completed: source.completed ?? base.completed,
        homeScore: source.homeScore ?? base.homeScore,
        homeTeamIcon: source.homeTeamIcon ?? base.homeTeamIcon,
        id: base.id,
        parsedScore:
          source.parsedScore ??
          base.parsedScore ??
          structured?.parsedScore ??
          null,
        phase: source.phase ?? base.phase,
        slug: source.slug || base.slug,
        statList: source.statList?.length
          ? source.statList
          : (structured?.statList ?? base.statList),
      });
    }

    if (structured) {
      return sanitizePublicEventDto({
        ...base,
        parsedScore: structured.parsedScore ?? base.parsedScore ?? null,
        statList: structured.statList?.length
          ? structured.statList
          : base.statList,
      });
    }

    return base;
  }

  /** Merge realtime cache stats for live list cards (no blocking Olimpbet calls). */
  private mergeLiveEventStatsFromCache(
    dtos: WcOddsEventDto[],
  ): WcOddsEventDto[] {
    if (dtos.length === 0) return dtos;

    const cacheById = new Map(
      this.realtime.getLiveCache().map((e) => [e.id, e]),
    );

    return dtos.map((dto) => {
      const cached = cacheById.get(dto.id);
      const structuredCache = this.realtime.getStructuredStatsCache(dto.id);

      return {
        ...dto,
        awayScore: cached?.awayScore ?? dto.awayScore,
        hasBroadcast: Boolean(cached?.hasBroadcast || dto.hasBroadcast),
        hasLiveTracker: Boolean(
          cached?.hasLiveTracker || dto.hasLiveTracker,
        ),
        homeScore: cached?.homeScore ?? dto.homeScore,
        oddsAway: cached?.oddsAway ?? dto.oddsAway,
        oddsDraw: cached?.oddsDraw ?? dto.oddsDraw,
        oddsHome: cached?.oddsHome ?? dto.oddsHome,
        parsedScore:
          cached?.parsedScore ??
          structuredCache?.parsedScore ??
          dto.parsedScore,
        phase: cached?.phase ?? dto.phase,
        statList:
          pickRicherStatList(
            pickRicherStatList(cached?.statList, structuredCache?.statList),
            dto.statList,
          ) ?? dto.statList,
      };
    });
  }

  private async resolveEventBroadcastPayload(
    event: WcOddsEvent,
    ref: string,
    requestHost?: string,
  ) {
    const publicRef = event.slug?.trim() || toPublicEventId(event.id);

    // 1win-native events (cybersport + enriched ow-*): never call Olimpbet.
    const oneWinMatchId = oneWinMatchIdFromWcEventId(event.id);
    if (oneWinMatchId) {
      const oneWinDirect = await this.tryOneWinBroadcastByMatchId(
        oneWinMatchId,
        publicRef,
        requestHost,
      );
      if (oneWinDirect) return oneWinDirect;

      // Cybersport: no ESL/Blast Kick/Twitch fallbacks — only 1win (or partner Kick unwrap).
      return { available: false, streamType: null, streamUrl: null };
    }

    const olimpbetId = await this.resolveOlimpbetIdForBroadcast(event, ref);
    if (!olimpbetId) {
      const oneWinFallback = await this.tryOneWinBroadcastFallback(
        event,
        publicRef,
        requestHost,
      );
      if (oneWinFallback) return oneWinFallback;
      return { available: false, streamType: null, streamUrl: null };
    }

    const sportMatch = /^olimp_(\d+)$/.exec(event.sportKey ?? '');
    const preferIframe = sportMatch
      ? isOlimpbetEsportsSportId(Number(sportMatch[1]))
      : false;

    const payload = await this.olimpbet.fetchEventBroadcast(olimpbetId, {
      preferIframe,
    });

    const kickFromUrl = kickChannelFromStreamUrl(payload.streamUrl);

    const buildKickResponse = (channel: string, isFallback = false) => {
      const kickUrl = buildKickPlayerUrl(channel, requestHost);
      this.broadcastProxy.rememberEmbed(publicRef, kickUrl);
      return {
        available: true,
        kickChannel: channel,
        provider: 'kick' as const,
        streamFallback: isFallback,
        streamType: 'iframe' as const,
        streamUrl: kickUrl,
      };
    };

    if (preferIframe) {
      const hlsUrl =
        payload.hlsFallbackUrl ??
        (payload.streamType === 'hls' && payload.streamUrl?.includes('.m3u8')
          ? payload.streamUrl
          : null);
      const olimpbetIframeUrl =
        payload.iframeFallbackUrl ??
        (payload.streamType === 'iframe' &&
        payload.streamUrl &&
        !isKickPlayerUrl(payload.streamUrl)
          ? payload.streamUrl
          : null);

      // Kick only for Affilator partners — never ESL/Blast tournament mirrors.
      if (kickFromUrl && (await this.isPartnerKickChannel(kickFromUrl))) {
        return buildKickResponse(kickFromUrl, false);
      }

      // Prefer proxied HLS (hls.js) over Sportboom iframe — iframe /js assets break on our domain.
      if (hlsUrl) {
        this.broadcastProxy.rememberUpstream(publicRef, hlsUrl);
        return {
          available: true,
          provider: 'sportboom',
          streamType: 'hls',
          streamUrl: `/api/feed/events/${encodeURIComponent(publicRef)}/v?t=${Date.now()}`,
        };
      }

      // This match's Olimpbet embed — before 1win fallback.
      if (
        olimpbetIframeUrl &&
        !/^https:\/\/player\.twitch\.tv\//i.test(olimpbetIframeUrl)
      ) {
        this.broadcastProxy.rememberEmbed(publicRef, olimpbetIframeUrl);
        return {
          available: true,
          provider: 'sportboom',
          streamType: 'iframe',
          streamUrl: `/api/feed/events/${encodeURIComponent(publicRef)}/view`,
        };
      }

      const oneWinEsportsFallback = await this.tryOneWinBroadcastFallback(
        event,
        publicRef,
        requestHost,
      );
      if (oneWinEsportsFallback) return oneWinEsportsFallback;

      return { available: false, streamType: null, streamUrl: null };
    }

    // Regular sportsbook — Olimpbet HLS/iframe only; never fall back to esports Kick/Twitch.
    if (payload.streamType === 'hls' && payload.streamUrl) {
      this.broadcastProxy.rememberUpstream(publicRef, payload.streamUrl);
      return {
        available: payload.available,
        streamType: 'hls',
        streamUrl: `/api/feed/events/${encodeURIComponent(publicRef)}/v?t=${Date.now()}`,
      };
    }

    if (payload.streamType === 'iframe' && payload.streamUrl) {
      if (/twitch\.tv/i.test(payload.streamUrl)) {
        return { available: false, streamType: null, streamUrl: null };
      }
      this.broadcastProxy.rememberEmbed(publicRef, payload.streamUrl);
      return {
        available: payload.available,
        streamType: 'iframe',
        streamUrl: `/api/feed/events/${encodeURIComponent(publicRef)}/view`,
      };
    }

    const oneWinFallback = await this.tryOneWinBroadcastFallback(
      event,
      publicRef,
      requestHost,
    );
    if (oneWinFallback) return oneWinFallback;

    return {
      available: payload.available,
      streamType: null,
      streamUrl: null,
    };
  }

  private async resolveHeadToHeadNumericId(
    ref: string,
  ): Promise<null | string> {
    const cached = this.realtime.getEventCache(ref);
    let olimpbetId = cached?.olimpbetEventId ?? null;

    if (!olimpbetId) {
      const event = await this.findEventByRef(ref);
      if (!event) return null;
      olimpbetId = olimpbetIdFromWcEventId(event.id);
    }

    if (!olimpbetId) return null;

    const main = await this.olimpbet.fetchEventDetail(olimpbetId, {
      locale: 'ru',
    });
    const headToHeadId = extractOlimpbetHeadToHeadId(main);
    if (!headToHeadId) return null;

    return sportRadarMatchNumericId(headToHeadId);
  }

  private async resolveOlimpbetIdForBroadcast(
    event: WcOddsEvent,
    ref: string,
  ): Promise<null | number> {
    const fromId = olimpbetIdFromWcEventId(event.id);
    if (fromId) return fromId;

    const hints = [ref, event.slug, decodeURIComponent(ref)].filter(
      Boolean,
    ) as string[];
    for (const hint of hints) {
      if (isCyberGameRef(hint)) {
        const cyberId = olimpbetIdFromCyberGameRef(hint);
        if (cyberId) return cyberId;
      }
      const slugHint = olimpbetIdFromSlugHint(hint);
      if (slugHint) {
        const parsed = olimpbetIdFromWcEventId(slugHint);
        if (parsed) return parsed;
      }
    }

    if (event.homeTeam && event.awayTeam && event.commenceTime) {
      return this.olimpbet.resolveOlimpbetEventIdByTeams(
        event.commenceTime,
        event.homeTeam,
        event.awayTeam,
      );
    }

    return null;
  }

  /**
   * Live Tracker widget URL + corner/card micro-stats — bonus enrichment
   * pulled from the same 1win fixture match used for the video fallback.
   * Independent of whether video itself was found (tracker has no video).
   */
  private async resolveOneWinExtras(
    event: Pick<
      WcOddsEvent,
      'awayTeam' | 'bookmakerKey' | 'commenceTime' | 'homeTeam' | 'id' | 'sportKey'
    >,
  ): Promise<{
    liveTrackerUrl: null | string;
    microStatList: WcStatListItem[];
  }> {
    if (!this.onewin.isEnabled())
      return { liveTrackerUrl: null, microStatList: [] };

    // Direct path for events already linked to a 1win match (esports primary line).
    const owMatchId = oneWinMatchIdFromWcEventId(event.id);
    if (owMatchId) {
      this.onewin.warmMatchIds([owMatchId]);
      const snapshot = await this.onewin.waitForSnapshot(owMatchId, 5_000, {
        force: true,
      });
      const tracker =
        snapshot?.liveTrackerUrl ??
        snapshot?.statisticsTrackerUrl ??
        this.onewin.getLiveTrackerUrl(owMatchId) ??
        this.onewin.getEsportsStatisticsTrackerUrl(owMatchId);
      return { liveTrackerUrl: tracker, microStatList: [] };
    }

    const fixture = await this.onewin.resolveFixture(
      event.commenceTime,
      event.homeTeam,
      event.awayTeam,
    );
    if (!fixture) return { liveTrackerUrl: null, microStatList: [] };

    this.onewin.warmFixture(fixture);
    const snapshot = await this.onewin.waitForSnapshot(fixture.matchId, 5_000, {
      force: true,
    });
    const tracker =
      snapshot?.liveTrackerUrl ??
      snapshot?.statisticsTrackerUrl ??
      this.onewin.getLiveTrackerUrl(fixture.matchId) ??
      (fixture.isEsport
        ? this.onewin.getEsportsStatisticsTrackerUrl(fixture.matchId)
        : null);
    return {
      liveTrackerUrl: tracker,
      microStatList: this.onewin.getMicroStatList(fixture),
    };
  }

  private toDto(event: {
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

  private async toDtos(
    events: Array<Parameters<WcOddsBetService['toDto']>[0]>,
    options?: { locale?: OlimpbetApiLocale; logosCacheOnly?: boolean },
  ): Promise<WcOddsEventDto[]> {
    const dtos = events.map((event) => this.toDto(event));
    const withLogos = await this.olimpbet.enrichEventDtos(dtos, events, {
      cacheOnly: options?.logosCacheOnly === true,
    });
    return this.olimpbet.localizeEventDtos(withLogos, options?.locale);
  }

  private async toPublicDtos(
    events: Array<Parameters<WcOddsBetService['toDto']>[0]>,
    locale: OlimpbetApiLocale = 'ru',
  ): Promise<WcOddsEventDto[]> {
    return sanitizePublicEventList(
      await this.toDtos(events, { locale, logosCacheOnly: true }),
    );
  }

  /**
   * Direct 1win stream by matchId (cybersport ow-* events). No team matching.
   */
  private async isPartnerKickChannel(channel: string): Promise<boolean> {
    const slug = channel.trim().toLowerCase();
    if (!slug) return false;
    const found = await this.prisma.affilator.findFirst({
      where: {
        status: 'ACTIVE',
        kickChannelSlug: { equals: slug, mode: 'insensitive' },
      },
      select: { userId: true },
    });
    return Boolean(found);
  }

  private async tryOneWinBroadcastByMatchId(
    matchId: number,
    publicRef: string,
    requestHost?: string,
  ): Promise<{
    available: boolean;
    kickChannel?: string;
    provider?: 'onewin' | 'kick' | 'twitch';
    streamFallback?: boolean;
    streamType: 'hls' | 'iframe' | null;
    streamUrl: null | string;
    twitchChannel?: string;
  } | null> {
    if (!this.onewin.isEnabled()) return null;

    this.onewin.warmMatchIds([matchId]);
    const payload = await this.onewin.fetchEventBroadcast(matchId);
    if (!payload.available || !payload.streamUrl) return null;

    if (payload.streamType === 'hls') {
      this.broadcastProxy.rememberUpstream(publicRef, payload.streamUrl);
      return {
        available: true,
        provider: 'onewin',
        streamType: 'hls',
        streamUrl: `/api/feed/events/${encodeURIComponent(publicRef)}/v?t=${Date.now()}`,
      };
    }

    // Unwrap Kick only for Affilator partners — never ESL/Blast public channels.
    if (isKickPlayerUrl(payload.streamUrl)) {
      const channel = extractKickChannelFromPlayerUrl(payload.streamUrl);
      if (channel && (await this.isPartnerKickChannel(channel))) {
        const kickUrl = buildKickPlayerUrl(channel, requestHost);
        this.broadcastProxy.rememberEmbed(publicRef, kickUrl);
        return {
          available: true,
          kickChannel: channel,
          provider: 'kick',
          streamFallback: false,
          streamType: 'iframe',
          streamUrl: kickUrl,
        };
      }
      // Non-partner Kick from 1win — keep sportplayer shell as onewin below.
    }
    if (isTwitchPlayerUrl(payload.streamUrl)) {
      const channel = extractTwitchLoginFromUrl(payload.streamUrl);
      if (channel) {
        return {
          available: true,
          provider: 'twitch',
          streamFallback: false,
          streamType: 'iframe',
          streamUrl: buildTwitchPlayerUrl(channel, requestHost),
          twitchChannel: channel,
        };
      }
    }

    this.broadcastProxy.rememberEmbed(publicRef, payload.streamUrl);
    return {
      available: true,
      provider: 'onewin',
      streamType: 'iframe',
      streamUrl: `/api/feed/events/${encodeURIComponent(publicRef)}/view`,
    };
  }

  /**
   * Fallback video for Olimpbet sports events with no native stream —
   * resolve 1win matchId by team+kickoff, then proxy the stream.
   */
  private async tryOneWinBroadcastFallback(
    event: Pick<WcOddsEvent, 'awayTeam' | 'commenceTime' | 'homeTeam'>,
    publicRef: string,
    requestHost?: string,
  ): Promise<{
    available: boolean;
    kickChannel?: string;
    provider?: 'onewin' | 'kick' | 'twitch';
    streamFallback?: boolean;
    streamType: 'hls' | 'iframe' | null;
    streamUrl: null | string;
    twitchChannel?: string;
  } | null> {
    if (!this.onewin.isEnabled()) return null;

    const fixture = await this.onewin.resolveFixture(
      event.commenceTime,
      event.homeTeam,
      event.awayTeam,
    );
    if (!fixture) return null;

    this.onewin.warmFixture(fixture);
    return this.tryOneWinBroadcastByMatchId(
      fixture.matchId,
      publicRef,
      requestHost,
    );
  }

  async findEventByRef(ref: string): Promise<WcOddsEvent | null> {
    let decoded = resolveEventRef(ref);

    if (isCyberGameRef(decoded)) {
      const cyberId = olimpbetIdFromCyberGameRef(decoded);
      if (cyberId) {
        // Cybersport is 1win-only — never resolve to Olimpbet ol-* events.
        return this.prisma.wcOddsEvent.findUnique({
          where: { id: `ow-${cyberId}` },
        });
      }
    }

    if (isWcEventId(decoded)) {
      return this.prisma.wcOddsEvent.findUnique({ where: { id: decoded } });
    }

    const cleanSlug = stripLegacyHashFromSlug(decoded);
    const bySlug = await this.prisma.wcOddsEvent.findUnique({
      where: { slug: cleanSlug },
    });
    if (bySlug) return bySlug;

    if (cleanSlug !== decoded) {
      const byLegacySlug = await this.prisma.wcOddsEvent.findUnique({
        where: { slug: decoded },
      });
      if (byLegacySlug) return byLegacySlug;
    }

    const idHint = olimpbetIdFromSlugHint(decoded);
    if (idHint) {
      return this.prisma.wcOddsEvent.findUnique({ where: { id: idHint } });
    }

    return null;
  }

  async getAdminBetHealthStats(hours = 24) {
    this.assertEnabled();
    const since = new Date(Date.now() - hours * 3_600_000);

    const [voidByMarket, pendingOnCompleted, statusTotals, stalePending] =
      await Promise.all([
        this.prisma.wcOddsBet.groupBy({
          _count: { id: true },
          by: ['marketKey'],
          orderBy: { _count: { id: 'desc' } },
          take: 15,
          where: {
            isProbe: false,
            settledAt: { gte: since },
            status: WcOddsBetStatus.VOID,
          },
        }),
        this.prisma.wcOddsBet.count({
          where: {
            event: { completed: true },
            isProbe: false,
            status: WcOddsBetStatus.PENDING,
          },
        }),
        this.prisma.wcOddsBet.groupBy({
          _count: { id: true },
          by: ['status'],
          where: { isProbe: false },
        }),
        this.prisma.wcOddsBet.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            event: { select: { awayTeam: true, homeTeam: true, slug: true } },
            id: true,
            marketKey: true,
            outcomeKey: true,
          },
          take: 10,
          where: {
            event: { completed: true },
            isProbe: false,
            status: WcOddsBetStatus.PENDING,
          },
        }),
      ]);

    return {
      hours,
      pendingOnCompleted,
      stalePending,
      statusTotals: Object.fromEntries(
        statusTotals.map((row) => [row.status, row._count.id]),
      ),
      voidLastPeriod: voidByMarket.map((row) => ({
        count: row._count.id,
        marketKey: row.marketKey,
      })),
    };
  }

  async getBetShare(userId: number, betId: number) {
    this.assertEnabled();
    const bet = await this.prisma.wcOddsBet.findFirst({
      include: { event: true },
      where: { id: betId, isProbe: false, userId },
    });
    if (!bet || !bet.event) throw new NotFoundException('Bet not found');

    const baseUrl = (
      this.config.get<string>('BASE_URL') || 'https://imba.bet'
    ).replace(/\/$/, '');
    const shareInput = {
      awayTeam: bet.event.awayTeam,
      commenceTime: bet.event.commenceTime.toISOString(),
      currencyCode: bet.currencyCode,
      eventSlug: bet.event.slug,
      homeTeam: bet.event.homeTeam,
      id: bet.id,
      odds: Number(bet.odds).toFixed(2),
      outcomeName: bet.outcomeName,
      potentialPayout: Number(bet.potentialPayout).toFixed(2),
      stake: Number(bet.stake).toFixed(2),
      status: bet.status,
    };

    return {
      svg: buildWcBetShareSvg(shareInput),
      text: buildWcBetShareText(shareInput, baseUrl),
      url: shareInput.eventSlug
        ? `${baseUrl}/game/${shareInput.eventSlug}`
        : baseUrl,
    };
  }

  async getEventBroadcast(ref: string, requestHost?: string) {
    this.assertEnabled();

    const event = await this.findEventByRef(ref);
    if (!event) throw new NotFoundException('Event not found');

    const extrasPromise = this.resolveOneWinExtras(event).catch(() => ({
      liveTrackerUrl: null,
      microStatList: [] as WcStatListItem[],
    }));
    const result = await this.resolveEventBroadcastPayload(
      event,
      ref,
      requestHost,
    );
    const extras = await extrasPromise;

    if (result.available && !event.hasBroadcast) {
      void this.prisma.wcOddsEvent
        .update({
          data: { hasBroadcast: true },
          where: { id: event.id },
        })
        .then(() => {
          this.realtime.patchLiveCacheMediaFlags(event.id, {
            hasBroadcast: true,
          });
        })
        .catch(() => undefined);
    }
    if (extras.liveTrackerUrl) {
      void this.persistLiveTrackerFlag(event.id, true);
    }

    return {
      ...result,
      ...(extras.liveTrackerUrl
        ? { liveTrackerUrl: extras.liveTrackerUrl }
        : {}),
      ...(extras.microStatList.length > 0
        ? { microStatList: extras.microStatList }
        : {}),
    };
  }

  async getEventDetail(
    ref: string,
    locale: OlimpbetApiLocale = 'ru',
    options?: { sync?: boolean },
  ): Promise<{ syncOk?: boolean } & WcOddsEventDetailDto> {
    this.assertEnabled();

    const eventRow = await this.findEventByRef(ref);
    let base: WcOddsEventDetailDto | null = null;
    let syncOk = !options?.sync;

    if (options?.sync) {
      // Fast path: force main-event odds only (linked fullMarkets is too slow for page open).
      // Full markets catch up via focused ingest in the background.
      const SYNC_BUDGET_MS = 2_500;
      let refreshed: WcOddsEventDetailDto | null = null;
      try {
        refreshed = await Promise.race([
          this.realtime.refreshEvent(ref, true, {
            forceFetch: true,
            oddsOnly: true,
            persistOdds: true,
            skipStructuredStats: true,
          }),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), SYNC_BUDGET_MS);
          }),
        ]);
      } catch {
        refreshed = null;
      }

      void this.realtime
        .refreshEvent(ref, true, {
          fullMarkets: true,
          persistOdds: true,
        })
        .catch(() => undefined);

      if (refreshed) {
        syncOk = true;
        const [localized] = await this.olimpbet.localizeEventDtos(
          [refreshed],
          locale,
        );
        base = sanitizePublicEventDetail(localized ?? refreshed);
      } else {
        syncOk = false;
        const cached = this.realtime.getEventCache(ref);
        if (cached) {
          const [localized] = await this.olimpbet.localizeEventDtos(
            [cached],
            locale,
          );
          base = sanitizePublicEventDetail(localized ?? cached);
        } else if (eventRow) {
          const groupedMarkets = (eventRow.marketsJson ??
            {}) as WcGroupedMarkets;
          const [dto] = await this.toDtos([eventRow], { locale });
          base = sanitizePublicEventDetail({
            ...dto,
            groupedMarkets,
          });
        }
      }
    } else {
      const cached =
        this.realtime.getEventDetailSnapshot(ref) ??
        this.realtime.getEventCache(ref);

      if (cached) {
        const [localized] = await this.olimpbet.localizeEventDtos(
          [cached],
          locale,
        );
        base = sanitizePublicEventDetail(localized ?? cached);
      } else {
        if (!eventRow) throw new NotFoundException('Event not found');

        // Never await fullMarkets on cold miss — it fans out to dozens of linked Olimpbet GETs.
        // Return DB markets immediately; focused SUB / background refresh fills eventCache.
        const groupedMarkets = (eventRow.marketsJson ?? {}) as WcGroupedMarkets;
        const [dto] = await this.toDtos([eventRow], { locale });
        base = sanitizePublicEventDetail({
          ...dto,
          groupedMarkets,
        });
        void this.realtime
          .refreshEvent(ref, false, {
            forceFetch: true,
            oddsOnly: true,
            persistOdds: true,
            skipStructuredStats: true,
          })
          .then(() => {
            void this.realtime.refreshEvent(ref, false, {
              fullMarkets: true,
              persistOdds: true,
            });
          })
          .catch(() => undefined);
      }
    }

    if (!base) throw new NotFoundException('Event not found');

    // Display-only EN team/league labels — never rebuild linked markets on the hot path.
    if (locale === 'en') {
      // Names already localized via localizeEventDtos above when possible.
      // Full EN market label rebuild belongs in background sync, not TTFB.
    }

    return { ...base, syncOk };
  }

  async getEventSubscription(userId: number, ref: string) {
    this.assertEnabled();
    const event = await this.findEventByRef(ref);
    if (!event) throw new NotFoundException('Event not found');

    const sub = await this.prisma.wcEventSubscription.findUnique({
      where: { userId_eventId: { eventId: event.id, userId } },
    });

    return {
      eventId: event.id,
      notifyGoals: sub?.notifyGoals ?? true,
      notifyStart: sub?.notifyStart ?? true,
      subscribed: Boolean(sub),
    };
  }

  async getH2hEmbedHtmlAsync(ref: string): Promise<null | string> {
    this.assertEnabled();

    const numericId = await this.resolveHeadToHeadNumericId(ref);
    if (!numericId) return null;

    const event = await this.findEventByRef(ref);
    const publicRef = event ? toPublicRef(event) : ref.trim();
    const assetProxyBase = `/api/feed/embed/h2h/${encodeURIComponent(publicRef)}/sh`;

    const statshubHtml = await fetchStatshubMatchEmbedHtml(
      numericId,
      assetProxyBase,
    );
    if (statshubHtml) return statshubHtml;

    const fallback = buildH2hStandalonePage(numericId);
    return fallback || null;
  }

  /** Single fast payload for homepage top-event widgets. */
  async getHomepageWidgets(): Promise<{ items: HomepageWidgetItem[] }> {
    this.assertEnabled();

    const now = Date.now();
    if (
      this.homepageWidgetsCache &&
      this.homepageWidgetsCache.expiresAt > now
    ) {
      return this.homepageWidgetsCache.payload;
    }

    const perSport = 24;
    const cyberPromise = this.cybersport.isEnabled()
      ? Promise.race([
          this.cybersport.pickHomepageLiveWithOdds(48, 4).catch(() => []),
          new Promise<Awaited<ReturnType<CybersportService['pickHomepageLiveWithOdds']>>>(
            (resolve) => setTimeout(() => resolve([]), 2500),
          ),
        ])
      : Promise.resolve([]);

    const [soccerLive, soccerLine, tennisLive, tennisLine, mixLive, mixLine, cyberLive] =
      await Promise.all([
        this.listLiveEvents({ limit: perSport, sport: 'soccer' }),
        this.listLineEvents({ hours: '168', limit: perSport, sport: 'soccer' }),
        this.listLiveEvents({ limit: Math.min(perSport, 16), sport: 'tennis' }),
        this.listLineEvents({ hours: '72', limit: Math.min(perSport, 16), sport: 'tennis' }),
        this.listLiveEvents({ limit: Math.min(perSport, 12) }),
        this.listLineEvents({ hours: '72', limit: Math.min(perSport, 12) }),
        cyberPromise,
      ]);

    const wcPool = [
      ...new Map(
        [
          ...soccerLive,
          ...soccerLine,
          ...tennisLive,
          ...tennisLine,
          ...mixLive,
          ...mixLine,
        ].map((event) => [event.id, event] as const),
      ).values(),
    ];

    const items = buildHomepageWidgets(wcPool, cyberLive);

    const payload = { items };
    this.homepageWidgetsCache = {
      expiresAt: now + HOMEPAGE_WIDGETS_CACHE_MS,
      payload,
    };
    return payload;
  }

  /**
   * Lightweight, standalone endpoint for the Live Tracker widget — deliberately
   * skips the (heavier) Olimpbet broadcast resolution path used by `/play`,
   * only touching the cached 1win fixture index + push-feed snapshot.
   */
  async getLiveTracker(
    ref: string,
  ): Promise<{ available: boolean; trackerUrl: null | string }> {
    this.assertEnabled();

    const event = await this.findEventByRef(ref);
    if (!event) throw new NotFoundException('Event not found');

    const extras = await this.resolveOneWinExtras(event).catch(() => ({
      liveTrackerUrl: null,
      microStatList: [] as WcStatListItem[],
    }));
    if (extras.liveTrackerUrl) {
      void this.persistLiveTrackerFlag(event.id, true);
    }
    return {
      available: Boolean(extras.liveTrackerUrl),
      trackerUrl: extras.liveTrackerUrl,
    };
  }

  /** Remember tracker presence so list cards can show the stats badge without /tracker. */
  private async persistLiveTrackerFlag(eventId: string, hasLiveTracker: boolean) {
    try {
      const row = await this.prisma.wcOddsEvent.findUnique({
        select: { matchStateJson: true },
        where: { id: eventId },
      });
      if (!row) return;
      const prev = parseMatchState(row.matchStateJson) ?? emptyMatchState();
      if (Boolean(prev.result?.hasLiveTracker) === hasLiveTracker) return;
      const next = {
        ...prev,
        result: {
          ...prev.result,
          capturedAt: prev.result?.capturedAt ?? new Date().toISOString(),
          hasLiveTracker,
        },
        updatedAt: new Date().toISOString(),
      };
      await this.prisma.wcOddsEvent.update({
        data: { matchStateJson: next as object },
        where: { id: eventId },
      });
      this.realtime.patchLiveCacheMediaFlags(eventId, { hasLiveTracker });
    } catch {
      /* best-effort */
    }
  }

  async getMyTournament(userId: number) {
    this.assertEnabled();
    const bets = await this.prisma.wcOddsBet.findMany({
      include: { event: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
      where: { isProbe: false, userId },
    });

    let totalStaked = 0;
    let totalWon = 0;
    let wins = 0;
    let losses = 0;
    let pending = 0;
    const teamCounts = new Map<string, number>();

    for (const bet of bets) {
      const stake = Number(bet.stake);
      totalStaked += stake;
      if (bet.status === WcOddsBetStatus.WIN) {
        wins += 1;
        totalWon += Number(bet.potentialPayout);
      } else if (bet.status === WcOddsBetStatus.LOSE) {
        losses += 1;
      } else if (bet.status === WcOddsBetStatus.PENDING) {
        pending += 1;
      }

      if (bet.event) {
        for (const team of [bet.event.homeTeam, bet.event.awayTeam]) {
          teamCounts.set(team, (teamCounts.get(team) ?? 0) + 1);
        }
      }
    }

    const favoriteTeam = [...teamCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const settled = wins + losses;
    const roiPercent =
      totalStaked > 0 && settled > 0
        ? Math.round(((totalWon - totalStaked) / totalStaked) * 1000) / 10
        : null;

    const openBets = await this.mapBetsToPublicDtos(
      bets.filter((b) => b.status === WcOddsBetStatus.PENDING).slice(0, 10),
    );
    const recentSettled = await this.mapBetsToPublicDtos(
      bets.filter((b) => b.status !== WcOddsBetStatus.PENDING).slice(0, 10),
    );

    return {
      favoriteTeam: favoriteTeam
        ? { betCount: favoriteTeam[1], name: favoriteTeam[0] }
        : null,
      openBets,
      recentSettled,
      summary: {
        losses,
        pending,
        roiPercent,
        totalBets: bets.length,
        totalStaked: Math.round(totalStaked * 100) / 100,
        totalWon: Math.round(totalWon * 100) / 100,
        wins,
      },
    };
  }

  async getUserBet(userId: number, betId: number) {
    this.assertEnabled();
    const bet = await this.prisma.wcOddsBet.findFirst({
      include: { event: true },
      where: { id: betId, isProbe: false, userId },
    });
    if (!bet) throw new NotFoundException('Bet not found');
    const [dto] = await this.mapBetsToPublicDtos([bet]);
    return dto;
  }

  /** Validates wc-bet-probe script header; normal users cannot mark probe bets. */
  isProbePlacement(probeSecret?: null | string): boolean {
    const expected = this.config.get<string>('WC_PROBE_SECRET');
    if (!expected || !probeSecret) return false;
    return probeSecret === expected;
  }

  async listAllBets(status?: WcOddsBetStatus) {
    this.assertEnabled();
    return this.prisma.wcOddsBet.findMany({
      include: { event: true, user: { select: { email: true, id: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      where: {
        isProbe: false,
        ...(status ? { status } : {}),
      },
    });
  }

  async listDates(): Promise<string[]> {
    this.assertEnabled();
    const rows = await this.prisma.wcOddsEvent.findMany({
      orderBy: { commenceTime: 'asc' },
      select: { commenceTime: true },
      where: wcLineEventWhere(),
    });

    const dates = new Set<string>();
    for (const row of rows) {
      dates.add(row.commenceTime.toISOString().slice(0, 10));
    }
    return [...dates].sort();
  }

  async listEventsByDate(date?: string): Promise<WcOddsEventDto[]> {
    this.assertEnabled();

    const events = await this.prisma.wcOddsEvent.findMany({
      orderBy: this.lineOrderBy,
      where: this.buildLineWhere('all', date),
    });

    return this.toPublicDtos(events);
  }

  async listEventsBySport(
    sport: string,
    date?: string,
    hours?: string,
  ): Promise<WcOddsEventDto[]> {
    return this.listLineEvents({ date, hours, sport });
  }

  async listLineCountsBySport(): Promise<Record<string, number>> {
    this.assertEnabled();
    const rows = await this.prisma.wcOddsEvent.findMany({
      select: { sportKey: true },
      where: wcLineEventWhere(),
    });

    const counts: Record<string, number> = {};
    for (const row of rows) {
      const sport = wcSportKeyToSlug(row.sportKey);
      counts[sport] = (counts[sport] ?? 0) + 1;
    }
    return counts;
  }

  async listLineEvents(params: {
    date?: string;
    hours?: string;
    league?: string;
    limit?: number;
    locale?: OlimpbetApiLocale;
    offset?: number;
    sport?: string;
    tournament?: string;
  }): Promise<WcOddsEventDto[]> {
    this.assertEnabled();
    const hoursFilter = parseWcLineHoursFilter(params.hours);
    const limit = Math.min(Math.max(params.limit ?? 15, 1), 50);
    const offset = Math.max(params.offset ?? 0, 0);
    const sportKey = params.sport ? wcSlugToSportKey(params.sport) : undefined;
    const locale = params.locale ?? 'ru';

    const where = {
      ...this.buildLineWhere(hoursFilter, params.date, sportKey),
      ...(sportKey ? { sportKey } : {}),
      ...this.buildTournamentFilter(params.tournament, params.league),
    };

    const events = await this.prisma.wcOddsEvent.findMany({
      orderBy: this.lineOrderBy,
      skip: offset,
      take: limit,
      where,
    });

    return this.toPublicDtos(events, locale);
  }

  async listLineTimeCounts(sport?: string): Promise<Record<string, number>> {
    this.assertEnabled();
    const rows = await this.prisma.wcOddsEvent.findMany({
      select: { commenceTime: true, sportKey: true },
      where: wcLineEventWhere(),
    });

    const counts: Record<string, number> = { all: 0 };
    for (const option of WC_LINE_HOUR_OPTIONS) {
      if (option.id !== 'all') counts[option.id] = 0;
    }

    const nowMs = Date.now();
    for (const row of rows) {
      if (sport && wcSportKeyToSlug(row.sportKey) !== sport) continue;
      counts.all = (counts.all ?? 0) + 1;
      const deltaMs = row.commenceTime.getTime() - nowMs;
      if (deltaMs <= 0) continue;

      for (const option of WC_LINE_HOUR_OPTIONS) {
        if (!option.hours) continue;
        if (deltaMs <= option.hours * 60 * 60 * 1000) {
          counts[option.id] = (counts[option.id] ?? 0) + 1;
        }
      }
    }

    return counts;
  }

  async listLineTournaments(
    sport?: string,
    locale: OlimpbetApiLocale = 'ru',
  ): Promise<WcTournamentDto[]> {
    this.assertEnabled();
    const sportKey = sport ? wcSlugToSportKey(sport) : undefined;
    const rows = await this.prisma.wcOddsEvent.findMany({
      select: { leagueName: true, priorityLevel: true, tournamentId: true },
      where: {
        ...wcLineEventWhere(),
        ...(sportKey ? { sportKey } : {}),
      },
    });
    const aggregated = this.aggregateTournaments(rows);
    if (locale === 'ru') return aggregated;
    await this.olimpbet.ensureLocalizedNames(locale);
    return aggregated.map((row) => ({
      ...row,
      leagueName: this.olimpbet.localizeTournamentName(
        row.tournamentId,
        row.leagueName,
        locale,
      ),
    }));
  }

  async listLiveCountsBySport(
    broadcastOnly = false,
  ): Promise<Record<string, number>> {
    this.assertEnabled();

    const cached = this.realtime.getLiveCache();
    if (cached.length > 0) {
      const counts: Record<string, number> = {};
      for (const event of cached) {
        if (broadcastOnly && !event.hasBroadcast) continue;
        counts[event.sport] = (counts[event.sport] ?? 0) + 1;
      }
      return counts;
    }

    const rows = await this.prisma.wcOddsEvent.findMany({
      where: {
        ...wcLiveEventWhere(),
        ...(broadcastOnly ? { hasBroadcast: true } : {}),
      },
    });

    const counts: Record<string, number> = {};
    for (const row of rows) {
      const dto = buildWcOddsEventDto(row);
      if (!isWcEventVisibleInLiveList(dto)) continue;
      const sport = wcSportKeyToSlug(row.sportKey);
      counts[sport] = (counts[sport] ?? 0) + 1;
    }
    return counts;
  }

  async listLiveEvents(params: {
    broadcastOnly?: boolean;
    league?: string;
    limit?: number;
    locale?: OlimpbetApiLocale;
    offset?: number;
    sport?: string;
    tournament?: string;
  }): Promise<WcOddsEventDto[]> {
    this.assertEnabled();
    const limit = Math.min(Math.max(params.limit ?? 15, 1), 50);
    const offset = Math.max(params.offset ?? 0, 0);
    const sportKey = params.sport ? wcSlugToSportKey(params.sport) : undefined;
    const locale = params.locale ?? 'ru';

    const where = {
      ...wcLiveEventWhere(),
      ...(sportKey ? { sportKey } : {}),
      ...(params.broadcastOnly ? { hasBroadcast: true } : {}),
      ...this.buildTournamentFilter(params.tournament, params.league),
    };

    const visible = await this.fetchVisibleLiveEvents(
      where,
      offset + limit,
      locale,
    );
    return sanitizePublicEventList(visible.slice(offset, offset + limit));
  }

  async listLiveTournaments(
    sport?: string,
    locale: OlimpbetApiLocale = 'ru',
  ): Promise<WcTournamentDto[]> {
    this.assertEnabled();
    const sportKey = sport ? wcSlugToSportKey(sport) : undefined;
    const rows = await this.prisma.wcOddsEvent.findMany({
      select: { leagueName: true, priorityLevel: true, tournamentId: true },
      where: {
        ...wcLiveEventWhere(),
        ...(sportKey ? { sportKey } : {}),
      },
    });
    const aggregated = this.aggregateTournaments(rows);
    if (locale === 'ru') return aggregated;
    await this.olimpbet.ensureLocalizedNames(locale);
    return aggregated.map((row) => ({
      ...row,
      leagueName: this.olimpbet.localizeTournamentName(
        row.tournamentId,
        row.leagueName,
        locale,
      ),
    }));
  }

  async listUserBets(userId: number) {
    return this.listUserBetsGrouped(userId);
  }

  /** @deprecated use listUserBetsGrouped */
  async listUserBetsFlat(userId: number) {
    this.assertEnabled();
    const rows = await this.prisma.wcOddsBet.findMany({
      include: { event: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
      where: { isProbe: false, userId },
    });

    return this.mapBetsToPublicDtos(rows);
  }

  async listUserBetsGrouped(userId: number) {
    this.assertEnabled();
    const ordinarRows = await this.prisma.wcOddsBet.findMany({
      include: { event: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
      where: { isProbe: false, userId, wcExpressBetId: null },
    });

    const expressRows = await this.prisma.wcOddsExpressBet.findMany({
      include: { legs: { include: { event: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      where: { userId },
    });

    const ordinar = await this.mapBetsToPublicDtos(ordinarRows);
    const express = await Promise.all(
      expressRows.map(async (parent) => ({
        combinedOdds: Number(parent.combinedOdds).toFixed(2),
        createdAt: parent.createdAt.toISOString(),
        currencyCode: parent.currencyCode,
        id: parent.id,
        legs: await this.mapBetsToPublicDtos(parent.legs),
        potentialPayout: Number(parent.potentialPayout).toFixed(2),
        stake: Number(parent.stake).toFixed(2),
        status: parent.status,
      })),
    );

    return { express, ordinar };
  }

  async placeBet(params: {
    acceptOddsChange?: boolean;
    accountType?: 'bonus' | 'main';
    clientOdds?: number;
    currencyCode: string;
    eventId: string;
    groupKey?: string;
    /** Set only via X-WC-Probe-Secret — hidden from user coupons. */
    isProbe?: boolean;
    line?: string;
    marketKey?: string;
    outcomeKey?: string;
    outcomeName?: string;
    pick?: WcOddsPick;
    stake: number;
    userId: number;
  }) {
    this.assertEnabled();

    const minStake = wcOddsMinStakeForCurrency(
      params.currencyCode,
      Number(this.config.get<string>('WC_ODDS_MIN_STAKE', '100')),
    );
    const maxStake = wcOddsMaxStakeForCurrency(
      params.currencyCode,
      Number(this.config.get<string>('WC_ODDS_MAX_STAKE', '1000000')),
    );

    if (
      !Number.isFinite(params.stake) ||
      params.stake < minStake ||
      params.stake > maxStake
    ) {
      throw new BadRequestException(
        `Stake must be between ${minStake} and ${maxStake}`,
      );
    }

    const event = await this.findEventByRef(params.eventId);
    if (!event) throw new NotFoundException('Event not found');

    const publicRef = event.slug?.trim() || toPublicEventId(event.id);
    const rawMarketKey = params.marketKey || 'h2h';
    const placeStartedAt = Date.now();

    const placementSnapshot = await this.realtime.resolveBetPlacementSnapshot(
      publicRef,
      event,
      {
        groupKey: params.groupKey ?? null,
        line: params.line ?? null,
        marketKey: rawMarketKey,
        outcomeKey: params.outcomeKey ?? null,
      },
    );
    if (!placementSnapshot) {
      throw new NotFoundException('Event not found');
    }

    const {
      bettingOpen,
      groupedMarkets,
      main: placementDetail,
    } = placementSnapshot;

    if (bettingOpen === false) {
      throw new BadRequestException('Betting closed for this match');
    }

    if (!isWcBettingOpen(event.completed, event.commenceTime)) {
      throw new BadRequestException('Betting closed for this match');
    }

    if (!isWcBetPlacementAllowed(rawMarketKey, params.outcomeKey)) {
      throw new BadRequestException('This market is not available for betting');
    }

    const marketKey = normalizeWcMarketKey(rawMarketKey);

    let pick: WcOddsPick | null = params.pick ?? null;
    let outcomeKey = params.outcomeKey ?? null;
    let line = params.line ?? null;
    let outcomeName = params.outcomeName ?? null;
    let odds: null | number = null;
    const storedMarketKey = rawMarketKey;
    const groupKey = params.groupKey ?? null;

    if (marketKey === 'h2h') {
      if (!pick && outcomeKey) pick = outcomeKeyToPick(outcomeKey);
      if (!outcomeKey && pick) outcomeKey = pick;

      if (!pick || !outcomeKey) {
        throw new BadRequestException('Pick required for 1X2 market');
      }

      const oddsMap: Record<WcOddsPick, Decimal | null> = {
        [WcOddsPick.AWAY]: event.oddsAway,
        [WcOddsPick.DRAW]: event.oddsDraw,
        [WcOddsPick.HOME]: event.oddsHome,
      };
      odds =
        findOutcomeOdds(
          groupedMarkets,
          rawMarketKey,
          outcomeKey,
          null,
          groupKey,
        ) ??
        findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, null, groupKey);
      if (odds == null) {
        const oddsDec = oddsMap[pick];
        odds = oddsDec ? Number(oddsDec) : null;
      }
      if (!outcomeName) {
        outcomeName =
          pick === WcOddsPick.HOME
            ? 'П1'
            : pick === WcOddsPick.DRAW
              ? 'X'
              : 'П2';
      }
    } else if (marketKey === 'double_chance') {
      if (!outcomeKey) throw new BadRequestException('Outcome required');
      odds =
        findOutcomeOdds(
          groupedMarkets,
          rawMarketKey,
          outcomeKey,
          null,
          groupKey,
        ) ??
        findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, null, groupKey);
      if (!outcomeName) {
        outcomeName =
          outcomeKey === 'DC_1X'
            ? '1X'
            : outcomeKey === 'DC_12'
              ? '12'
              : outcomeKey === 'DC_X2'
                ? 'X2'
                : outcomeKey;
      }
    } else if (marketKey === 'handicap') {
      if (!outcomeKey) throw new BadRequestException('Outcome required');
      odds =
        findOutcomeOdds(
          groupedMarkets,
          rawMarketKey,
          outcomeKey,
          null,
          groupKey,
        ) ??
        findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, null, groupKey);
      if (!line) {
        const hcpMatch = outcomeKey.match(/^(HOME|AWAY)_HCP_(-?[\d.]+)$/);
        if (hcpMatch) line = hcpMatch[2];
      }
    } else {
      if (!outcomeKey) throw new BadRequestException('Outcome required');
      if (isTotalsMarketKey(marketKey) && !line) {
        const parts = outcomeKey.split('_');
        line = parts.slice(1).join('_') || null;
      }
      odds =
        findOutcomeOdds(
          groupedMarkets,
          rawMarketKey,
          outcomeKey,
          line,
          groupKey,
        ) ??
        findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, line, groupKey);
    }

    if (odds == null || !Number.isFinite(odds)) {
      throw new BadRequestException('Odds unavailable for this outcome');
    }

    const matchedOutcome = outcomeKey
      ? (findMarketOutcome(
          groupedMarkets,
          rawMarketKey,
          outcomeKey,
          line,
          groupKey,
        ) ??
        findMarketOutcome(
          groupedMarkets,
          marketKey,
          outcomeKey,
          line,
          groupKey,
        ))
      : null;
    if (matchedOutcome?.suspended) {
      throw new BadRequestException('This outcome is temporarily suspended');
    }
    if (
      matchedOutcome &&
      (!Number.isFinite(matchedOutcome.price) || matchedOutcome.price <= 1)
    ) {
      throw new BadRequestException('Odds unavailable for this outcome');
    }

    if (isTotalsMarketKey(marketKey)) {
      const matchedGroup = findMarketGroup(
        groupedMarkets,
        rawMarketKey,
        outcomeKey ?? '',
        line,
        groupKey,
      );
      if (matchedGroup) {
        outcomeName = buildTotalsOutcomeName(
          matchedGroup.label,
          line,
          outcomeKey,
          outcomeName,
        );
      }
    }

    const totalsGroupLabel = isTotalsMarketKey(marketKey)
      ? (findMarketGroup(
          groupedMarkets,
          rawMarketKey,
          outcomeKey ?? '',
          line,
          groupKey,
        )?.label ?? null)
      : (findMarketGroup(
          groupedMarkets,
          rawMarketKey,
          outcomeKey ?? '',
          line,
          groupKey,
        )?.label ?? null);

    const placementScope = resolveBetPlacementScope({
      groupKey,
      marketKey: rawMarketKey,
      outcomeKey,
      outcomeName,
      totalsGroupLabel,
    });

    const olimpbetId = olimpbetIdFromWcEventId(event.id);
    if (placementDetail && olimpbetId && placementScope) {
      if (
        isMarketScopeFinalized(
          placementDetail,
          placementScope,
          parseMatchState(event.matchStateJson),
        )
      ) {
        throw new BadRequestException('Betting closed for this period');
      }
    }

    const oddsTolerance = Number(
      this.config.get<string>('WC_ODDS_TOLERANCE', '0.02'),
    );
    if (
      !params.acceptOddsChange &&
      params.clientOdds != null &&
      Number.isFinite(params.clientOdds) &&
      Math.abs(params.clientOdds - odds) > oddsTolerance
    ) {
      throw new BadRequestException({
        actualCoefficient: odds,
        coefficientChanged: true,
        message: 'Odds have changed',
        originalCoefficient: params.clientOdds,
      });
    }

    const isBonus = params.accountType === 'bonus';
    let stake: Decimal;
    let isTokenBonus = false;

    if (isBonus) {
      assertBonusMarketAllowed({
        betInfo: outcomeName ?? params.outcomeName,
        marketKey: storedMarketKey,
      });

      const bb = await this.prisma.bonusBalance.findUnique({
        where: {
          userId_currencyCode: {
            currencyCode: params.currencyCode,
            userId: params.userId,
          },
        },
      });
      if (!bb || !bb.isActive) {
        throw new BadRequestException('Бонусный счёт не активен');
      }
      if (bb.requiresDeposit && !bb.depositActivated) {
        throw new BadRequestException('Пополните счёт, чтобы играть с бонусом');
      }
      if (isBonusExpired(bb.expiresAt)) {
        throw new BadRequestException('Срок действия бонуса истёк');
      }
      assertBonusOddsInRange(odds, bb.minOdds);

      if (bb.isTokenBased) {
        if (bb.remainingTokens < bb.tokensPerBet) {
          throw new BadRequestException('Недостаточно жетонов для ставки');
        }
        if (params.stake !== bb.tokensPerBet) {
          throw new BadRequestException(
            `Нужно ставить ровно ${bb.tokensPerBet} жетон(ов)`,
          );
        }
        isTokenBonus = true;
        stake = new Decimal(bb.tokensPerBet);
      } else if (bb.isFreeBet) {
        const freeStake = Number(bb.freeBetStake ?? bb.amount);
        if (params.stake !== freeStake) {
          throw new BadRequestException(
            `Фрибет: ставка должна быть ровно ${freeStake}`,
          );
        }
        stake = new Decimal(freeStake);
      } else {
        assertBonusStakeWithinLimit(params.stake, bb.amount);
        if (bb.amount.lessThan(new Decimal(params.stake))) {
          throw new BadRequestException(
            'Недостаточно средств на бонусном счёте',
          );
        }
        stake = new Decimal(params.stake);
      }

      if (stake.lessThan(minStake) || stake.greaterThan(maxStake)) {
        throw new BadRequestException(
          `Stake must be between ${minStake} and ${maxStake}`,
        );
      }
    } else {
      const balance = await this.prisma.balance.findUnique({
        where: {
          userId_currencyCode: {
            currencyCode: params.currencyCode,
            userId: params.userId,
          },
        },
      });
      if (!balance || balance.amount.lessThan(new Decimal(params.stake))) {
        throw new BadRequestException('Insufficient funds');
      }

      const effectiveStakeNum = toStakeNumber(
        computeMainAccountBetDebit(balance.amount, params.stake),
      );
      if (effectiveStakeNum < minStake) {
        throw new BadRequestException(
          `Stake must be between ${minStake} and ${maxStake}`,
        );
      }
      stake = new Decimal(effectiveStakeNum);
    }

    const potentialPayout = stake.mul(odds).toDecimalPlaces(2);

    const homeScore = event.homeScore ?? 0;
    const awayScore = event.awayScore ?? 0;
    let placementContext = buildBetPlacementContext({
      awayScore,
      homeScore,
      marketKey: storedMarketKey,
      matchState: parseMatchState(event.matchStateJson),
      outcomeKey,
      totalsGroupLabel,
    });

    if (placementDetail) {
      const score = this.olimpbet.extractScore(placementDetail);
      const matchState = advanceMatchState(
        event.matchStateJson,
        placementDetail,
        olimpbetSportKeyToSlug(event.sportKey),
      );
      placementContext = buildBetPlacementContext({
        awayScore: score.awayScore ?? awayScore,
        detail: placementDetail,
        homeScore: score.homeScore ?? homeScore,
        marketKey: storedMarketKey,
        matchState,
        outcomeKey,
        totalsGroupLabel,
      });
    }

    const bet = await this.prisma.$transaction(async (tx) => {
      if (isBonus) {
        if (isTokenBonus) {
          await tx.bonusBalance.update({
            data: { remainingTokens: { decrement: Number(stake) } },
            where: {
              userId_currencyCode: {
                currencyCode: params.currencyCode,
                userId: params.userId,
              },
            },
          });
        } else {
          const bb = await tx.bonusBalance.findUnique({
            where: {
              userId_currencyCode: {
                currencyCode: params.currencyCode,
                userId: params.userId,
              },
            },
          });
          if (!bb) throw new BadRequestException('Бонусный счёт не найден');
          if (bb.isFreeBet) {
            await tx.bonusBalance.update({
              data: { isActive: false, totalWagered: { increment: stake } },
              where: {
                userId_currencyCode: {
                  currencyCode: params.currencyCode,
                  userId: params.userId,
                },
              },
            });
          } else {
            await tx.bonusBalance.update({
              data: {
                amount: { decrement: stake },
                totalWagered: { increment: stake },
              },
              where: {
                userId_currencyCode: {
                  currencyCode: params.currencyCode,
                  userId: params.userId,
                },
              },
            });
            await completeBonusWageringIfNeeded(
              tx,
              params.userId,
              params.currencyCode,
            );
          }
        }

        await this.operationService.createWithoutBalanceUpdate(
          tx,
          params.userId,
          {
            amount: stake,
            currencyCode: params.currencyCode,
            meta: {
              accountType: 'bonus',
              eventId: params.eventId,
              marketKey: storedMarketKey,
              outcomeKey,
              pick,
              tokenBet: isTokenBonus,
              wcBet: true,
            },
            source: OperationSource.BONUS_BET,
            status: OperationStatus.SUCCESS,
            type: OperationType.OUTCOME,
          },
        );
      } else {
        await this.operationService.create(tx, params.userId, {
          amount: stake,
          currencyCode: params.currencyCode,
          meta: {
            eventId: params.eventId,
            marketKey: storedMarketKey,
            outcomeKey,
            pick,
          },
          source: OperationSource.WC_BET,
          status: OperationStatus.SUCCESS,
          type: OperationType.OUTCOME,
        });
      }

      return tx.wcOddsBet.create({
        data: {
          currencyCode: params.currencyCode,
          eventId: event.id,
          isBonus,
          isProbe: params.isProbe === true,
          line,
          marketKey: storedMarketKey,
          odds: new Decimal(odds),
          outcomeKey,
          outcomeName,
          pick: pick ?? undefined,
          placementContextJson: placementContext as object,
          potentialPayout,
          stake,
          status: WcOddsBetStatus.PENDING,
          userId: params.userId,
        },
        include: {
          event: true,
        },
      });
    });

    const placeElapsed = Date.now() - placeStartedAt;
    if (placeElapsed >= 2_000) {
      this.logger.warn(
        `[perf] placeBet user=${params.userId} event=${params.eventId} took ${placeElapsed}ms`,
      );
    }

    return bet;
  }

  async proxyH2hStatshubAsset(
    ref: string,
    assetPath: string,
    res: import('express').Response,
  ): Promise<void> {
    const numericId = await this.resolveHeadToHeadNumericId(ref);
    if (!numericId || !assetPath.startsWith('/')) {
      res.status(404).send('Asset not found');
      return;
    }

    const upstream = await fetchStatshubAsset(numericId, assetPath);
    if (!upstream?.ok) {
      res.status(upstream?.status ?? 404).send('Failed to load asset');
      return;
    }

    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Cache-Control',
      'public, max-age=300, stale-while-revalidate=600',
    );
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }

  async searchEvents(
    q: string,
    sport?: string,
    limit = 25,
  ): Promise<WcOddsEventDto[]> {
    this.assertEnabled();
    const term = q.trim();
    if (term.length < 2) return [];

    const sportKey = sport ? wcSlugToSportKey(sport) : undefined;
    const take = Math.min(Math.max(limit, 1), 40);

    const rows = await this.prisma.wcOddsEvent.findMany({
      orderBy: [
        { priorityLevel: 'desc' },
        { commenceTime: 'asc' },
        { leagueName: 'asc' },
      ],
      take,
      where: {
        completed: false,
        ...(sportKey ? { sportKey } : {}),
        OR: [
          { homeTeam: { contains: term, mode: 'insensitive' } },
          { awayTeam: { contains: term, mode: 'insensitive' } },
          { leagueName: { contains: term, mode: 'insensitive' } },
        ],
      },
    });

    return this.toPublicDtos(rows);
  }

  async subscribeEvent(
    userId: number,
    ref: string,
    opts?: { notifyGoals?: boolean; notifyStart?: boolean },
  ) {
    this.assertEnabled();
    const event = await this.findEventByRef(ref);
    if (!event) throw new NotFoundException('Event not found');

    const user = await this.prisma.user.findUnique({
      select: { telegramLinkedAt: true },
      where: { id: userId },
    });
    if (!user?.telegramLinkedAt) {
      throw new BadRequestException('Привяжите Telegram в настройках профиля');
    }

    await this.prisma.wcEventSubscription.upsert({
      create: {
        eventId: event.id,
        notifyGoals: opts?.notifyGoals ?? true,
        notifyStart: opts?.notifyStart ?? true,
        userId,
      },
      update: {
        notifyGoals: opts?.notifyGoals ?? true,
        notifyStart: opts?.notifyStart ?? true,
      },
      where: { userId_eventId: { eventId: event.id, userId } },
    });

    return { ok: true, subscribed: true };
  }

  async unsubscribeEvent(userId: number, ref: string) {
    this.assertEnabled();
    const event = await this.findEventByRef(ref);
    if (!event) throw new NotFoundException('Event not found');

    await this.prisma.wcEventSubscription.deleteMany({
      where: { eventId: event.id, userId },
    });

    return { ok: true, subscribed: false };
  }
}
