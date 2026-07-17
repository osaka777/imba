import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { WcGroupedMarkets } from '../wc-odds/wc-odds-markets.util';
import { collectGroupedMarketsWarnings, extractMainTotalLine } from '../wc-odds/wc-odds-markets.util';
import { filterFinalizedScopeMarkets } from '../wc-odds/wc-scope-market-filter.util';
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
import { stripJunkSpecialtyGroupedMarkets } from './olimpbet-wc-market-keys.util';
import {
  linkedEventIdsForSettlement,
  mergeOlimpbetProbabilityDetails,
} from './olimpbet-settlement-detail.util';
import { olimpbetTeamToWcEnglish, teamsMatchLoose } from './olimpbet-wc-team-map';
import { extractListH2hOdds } from './olimpbet-list-h2h.util';
import {
  DEFAULT_OLIMPBET_SPORT_IDS,
  buildOlimpbetSportKey,
  isOlimpbetEsportsSportId,
  olimpbetLineWindowMs,
} from './olimpbet-sport.util';
import { hasKickEsportsBroadcast, kickChannelFromStreamUrl } from '../wc-odds/kick-broadcast.util';
import {
  compareOlimpbetPriority,
  resolveOlimpbetPriorityLevel,
  type OlimpbetPriorityLevel,
} from './olimpbet-priority.util';
import { OlimpbetHttpClient, OLIMPBET_API_HOST } from './olimpbet-http.client';
import {
  parseOlimpbetEventDetail,
  parseOlimpbetStatistics,
  parseOlimpbetV2EventListResponse,
} from './olimpbet-wc.schemas';
import type {
  OlimpbetEventDetail,
  OlimpbetV2EventListItem,
  OlimpbetV2EventListResponse,
} from './olimpbet-wc.types';
import {
  resolveOlimpbetApiLocale,
  type OlimpbetApiLocale,
} from '~/common/locale/olimpbet-locale.util';

import type { WcOddsEventDto } from '../wc-odds/wc-odds.types';

type LocalizedEventLabels = {
  homeTeam: string;
  awayTeam: string;
  tournamentName: string;
};

type LocaleNameIndex = {
  builtAtMs: number;
  byEventId: Map<number, LocalizedEventLabels>;
  byTournamentId: Map<number, string>;
};

