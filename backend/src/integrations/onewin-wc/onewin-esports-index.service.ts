import { Injectable, Logger } from '@nestjs/common';

import {
  DEFAULT_ONEWIN_ESPORTS_SPORT_IDS,
  oneWinApiSportFromSportId,
} from './onewin-esports-catalog';
import { pickOneWinTeamLogoUrl, parseOneWinLogoUrl } from './onewin-esports-logos.util';
import { OneWinHttpClient } from './onewin-http.client';

const INDEX_TTL_MS = 60_000;
const LINE_WINDOW_MS = 14 * 24 * 60 * 60_000;

export type OneWinEsportsTeamRef = {
  id: number;
  logoUrl?: null | string;
  name: string;
  slug: string;
};

export type OneWinEsportsFixture = {
  apiSport: string;
  awayTeam: OneWinEsportsTeamRef;
  categoryId: null | number;
  homeTeam: OneWinEsportsTeamRef;
  live: boolean;
  matchId: number;
  sportId: number;
  sportTag: null | string;
  startAtMs: number;
  tournamentId: null | number;
  tournamentName: string;
};

type RawTeam = {
  id: number;
  logo?: { url?: null | string } | null;
  name: string;
  slug: string;
};
type RawItem = {
  awayTeam: RawTeam;
  categoryId?: null | number;
  /** Only present on single `/matches/get` — 1win's own authoritative "match over" flag. */
  closed?: boolean;
  competitors?: RawTeam[] | null;
  homeTeam: RawTeam;
  id: number;
  /** Sport/discipline icon (CS2, Dota 2, …) — same URL for all matches in that sport. */
  logo?: { url?: null | string } | null;
  service?: string;
  serviceV2?: string;
  sport?: { isEsport?: boolean; sportTag?: string };
  sportId: number;
  sportTag?: null | string;
  startAt: number;
  tournament?: { id?: number; name?: string; slug?: string } | null;
  tournamentId?: null | number;
};

type RawGetMany = { items: RawItem[] };

function toTeamRef(
  team: RawTeam,
  competitors?: RawTeam[] | null,
): OneWinEsportsTeamRef {
  return {
    id: team.id,
    logoUrl: pickOneWinTeamLogoUrl(team, competitors),
    name: team.name,
    slug: team.slug,
  };
}

function toFixture(item: RawItem, live: boolean): OneWinEsportsFixture | null {
  if (!item?.id || !item.homeTeam?.name || !item.awayTeam?.name) return null;
  if (!DEFAULT_ONEWIN_ESPORTS_SPORT_IDS.includes(item.sportId)) return null;
  const apiSport = oneWinApiSportFromSportId(item.sportId);
  if (!apiSport) return null;

  return {
    apiSport,
    awayTeam: toTeamRef(item.awayTeam, item.competitors),
    categoryId: item.categoryId ?? null,
    homeTeam: toTeamRef(item.homeTeam, item.competitors),
    live,
    matchId: item.id,
    sportId: item.sportId,
    sportTag: item.sportTag ?? item.sport?.sportTag ?? null,
    startAtMs: item.startAt * 1000,
    tournamentId: item.tournamentId ?? item.tournament?.id ?? null,
    tournamentName: item.tournament?.name?.trim() || 'Киберспорт',
  };
}

@Injectable()
export class OneWinEsportsIndexService {
  private building: Promise<void> | null = null;
  private builtAtMs = 0;
  private readonly logger = new Logger(OneWinEsportsIndexService.name);
  private rows: OneWinEsportsFixture[] = [];
  /** sportId → discipline icon URL from 1win match list (`logo.url`). */
  private readonly sportIconUrls = new Map<number, string>();

  constructor(private readonly http: OneWinHttpClient) {}

  private ingestSportLogo(item: RawItem): void {
    const url = parseOneWinLogoUrl(item.logo);
    if (!url || !item.sportId) return;
    if (!this.sportIconUrls.has(item.sportId)) {
      this.sportIconUrls.set(item.sportId, url);
    }
  }

  private async fetchBucket(
    body: Record<string, unknown>,
    live: boolean,
  ): Promise<OneWinEsportsFixture[]> {
    const result = await this.http.postJson<RawGetMany>(
      '/matches/get-many',
      body,
    );
    const items = result?.items ?? [];
    for (const item of items) this.ingestSportLogo(item);
    return items
      .map((item) => toFixture(item, live))
      .filter((row): row is OneWinEsportsFixture => row !== null);
  }

