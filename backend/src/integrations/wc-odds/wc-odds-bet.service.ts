import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OperationSource,
  OperationStatus,
  OperationType,
  WcOddsBetStatus,
  WcOddsPick,
  WcOddsEvent,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import { PrismaService } from '~/prisma/prisma.service';
import {
  computeMainAccountBetDebit,
  toStakeNumber,
} from '~/shared/utils/balance-fractional-reserve.util';

import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';
import { CybersportService } from '../cybersport/cybersport.service';
import {
  extractOlimpbetHeadToHeadId,
  sportRadarMatchNumericId,
} from '../olimpbet-wc/olimpbet-head-to-head.util';

import { WcBroadcastProxyService } from './wc-broadcast-proxy.service';
import { buildWcBetShareSvg, buildWcBetShareText } from './wc-bet-share.util';
import { buildWcOddsEventDto } from './wc-event-dto.util';
import { isWcEventVisibleInLiveList } from './wc-live-visibility.util';
import { compareOlimpbetPriority, isOlimpbetPriorityLevel } from '../olimpbet-wc/olimpbet-priority.util';
import { isWcBettingOpen, wcLineEventWhere, wcLiveEventWhere } from './wc-betting.util';
import {
  parseWcLineHoursFilter,
  wcLineCommenceTimeRange,
  WC_LINE_HOUR_OPTIONS,
  type WcLineHoursFilter,
} from './wc-line-time.util';
import {
  findMarketGroup,
  findMarketOutcome,
  findOutcomeOdds,
  isTotalsMarketKey,
  isWcBetPlacementAllowed,
  normalizeWcMarketKey,
  outcomeKeyToPick,
  type WcGroupedMarkets,
} from './wc-odds-markets.util';
import { buildBetPlacementContext } from './wc-bet-placement-context.util';
import { isMarketScopeFinalized } from '../olimpbet-wc/olimpbet-score-scope.util';
import { resolveBetPlacementScope } from './wc-scope-market-filter.util';
import { buildTotalsOutcomeName } from './wc-totals-outcome-name.util';
import { advanceMatchState } from './wc-match-state-tracker.util';
import { parseMatchState } from './wc-match-state.types';
import { olimpbetSportKeyToSlug } from '../olimpbet-wc/olimpbet-sport.util';
import { wcLeagueNameFromSportKey, wcSlugToSportKey, wcSportKeyToSlug } from './wc-sport.util';
import {
  isWcEventId,
  olimpbetIdFromSlugHint,
  olimpbetIdFromWcEventId,
  stripLegacyHashFromSlug,
} from './wc-slug.util';
import {
  publicIdToInternal,
  resolveEventRef,
  sanitizePublicEventDetail,
  sanitizePublicEventDto,
  sanitizePublicEventList,
  toPublicEventId,
  toPublicRef,
} from './wc-public.util';
import {
  pickRicherStatList,
} from './wc-odds-statistics.util';
import type { WcOddsEventDetailDto, WcOddsEventDto, WcTournamentDto } from './wc-odds.types';
import {
  buildH2hStandalonePage,
  fetchStatshubAsset,
  fetchStatshubMatchEmbedHtml,
} from './wc-statshub-embed.util';
import { WcOddsRealtimeService } from './wc-odds-realtime.service';
import { buildHomepageWidgets, type HomepageWidgetItem } from './wc-home-widgets.util';

const HOMEPAGE_WIDGETS_CACHE_MS = 45_000;

@Injectable()
export class WcOddsBetService {
  private homepageWidgetsCache: {
    expiresAt: number;
    payload: { items: HomepageWidgetItem[] };
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly realtime: WcOddsRealtimeService,
    private readonly config: ConfigService,
    private readonly broadcastProxy: WcBroadcastProxyService,
    private readonly cybersport: CybersportService,
  ) {}

  private assertEnabled() {
    if (!this.olimpbet.isEnabled()) {
      throw new ForbiddenException('WC odds module is disabled');
    }
  }

  private readonly liveOrderBy = [
    { priorityLevel: 'desc' as const },
    { leagueName: 'asc' as const },
    { commenceTime: 'desc' as const },
    { id: 'asc' as const },
  ];

  private readonly lineOrderBy = [
    { priorityLevel: 'desc' as const },
    { leagueName: 'asc' as const },
    { commenceTime: 'asc' as const },
    { id: 'asc' as const },
  ];

  private toDto(event: {
    id: string;
    slug: string | null;
    sportKey: string;
    leagueName?: string | null;
    tournamentId?: number | null;
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
    homeCompetitorId?: number | null;
    awayCompetitorId?: number | null;
    hasBroadcast?: boolean;
    marketsJson?: unknown;
    oddsUpdatedAt?: Date | null;
  }): WcOddsEventDto {
    return buildWcOddsEventDto(event);
  }

