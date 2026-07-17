import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { GameDtoWithGroupedMarkets } from '~/main/game/dto/available-games.dto';

import {
  countCyberListMarkets,
  cyberGameHasTeamLogos,
  cyberGameHasWinnerOdds,
  listSnapshotNeedsDetailFetch,
  mapOlimpbetCyberEventToGameDto,
} from './cybersport-markets.util';
import { olimpbetIdFromCyberGameRef } from './cybersport-mask.util';
import {
  cyberOlimpbetSportIdFromSlug,
  cyberSlugFromOlimpbetSportId,
  DEFAULT_CYBER_OLIMP_SPORT_IDS,
} from './cybersport-sport.util';
import { CybersportWcBridgeService } from './cybersport-wc-bridge.service';
import { slugifyCyberTournament } from './cybersport-tournament.util';
import {
  compareOlimpbetPriority,
  resolveOlimpbetPriorityLevel,
} from '../olimpbet-wc/olimpbet-priority.util';
import type {
  OlimpbetCyberEventDetail,
  OlimpbetCyberEventListItem,
  OlimpbetCyberEventListResponse,
  OlimpbetCyberTournamentListItem,
  OlimpbetCyberTournamentListResponse,
} from './cybersport.types';
import {
  loadOlimpbetMarketCatalog,
  type OlimpbetMarketCatalog,
} from '../olimpbet-wc/olimpbet-wc-catalog';
import { OlimpbetHttpClient } from '../olimpbet-wc/olimpbet-http.client';
import { buildOlimpbetSportKey } from '../olimpbet-wc/olimpbet-sport.util';
import { EsportsStreamResolverService } from '../kick-live/esports-stream-resolver.service';
import {
  parseOlimpbetCyberEventDetail,
  parseOlimpbetCyberEventListResponse,
  parseOlimpbetCyberTournamentListResponse,
} from '../olimpbet-wc/olimpbet-wc.schemas';

const LINE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const LIST_DETAIL_CONCURRENCY = 6;
const COUNTS_CACHE_TTL_MS = 90_000;
const TOURNAMENTS_CACHE_TTL_MS = 90_000;