  sportIconUrlByApiSport(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [sportId, url] of this.sportIconUrls) {
      const apiSport = oneWinApiSportFromSportId(sportId);
      if (apiSport) out[apiSport] = url;
    }
    return out;
  }

  getSportIconUrl(sportId: number): null | string {
    return this.sportIconUrls.get(sportId) ?? null;
  }

  async ensureFresh(force = false): Promise<void> {
    if (
      !force &&
      Date.now() - this.builtAtMs < INDEX_TTL_MS &&
      this.rows.length > 0
    ) {
      return;
    }
    if (this.building) return this.building;

    this.building = (async () => {
      const excludeSportType = ['polybet', 'racing'];
      const [live, prematch] = await Promise.all([
        this.fetchBucket(
          {
            excludeSportType,
            includeSportType: 'esport',
            limit: 300,
            service: 'live',
          },
          true,
        ),
        this.fetchBucket(
          {
            excludeSportType,
            includeSportType: 'esport',
            limit: 400,
            service: 'prematch',
          },
          false,
        ),
      ]);

      const now = Date.now();
      const merged = [...live];
      const seen = new Set(live.map((r) => r.matchId));
      for (const row of prematch) {
        if (seen.has(row.matchId)) continue;
        if (row.startAtMs <= now || row.startAtMs > now + LINE_WINDOW_MS) continue;
        merged.push(row);
        seen.add(row.matchId);
      }

      if (merged.length > 0) {
        this.rows = merged;
        this.builtAtMs = Date.now();
        this.logger.debug(
          `1win esports index: ${live.length} live + ${merged.length - live.length} line`,
        );
      } else if (this.rows.length === 0) {
        this.logger.debug('1win esports index empty — will retry');
      }
    })().finally(() => {
      this.building = null;
    });

    return this.building;
  }

  async list(opts: {
    apiSport?: string;
    live?: boolean;
    tournamentId?: number;
  }): Promise<OneWinEsportsFixture[]> {
    await this.ensureFresh();
    return this.rows.filter((row) => {
      if (opts.apiSport && row.apiSport !== opts.apiSport) return false;
      if (opts.live === true && !row.live) return false;
      if (opts.live === false && row.live) return false;
      if (opts.tournamentId && row.tournamentId !== opts.tournamentId) return false;
      return true;
    });
  }

  async get(matchId: number): Promise<OneWinEsportsFixture | null> {
    await this.ensureFresh();
    const row = this.rows.find((r) => r.matchId === matchId) ?? null;
    if (!row) return null;
    return this.enrichFixtureLogos(row);
  }

  /** /matches/get often carries logos missing from live get-many buckets. */
  async enrichFixtureLogos(
    fixture: OneWinEsportsFixture,
  ): Promise<OneWinEsportsFixture> {
    if (fixture.homeTeam.logoUrl && fixture.awayTeam.logoUrl) return fixture;

    const detail = await this.http.postJson<RawItem>('/matches/get', {
      matchId: fixture.matchId,
    });
    if (!detail?.homeTeam || !detail.awayTeam) return fixture;

    return {
      ...fixture,
      awayTeam: toTeamRef(detail.awayTeam, detail.competitors ?? null),
      homeTeam: toTeamRef(detail.homeTeam, detail.competitors ?? null),
    };
  }

  /**
   * Authoritative "is this match over" check straight from 1win — unlike the
   * live push status text (which can go stale/stuck mid-series), `closed`
   * reflects 1win's own settlement state. Meant as a rare safety-net check
   * (see WcOddsSettlementService), not a per-poll call — it hits `/matches/get`.
   */
  async isMatchClosed(matchId: number): Promise<boolean | null> {
    const detail = await this.http.postJson<RawItem>('/matches/get', {
      matchId,
    });
    if (!detail) return null;
    return detail.closed === true;
  }

  async countsByApiSport(): Promise<Record<string, number>> {
    await this.ensureFresh();
    const out: Record<string, number> = {};
    for (const row of this.rows) {
      out[row.apiSport] = (out[row.apiSport] ?? 0) + 1;
    }
    return out;
  }

  async tournaments(apiSport?: string): Promise<
    Array<{
      apiSport: string;
      id: number;
      lineCount: number;
      liveCount: number;
      name: string;
      slug: string;
      sportId: number;
    }>
  > {
    await this.ensureFresh();
    const map = new Map<
      number,
      {
        apiSport: string;
        id: number;
        lineCount: number;
        liveCount: number;
        name: string;
        slug: string;
        sportId: number;
      }
    >();

    for (const row of this.rows) {
      if (apiSport && row.apiSport !== apiSport) continue;
      if (!row.tournamentId) continue;
      const cur = map.get(row.tournamentId) ?? {
        apiSport: row.apiSport,
        id: row.tournamentId,
        lineCount: 0,
        liveCount: 0,
        name: row.tournamentName,
        slug: String(row.tournamentId),
        sportId: row.sportId,
      };
      if (row.live) cur.liveCount += 1;
      else cur.lineCount += 1;
      map.set(row.tournamentId, cur);
    }

    return [...map.values()].sort(
      (a, b) => b.liveCount + b.lineCount - (a.liveCount + a.lineCount),
    );
  }
}