  private async toDtos(
    events: Array<Parameters<WcOddsBetService['toDto']>[0]>,
  ): Promise<WcOddsEventDto[]> {
    const dtos = events.map((event) => this.toDto(event));
    return this.olimpbet.enrichEventDtos(dtos, events);
  }

  private async toPublicDtos(
    events: Array<Parameters<WcOddsBetService['toDto']>[0]>,
  ): Promise<WcOddsEventDto[]> {
    return sanitizePublicEventList(await this.toDtos(events));
  }

  private buildLineWhere(hoursFilter: WcLineHoursFilter = 'all', date?: string, sportKey?: string | null) {
    const now = new Date();
    const range = wcLineCommenceTimeRange(now, hoursFilter, sportKey);
    const commenceTime: { gt: Date; lte: Date; gte?: Date; lt?: Date } = {
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
      completed: false as const,
      commenceTime,
    };
  }

  private aggregateTournaments(
    rows: Array<{ tournamentId: number | null; leagueName: string | null; priorityLevel?: number | null }>,
  ): WcTournamentDto[] {
    const map = new Map<string, WcTournamentDto & { priorityLevel: number }>();

    for (const row of rows) {
      const leagueName = row.leagueName?.trim() || 'Imba';
      const key = row.tournamentId != null ? `id:${row.tournamentId}` : `name:${leagueName}`;
      const rowPriority = row.priorityLevel ?? 0;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.priorityLevel = Math.max(existing.priorityLevel, rowPriority);
        existing.isPriority = isOlimpbetPriorityLevel(existing.priorityLevel);
        continue;
      }
      map.set(key, {
        tournamentId: row.tournamentId,
        leagueName,
        count: 1,
        priorityLevel: rowPriority,
        isPriority: isOlimpbetPriorityLevel(rowPriority),
      });
    }

