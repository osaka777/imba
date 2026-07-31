import { Injectable, Logger } from '@nestjs/common';

import type { OneWinFixtureRow } from './onewin-wc.types';

import { OneWinHttpClient } from './onewin-http.client';
import { oneWinTeamMatchScore } from './onewin-team-match.util';

const INDEX_TTL_MS = 90_000;
/** Strict pass: kickoff must be within this window. */
const MATCH_TIME_STRICT_MS = 3 * 60 * 60_000;
/** Fallback pass: allow a wider kickoff window when names are still strong. */
const MATCH_TIME_FALLBACK_MS = 6 * 60 * 60_000;

type RawTeam = { id: number; name: string; slug: string };
type RawMatchItem = {
  awayTeam: RawTeam;
  categoryId?: null | number;
  homeTeam: RawTeam;
  id: number;
  service?: string;
  serviceV2?: string;
  sport?: { isEsport?: boolean };
  sportId: number;
  sportTag?: null | string;
  startAt: number;
  tournamentId?: null | number;
};
type RawGetManyResult = { items: RawMatchItem[] };

type ScoredCandidate = {
  awayScore: number;
  deltaMs: number;
  homeScore: number;
  row: OneWinFixtureRow;
  swapped: boolean;
};

function toFixtureRow(
  item: RawMatchItem,
  live: boolean,
): OneWinFixtureRow | null {
  if (!item?.id || !item.homeTeam?.slug || !item.awayTeam?.slug) return null;
  return {
    awayTeam: item.awayTeam,
    categoryId: item.categoryId ?? null,
    homeTeam: item.homeTeam,
    isEsport: item.sport?.isEsport === true,
    live,
    matchId: item.id,
    sportId: item.sportId,
    sportTag: item.sportTag ?? null,
    startAtMs: item.startAt * 1000,
    tournamentId: item.tournamentId ?? null,
  };
}

function pairScore(home: number, away: number): number {
  return Math.min(home, away) * 0.55 + ((home + away) / 2) * 0.45;
}

function isDoublesName(name: string): boolean {
  return name.includes('/');
}

function candidateRank(c: ScoredCandidate): number {
  // Prefer strong name matches, then closer kickoff, then live over prematch.
  const names = pairScore(c.homeScore, c.awayScore);
  const time = 1 - Math.min(1, c.deltaMs / MATCH_TIME_FALLBACK_MS);
  const liveBoost = c.row.live ? 0.03 : 0;
  return names * 0.82 + time * 0.15 + liveBoost;
}

/**
 * Lightweight fixture index used only for team+time matching (video/tracker
 * fallback) — deliberately does NOT ingest odds/markets, we already have a
 * primary line from Olimpbet.
 */
@Injectable()
export class OneWinFixtureIndexService {
  private building: Promise<void> | null = null;
  private builtAtMs = 0;
  private readonly logger = new Logger(OneWinFixtureIndexService.name);
  private rows: OneWinFixtureRow[] = [];

  constructor(private readonly http: OneWinHttpClient) {}

  private async fetchBucket(
    body: Record<string, unknown>,
    live: boolean,
  ): Promise<OneWinFixtureRow[]> {
    const result = await this.http.postJson<RawGetManyResult>(
      '/matches/get-many',
      body,
    );
    return (result?.items ?? [])
      .map((item) => toFixtureRow(item, live))
      .filter((row): row is OneWinFixtureRow => row !== null);
  }

  private scoreAgainst(
    row: OneWinFixtureRow,
    homeTeam: string,
    awayTeam: string,
    kickoffMs: number,
  ): ScoredCandidate | null {
    const deltaMs = Math.abs(row.startAtMs - kickoffMs);
    if (deltaMs > MATCH_TIME_FALLBACK_MS) return null;

    // Tennis doubles ↔ singles / baseball etc. — structural mismatch.
    const ownDoubles = isDoublesName(homeTeam) || isDoublesName(awayTeam);
    const theirDoubles =
      isDoublesName(row.homeTeam.name) || isDoublesName(row.awayTeam.name);
    if (ownDoubles !== theirDoubles) return null;

    const straightHome = oneWinTeamMatchScore(homeTeam, row.homeTeam);
    const straightAway = oneWinTeamMatchScore(awayTeam, row.awayTeam);
    const swappedHome = oneWinTeamMatchScore(homeTeam, row.awayTeam);
    const swappedAway = oneWinTeamMatchScore(awayTeam, row.homeTeam);

    const straight = pairScore(straightHome, straightAway);
    const swapped = pairScore(swappedHome, swappedAway);

    if (straight >= swapped) {
      return {
        awayScore: straightAway,
        deltaMs,
        homeScore: straightHome,
        row,
        swapped: false,
      };
    }
    return {
      awayScore: swappedAway,
      deltaMs,
      homeScore: swappedHome,
      row,
      swapped: true,
    };
  }

