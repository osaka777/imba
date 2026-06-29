import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { GameDtoWithGroupedMarkets } from '~/main/game/dto/available-games.dto';

import {
  countCyberListMarkets,
  cyberGameHasTeamLogos,
  cyberGameHasWinnerOdds,
  mapOlimpbetCyberEventToGameDto,
} from './cybersport-markets.util';
import { olimpbetIdFromCyberGameRef } from './cybersport-mask.util';
import {
  cyberOlimpbetSportIdFromSlug,
  cyberSlugFromOlimpbetSportId,
  DEFAULT_CYBER_OLIMP_SPORT_IDS,
} from './cybersport-sport.util';
import type {
  OlimpbetCyberEventDetail,
  OlimpbetCyberEventListItem,
  OlimpbetCyberEventListResponse,
} from './cybersport.types';

const API_HOST = 'https://olimpbet.kz/api';
const LINE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const LIST_DETAIL_CONCURRENCY = 6;

@Injectable()
export class CybersportService {
  private readonly logger = new Logger(CybersportService.name);

  constructor(private readonly config: ConfigService) {}

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
      this.logger.warn(`Cybersport API ${res.status} ${path}: ${body.slice(0, 120)}`);
      return null;
    }

    return (await res.json()) as T;
  }

  private isWithinLineWindow(eventDate: string, nowMs = Date.now()): boolean {
    const kickoff = Date.parse(eventDate);
    if (!Number.isFinite(kickoff)) return false;
    return kickoff > nowMs && kickoff <= nowMs + LINE_WINDOW_MS;
  }

  private async listSportEventsPage(
    sportId: number,
    params: { live?: boolean; paginationKey?: string },
  ): Promise<OlimpbetCyberEventListResponse | null> {
    return this.fetchJson<OlimpbetCyberEventListResponse>('/v2/events', {
      'sport-ids': sportId,
      'page-size': 100,
      locale: 'ru',
      platform: 'web-desktop',
      ...(params.live === undefined ? {} : { live: params.live }),
      ...(params.paginationKey ? { 'pagination-key': params.paginationKey } : {}),
    });
  }

  private async listSportEventItems(
    sportId: number,
    mode: 'live' | 'line',
  ): Promise<OlimpbetCyberEventListItem[]> {
    const rows: OlimpbetCyberEventListItem[] = [];
    let paginationKey: string | undefined;
    let pages = 0;

    do {
      const list = await this.listSportEventsPage(sportId, {
        live: mode === 'live',
        paginationKey,
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

  async fetchEventDetail(eventId: number): Promise<OlimpbetCyberEventDetail | null> {
    return this.fetchJson<OlimpbetCyberEventDetail>(`/events/${eventId}`, { locale: 'ru' });
  }

  private async mapListItems(
    items: OlimpbetCyberEventListItem[],
    sportId: number,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    const results: GameDtoWithGroupedMarkets[] = [];

    for (let i = 0; i < items.length; i += LIST_DETAIL_CONCURRENCY) {
      const chunk = items.slice(i, i + LIST_DETAIL_CONCURRENCY);
      const details = await Promise.all(
        chunk.map((item) => this.fetchEventDetail(item.id)),
      );

      for (const detail of details) {
        if (!detail?.id) continue;
        try {
          results.push(await mapOlimpbetCyberEventToGameDto(detail, sportId));
        } catch (err) {
          this.logger.warn(`Cybersport map failed for ${detail.id}: ${(err as Error).message}`);
        }
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

  async listLive(sport?: string, limit = 24): Promise<GameDtoWithGroupedMarkets[]> {
    if (!this.isEnabled()) return [];

    const sportIds = sport
      ? [cyberOlimpbetSportIdFromSlug(sport)].filter((id): id is number => id != null)
      : this.sportIds();

    const games: GameDtoWithGroupedMarkets[] = [];
    for (const sportId of sportIds) {
      const items = await this.listSportEventItems(sportId, 'live');
      const mapped = await this.mapListItems(items.slice(0, limit), sportId);
      games.push(...mapped);
    }

    return games.slice(0, limit);
  }

  async listLine(
    sport?: string,
    limit = 24,
    offset = 0,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    if (!this.isEnabled()) return [];

    const sportIds = sport
      ? [cyberOlimpbetSportIdFromSlug(sport)].filter((id): id is number => id != null)
      : this.sportIds();

    const games: GameDtoWithGroupedMarkets[] = [];
    for (const sportId of sportIds) {
      const items = await this.listSportEventItems(sportId, 'line');
      const mapped = await this.mapListItems(items, sportId);
      games.push(...mapped);
    }

    return games.slice(offset, offset + limit);
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
    return dto;
  }

  async counts(): Promise<Record<string, number>> {
    if (!this.isEnabled()) return {};

    const counts: Record<string, number> = {};
    for (const sportId of this.sportIds()) {
      const slug = cyberSlugFromOlimpbetSportId(sportId);
      const [liveItems, lineItems] = await Promise.all([
        this.listSportEventItems(sportId, 'live'),
        this.listSportEventItems(sportId, 'line'),
      ]);
      counts[slug] = liveItems.length + lineItems.length;
    }
    return counts;
  }

  /** Homepage CS2 widget: live first, then line; requires both team logos. */
  async pickHomepageCs2WithLogos(
    maxScan = 18,
  ): Promise<{ game: GameDtoWithGroupedMarkets; isLive: boolean } | null> {
    if (!this.isEnabled()) return null;

    const sportId = cyberOlimpbetSportIdFromSlug('esports.cs');
    if (!sportId) return null;

    for (const mode of ['live', 'line'] as const) {
      const items = (await this.listSportEventItems(sportId, mode)).slice(0, maxScan);

      for (let i = 0; i < items.length; i += LIST_DETAIL_CONCURRENCY) {
        const chunk = items.slice(i, i + LIST_DETAIL_CONCURRENCY);
        const details = await Promise.all(
          chunk.map((item) => this.fetchEventDetail(item.id)),
        );

        for (const detail of details) {
          if (!detail?.id) continue;
          try {
            const dto = await mapOlimpbetCyberEventToGameDto(detail, sportId);
            if (!cyberGameHasTeamLogos(dto) || !cyberGameHasWinnerOdds(dto)) continue;
            const isLive = mode === 'live' || Boolean(detail.live);
            return { game: dto, isLive };
          } catch (err) {
            this.logger.warn(`Cybersport homepage pick failed for ${detail.id}: ${(err as Error).message}`);
          }
        }
      }
    }

    return null;
  }
}
