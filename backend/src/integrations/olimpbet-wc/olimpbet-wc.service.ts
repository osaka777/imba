import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { WcGroupedMarkets } from '../wc-odds/wc-odds-markets.util';
import { collectGroupedMarketsWarnings, extractMainTotalLine } from '../wc-odds/wc-odds-markets.util';
import type {
  OlimpbetStructuredStatistics,
  WcEventStatsPayload,
} from '../wc-odds/wc-odds-statistics.types';
import { findUnknownOlimpbetInlineStatCodes } from '../wc-odds/olimpbet-inline-stats.util';
import {
  collectLinkedStatRows,
  mergeLinkedStatsIntoList,
} from '../wc-odds/olimpbet-linked-stats.util';
import { buildWcStatsPayload } from '../wc-odds/wc-odds-statistics.util';

import {
  buildOlimpbetCompetitorMeta,
  type OlimpbetCompetitorMeta,
} from './olimpbet-competitor.util';
import { OlimpbetAuthService } from './olimpbet-auth.service';
import {
  fetchOlimpbetCompetitorLogos,
  resolveOlimpbetCompetitorLogo,
} from './olimpbet-logos.util';
import {
  extractOlimpbetScore,
  isOlimpbetEventCancelled,
  isOlimpbetEventCompleted,
  isOlimpbetFeedBettingOpen,
  resolveOlimpbetEventResult,
} from './olimpbet-event-result.util';
import {
  parseOlimpbetFullEvent,
  pickLinkedEventIds,
} from './olimpbet-wc-markets.parser';
import {
  linkedEventIdsForSettlement,
  mergeOlimpbetProbabilityDetails,
} from './olimpbet-settlement-detail.util';
import { olimpbetTeamToWcEnglish, teamsMatchLoose } from './olimpbet-wc-team-map';
import {
  DEFAULT_OLIMPBET_SPORT_IDS,
  olimpbetLineWindowMs,
} from './olimpbet-sport.util';
import {
  compareOlimpbetPriority,
  resolveOlimpbetPriorityLevel,
  type OlimpbetPriorityLevel,
} from './olimpbet-priority.util';
import type {
  OlimpbetEventDetail,
  OlimpbetV2EventListItem,
  OlimpbetV2EventListResponse,
} from './olimpbet-wc.types';

import type { WcOddsEventDto } from '../wc-odds/wc-odds.types';

const API_HOST = 'https://olimpbet.kz/api';

export type OlimpbetLineEventRow = {
  olimpbetEventId: number;
  olimpbetSportId: number;
  tournamentId: number | null;
  tournamentName: string;
  live: boolean;
  commenceTimeIso: string;
  homeTeamRu: string;
  awayTeamRu: string;
  homeTeamEn: string | null;
  awayTeamEn: string | null;
  priorityLevel: OlimpbetPriorityLevel;
};

type OlimEventIndexRow = OlimpbetLineEventRow;

export type OlimpbetWcMatchSnapshot = {
  olimpbetEventId: number;
  live: boolean;
  commenceTimeIso: string;
  homeTeamRu: string;
  awayTeamRu: string;
  homeTeamEn: string | null;
  awayTeamEn: string | null;
  groupedMarkets: WcGroupedMarkets;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  totalLine: number | null;
  oddsOver: number | null;
  oddsUnder: number | null;
  homeCompetitorId?: number | null;
  awayCompetitorId?: number | null;
  homeTeamIcon?: string | null;
  awayTeamIcon?: string | null;
  hasBroadcast?: boolean;
};

export type OlimpbetBroadcastPayload = {
  available: boolean;
  streamUrl: string | null;
  streamType: 'hls' | 'iframe' | null;
};

@Injectable()
export class OlimpbetWcService {
  private readonly logger = new Logger(OlimpbetWcService.name);