@Injectable()
export class CybersportService {
  private readonly logger = new Logger(CybersportService.name);
  private countsCache: { at: number; data: Record<string, number> } | null = null;
  private tournamentsCache = new Map<
    string,
    {
      at: number;
      data: Array<{
        id: number;
        name: string;
        slug: string;
        sportId: number;
        apiSport: string;
        liveCount: number;
        lineCount: number;
        priorityLevel: number;
      }>;
    }
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly wcBridge: CybersportWcBridgeService,
    private readonly http: OlimpbetHttpClient,
    private readonly esportsStream: EsportsStreamResolverService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('CYBERSPORT_ENABLED', 'true') === 'true';
  }

  private sportIds(): number[] {
    const raw = this.config.get<string>(
      'CYBERSPORT_OLIMP_SPORT_IDS',
      DEFAULT_CYBER_OLIMP_SPORT_IDS.join(','),
    );
    return raw
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  private isWithinLineWindow(eventDate: string, nowMs = Date.now()): boolean {
    const kickoff = Date.parse(eventDate);
    if (!Number.isFinite(kickoff)) return false;
    return kickoff > nowMs && kickoff <= nowMs + LINE_WINDOW_MS;
  }

  private async listSportEventsPage(
    sportId: number,
    params: { live?: boolean; paginationKey?: string; tournamentId?: number },
  ): Promise<OlimpbetCyberEventListResponse | null> {
    return this.http.fetchJson(
      '/v2/events',
      {
        'sport-ids': sportId,
        'page-size': 100,
        locale: 'ru',
        platform: 'web-desktop',
        ...(params.live === undefined ? {} : { live: params.live }),
        ...(params.tournamentId ? { 'tournament-ids': params.tournamentId } : {}),
        ...(params.paginationKey ? { 'pagination-key': params.paginationKey } : {}),
      },
      parseOlimpbetCyberEventListResponse,
    );
  }

  private async listSportEventItems(
    sportId: number,
    mode: 'live' | 'line',
    tournamentId?: number,
  ): Promise<OlimpbetCyberEventListItem[]> {
    const rows: OlimpbetCyberEventListItem[] = [];
    let paginationKey: string | undefined;
    let pages = 0;

    do {
      const list = await this.listSportEventsPage(sportId, {
        live: mode === 'live',
        paginationKey,
        tournamentId,
      });

      for (const item of list?.items ?? []) {
        if (!item?.id || !item.eventDate) continue;
        if (mode === 'line' && !this.isWithinLineWindow(item.eventDate)) continue;
        if (mode === 'live' && !item.live && Date.parse(item.eventDate) > Date.now()) continue;
        rows.push(item);
      }

      paginationKey = list?.paginationKeyForward ?? undefined;
      pages += 1;
    } while (paginationKey && pages < 20);

    return rows;
  }

  /** Attach a verified-live Kick/Twitch channel when Olimpbet has no esports broadcast URL. */
  private async enrichLiveKickBroadcast(
    dto: GameDtoWithGroupedMarkets,
    sportId: number,
  ): Promise<void> {
    const meta = (dto.meta ?? {}) as Record<string, unknown>;
    if (meta.hasBroadcast || meta.wcHasBroadcast) return;

    const sportKey = buildOlimpbetSportKey(sportId);
    const kickCtx = {
      sportKey,
      leagueName: dto.leagueName,
      tournamentId: typeof meta.tournamentId === 'number' ? meta.tournamentId : null,
      homeTeam: dto.team1,
      awayTeam: dto.team2,
      olimpbetBroadcastAvailable: false,
      isLive: true,
    };

    const live = await this.esportsStream.resolveLiveStream(sportKey, kickCtx);
    if (!live) return;

    dto.meta = {
      ...meta,
      hasBroadcast: true,
      wcHasBroadcast: true,
      kickChannel: live.provider === 'kick' ? live.channel : undefined,
      twitchChannel: live.provider === 'twitch' ? live.channel : undefined,
      streamProvider: live.provider,
      kickBroadcastFallback: live.isFallback,
    };
  }

  async fetchEventDetail(eventId: number): Promise<OlimpbetCyberEventDetail | null> {
    return this.http.fetchJson(
      `/events/${eventId}`,
      { locale: 'ru' },
      parseOlimpbetCyberEventDetail,
    );
  }

  private async mapListItems(
    items: OlimpbetCyberEventListItem[],
    sportId: number,
    mode: 'live' | 'line',
  ): Promise<GameDtoWithGroupedMarkets[]> {
    const catalog = await loadOlimpbetMarketCatalog();
    const results: GameDtoWithGroupedMarkets[] = [];

    for (let i = 0; i < items.length; i += LIST_DETAIL_CONCURRENCY) {
      const chunk = items.slice(i, i + LIST_DETAIL_CONCURRENCY);
      const mapped = await Promise.all(
        chunk.map((item) => this.mapListItem(item, sportId, mode, catalog)),
      );

      for (const dto of mapped) {
        if (dto) results.push(dto);
      }
    }

    return results.sort(
      (a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0)
        || a.leagueName.localeCompare(b.leagueName, 'ru')
        || Date.parse(String((b.meta as { commenceTime?: string })?.commenceTime ?? 0))
          - Date.parse(String((a.meta as { commenceTime?: string })?.commenceTime ?? 0)),
    );
  }

  private async mapListItem(
    item: OlimpbetCyberEventListItem,
    sportId: number,
    mode: 'live' | 'line',
    catalog: OlimpbetMarketCatalog,
  ): Promise<GameDtoWithGroupedMarkets | null> {
    const listSnapshot = item as OlimpbetCyberEventDetail;
    const needsDetail = listSnapshotNeedsDetailFetch(listSnapshot, mode, catalog);

    try {
      const snapshot = needsDetail
        ? await this.fetchEventDetail(item.id)
        : listSnapshot;
      if (!snapshot?.id) return null;

      const dto = await mapOlimpbetCyberEventToGameDto(snapshot, sportId, catalog);
      if (item.outcomesCount != null && item.outcomesCount > 0) {
        dto.meta = {
          ...(dto.meta as object),
          marketsCount: item.outcomesCount,
        };
      }
      await this.wcBridge.attachWcBettingMeta(
        dto,
        snapshot.id,
        snapshot.tournament?.sportId ?? sportId,
      );
      if (mode === 'live') {
        await this.enrichLiveKickBroadcast(dto, snapshot.tournament?.sportId ?? sportId);
      }
      return dto;
    } catch (err) {
      this.logger.warn(`Cybersport map failed for ${item.id}: ${(err as Error).message}`);
      return null;
    }
  }

  async listLive(
    sport?: string,
    limit = 24,
    tournamentId?: number,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    if (!this.isEnabled()) return [];

    const sportIds = sport
      ? [cyberOlimpbetSportIdFromSlug(sport)].filter((id): id is number => id != null)
      : this.sportIds();

    const games: GameDtoWithGroupedMarkets[] = [];
    for (const sportId of sportIds) {
      const items = await this.listSportEventItems(sportId, 'live', tournamentId);
      const mapped = await this.mapListItems(items.slice(0, limit), sportId, 'live');
      games.push(...mapped);
    }

    return games.slice(0, limit);
  }

  async listLine(
    sport?: string,
    limit = 24,
    offset = 0,
    tournamentId?: number,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    if (!this.isEnabled()) return [];

    const sportIds = sport
      ? [cyberOlimpbetSportIdFromSlug(sport)].filter((id): id is number => id != null)
      : this.sportIds();

    const games: GameDtoWithGroupedMarkets[] = [];
    for (const sportId of sportIds) {
      const items = await this.listSportEventItems(sportId, 'line', tournamentId);
      const mapped = await this.mapListItems(items, sportId, 'line');
      games.push(...mapped);
    }

    return games.slice(offset, offset + limit);
  }

  async listTournaments(sport?: string): Promise<
    Array<{
      id: number;
      name: string;
      slug: string;
      sportId: number;
      apiSport: string;
      liveCount: number;
      lineCount: number;
      priorityLevel: number;
    }>
  > {
    if (!this.isEnabled()) return [];

    const cacheKey = sport ?? '__all__';
    const now = Date.now();
    const cached = this.tournamentsCache.get(cacheKey);
    if (cached && now - cached.at < TOURNAMENTS_CACHE_TTL_MS) {
      return cached.data;
    }

    const sportIds = sport
      ? [cyberOlimpbetSportIdFromSlug(sport)].filter((id): id is number => id != null)
      : this.sportIds();

    const metaById = new Map<
      number,
      { name: string; sportId: number; priorityLevel: number }
    >();
    const liveCounts = new Map<number, number>();
    const lineCounts = new Map<number, number>();

    const bumpPriority = (tournamentId: number, eventTags?: Array<number | string>) => {
      const level = resolveOlimpbetPriorityLevel(eventTags);
      const meta = metaById.get(tournamentId);
      if (!meta) return;
      meta.priorityLevel = Math.max(meta.priorityLevel, level);
    };

    for (const sportId of sportIds) {
      let paginationKey: string | undefined;
      let pages = 0;

      do {
        const list = await this.http.fetchJson(
          '/v2/tournaments',
          {
            'sport-ids': sportId,
            'page-size': 100,
            locale: 'ru',
            platform: 'web-desktop',
            ...(paginationKey ? { 'pagination-key': paginationKey } : {}),
          },
          parseOlimpbetCyberTournamentListResponse,
        );

        for (const item of list?.items ?? []) {
          if (!item?.id) continue;
          metaById.set(item.id, {
            name: item.name?.trim() || 'Турнир',
            sportId: item.sportId ?? sportId,
            priorityLevel: resolveOlimpbetPriorityLevel(item.tags),
          });
        }

        paginationKey = list?.paginationKeyForward ?? undefined;
        pages += 1;
      } while (paginationKey && pages < 10);

      const [liveItems, lineItems] = await Promise.all([
        this.listSportEventItems(sportId, 'live'),
        this.listSportEventItems(sportId, 'line'),
      ]);

      for (const item of liveItems) {
        const tid = item.tournament?.id;
        if (!tid) continue;
        liveCounts.set(tid, (liveCounts.get(tid) ?? 0) + 1);
        if (!metaById.has(tid)) {
          metaById.set(tid, {
            name: item.tournament?.name?.trim() || 'Турнир',
            sportId: item.tournament?.sportId ?? sportId,
            priorityLevel: 0,
          });
        }
        bumpPriority(tid, item.tags);
      }

      for (const item of lineItems) {
        const tid = item.tournament?.id;
        if (!tid) continue;
        lineCounts.set(tid, (lineCounts.get(tid) ?? 0) + 1);
        if (!metaById.has(tid)) {
          metaById.set(tid, {
            name: item.tournament?.name?.trim() || 'Турнир',
            sportId: item.tournament?.sportId ?? sportId,
            priorityLevel: 0,
          });
        }
        bumpPriority(tid, item.tags);
      }
    }

    const result = [...metaById.entries()]
      .map(([id, meta]) => {
        const liveCount = liveCounts.get(id) ?? 0;
        const lineCount = lineCounts.get(id) ?? 0;
        const sportId = meta.sportId;
        return {
          id,
          name: meta.name,
          slug: slugifyCyberTournament(meta.name, id),
          sportId,
          apiSport: cyberSlugFromOlimpbetSportId(sportId),
          liveCount,
          lineCount,
          priorityLevel: meta.priorityLevel,
        };
      })
      .filter((row) => row.liveCount + row.lineCount > 0)
      .sort(
        (a, b) =>
          compareOlimpbetPriority(a.priorityLevel, b.priorityLevel)
          || b.liveCount + b.lineCount - (a.liveCount + a.lineCount)
          || a.name.localeCompare(b.name, 'ru'),
      );

    this.tournamentsCache.set(cacheKey, { at: now, data: result });
    return result;
  }

  async getGame(eventId: string): Promise<GameDtoWithGroupedMarkets | null> {
    if (!this.isEnabled()) return null;

    const olimpbetId = olimpbetIdFromCyberGameRef(eventId);
    if (!olimpbetId) return null;

    const detail = await this.fetchEventDetail(olimpbetId);
    if (!detail?.id) return null;

    const dto = await mapOlimpbetCyberEventToGameDto(detail);
    const marketsCount = await countCyberListMarkets(detail);
    dto.meta = {
      ...(dto.meta as object),
      marketsCount,
    };
    await this.wcBridge.attachWcBettingMeta(
      dto,
      detail.id,
      detail.tournament?.sportId ?? 1040,
      { fullMarkets: true },
    );
    if (dto.status === 'IN_PROGRESS') {
      await this.enrichLiveKickBroadcast(dto, detail.tournament?.sportId ?? 1040);
    }
    return dto;
  }

  async counts(): Promise<Record<string, number>> {
    if (!this.isEnabled()) return {};

    const now = Date.now();
    if (this.countsCache && now - this.countsCache.at < COUNTS_CACHE_TTL_MS) {
      return this.countsCache.data;
    }

    const counts: Record<string, number> = {};
    for (const sportId of this.sportIds()) {
      const slug = cyberSlugFromOlimpbetSportId(sportId);
      const [liveItems, lineItems] = await Promise.all([
        this.listSportEventItems(sportId, 'live'),
        this.listSportEventItems(sportId, 'line'),
      ]);
      counts[slug] = liveItems.length + lineItems.length;
    }

    this.countsCache = { at: now, data: counts };
    return counts;
  }

  /** Homepage CS2 widget: live first, then line; requires both team logos. */
  async pickHomepageCs2WithLogos(
    maxScan = 18,
  ): Promise<{ game: GameDtoWithGroupedMarkets; isLive: boolean } | null> {
    if (!this.isEnabled()) return null;

    const sportId = cyberOlimpbetSportIdFromSlug('esports.cs');
    if (!sportId) return null;

    const candidates: Array<{ game: GameDtoWithGroupedMarkets; isLive: boolean }> = [];

    for (const mode of ['live', 'line'] as const) {
      const items = (await this.listSportEventItems(sportId, mode)).slice(0, maxScan);
      const mapped = await this.mapListItems(items, sportId, mode);

      for (const dto of mapped) {
        if (!cyberGameHasTeamLogos(dto) || !cyberGameHasWinnerOdds(dto)) continue;
        candidates.push({
          game: dto,
          isLive: mode === 'live' || dto.status === 'IN_PROGRESS',
        });
      }
    }

    candidates.sort(
      (a, b) =>
        Number(b.isLive) - Number(a.isLive)
        || (b.game.priority ?? 0) - (a.game.priority ?? 0),
    );

    return candidates[0] ?? null;
  }
}