/** Decode internal ol-{n} or public m{base36} event ids back to Olimpbet numeric id. */
function olimpbetIdFromDtoId(id: string): number | null {
  const ol = /^ol-(\d+)$/.exec(id);
  if (ol) return Number(ol[1]);
  if (/^m[a-z0-9]+$/i.test(id)) {
    const n = parseInt(id.slice(1), 36) ^ 0x5a3c9f12;
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

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
  /** SportBoom HLS when no Kick/Twitch mirror is available. */
  hlsFallbackUrl?: string | null;
  iframeFallbackUrl?: string | null;
};

@Injectable()
export class OlimpbetWcService {
  private readonly logger = new Logger(OlimpbetWcService.name);

  private indexCache: {
    builtAtMs: number;
    rows: OlimEventIndexRow[];
    byKey: Map<string, OlimEventIndexRow>;
  } | null = null;

  private readonly eventDetailCache = new Map<
    string,
    { detail: OlimpbetEventDetail | null; expiresAt: number }
  >();

  /** Team/tournament names per Olimpbet locale (for UI overlay without rewriting DB). */
  private readonly localeNameIndexes = new Map<OlimpbetApiLocale, LocaleNameIndex>();

  private static readonly EVENT_DETAIL_TTL_MS = 4_000;
  private static readonly NAME_INDEX_TTL_MS = 5 * 60_000;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: OlimpbetAuthService,
    private readonly http: OlimpbetHttpClient,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('WC_OLIMPBET_ENABLED', 'false') === 'true';
  }

  /** Pause background ingest while circuit is open/half-open. */
  isFetchBlocked(): boolean {
    return this.http.isCircuitOpen();
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

  /**
   * Prefetch Olimpbet competitor/tournament labels for a locale.
   * Sync/ingest stay on `ru`; EN is warmed on demand for UI overlay.
   */
  async ensureLocalizedNames(
    locale: OlimpbetApiLocale = resolveOlimpbetApiLocale(),
  ): Promise<void> {
    const existing = this.localeNameIndexes.get(locale);
    if (
      existing
      && Date.now() - existing.builtAtMs < OlimpbetWcService.NAME_INDEX_TTL_MS
    ) {
      return;
    }

    try {
      await Promise.all([
        this.listAllLiveEvents(locale),
        this.listAllLineEvents(locale),
      ]);
      // listAll* already seed localeNameIndexes via seedNameIndex()
    } catch (err) {
      this.logger.warn(
        `Failed to warm Olimpbet ${locale} name index: ${(err as Error).message}`,
      );
    }
  }

  applyLocalizedNames<T extends {
    id: string;
    homeTeam: string;
    awayTeam: string;
    leagueName?: string | null;
  }>(
    dto: T,
    locale: OlimpbetApiLocale = resolveOlimpbetApiLocale(),
  ): T {
    if (locale === 'ru') return dto;

    const olimpbetId = olimpbetIdFromDtoId(dto.id);
    if (olimpbetId == null) return dto;
    const labels = this.localeNameIndexes.get(locale)?.byEventId.get(olimpbetId);
    if (!labels) return dto;

    return {
      ...dto,
      homeTeam: labels.homeTeam || dto.homeTeam,
      awayTeam: labels.awayTeam || dto.awayTeam,
      leagueName: labels.tournamentName || dto.leagueName,
    };
  }

  async localizeEventDtos<T extends {
    id: string;
    homeTeam: string;
    awayTeam: string;
    leagueName?: string | null;
  }>(
    dtos: T[],
    locale: OlimpbetApiLocale = resolveOlimpbetApiLocale(),
  ): Promise<T[]> {
    if (locale === 'ru' || dtos.length === 0) return dtos;

    const index = this.localeNameIndexes.get(locale);
    const missingIds: number[] = [];
    for (const dto of dtos) {
      const id = olimpbetIdFromDtoId(dto.id);
      if (id != null && !index?.byEventId.has(id)) {
        missingIds.push(id);
      }
    }

    // Fill gaps for this page quickly via event detail (stores names in locale index).
    if (missingIds.length > 0) {
      const batch = missingIds.slice(0, 40);
      await Promise.all(
        batch.map((id) => this.fetchEventDetail(id, { locale }).catch(() => null)),
      );
    }

    // Background full warm for subsequent pages / tournaments.
    void this.ensureLocalizedNames(locale);

    return dtos.map((dto) => this.applyLocalizedNames(dto, locale));
  }

  async enrichEventDtos<T extends WcOddsEventDto>(
    dtos: T[],
    rows: Array<{ homeCompetitorId?: number | null; awayCompetitorId?: number | null }>,
    options?: { cacheOnly?: boolean },
  ): Promise<T[]> {
    if (dtos.length === 0) return dtos;

    const ids = rows.flatMap((row) => [
      row.homeCompetitorId,
      row.awayCompetitorId,
    ]).filter((id): id is number => typeof id === 'number' && Number.isFinite(id));

    // List/API paths must not block on Olimpbet logo HTTP (was hanging /live/events).
    const cacheOnly = options?.cacheOnly === true || this.http.isCircuitOpen();
    const logoMap = await fetchOlimpbetCompetitorLogos(ids, { cacheOnly });

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

  private indexKey(commenceTimeIso: string, teamA: string, teamB: string): string {
    return `${commenceTimeIso}::${teamA.toLowerCase()}::${teamB.toLowerCase()}`;
  }

  private rowFromListItem(
    e: OlimpbetV2EventListItem,
    olimpbetSportId: number,
    mode: 'line' | 'live' = 'line',
  ): OlimEventIndexRow | null {
    if (!e?.id || !e.eventDate) return null;

    // Угловые, офсайды, VAR и пр. — отдельные eventType, не основной матч.
    const eventTypeCode = e.eventType?.code;
    if (eventTypeCode && eventTypeCode !== 'Main') return null;

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
      locale?: OlimpbetApiLocale;
    },
  ): Promise<OlimpbetV2EventListResponse | null> {
    const locale = params.locale ?? 'ru';
    return this.http.fetchJson(
      '/v2/events',
      {
        'sport-ids': sportId,
        'page-size': 100,
        locale,
        platform: 'web-desktop',
        ...(params.live === undefined ? {} : { live: params.live }),
        ...(params.tournamentId ? { 'tournament-ids': params.tournamentId } : {}),
        ...(params.paginationKey ? { 'pagination-key': params.paginationKey } : {}),
      },
      parseOlimpbetV2EventListResponse,
    );
  }

  async listSportEvents(
    sportId: number,
    live?: boolean,
    locale: OlimpbetApiLocale = 'ru',
  ): Promise<OlimEventIndexRow[]> {
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
          locale,
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

  private seedNameIndex(locale: OlimpbetApiLocale, rows: OlimEventIndexRow[]): void {
    let index = this.localeNameIndexes.get(locale);
    if (!index) {
      index = {
        builtAtMs: Date.now(),
        byEventId: new Map(),
        byTournamentId: new Map(),
      };
      this.localeNameIndexes.set(locale, index);
    }
    for (const row of rows) {
      index.byEventId.set(row.olimpbetEventId, {
        homeTeam: row.homeTeamRu,
        awayTeam: row.awayTeamRu,
        tournamentName: row.tournamentName,
      });
      if (row.tournamentId != null && row.tournamentName) {
        index.byTournamentId.set(row.tournamentId, row.tournamentName);
      }
    }
    index.builtAtMs = Date.now();
  }

  localizeTournamentName(
    tournamentId: number | null | undefined,
    fallback: string,
    locale: OlimpbetApiLocale = resolveOlimpbetApiLocale(),
  ): string {
    if (locale === 'ru' || tournamentId == null) return fallback;
    return this.localeNameIndexes.get(locale)?.byTournamentId.get(tournamentId) ?? fallback;
  }

  async listAllLiveEvents(locale: OlimpbetApiLocale = 'ru'): Promise<OlimEventIndexRow[]> {
    const byId = new Map<number, OlimEventIndexRow>();

    for (const sportId of this.sportIds()) {
      const rows = await this.listSportEvents(sportId, true, locale);
      for (const row of rows) {
        byId.set(row.olimpbetEventId, row);
      }
    }

    const result = [...byId.values()].sort(
      (a, b) =>
        compareOlimpbetPriority(a.priorityLevel, b.priorityLevel)
        || a.tournamentName.localeCompare(b.tournamentName, locale)
        || Date.parse(b.commenceTimeIso) - Date.parse(a.commenceTimeIso)
        || a.olimpbetEventId - b.olimpbetEventId,
    );
    this.seedNameIndex(locale, result);
    return result;
  }

  async listAllLineEvents(locale: OlimpbetApiLocale = 'ru'): Promise<OlimEventIndexRow[]> {
    const byId = new Map<number, OlimEventIndexRow>();

    for (const sportId of this.sportIds()) {
      const prematch = await this.listSportEvents(sportId, false, locale);
      for (const row of prematch) {
        byId.set(row.olimpbetEventId, row);
      }
    }

    const result = [...byId.values()].sort(
      (a, b) =>
        compareOlimpbetPriority(a.priorityLevel, b.priorityLevel)
        || a.tournamentName.localeCompare(b.tournamentName, locale)
        || Date.parse(a.commenceTimeIso) - Date.parse(b.commenceTimeIso)
        || a.olimpbetEventId - b.olimpbetEventId,
    );
    this.seedNameIndex(locale, result);
    return result;
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

  async resolveOlimpbetEventIdByTeams(
    commenceTime: Date | string,
    homeTeam: string,
    awayTeam: string,
  ): Promise<number | null> {
    const iso = commenceTime instanceof Date ? commenceTime.toISOString() : commenceTime;
    const { byKey } = await this.buildIndex();
    return this.findIndexRow(byKey, iso, homeTeam, awayTeam)?.olimpbetEventId ?? null;
  }

  async fetchEventDetail(
    eventId: number,
    forceOrOptions: boolean | { force?: boolean; locale?: OlimpbetApiLocale } = false,
  ): Promise<OlimpbetEventDetail | null> {
    const force =
      typeof forceOrOptions === 'boolean'
        ? forceOrOptions
        : forceOrOptions.force === true;
    const locale =
      typeof forceOrOptions === 'boolean'
        ? resolveOlimpbetApiLocale()
        : (forceOrOptions.locale ?? resolveOlimpbetApiLocale());
    const cacheKey = `${locale}:${eventId}`;

    if (!force) {
      const cached = this.eventDetailCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.detail;
      }
    }

    const detail = await this.http.fetchJson(
      `/events/${eventId}`,
      { locale },
      parseOlimpbetEventDetail,
    );
    if (detail) {
      this.eventDetailCache.set(cacheKey, {
        detail,
        expiresAt: Date.now() + OlimpbetWcService.EVENT_DETAIL_TTL_MS,
      });
      this.rememberDetailLabels(locale, eventId, detail);
    }
    return detail;
  }

  private rememberDetailLabels(
    locale: OlimpbetApiLocale,
    eventId: number,
    detail: OlimpbetEventDetail,
  ): void {
    const homeId = (detail.homeCompetitorIds ?? [])[0];
    const home =
      detail.competitors?.find((c) => c.id === homeId)?.name
      ?? detail.competitors?.[0]?.name;
    const away =
      detail.competitors?.find((c) => c.id !== homeId)?.name
      ?? detail.competitors?.[1]?.name;
    if (!home || !away) return;

    let index = this.localeNameIndexes.get(locale);
    if (!index) {
      index = {
        builtAtMs: Date.now(),
        byEventId: new Map(),
        byTournamentId: new Map(),
      };
      this.localeNameIndexes.set(locale, index);
    }
    index.byEventId.set(eventId, {
      homeTeam: home,
      awayTeam: away,
      tournamentName: detail.tournament?.name?.trim() || 'Olimpbet',
    });
    if (detail.tournament?.id != null && detail.tournament?.name?.trim()) {
      index.byTournamentId.set(detail.tournament.id, detail.tournament.name.trim());
    }
  }

  /** Main event + linked statistics/special markets for DISPLAY settlement snapshots. */
  async fetchSettlementDetail(main: OlimpbetEventDetail): Promise<OlimpbetEventDetail> {
    const linked: OlimpbetEventDetail[] = [];
    for (const id of linkedEventIdsForSettlement(main)) {
      const detail = await this.fetchEventDetail(id, { locale: 'ru' });
      if (detail?.probabilities?.markets?.length) linked.push(detail);
    }
    return mergeOlimpbetProbabilityDetails(main, linked);
  }

  async fetchEventStatistics(
    eventId: number,
    locale: OlimpbetApiLocale = 'ru',
  ): Promise<OlimpbetStructuredStatistics | null> {
    return this.http.fetchJson(
      `/events/${eventId}/statistics`,
      { locale },
      parseOlimpbetStatistics<OlimpbetStructuredStatistics>,
    );
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
    const main = detail ?? await this.fetchEventDetail(olimpbetEventId, { locale: 'ru' });
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
      const detail = await this.fetchEventDetail(id, { locale: 'ru' });
      if (detail) detailsById.set(id, detail);
    }));

    return collectLinkedStatRows(refs, detailsById);
  }

  async buildLineSnapshotFromDetail(
    main: OlimpbetEventDetail,
    olimpbetEventId: number,
    options?: { skipLogos?: boolean },
  ): Promise<OlimpbetWcMatchSnapshot> {
    return this.buildSnapshotFromMain(main, olimpbetEventId, false, options?.skipLogos === true);
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

  async fetchEventBroadcast(
    olimpbetEventId: number,
    options?: { preferIframe?: boolean },
  ): Promise<OlimpbetBroadcastPayload> {
    const main = await this.fetchEventDetail(olimpbetEventId, { locale: 'ru' });
    const available = main ? buildOlimpbetCompetitorMeta(main).hasBroadcast : false;
    if (!available) {
      return { available: false, streamUrl: null, streamType: null };
    }

    const cookie = await this.auth.getBroadcastCookieHeader();
    const sportId = main?.tournament?.sportId;
    const esports = options?.preferIframe ?? isOlimpbetEsportsSportId(sportId);

    if (esports) {
      const iframePayload = await this.fetchEventBroadcastByType(olimpbetEventId, 'IFRAME', cookie);
      const hlsPayload = await this.fetchEventBroadcastByType(olimpbetEventId, 'HLS', cookie);

      const kickMirrorUrl = await this.resolveEsportsKickMirrorUrl(
        [hlsPayload.streamUrl, iframePayload.streamUrl],
        cookie,
      );

      const hlsFallback = hlsPayload.streamUrl?.includes('.m3u8') ? hlsPayload.streamUrl : null;

      if (kickMirrorUrl) {
        return {
          available: true,
          streamUrl: kickMirrorUrl,
          streamType: 'iframe',
          hlsFallbackUrl: hlsFallback,
          iframeFallbackUrl: iframePayload.streamUrl,
        };
      }

      if (hlsFallback) {
        return {
          available: true,
          streamUrl: hlsFallback,
          streamType: 'hls',
          hlsFallbackUrl: hlsFallback,
          iframeFallbackUrl: iframePayload.streamUrl,
        };
      }

      if (iframePayload.streamUrl) {
        return { ...iframePayload, iframeFallbackUrl: iframePayload.streamUrl };
      }
      if (hlsPayload.streamUrl) {
        return { ...hlsPayload, hlsFallbackUrl: hlsPayload.streamUrl };
      }
      return iframePayload;
    }

    const hlsPayload = await this.fetchEventBroadcastByType(olimpbetEventId, 'HLS', cookie);
    if (hlsPayload.streamUrl) return hlsPayload;
    return this.fetchEventBroadcastByType(olimpbetEventId, 'IFRAME', cookie);
  }

  private async resolveEsportsKickMirrorUrl(
    hints: Array<string | null | undefined>,
    cookie: string | null,
  ): Promise<string | null> {
    for (const hint of hints) {
      if (hint && kickChannelFromStreamUrl(hint)) return hint;
    }

    for (const hint of hints) {
      if (!hint) continue;
      const nested = await this.extractStreamHintFromEmbed(hint, cookie);
      if (nested && kickChannelFromStreamUrl(nested)) return nested;
    }

    return null;
  }

  private async extractStreamHintFromEmbed(
    embedUrl: string,
    cookie: string | null,
  ): Promise<string | null> {
    try {
      const res = await fetch(embedUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://olimpbet.kz/',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      });
      if (!res.ok) return null;
      const html = await res.text();
      const iframeSrc = /<iframe[^>]+src=["']([^"']+)["']/i.exec(html)?.[1];
      if (iframeSrc) return iframeSrc;
      const twitchInHtml = /https:\/\/player\.twitch\.tv\/\?[^\s"'<>]+/i.exec(html)?.[0];
      if (twitchInHtml) return twitchInHtml;
      const kickInHtml = /https:\/\/(?:player\.)?kick\.com\/[^\s"'<>]+/i.exec(html)?.[0];
      return kickInHtml ?? null;
    } catch (err) {
      this.logger.debug(
        `embed hint extract failed: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async fetchEventBroadcastByType(
    olimpbetEventId: number,
    preferredType: 'HLS' | 'IFRAME',
    cookie: string | null,
  ): Promise<OlimpbetBroadcastPayload> {
    const url = new URL(`${OLIMPBET_API_HOST}/events/${olimpbetEventId}/broadcasts`);
    url.searchParams.set('locale', 'ru');
    url.searchParams.set('platform', 'DESKTOP');
    url.searchParams.set('redirect-url', 'https://olimpbet.kz');
    url.searchParams.set('preferred-broadcast-type', preferredType);

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://olimpbet.kz/',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      });

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
        `broadcast fetch failed for ${olimpbetEventId} (${preferredType}): ${(err as Error).message}`,
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
    const main = await this.fetchEventDetail(olimpbetEventId, { locale: 'ru' });
    if (!main?.probabilities?.markets?.length) return {};
    return this.fetchFullGroupedMarketsFromMain(main, 'ru');
  }

  private async fetchFullGroupedMarketsFromMain(
    main: OlimpbetEventDetail,
    locale: OlimpbetApiLocale = 'ru',
  ): Promise<WcGroupedMarkets> {
    const linkedIds = pickLinkedEventIds(main);
    const linked: Array<{ detail: OlimpbetEventDetail; sectionLabel: string }> = [];

    for (const id of linkedIds) {
      const detail = await this.fetchEventDetail(id, { locale });
      if (!detail?.probabilities?.markets?.length) continue;
      linked.push({
        detail,
        sectionLabel: detail.eventType?.name ?? 'Статистика',
      });
    }

    return parseOlimpbetFullEvent(main, linked, locale);
  }

  /** One API call — main-event markets only (line rows). */
  async fetchQuickLineSnapshot(
    olimpbetEventId: number,
    options?: { locale?: OlimpbetApiLocale },
  ): Promise<OlimpbetWcMatchSnapshot | null> {
    const locale = options?.locale ?? 'ru';
    const main = await this.fetchEventDetail(olimpbetEventId, { locale });
    if (!main) return null;
    return this.buildSnapshotFromMain(main, olimpbetEventId, false, false, locale);
  }

  async fetchMatchSnapshot(
    olimpbetEventId: number,
    options?: { includeLinked?: boolean; locale?: OlimpbetApiLocale },
  ): Promise<OlimpbetWcMatchSnapshot | null> {
    const locale = options?.locale ?? 'ru';
    const main = await this.fetchEventDetail(olimpbetEventId, { locale });
    if (!main) return null;
    return this.buildSnapshotFromMain(
      main,
      olimpbetEventId,
      options?.includeLinked !== false,
      false,
      locale,
    );
  }

  private extractH2h(
    grouped: WcGroupedMarkets,
    score?: { homeScore: number | null; awayScore: number | null },
  ): {
    home: number | null;
    draw: number | null;
    away: number | null;
  } {
    return extractListH2hOdds(grouped, score);
  }

  private async buildSnapshotFromMain(
    main: OlimpbetEventDetail,
    olimpbetEventId: number,
    includeLinked: boolean,
    skipLogos = false,
    locale: OlimpbetApiLocale = 'ru',
  ): Promise<OlimpbetWcMatchSnapshot> {
    let groupedMarkets = includeLinked
      ? await this.fetchFullGroupedMarketsFromMain(main, locale)
      : await parseOlimpbetFullEvent(main, [], locale);

    if (main.live && !isOlimpbetEventCompleted(main)) {
      groupedMarkets = filterFinalizedScopeMarkets(groupedMarkets, main);
    }

    groupedMarkets = stripJunkSpecialtyGroupedMarkets(groupedMarkets);

    const marketWarnings = collectGroupedMarketsWarnings(
      groupedMarkets,
      String(olimpbetEventId),
    );
    if (marketWarnings.length > 0) {
      this.logger.warn(
        `Olimpbet markets warnings event=${olimpbetEventId} count=${marketWarnings.length} sample=${JSON.stringify(marketWarnings[0])}`,
      );
    }

    const score = extractOlimpbetScore(main);
    const h2h = this.extractH2h(groupedMarkets, score);
    const totals = extractMainTotalLine(groupedMarkets);

    const homeId = (main.homeCompetitorIds ?? [])[0];
    const homeRu = main.competitors.find((c) => c.id === homeId)?.name ?? main.competitors[0]?.name ?? '';
    const awayRu = main.competitors.find((c) => c.id !== homeId)?.name ?? main.competitors[1]?.name ?? '';
    const competitorMeta = buildOlimpbetCompetitorMeta(main);
    const logoMap = skipLogos
      ? new Map<number, string>()
      : await fetchOlimpbetCompetitorLogos(
        [competitorMeta.homeCompetitorId, competitorMeta.awayCompetitorId]
          .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
      );

    const sportId = main.tournament?.sportId;
    const hasBroadcast = isOlimpbetEsportsSportId(sportId)
      ? hasKickEsportsBroadcast({
        sportKey: buildOlimpbetSportKey(sportId!),
        leagueName: main.tournament?.name,
        tournamentId: main.tournament?.id ?? null,
        homeTeam: homeRu,
        awayTeam: awayRu,
        olimpbetBroadcastAvailable: competitorMeta.hasBroadcast,
        isLive: Boolean(main.live),
      })
      : competitorMeta.hasBroadcast;

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
      hasBroadcast,
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