  private indexCache: {
    builtAtMs: number;
    rows: OlimEventIndexRow[];
    byKey: Map<string, OlimEventIndexRow>;
  } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: OlimpbetAuthService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('WC_OLIMPBET_ENABLED', 'false') === 'true';
  }

  isEventCompleted(detail: OlimpbetEventDetail, nowMs?: number): boolean {
    return isOlimpbetEventCompleted(detail, nowMs);
  }

  isFeedBettingOpen(detail: OlimpbetEventDetail, nowMs?: number): boolean {
    return isOlimpbetFeedBettingOpen(detail, nowMs);
  }

  isEventCancelled(detail: OlimpbetEventDetail): boolean {
    return isOlimpbetEventCancelled(detail);
  }

  extractScore(detail: OlimpbetEventDetail): { homeScore: number | null; awayScore: number | null } {
    return extractOlimpbetScore(detail);
  }

  resolveEventResult(detail: OlimpbetEventDetail, nowMs?: number) {
    return resolveOlimpbetEventResult(detail, nowMs);
  }

  displayTeamName(ruName: string): string {
    return olimpbetTeamToWcEnglish(ruName) ?? ruName;
  }

  async enrichEventDtos<T extends WcOddsEventDto>(
    dtos: T[],
    rows: Array<{ homeCompetitorId?: number | null; awayCompetitorId?: number | null }>,
  ): Promise<T[]> {
    if (dtos.length === 0) return dtos;

    const ids = rows.flatMap((row) => [
      row.homeCompetitorId,
      row.awayCompetitorId,
    ]).filter((id): id is number => typeof id === 'number' && Number.isFinite(id));

    const logoMap = await fetchOlimpbetCompetitorLogos(ids);

    return dtos.map((dto, index) => {
      const row = rows[index];
      const homeTeamIcon = resolveOlimpbetCompetitorLogo(row?.homeCompetitorId, logoMap);
      const awayTeamIcon = resolveOlimpbetCompetitorLogo(row?.awayCompetitorId, logoMap);
      if (dto.homeTeamIcon === homeTeamIcon && dto.awayTeamIcon === awayTeamIcon) {
        return dto;
      }
      return { ...dto, homeTeamIcon, awayTeamIcon };
    });
  }

  private sportIds(): number[] {
    const raw = this.config.get<string>(
      'WC_OLIMPBET_SPORT_IDS',
      DEFAULT_OLIMPBET_SPORT_IDS.join(','),
    );
    return raw
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  private tournamentIds(): number[] {
    const raw = this.config.get<string>('WC_OLIMPBET_TOURNAMENT_IDS', '');
    return raw
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  private isWithinLineWindow(commenceTimeIso: string, sportId: number, nowMs = Date.now()): boolean {
    const kickoff = Date.parse(commenceTimeIso);
    if (!Number.isFinite(kickoff)) return false;
    const windowMs = olimpbetLineWindowMs(sportId);
    return kickoff > nowMs && kickoff <= nowMs + windowMs;
  }

  private async fetchJson<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T | null> {
    const url = new URL(`${API_HOST}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`Olimpbet API error ${res.status} ${path}: ${body.slice(0, 160)}`);
      return null;
    }

    return (await res.json()) as T;
  }

  private indexKey(commenceTimeIso: string, teamA: string, teamB: string): string {
    return `${commenceTimeIso}::${teamA.toLowerCase()}::${teamB.toLowerCase()}`;
  }

  private rowFromListItem(
    e: OlimpbetV2EventListItem,
    olimpbetSportId: number,
    mode: 'line' | 'live' = 'line',
  ): OlimEventIndexRow | null {
    if (!e?.id || !e.eventDate) return null;

    const kickoff = Date.parse(e.eventDate);
    if (!Number.isFinite(kickoff)) return null;

    const sportId = e.tournament?.sportId ?? olimpbetSportId;

    if (mode === 'line') {
      if (!this.isWithinLineWindow(e.eventDate, sportId)) return null;
    } else {
      const nowMs = Date.now();
      if (!e.live && kickoff > nowMs) return null;
    }

    const comps = e.competitors ?? [];
    if (comps.length < 2) return null;

    const homeId = (e.homeCompetitorIds ?? [])[0];
    const homeRu = comps.find((c) => c.id === homeId)?.name ?? comps[0]?.name;
    const awayRu = comps.find((c) => c.id !== homeId)?.name ?? comps[1]?.name;
    if (!homeRu || !awayRu) return null;

    return {
      olimpbetEventId: e.id,
      olimpbetSportId: sportId,
      tournamentId: e.tournament?.id ?? null,
      tournamentName: e.tournament?.name?.trim() || 'Olimpbet',
      live: Boolean(e.live),
      commenceTimeIso: e.eventDate,
      homeTeamRu: homeRu,
      awayTeamRu: awayRu,
      homeTeamEn: olimpbetTeamToWcEnglish(homeRu),
      awayTeamEn: olimpbetTeamToWcEnglish(awayRu),
      priorityLevel: resolveOlimpbetPriorityLevel(e.tags, e.tournament?.tags),
    };
  }

  private async listSportEventsPage(
    sportId: number,
    params: {
      live?: boolean;
      tournamentId?: number;
      paginationKey?: string;
    },
  ): Promise<OlimpbetV2EventListResponse | null> {
    return this.fetchJson<OlimpbetV2EventListResponse>('/v2/events', {
      'sport-ids': sportId,
      'page-size': 100,
      locale: 'ru',
      platform: 'web-desktop',
      ...(params.live === undefined ? {} : { live: params.live }),
      ...(params.tournamentId ? { 'tournament-ids': params.tournamentId } : {}),
      ...(params.paginationKey ? { 'pagination-key': params.paginationKey } : {}),
    });
  }

  async listSportEvents(sportId: number, live?: boolean): Promise<OlimEventIndexRow[]> {
    const rows: OlimEventIndexRow[] = [];
    const mode: 'line' | 'live' = live ? 'live' : 'line';
    const tournamentFilter = this.tournamentIds();
    const tournamentIds = tournamentFilter.length > 0 ? tournamentFilter : [undefined];

    for (const tournamentId of tournamentIds) {
      let paginationKey: string | undefined;
      let pages = 0;

      do {
        const list = await this.listSportEventsPage(sportId, {
          live,
          tournamentId,
          paginationKey,
        });

        for (const e of list?.items ?? []) {
          const row = this.rowFromListItem(e, sportId, mode);
          if (row) rows.push(row);
        }

        paginationKey = list?.paginationKeyForward ?? undefined;
        pages += 1;
      } while (paginationKey && pages < 50);
    }

    return rows;
  }

  async listAllLiveEvents(): Promise<OlimEventIndexRow[]> {
    const byId = new Map<number, OlimEventIndexRow>();

    for (const sportId of this.sportIds()) {
      const rows = await this.listSportEvents(sportId, true);
      for (const row of rows) {
        byId.set(row.olimpbetEventId, row);
      }
    }

    return [...byId.values()].sort(
      (a, b) =>
        compareOlimpbetPriority(a.priorityLevel, b.priorityLevel)
        || a.tournamentName.localeCompare(b.tournamentName, 'ru')
        || Date.parse(b.commenceTimeIso) - Date.parse(a.commenceTimeIso)
        || a.olimpbetEventId - b.olimpbetEventId,
    );
  }

  async listAllLineEvents(): Promise<OlimEventIndexRow[]> {
    const byId = new Map<number, OlimEventIndexRow>();

    for (const sportId of this.sportIds()) {
      const prematch = await this.listSportEvents(sportId, false);
      for (const row of prematch) {
        byId.set(row.olimpbetEventId, row);
      }
    }

    return [...byId.values()].sort(
      (a, b) =>
        compareOlimpbetPriority(a.priorityLevel, b.priorityLevel)
        || a.tournamentName.localeCompare(b.tournamentName, 'ru')
        || Date.parse(a.commenceTimeIso) - Date.parse(b.commenceTimeIso)
        || a.olimpbetEventId - b.olimpbetEventId,
    );
  }

  /** @deprecated use listAllLineEvents */
  async listAllFootballEvents(): Promise<OlimEventIndexRow[]> {
    return this.listAllLineEvents();
  }

  /** @deprecated use listSportEvents */
  async listFootballEvents(live?: boolean): Promise<OlimEventIndexRow[]> {
    return this.listSportEvents(100, live);
  }

  async buildIndex(force = false): Promise<{ rows: OlimEventIndexRow[]; byKey: Map<string, OlimEventIndexRow> }> {
    const now = Date.now();
    if (!force && this.indexCache && now - this.indexCache.builtAtMs < 5 * 60_000) {
      return { rows: this.indexCache.rows, byKey: this.indexCache.byKey };
    }

    const rows = await this.listAllLineEvents();
    const byKey = new Map<string, OlimEventIndexRow>();

    for (const row of rows) {
      const keys = [
        this.indexKey(row.commenceTimeIso, row.homeTeamRu, row.awayTeamRu),
        this.indexKey(row.commenceTimeIso, row.awayTeamRu, row.homeTeamRu),
      ];
      if (row.homeTeamEn && row.awayTeamEn) {
        keys.push(
          this.indexKey(row.commenceTimeIso, row.homeTeamEn, row.awayTeamEn),
          this.indexKey(row.commenceTimeIso, row.awayTeamEn, row.homeTeamEn),
        );
      }
      for (const k of keys) byKey.set(k, row);
    }

    this.indexCache = { builtAtMs: now, rows, byKey };
    return { rows, byKey };
  }

  findIndexRow(
    byKey: Map<string, OlimEventIndexRow>,
    commenceTimeIso: string,
    homeTeam: string,
    awayTeam: string,
  ): OlimEventIndexRow | null {
    const exact =
      byKey.get(this.indexKey(commenceTimeIso, homeTeam, awayTeam)) ??
      byKey.get(this.indexKey(commenceTimeIso, awayTeam, homeTeam));
    if (exact) return exact;

    const kickoff = Date.parse(commenceTimeIso);
    if (!Number.isFinite(kickoff)) return null;

    for (const row of byKey.values()) {
      const rowKick = Date.parse(row.commenceTimeIso);
      if (!Number.isFinite(rowKick)) continue;
      if (Math.abs(rowKick - kickoff) > 3 * 60 * 60_000) continue;
      if (
        (teamsMatchLoose(row.homeTeamEn ?? row.homeTeamRu, homeTeam) &&
          teamsMatchLoose(row.awayTeamEn ?? row.awayTeamRu, awayTeam)) ||
        (teamsMatchLoose(row.homeTeamEn ?? row.homeTeamRu, awayTeam) &&
          teamsMatchLoose(row.awayTeamEn ?? row.awayTeamRu, homeTeam))
      ) {
        return row;
      }
    }

    return null;
  }

  async fetchEventDetail(eventId: number): Promise<OlimpbetEventDetail | null> {
    return this.fetchJson<OlimpbetEventDetail>(`/events/${eventId}`, { locale: 'ru' });
  }

  /** Main event + linked statistics/special markets for DISPLAY settlement snapshots. */
  async fetchSettlementDetail(main: OlimpbetEventDetail): Promise<OlimpbetEventDetail> {
    const linked: OlimpbetEventDetail[] = [];
    for (const id of linkedEventIdsForSettlement(main)) {
      const detail = await this.fetchEventDetail(id);
      if (detail?.probabilities?.markets?.length) linked.push(detail);
    }
    return mergeOlimpbetProbabilityDetails(main, linked);
  }

  async fetchEventStatistics(eventId: number): Promise<OlimpbetStructuredStatistics | null> {
    const data = await this.fetchJson<OlimpbetStructuredStatistics>(`/events/${eventId}/statistics`, {
      locale: 'ru',
    });
    if (!data || 'errors' in (data as object)) return null;
    return data;
  }

  private readonly loggedUnknownInlineStats = new Map<number, number>();
  private readonly unknownInlineStatsTtlMs = 60 * 60 * 1000;

  async fetchEventStatsPayload(
    sportSlug: string,
    olimpbetEventId: number,
    detail?: OlimpbetEventDetail | null,
    options?: {
      skipStructuredFetch?: boolean;
      includeLinkedStats?: boolean;
      linkedDetails?: Map<number, OlimpbetEventDetail>;
    },
  ): Promise<WcEventStatsPayload> {
    const main = detail ?? await this.fetchEventDetail(olimpbetEventId);
    if (!main) {
      return { parsedScore: null, statList: [], homeScore: null, awayScore: null };
    }

    const inline = main.statistics ?? [];
    this.logUnknownInlineStatCodes(olimpbetEventId, inline);

    const needsStructured =
      !options?.skipStructuredFetch
      && (
        Boolean(main.live)
        || inline.length > 0
        || sportSlug === 'soccer'
      );

    let structured: OlimpbetStructuredStatistics | null = null;
    if (needsStructured) {
      structured = await this.fetchEventStatistics(olimpbetEventId);
    }

    const payload = buildWcStatsPayload(sportSlug, main, structured, {
      structuredFetched: needsStructured && structured != null,
    });

    const shouldFetchLinked =
      options?.includeLinkedStats === true
      && Boolean(main.live)
      && (main.linkedEvents?.length ?? 0) > 0;

    if (shouldFetchLinked) {
      const linkedRows = await this.collectLinkedStatRows(main, options?.linkedDetails);
      if (linkedRows.length > 0) {
        payload.statList = mergeLinkedStatsIntoList(payload.statList, linkedRows);
      }
    }

    return payload;
  }

  private logUnknownInlineStatCodes(
    olimpbetEventId: number,
    inline: OlimpbetEventDetail['statistics'],
  ): void {
    const unknown = findUnknownOlimpbetInlineStatCodes(inline);
    if (unknown.length === 0) return;

    const now = Date.now();
    const lastLogged = this.loggedUnknownInlineStats.get(olimpbetEventId) ?? 0;
    if (now - lastLogged < this.unknownInlineStatsTtlMs) return;

    this.loggedUnknownInlineStats.set(olimpbetEventId, now);
    this.logger.debug(
      `Olimpbet unknown inline stats event=${olimpbetEventId} codes=${unknown.join(',')}`,
    );
  }

  private async collectLinkedStatRows(
    main: OlimpbetEventDetail,
    prefetched?: Map<number, OlimpbetEventDetail>,
  ) {
    const refs = main.linkedEvents ?? [];
    if (refs.length === 0) return [];

    const detailsById = new Map<number, OlimpbetEventDetail>(prefetched ?? []);
    const missingIds = refs
      .map((ref) => ref.eventId)
      .filter((id) => Number.isFinite(id) && !detailsById.has(id))
      .slice(0, 20);

    await Promise.all(missingIds.map(async (id) => {
      const detail = await this.fetchEventDetail(id);
      if (detail) detailsById.set(id, detail);
    }));

    return collectLinkedStatRows(refs, detailsById);
  }

  async buildLineSnapshotFromDetail(
    main: OlimpbetEventDetail,
    olimpbetEventId: number,
  ): Promise<OlimpbetWcMatchSnapshot> {
    return this.buildSnapshotFromMain(main, olimpbetEventId, false);
  }

  async buildFullSnapshotFromDetail(
    main: OlimpbetEventDetail,
    olimpbetEventId: number,
  ): Promise<OlimpbetWcMatchSnapshot> {
    return this.buildSnapshotFromMain(main, olimpbetEventId, true);
  }

  extractCompetitorMeta(detail: OlimpbetEventDetail): OlimpbetCompetitorMeta {
    return buildOlimpbetCompetitorMeta(detail);
  }

  async fetchEventBroadcast(olimpbetEventId: number): Promise<OlimpbetBroadcastPayload> {
    const main = await this.fetchEventDetail(olimpbetEventId);
    const available = main ? buildOlimpbetCompetitorMeta(main).hasBroadcast : false;
    if (!available) {
      return { available: false, streamUrl: null, streamType: null };
    }

    const cookie = await this.auth.getBroadcastCookieHeader();
    const url = new URL(`${API_HOST}/events/${olimpbetEventId}/broadcasts`);
    url.searchParams.set('locale', 'ru');
    url.searchParams.set('platform', 'DESKTOP');
    url.searchParams.set('redirect-url', 'https://olimpbet.kz');
    url.searchParams.set('preferred-broadcast-type', 'HLS');

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://olimpbet.kz/',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      });

      // Capture any refreshed session cookies (sliding session).
      this.auth.ingestResponse(res);

      if (!res.ok) {
        return { available: true, streamUrl: null, streamType: null };
      }

      const body = await res.json() as unknown;
      const streamUrl = this.extractBroadcastStreamUrl(body);
      const rawType =
        body && typeof body === 'object'
          ? String((body as Record<string, unknown>).broadcastType ?? '').toUpperCase()
          : '';
      let streamType: 'hls' | 'iframe' | null = null;
      if (streamUrl) {
        if (rawType === 'HLS' || streamUrl.includes('.m3u8')) {
          streamType = 'hls';
        } else if (rawType === 'IFRAME') {
          streamType = 'iframe';
        }
      }
      return { available: true, streamUrl, streamType };
    } catch (err) {
      this.logger.debug(
        `broadcast fetch failed for ${olimpbetEventId}: ${(err as Error).message}`,
      );
      return { available: true, streamUrl: null, streamType: null };
    }
  }

  private extractBroadcastStreamUrl(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    if ('errors' in (body as object)) return null;

    const root = body as Record<string, unknown>;
    const candidates: unknown[] = [
      root.broadcastUrl,
      root.streamUrl,
      root.hlsUrl,
      root.url,
      root.m3u8,
    ];

    const streams = root.streams ?? root.items ?? root.broadcasts;
    if (Array.isArray(streams)) {
      for (const item of streams) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;
        candidates.push(row.url, row.hlsUrl, row.m3u8, row.streamUrl, row.hls);
        const links = row.links;
        if (Array.isArray(links)) {
          for (const link of links) {
            if (!link || typeof link !== 'object') continue;
            const l = link as Record<string, unknown>;
            candidates.push(l.m3u8, l.hls, l.url, l.streamUrl);
          }
        }
      }
    }

    for (const value of candidates) {
      if (typeof value !== 'string' || !value.trim()) continue;
      const normalized = value.trim();
      if (normalized.startsWith('http') || normalized.includes('.m3u8')) {
        return normalized.startsWith('http')
          ? normalized
          : `https://olimpbet.kz${normalized.startsWith('/') ? '' : '/'}${normalized}`;
      }
    }

    return null;
  }

  async fetchFullGroupedMarkets(olimpbetEventId: number): Promise<WcGroupedMarkets> {
    const main = await this.fetchEventDetail(olimpbetEventId);
    if (!main?.probabilities?.markets?.length) return {};
    return this.fetchFullGroupedMarketsFromMain(main);
  }

  private async fetchFullGroupedMarketsFromMain(main: OlimpbetEventDetail): Promise<WcGroupedMarkets> {
    const linkedIds = pickLinkedEventIds(main);
    const linked: Array<{ detail: OlimpbetEventDetail; sectionLabel: string }> = [];

    for (const id of linkedIds) {
      const detail = await this.fetchEventDetail(id);
      if (!detail?.probabilities?.markets?.length) continue;
      linked.push({
        detail,
        sectionLabel: detail.eventType?.name ?? 'Статистика',
      });
    }

    return parseOlimpbetFullEvent(main, linked);
  }

  /** One API call — main-event markets only (line rows). */
  async fetchQuickLineSnapshot(olimpbetEventId: number): Promise<OlimpbetWcMatchSnapshot | null> {
    const main = await this.fetchEventDetail(olimpbetEventId);
    if (!main) return null;
    return this.buildSnapshotFromMain(main, olimpbetEventId, false);
  }

  async fetchMatchSnapshot(
    olimpbetEventId: number,
    options?: { includeLinked?: boolean },
  ): Promise<OlimpbetWcMatchSnapshot | null> {
    const main = await this.fetchEventDetail(olimpbetEventId);
    if (!main) return null;
    return this.buildSnapshotFromMain(main, olimpbetEventId, options?.includeLinked !== false);
  }

  private extractH2h(grouped: WcGroupedMarkets): {
    home: number | null;
    draw: number | null;
    away: number | null;
  } {
    for (const groups of Object.values(grouped)) {
      for (const g of groups) {
        if (g.marketKey !== 'h2h' && !g.marketKey.includes('MATCH_WINNER')) continue;
        const home = g.outcomes.find((o) => o.outcomeKey === 'HOME')?.price ?? null;
        const draw = g.outcomes.find((o) => o.outcomeKey === 'DRAW')?.price ?? null;
        const away = g.outcomes.find((o) => o.outcomeKey === 'AWAY')?.price ?? null;
        if (home && away) return { home, draw, away };
        if (g.outcomes.length === 2) {
          return {
            home: g.outcomes[0]?.price ?? null,
            draw: null,
            away: g.outcomes[1]?.price ?? null,
          };
        }
        if (g.outcomes.length >= 3 && home) {
          return { home, draw, away };
        }
      }
    }
    return { home: null, draw: null, away: null };
  }

  private async buildSnapshotFromMain(
    main: OlimpbetEventDetail,
    olimpbetEventId: number,
    includeLinked: boolean,
  ): Promise<OlimpbetWcMatchSnapshot> {
    const groupedMarkets = includeLinked
      ? await this.fetchFullGroupedMarketsFromMain(main)
      : await parseOlimpbetFullEvent(main, []);

    const marketWarnings = collectGroupedMarketsWarnings(
      groupedMarkets,
      String(olimpbetEventId),
    );
    if (marketWarnings.length > 0) {
      this.logger.warn(
        `Olimpbet markets warnings event=${olimpbetEventId} count=${marketWarnings.length} sample=${JSON.stringify(marketWarnings[0])}`,
      );
    }

    const h2h = this.extractH2h(groupedMarkets);
    const totals = extractMainTotalLine(groupedMarkets);

    const homeId = (main.homeCompetitorIds ?? [])[0];
    const homeRu = main.competitors.find((c) => c.id === homeId)?.name ?? main.competitors[0]?.name ?? '';
    const awayRu = main.competitors.find((c) => c.id !== homeId)?.name ?? main.competitors[1]?.name ?? '';
    const competitorMeta = buildOlimpbetCompetitorMeta(main);
    const logoMap = await fetchOlimpbetCompetitorLogos(
      [competitorMeta.homeCompetitorId, competitorMeta.awayCompetitorId]
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
    );

    return {
      olimpbetEventId,
      live: Boolean(main.live),
      commenceTimeIso: main.eventDate,
      homeTeamRu: homeRu,
      awayTeamRu: awayRu,
      homeTeamEn: olimpbetTeamToWcEnglish(homeRu),
      awayTeamEn: olimpbetTeamToWcEnglish(awayRu),
      groupedMarkets,
      oddsHome: h2h.home,
      oddsDraw: h2h.draw,
      oddsAway: h2h.away,
      totalLine: totals.totalLine,
      oddsOver: totals.oddsOver,
      oddsUnder: totals.oddsUnder,
      homeCompetitorId: competitorMeta.homeCompetitorId,
      awayCompetitorId: competitorMeta.awayCompetitorId,
      homeTeamIcon: resolveOlimpbetCompetitorLogo(competitorMeta.homeCompetitorId, logoMap),
      awayTeamIcon: resolveOlimpbetCompetitorLogo(competitorMeta.awayCompetitorId, logoMap),
      hasBroadcast: competitorMeta.hasBroadcast,
    };
  }

  async enrichGroupedMarkets(params: {
    commenceTimeIso: string;
    homeTeam: string;
    awayTeam: string;
    baseGroupedMarkets: WcGroupedMarkets;
  }): Promise<{
    groupedMarkets: WcGroupedMarkets;
    bookmakerKey: string;
    bookmakerTitle: string;
    snapshot?: OlimpbetWcMatchSnapshot;
  } | null> {
    if (!this.isEnabled()) return null;

    const { byKey } = await this.buildIndex();
    const row = this.findIndexRow(byKey, params.commenceTimeIso, params.homeTeam, params.awayTeam);
    if (!row) return null;

    const snapshot = await this.fetchMatchSnapshot(row.olimpbetEventId);
    if (!snapshot) return null;

    return {
      groupedMarkets: { ...params.baseGroupedMarkets, ...snapshot.groupedMarkets },
      bookmakerKey: 'olimpbet',
      bookmakerTitle: 'Olimpbet',
      snapshot,
    };
  }
}