  private pickBest(
    candidates: ScoredCandidate[],
    opts: {
      maxDeltaMs: number;
      minEach: number;
      minPair: number;
    },
  ): OneWinFixtureRow | null {
    let best: ScoredCandidate | null = null;
    let bestRank = -1;

    for (const c of candidates) {
      if (c.deltaMs > opts.maxDeltaMs) continue;
      if (c.homeScore < opts.minEach || c.awayScore < opts.minEach) continue;
      if (pairScore(c.homeScore, c.awayScore) < opts.minPair) continue;
      const rank = candidateRank(c);
      if (rank > bestRank) {
        best = c;
        bestRank = rank;
      }
    }

    return best?.row ?? null;
  }

  async ensureFresh(force = false): Promise<void> {
    if (
      !force &&
      Date.now() - this.builtAtMs < INDEX_TTL_MS &&
      this.rows.length > 0
    )
      return;
    if (this.building) return this.building;

    this.building = (async () => {
      const excludeSportType = ['polybet', 'racing'];
      const [live, prematch, esportLive, esportPrematch] = await Promise.all([
        this.fetchBucket(
          { excludeSportType, limit: 500, service: 'live' },
          true,
        ),
        this.fetchBucket(
          { excludeSportType, limit: 400, service: 'prematch' },
          false,
        ),
        this.fetchBucket(
          {
            excludeSportType: ['polybet', 'racing'],
            includeSportType: 'esport',
            limit: 200,
            service: 'live',
          },
          true,
        ),
        this.fetchBucket(
          {
            excludeSportType: ['polybet', 'racing'],
            includeSportType: 'esport',
            limit: 200,
          },
          false,
        ),
      ]);

      const merged = [...live, ...prematch, ...esportLive, ...esportPrematch];
      if (merged.length > 0) {
        this.rows = merged;
        this.builtAtMs = Date.now();
      } else if (this.rows.length === 0) {
        // Keep builtAtMs at 0 so the next call retries immediately instead of caching an empty miss.
        this.logger.debug(
          '1win fixture index came back empty — will retry next call',
        );
      }
    })().finally(() => {
      this.building = null;
    });

    return this.building;
  }

  /**
   * Best-effort team+kickoff match.
   *
   * 1) Strict: ±3h, each side ≥0.75
   * 2) Fallback: ±6h, each side ≥0.62, pair ≥0.68 (spelling + name-order)
   * 3) Close-kickoff fallback: ±45m, one side ≥0.9 and the other ≥0.5
   *    (covers one-sided transliteration misses when time pins the fixture)
   */
  async findMatchId(
    commenceTime: Date | string,
    homeTeam: string,
    awayTeam: string,
  ): Promise<OneWinFixtureRow | null> {
    await this.ensureFresh();
    const kickoff =
      commenceTime instanceof Date
        ? commenceTime.getTime()
        : Date.parse(commenceTime);
    if (!Number.isFinite(kickoff)) return null;

    const candidates: ScoredCandidate[] = [];
    for (const row of this.rows) {
      const scored = this.scoreAgainst(row, homeTeam, awayTeam, kickoff);
      if (scored) candidates.push(scored);
    }
    if (candidates.length === 0) return null;

    const doubles = isDoublesName(homeTeam) || isDoublesName(awayTeam);
    // Doubles abbreviations (П.-Х., initials) are noisy — stay strict.
    const fuzzyMinEach = doubles ? 0.75 : 0.62;
    const fuzzyMinPair = doubles ? 0.75 : 0.68;

    const strict = this.pickBest(candidates, {
      maxDeltaMs: MATCH_TIME_STRICT_MS,
      minEach: 0.75,
      minPair: 0.75,
    });
    if (strict) return strict;

    const fuzzy = this.pickBest(candidates, {
      maxDeltaMs: MATCH_TIME_FALLBACK_MS,
      minEach: fuzzyMinEach,
      minPair: fuzzyMinPair,
    });
    if (fuzzy) {
      this.logger.debug(
        `1win fixture fuzzy match: ${homeTeam} vs ${awayTeam} → ${fuzzy.matchId} (${fuzzy.homeTeam.name} / ${fuzzy.awayTeam.name})`,
      );
      return fuzzy;
    }

    if (doubles) return null;

    let closeBest: ScoredCandidate | null = null;
    let closeRank = -1;
    for (const c of candidates) {
      if (c.deltaMs > 45 * 60_000) continue;
      const strong = Math.max(c.homeScore, c.awayScore);
      const weak = Math.min(c.homeScore, c.awayScore);
      if (strong < 0.9 || weak < 0.5) continue;
      const rank = candidateRank(c);
      if (rank > closeRank) {
        closeBest = c;
        closeRank = rank;
      }
    }
    if (closeBest) {
      this.logger.debug(
        `1win fixture close-kickoff match: ${homeTeam} vs ${awayTeam} → ${closeBest.row.matchId}`,
      );
      return closeBest.row;
    }

    return null;
  }

  getFixture(matchId: number): OneWinFixtureRow | null {
    return this.rows.find((row) => row.matchId === matchId) ?? null;
  }
}