    return [...map.values()].sort(
      (a, b) =>
        compareOlimpbetPriority(a.priorityLevel, b.priorityLevel)
        || b.count - a.count
        || a.leagueName.localeCompare(b.leagueName, 'ru'),
    );
  }

  async listLineTournaments(sport?: string): Promise<WcTournamentDto[]> {
    this.assertEnabled();
    const sportKey = sport ? wcSlugToSportKey(sport) : undefined;
    const rows = await this.prisma.wcOddsEvent.findMany({
      where: {
        ...wcLineEventWhere(),
        ...(sportKey ? { sportKey } : {}),
      },
      select: { tournamentId: true, leagueName: true, priorityLevel: true },
    });
    return this.aggregateTournaments(rows);
  }

  async listLiveTournaments(sport?: string): Promise<WcTournamentDto[]> {
    this.assertEnabled();
    const sportKey = sport ? wcSlugToSportKey(sport) : undefined;
    const rows = await this.prisma.wcOddsEvent.findMany({
      where: {
        ...wcLiveEventWhere(),
        ...(sportKey ? { sportKey } : {}),
      },
      select: { tournamentId: true, leagueName: true, priorityLevel: true },
    });
    return this.aggregateTournaments(rows);
  }

  private buildTournamentFilter(tournamentId?: string, league?: string) {
    if (tournamentId) {
      const id = parseInt(tournamentId, 10);
      if (Number.isFinite(id)) return { tournamentId: id };
    }
    if (league) return { leagueName: decodeURIComponent(league) };
    return {};
  }

  async listLineTimeCounts(sport?: string): Promise<Record<string, number>> {
    this.assertEnabled();
    const rows = await this.prisma.wcOddsEvent.findMany({
      where: wcLineEventWhere(),
      select: { commenceTime: true, sportKey: true },
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

  async listLineEvents(params: {
    sport?: string;
    date?: string;
    hours?: string;
    tournament?: string;
    league?: string;
    limit?: number;
    offset?: number;
  }): Promise<WcOddsEventDto[]> {
    this.assertEnabled();
    const hoursFilter = parseWcLineHoursFilter(params.hours);
    const limit = Math.min(Math.max(params.limit ?? 15, 1), 50);
    const offset = Math.max(params.offset ?? 0, 0);
    const sportKey = params.sport ? wcSlugToSportKey(params.sport) : undefined;

    const where = {
      ...this.buildLineWhere(hoursFilter, params.date, sportKey),
      ...(sportKey ? { sportKey } : {}),
      ...this.buildTournamentFilter(params.tournament, params.league),
    };

    const events = await this.prisma.wcOddsEvent.findMany({
      where,
      orderBy: this.lineOrderBy,
      take: limit,
      skip: offset,
    });

    return this.toPublicDtos(events);
  }

  async searchEvents(q: string, sport?: string, limit = 25): Promise<WcOddsEventDto[]> {
    this.assertEnabled();
    const term = q.trim();
    if (term.length < 2) return [];

    const sportKey = sport ? wcSlugToSportKey(sport) : undefined;
    const take = Math.min(Math.max(limit, 1), 40);

    const rows = await this.prisma.wcOddsEvent.findMany({
      where: {
        completed: false,
        ...(sportKey ? { sportKey } : {}),
        OR: [
          { homeTeam: { contains: term, mode: 'insensitive' } },
          { awayTeam: { contains: term, mode: 'insensitive' } },
          { leagueName: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: [
        { priorityLevel: 'desc' },
        { commenceTime: 'asc' },
        { leagueName: 'asc' },
      ],
      take,
    });

    return this.toPublicDtos(rows);
  }

  async listLineCountsBySport(): Promise<Record<string, number>> {
    this.assertEnabled();
    const rows = await this.prisma.wcOddsEvent.findMany({
      where: wcLineEventWhere(),
      select: { sportKey: true },
    });

    const counts: Record<string, number> = {};
    for (const row of rows) {
      const sport = wcSportKeyToSlug(row.sportKey);
      counts[sport] = (counts[sport] ?? 0) + 1;
    }
    return counts;
  }

  /** Single fast payload for homepage top-event widgets. */
  async getHomepageWidgets(): Promise<{ items: HomepageWidgetItem[] }> {
    this.assertEnabled();

    const now = Date.now();
    if (this.homepageWidgetsCache && this.homepageWidgetsCache.expiresAt > now) {
      return this.homepageWidgetsCache.payload;
    }

    const perSport = 14;
    const [soccerLive, soccerLine, tennisLive, tennisLine, cs2] = await Promise.all([
      this.listLiveEvents({ sport: 'soccer', limit: perSport }),
      this.listLineEvents({ sport: 'soccer', limit: perSport, hours: '72' }),
      this.listLiveEvents({ sport: 'tennis', limit: perSport }),
      this.listLineEvents({ sport: 'tennis', limit: perSport, hours: '72' }),
      this.cybersport.isEnabled()
        ? this.cybersport.pickHomepageCs2WithLogos()
        : Promise.resolve(null),
    ]);

    const items = buildHomepageWidgets(
      [...soccerLive, ...soccerLine, ...tennisLive, ...tennisLine],
      cs2,
    );

    const payload = { items };
    this.homepageWidgetsCache = {
      expiresAt: now + HOMEPAGE_WIDGETS_CACHE_MS,
      payload,
    };
    return payload;
  }

  async listLiveEvents(params: {
    sport?: string;
    tournament?: string;
    league?: string;
    limit?: number;
    offset?: number;
    broadcastOnly?: boolean;
  }): Promise<WcOddsEventDto[]> {
    this.assertEnabled();
    const limit = Math.min(Math.max(params.limit ?? 15, 1), 50);
    const offset = Math.max(params.offset ?? 0, 0);
    const sportKey = params.sport ? wcSlugToSportKey(params.sport) : undefined;

    const where = {
      ...wcLiveEventWhere(),
      ...(sportKey ? { sportKey } : {}),
      ...(params.broadcastOnly ? { hasBroadcast: true } : {}),
      ...this.buildTournamentFilter(params.tournament, params.league),
    };

    const visible = await this.fetchVisibleLiveEvents(where, offset + limit);
    return sanitizePublicEventList(visible.slice(offset, offset + limit));
  }

  private async fetchVisibleLiveEvents(
    where: Record<string, unknown>,
    needed: number,
  ): Promise<WcOddsEventDto[]> {
    const visible: WcOddsEventDto[] = [];
    let dbSkip = 0;
    const batchSize = 50;

    while (visible.length < needed) {
      let events = await this.prisma.wcOddsEvent.findMany({
        where,
        orderBy: this.liveOrderBy,
        take: batchSize,
        skip: dbSkip,
      });
      if (events.length === 0) break;
      dbSkip += events.length;

      const dtos = this.mergeLiveEventStatsFromCache(await this.toDtos(events));
      for (const dto of dtos) {
        if (isWcEventVisibleInLiveList(dto)) visible.push(dto);
      }

      if (events.length < batchSize) break;
    }

    return visible;
  }

  /** Merge realtime cache stats for live list cards (no blocking Olimpbet calls). */
  private mergeLiveEventStatsFromCache(dtos: WcOddsEventDto[]): WcOddsEventDto[] {
    if (dtos.length === 0) return dtos;

    const cacheById = new Map(this.realtime.getLiveCache().map((e) => [e.id, e]));

    return dtos.map((dto) => {
      const cached = cacheById.get(dto.id);
      const structuredCache = this.realtime.getStructuredStatsCache(dto.id);

      return {
        ...dto,
        parsedScore: cached?.parsedScore ?? structuredCache?.parsedScore ?? dto.parsedScore,
        statList: pickRicherStatList(
          pickRicherStatList(cached?.statList, structuredCache?.statList),
          dto.statList,
        ) ?? dto.statList,
        homeScore: cached?.homeScore ?? dto.homeScore,
        awayScore: cached?.awayScore ?? dto.awayScore,
        oddsHome: cached?.oddsHome ?? dto.oddsHome,
        oddsDraw: cached?.oddsDraw ?? dto.oddsDraw,
        oddsAway: cached?.oddsAway ?? dto.oddsAway,
        phase: cached?.phase ?? dto.phase,
      };
    });
  }

  async listLiveCountsBySport(broadcastOnly = false): Promise<Record<string, number>> {
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

  async listEventsBySport(
    sport: string,
    date?: string,
    hours?: string,
  ): Promise<WcOddsEventDto[]> {
    return this.listLineEvents({ sport, date, hours });
  }

  async listDates(): Promise<string[]> {
    this.assertEnabled();
    const rows = await this.prisma.wcOddsEvent.findMany({
      where: wcLineEventWhere(),
      select: { commenceTime: true },
      orderBy: { commenceTime: 'asc' },
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
      where: this.buildLineWhere('all', date),
      orderBy: this.lineOrderBy,
    });

    return this.toPublicDtos(events);
  }

  async findEventByRef(ref: string): Promise<WcOddsEvent | null> {
    const decoded = resolveEventRef(ref);

    if (isWcEventId(decoded)) {
      return this.prisma.wcOddsEvent.findUnique({ where: { id: decoded } });
    }

    const cleanSlug = stripLegacyHashFromSlug(decoded);
    const bySlug = await this.prisma.wcOddsEvent.findUnique({ where: { slug: cleanSlug } });
    if (bySlug) return bySlug;

    if (cleanSlug !== decoded) {
      const byLegacySlug = await this.prisma.wcOddsEvent.findUnique({ where: { slug: decoded } });
      if (byLegacySlug) return byLegacySlug;
    }

    const idHint = olimpbetIdFromSlugHint(decoded);
    if (idHint) {
      return this.prisma.wcOddsEvent.findUnique({ where: { id: idHint } });
    }

    return null;
  }

  private async resolveHeadToHeadNumericId(ref: string): Promise<string | null> {
    const cached = this.realtime.getEventCache(ref);
    let olimpbetId = cached?.olimpbetEventId ?? null;

    if (!olimpbetId) {
      const event = await this.findEventByRef(ref);
      if (!event) return null;
      olimpbetId = olimpbetIdFromWcEventId(event.id);
    }

    if (!olimpbetId) return null;

    const main = await this.olimpbet.fetchEventDetail(olimpbetId);
    const headToHeadId = extractOlimpbetHeadToHeadId(main);
    if (!headToHeadId) return null;

    return sportRadarMatchNumericId(headToHeadId);
  }

  async getH2hEmbedHtmlAsync(ref: string): Promise<string | null> {
    this.assertEnabled();

    const numericId = await this.resolveHeadToHeadNumericId(ref);
    if (!numericId) return null;

    const event = await this.findEventByRef(ref);
    const publicRef = event ? toPublicRef(event) : ref.trim();
    const assetProxyBase = `/api/feed/embed/h2h/${encodeURIComponent(publicRef)}/sh`;

    const statshubHtml = await fetchStatshubMatchEmbedHtml(numericId, assetProxyBase);
    if (statshubHtml) return statshubHtml;

    const fallback = buildH2hStandalonePage(numericId);
    return fallback || null;
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
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }

  async getEventBroadcast(ref: string) {
    this.assertEnabled();

    const event = await this.findEventByRef(ref);
    if (!event) throw new NotFoundException('Event not found');

    const olimpbetId = olimpbetIdFromWcEventId(event.id);
    if (!olimpbetId) {
      return { available: false, streamUrl: null, streamType: null };
    }

    const payload = await this.olimpbet.fetchEventBroadcast(olimpbetId);
    const publicRef = event.slug?.trim() || toPublicEventId(event.id);

    if (payload.streamType === 'hls' && payload.streamUrl) {
      this.broadcastProxy.rememberUpstream(publicRef, payload.streamUrl);
      return {
        available: payload.available,
        streamUrl: `/api/feed/events/${encodeURIComponent(publicRef)}/v?t=${Date.now()}`,
        streamType: 'hls',
      };
    }

    if (payload.streamType === 'iframe' && payload.streamUrl) {
      this.broadcastProxy.rememberEmbed(publicRef, payload.streamUrl);
      return {
        available: payload.available,
        streamUrl: `/api/feed/events/${encodeURIComponent(publicRef)}/view`,
        streamType: 'iframe',
      };
    }

    return {
      available: payload.available,
      streamUrl: null,
      streamType: null,
    };
  }

  async getEventDetail(ref: string): Promise<WcOddsEventDetailDto> {
    this.assertEnabled();

    const cached = this.realtime.getEventCache(ref);
    if (cached) return cached;

    let event = await this.findEventByRef(ref);
    if (!event) throw new NotFoundException('Event not found');

    const refreshed = await this.realtime.refreshEvent(ref, false, { fullMarkets: true });
    if (refreshed) return sanitizePublicEventDetail(refreshed);

    const groupedMarkets = (event.marketsJson ?? {}) as WcGroupedMarkets;
    const [dto] = await this.toDtos([event]);

    return sanitizePublicEventDetail({
      ...dto,
      groupedMarkets,
    });
  }

  async placeBet(params: {
    userId: number;
    eventId: string;
    pick?: WcOddsPick;
    marketKey?: string;
    groupKey?: string;
    outcomeKey?: string;
    line?: string;
    outcomeName?: string;
    stake: number;
    currencyCode: string;
    clientOdds?: number;
    acceptOddsChange?: boolean;
    /** Set only via X-WC-Probe-Secret — hidden from user coupons. */
    isProbe?: boolean;
  }) {
    this.assertEnabled();

    const minStake = Number(this.config.get<string>('WC_ODDS_MIN_STAKE', '100'));
    const maxStake = Number(this.config.get<string>('WC_ODDS_MAX_STAKE', '500000'));

    if (!Number.isFinite(params.stake) || params.stake < minStake || params.stake > maxStake) {
      throw new BadRequestException(`Stake must be between ${minStake} and ${maxStake}`);
    }

    let event = await this.findEventByRef(params.eventId);
    if (!event) throw new NotFoundException('Event not found');

    const publicRef = event.slug?.trim() || toPublicEventId(event.id);
    const refreshed = await this.realtime.refreshEvent(publicRef, true, {
      fullMarkets: true,
      persistOdds: true,
    });
    if (refreshed) {
      event = await this.findEventByRef(params.eventId);
      if (!event) throw new NotFoundException('Event not found');
    }

    if (refreshed?.bettingOpen === false) {
      throw new BadRequestException('Betting closed for this match');
    }

    if (!isWcBettingOpen(event.completed, event.commenceTime)) {
      throw new BadRequestException('Betting closed for this match');
    }

    const rawMarketKey = params.marketKey || 'h2h';
    if (!isWcBetPlacementAllowed(rawMarketKey, params.outcomeKey)) {
      throw new BadRequestException('This market is not available for betting');
    }

    const marketKey = normalizeWcMarketKey(rawMarketKey);
    const groupedMarkets = (
      refreshed?.groupedMarkets ?? event.marketsJson ?? {}
    ) as WcGroupedMarkets;

    let pick: WcOddsPick | null = params.pick ?? null;
    let outcomeKey = params.outcomeKey ?? null;
    let line = params.line ?? null;
    let outcomeName = params.outcomeName ?? null;
    let odds: number | null = null;
    const storedMarketKey = rawMarketKey;
    const groupKey = params.groupKey ?? null;

    if (marketKey === 'h2h') {
      if (!pick && outcomeKey) pick = outcomeKeyToPick(outcomeKey);
      if (!outcomeKey && pick) outcomeKey = pick;

      if (!pick || !outcomeKey) {
        throw new BadRequestException('Pick required for 1X2 market');
      }

      const oddsMap: Record<WcOddsPick, Decimal | null> = {
        [WcOddsPick.HOME]: event.oddsHome,
        [WcOddsPick.DRAW]: event.oddsDraw,
        [WcOddsPick.AWAY]: event.oddsAway,
      };
      odds = findOutcomeOdds(groupedMarkets, rawMarketKey, outcomeKey, null, groupKey)
        ?? findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, null, groupKey);
      if (odds == null) {
        const oddsDec = oddsMap[pick];
        odds = oddsDec ? Number(oddsDec) : null;
      }
      if (!outcomeName) {
        outcomeName = pick === WcOddsPick.HOME ? 'П1' : pick === WcOddsPick.DRAW ? 'X' : 'П2';
      }
    } else if (marketKey === 'double_chance') {
      if (!outcomeKey) throw new BadRequestException('Outcome required');
      odds = findOutcomeOdds(groupedMarkets, rawMarketKey, outcomeKey, null, groupKey)
        ?? findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, null, groupKey);
      if (!outcomeName) {
        outcomeName =
          outcomeKey === 'DC_1X' ? '1X' : outcomeKey === 'DC_12' ? '12' : outcomeKey === 'DC_X2' ? 'X2' : outcomeKey;
      }
    } else if (marketKey === 'handicap') {
      if (!outcomeKey) throw new BadRequestException('Outcome required');
      odds = findOutcomeOdds(groupedMarkets, rawMarketKey, outcomeKey, null, groupKey)
        ?? findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, null, groupKey);
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
      odds = findOutcomeOdds(groupedMarkets, rawMarketKey, outcomeKey, line, groupKey)
        ?? findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, line, groupKey);
    }

    if (odds == null || !Number.isFinite(odds)) {
      throw new BadRequestException('Odds unavailable for this outcome');
    }

    const matchedOutcome = outcomeKey
      ? findMarketOutcome(groupedMarkets, rawMarketKey, outcomeKey, line, groupKey)
        ?? findMarketOutcome(groupedMarkets, marketKey, outcomeKey, line, groupKey)
      : null;
    if (matchedOutcome?.suspended) {
      throw new BadRequestException('This outcome is temporarily suspended');
    }
    if (matchedOutcome && (!Number.isFinite(matchedOutcome.price) || matchedOutcome.price <= 1)) {
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
      ? findMarketGroup(groupedMarkets, rawMarketKey, outcomeKey ?? '', line, groupKey)?.label ?? null
      : findMarketGroup(groupedMarkets, rawMarketKey, outcomeKey ?? '', line, groupKey)?.label ?? null;

    const olimpbetId = olimpbetIdFromWcEventId(event.id);
    let placementDetail: Awaited<ReturnType<OlimpbetWcService['fetchEventDetail']>> = null;
    if (olimpbetId) {
      placementDetail = await this.olimpbet.fetchEventDetail(olimpbetId);
      if (placementDetail) {
        const scope = resolveBetPlacementScope({
          marketKey: rawMarketKey,
          outcomeKey,
          outcomeName,
          groupKey,
          totalsGroupLabel,
        });
        if (scope && isMarketScopeFinalized(placementDetail, scope)) {
          throw new BadRequestException('Betting closed for this period');
        }
      }
    }

    const oddsTolerance = Number(this.config.get<string>('WC_ODDS_TOLERANCE', '0.02'));
    if (
      !params.acceptOddsChange
      && params.clientOdds != null
      && Number.isFinite(params.clientOdds)
      && Math.abs(params.clientOdds - odds) > oddsTolerance
    ) {
      throw new BadRequestException({
        message: 'Odds have changed',
        coefficientChanged: true,
        originalCoefficient: params.clientOdds,
        actualCoefficient: odds,
      });
    }

    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currencyCode: {
          userId: params.userId,
          currencyCode: params.currencyCode,
        },
      },
    });
    if (!balance || balance.amount.lessThan(new Decimal(params.stake))) {
      throw new BadRequestException('Insufficient funds');
    }

    const effectiveStakeNum = toStakeNumber(computeMainAccountBetDebit(balance.amount, params.stake));
    if (effectiveStakeNum < minStake) {
      throw new BadRequestException(`Stake must be between ${minStake} and ${maxStake}`);
    }

    const stake = new Decimal(effectiveStakeNum);
    const potentialPayout = stake.mul(odds).toDecimalPlaces(2);

    const homeScore = event.homeScore ?? 0;
    const awayScore = event.awayScore ?? 0;
    let placementContext = buildBetPlacementContext({
      marketKey: storedMarketKey,
      outcomeKey,
      homeScore,
      awayScore,
      matchState: parseMatchState(event.matchStateJson),
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
        marketKey: storedMarketKey,
        outcomeKey,
        homeScore: score.homeScore ?? homeScore,
        awayScore: score.awayScore ?? awayScore,
        detail: placementDetail,
        matchState,
        totalsGroupLabel,
      });
    }

    const bet = await this.prisma.$transaction(async (tx) => {
      await this.operationService.create(tx, params.userId, {
        amount: stake,
        currencyCode: params.currencyCode,
        source: OperationSource.WC_BET,
        status: OperationStatus.SUCCESS,
        type: OperationType.OUTCOME,
        meta: { eventId: params.eventId, marketKey: storedMarketKey, outcomeKey, pick },
      });

      return tx.wcOddsBet.create({
        data: {
          userId: params.userId,
          eventId: event.id,
          pick: pick ?? undefined,
          marketKey: storedMarketKey,
          outcomeKey,
          line,
          outcomeName,
          odds: new Decimal(odds),
          stake,
          currencyCode: params.currencyCode,
          potentialPayout,
          status: WcOddsBetStatus.PENDING,
          placementContextJson: placementContext as object,
          isProbe: params.isProbe === true,
        },
        include: {
          event: true,
        },
      });
    });

    return bet;
  }

  /** Validates wc-bet-probe script header; normal users cannot mark probe bets. */
  isProbePlacement(probeSecret?: string | null): boolean {
    const expected = this.config.get<string>('WC_PROBE_SECRET');
    if (!expected || !probeSecret) return false;
    return probeSecret === expected;
  }

  async getUserBet(userId: number, betId: number) {
    this.assertEnabled();
    const bet = await this.prisma.wcOddsBet.findFirst({
      where: { id: betId, userId, isProbe: false },
      include: { event: true },
    });
    if (!bet) throw new NotFoundException('Bet not found');
    const [dto] = await this.mapBetsToPublicDtos([bet]);
    return dto;
  }

  async listUserBets(userId: number) {
    return this.listUserBetsGrouped(userId);
  }

  async listUserBetsGrouped(userId: number) {
    this.assertEnabled();
    const ordinarRows = await this.prisma.wcOddsBet.findMany({
      where: { userId, isProbe: false, wcExpressBetId: null },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const expressRows = await this.prisma.wcOddsExpressBet.findMany({
      where: { userId },
      include: { legs: { include: { event: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const ordinar = await this.mapBetsToPublicDtos(ordinarRows);
    const express = await Promise.all(
      expressRows.map(async (parent) => ({
        id: parent.id,
        stake: Number(parent.stake).toFixed(2),
        combinedOdds: Number(parent.combinedOdds).toFixed(2),
        potentialPayout: Number(parent.potentialPayout).toFixed(2),
        status: parent.status,
        currencyCode: parent.currencyCode,
        createdAt: parent.createdAt.toISOString(),
        legs: await this.mapBetsToPublicDtos(parent.legs),
      })),
    );

    return { ordinar, express };
  }

  /** @deprecated use listUserBetsGrouped */
  async listUserBetsFlat(userId: number) {
    this.assertEnabled();
    const rows = await this.prisma.wcOddsBet.findMany({
      where: { userId, isProbe: false },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return this.mapBetsToPublicDtos(rows);
  }

  private async mapBetsToPublicDtos(
    rows: Array<
      import('@prisma/client').WcOddsBet & { event: WcOddsEvent | null }
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
      const event = baseDto && eventRow
        ? this.buildBetListEventPayload(eventRow.id, eventRow.slug, baseDto)
        : eventRow
          ? {
              id: toPublicEventId(eventRow.id),
              slug: eventRow.slug ?? undefined,
              sport: undefined,
              leagueName: eventRow.leagueName ?? undefined,
              homeTeam: eventRow.homeTeam,
              awayTeam: eventRow.awayTeam,
              commenceTime: eventRow.commenceTime.toISOString(),
              homeScore: eventRow.homeScore,
              awayScore: eventRow.awayScore,
              completed: eventRow.completed,
            }
          : null;

      return {
        id: bet.id,
        pick: bet.pick,
        marketKey: bet.marketKey,
        outcomeKey: bet.outcomeKey,
        line: bet.line,
        outcomeName: bet.outcomeName,
        odds: Number(bet.odds).toFixed(2),
        stake: Number(bet.stake).toFixed(2),
        potentialPayout: Number(bet.potentialPayout).toFixed(2),
        cashoutAmount: bet.cashoutAmount != null ? Number(bet.cashoutAmount).toFixed(2) : null,
        status: bet.status,
        currencyCode: bet.currencyCode,
        createdAt: bet.createdAt.toISOString(),
        event,
      };
    });
  }

  private buildBetListEventPayload(
    internalId: string,
    slug: string | null,
    base: import('./wc-odds.types').WcOddsEventDto,
  ) {
    const merged = this.mergeBetEventFromCache(internalId, slug, base);
    return {
      id: merged.id,
      slug: merged.slug,
      sport: merged.sport,
      leagueName: merged.leagueName,
      homeTeam: merged.homeTeam,
      awayTeam: merged.awayTeam,
      commenceTime: merged.commenceTime,
      homeScore: merged.homeScore,
      awayScore: merged.awayScore,
      completed: merged.completed,
      phase: merged.phase,
      parsedScore: merged.parsedScore ?? null,
      homeTeamIcon: merged.homeTeamIcon ?? null,
      awayTeamIcon: merged.awayTeamIcon ?? null,
    };
  }

  private mergeBetEventFromCache(
    internalId: string,
    slug: string | null,
    base: import('./wc-odds.types').WcOddsEventDto,
  ): import('./wc-odds.types').WcOddsEventDto {
    const fromLive = this.realtime.getLiveCache().find((event) => event.id === internalId);
    const fromLine = fromLive
      ? null
      : this.realtime.getLineCache().find((event) => event.id === internalId);
    const cachedDetail =
      this.realtime.getEventCache(slug ?? internalId)
      ?? this.realtime.getEventCache(base.slug)
      ?? null;
    const structured = this.realtime.getStructuredStatsCache(internalId);
    const source = fromLive ?? fromLine ?? cachedDetail;

    if (source) {
      return sanitizePublicEventDto({
        ...base,
        ...source,
        id: base.id,
        slug: source.slug || base.slug,
        parsedScore: source.parsedScore ?? base.parsedScore ?? structured?.parsedScore ?? null,
        statList: source.statList?.length ? source.statList : (structured?.statList ?? base.statList),
        homeScore: source.homeScore ?? base.homeScore,
        awayScore: source.awayScore ?? base.awayScore,
        phase: source.phase ?? base.phase,
        homeTeamIcon: source.homeTeamIcon ?? base.homeTeamIcon,
        awayTeamIcon: source.awayTeamIcon ?? base.awayTeamIcon,
        completed: source.completed ?? base.completed,
      });
    }

    if (structured) {
      return sanitizePublicEventDto({
        ...base,
        parsedScore: structured.parsedScore ?? base.parsedScore ?? null,
        statList: structured.statList?.length ? structured.statList : base.statList,
      });
    }

    return base;
  }

  async getBetShare(userId: number, betId: number) {
    this.assertEnabled();
    const bet = await this.prisma.wcOddsBet.findFirst({
      where: { id: betId, userId, isProbe: false },
      include: { event: true },
    });
    if (!bet || !bet.event) throw new NotFoundException('Bet not found');

    const baseUrl = (this.config.get<string>('BASE_URL') || 'https://imba.bet').replace(/\/$/, '');
    const shareInput = {
      id: bet.id,
      outcomeName: bet.outcomeName,
      odds: Number(bet.odds).toFixed(2),
      stake: Number(bet.stake).toFixed(2),
      potentialPayout: Number(bet.potentialPayout).toFixed(2),
      currencyCode: bet.currencyCode,
      status: bet.status,
      homeTeam: bet.event.homeTeam,
      awayTeam: bet.event.awayTeam,
      commenceTime: bet.event.commenceTime.toISOString(),
      eventSlug: bet.event.slug,
    };

    return {
      text: buildWcBetShareText(shareInput, baseUrl),
      svg: buildWcBetShareSvg(shareInput),
      url: shareInput.eventSlug
        ? `${baseUrl}/game/${shareInput.eventSlug}`
        : baseUrl,
    };
  }

  async getMyTournament(userId: number) {
    this.assertEnabled();
    const bets = await this.prisma.wcOddsBet.findMany({
      where: { userId, isProbe: false },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
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

    const favoriteTeam = [...teamCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const settled = wins + losses;
    const roiPercent = totalStaked > 0 && settled > 0
      ? Math.round(((totalWon - totalStaked) / totalStaked) * 1000) / 10
      : null;

    const openBets = await this.mapBetsToPublicDtos(
      bets.filter((b) => b.status === WcOddsBetStatus.PENDING).slice(0, 10),
    );
    const recentSettled = await this.mapBetsToPublicDtos(
      bets
        .filter((b) => b.status !== WcOddsBetStatus.PENDING)
        .slice(0, 10),
    );

    return {
      summary: {
        totalBets: bets.length,
        wins,
        losses,
        pending,
        totalStaked: Math.round(totalStaked * 100) / 100,
        totalWon: Math.round(totalWon * 100) / 100,
        roiPercent,
      },
      favoriteTeam: favoriteTeam
        ? { name: favoriteTeam[0], betCount: favoriteTeam[1] }
        : null,
      openBets,
      recentSettled,
    };
  }

  async getEventSubscription(userId: number, ref: string) {
    this.assertEnabled();
    const event = await this.findEventByRef(ref);
    if (!event) throw new NotFoundException('Event not found');

    const sub = await this.prisma.wcEventSubscription.findUnique({
      where: { userId_eventId: { userId, eventId: event.id } },
    });

    return {
      subscribed: Boolean(sub),
      notifyGoals: sub?.notifyGoals ?? true,
      notifyStart: sub?.notifyStart ?? true,
      eventId: event.id,
    };
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
      where: { id: userId },
      select: { telegramLinkedAt: true },
    });
    if (!user?.telegramLinkedAt) {
      throw new BadRequestException('Привяжите Telegram в настройках профиля');
    }

    await this.prisma.wcEventSubscription.upsert({
      where: { userId_eventId: { userId, eventId: event.id } },
      create: {
        userId,
        eventId: event.id,
        notifyGoals: opts?.notifyGoals ?? true,
        notifyStart: opts?.notifyStart ?? true,
      },
      update: {
        notifyGoals: opts?.notifyGoals ?? true,
        notifyStart: opts?.notifyStart ?? true,
      },
    });

    return { ok: true, subscribed: true };
  }

  async unsubscribeEvent(userId: number, ref: string) {
    this.assertEnabled();
    const event = await this.findEventByRef(ref);
    if (!event) throw new NotFoundException('Event not found');

    await this.prisma.wcEventSubscription.deleteMany({
      where: { userId, eventId: event.id },
    });

    return { ok: true, subscribed: false };
  }

  async listAllBets(status?: WcOddsBetStatus) {
    this.assertEnabled();
    return this.prisma.wcOddsBet.findMany({
      where: {
        isProbe: false,
        ...(status ? { status } : {}),
      },
      include: { event: true, user: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
