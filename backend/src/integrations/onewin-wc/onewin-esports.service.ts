import { Injectable, Logger } from '@nestjs/common';

import type { GameDtoWithGroupedMarkets } from '~/main/game/dto/available-games.dto';

import { slugifyCyberTournament } from '../cybersport/cybersport-tournament.util';

import { OneWinEsportsBridgeService } from './onewin-esports-bridge.service';
import {
  ONEWIN_ESPORTS_CATALOG,
  oneWinSportIdFromApiSport,
} from './onewin-esports-catalog';
import {
  OneWinEsportsFixture,
  OneWinEsportsIndexService,
} from './onewin-esports-index.service';
import { resolveOneWinBestOf } from './onewin-esports-bestof-resolve.util';
import { resolveOneWinEsportsResult } from './onewin-esports-settlement.util';
import { OneWinPushFeedService } from './onewin-push-feed.service';

/** Each mapped fixture does a Prisma read + upsert — keep the pool breathing. */
const MAP_CONCURRENCY = 6;

@Injectable()
export class OneWinEsportsService {
  private readonly logger = new Logger(OneWinEsportsService.name);

  constructor(
    private readonly index: OneWinEsportsIndexService,
    private readonly bridge: OneWinEsportsBridgeService,
    private readonly pushFeed: OneWinPushFeedService,
  ) {}

  isEnabled(): boolean {
    return this.pushFeed.isEnabled();
  }

  private async mapFixture(
    fixture: OneWinEsportsFixture,
    opts?: { fullMarkets?: boolean; waitMs?: number },
  ): Promise<GameDtoWithGroupedMarkets> {
    this.pushFeed.subscribe([fixture.matchId]);
    this.pushFeed.subscribeOdds([fixture.matchId]);

    const waitMs = opts?.waitMs ?? 0;
    if (waitMs > 0) {
      await Promise.all([
        this.pushFeed.waitForSnapshot(fixture.matchId, waitMs),
        this.pushFeed.waitForOdds(fixture.matchId, waitMs),
      ]);
    }

    const info = this.pushFeed.getSnapshot(fixture.matchId);
    const odds = this.pushFeed.getOddsSnapshot(fixture.matchId);
    const bestOf = resolveOneWinBestOf({
      leagueName: fixture.tournamentName,
      oddsGroups: odds?.oddsGroups ?? [],
    });
    const result = resolveOneWinEsportsResult(
      {
        hasOpenOdds: info?.hasOpenOdds,
        matchScore: info?.matchScore ?? null,
        periodsScore: info?.periodsScore ?? null,
        status: info?.status ?? null,
      },
      { bestOf: bestOf ?? undefined },
    );
    // h2h from mapped odds via bridge after attach — seed from raw groups lightly
    let oddsHome: null | number = null;
    let oddsAway: null | number = null;
    for (const g of odds?.oddsGroups ?? []) {
      if (!g?.name || !/^победитель\s*$/i.test(g.name.trim())) continue;
      for (const o of g.oddsList ?? []) {
        if (o.status !== 1 || !(o.cf > 1)) continue;
        if (o.outcome === '1') oddsHome = o.cf;
        if (o.outcome === '2') oddsAway = o.cf;
      }
    }

    const dto = this.bridge.mapFixtureToGameDto(fixture, {
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      oddsAway,
      oddsHome,
      periodScores: result.periodScores,
      status: info?.status ?? null,
    });

    // Snapshot and odds are already awaited above — forwarding waitMs made
    // ensureWcEvent repeat the exact same wait, doubling list latency.
    await this.bridge.attachWcBettingMeta(dto, fixture, {
      fullMarkets: opts?.fullMarkets,
      waitMs: 0,
    });

    // Prefer bridge odds (includes suspended match winner + map fallback).
    const meta = (dto.meta ?? {}) as {
      wcOddsAway?: null | number;
      wcOddsHome?: null | number;
    };
    if (
      (meta.wcOddsHome ?? 0) > 1 &&
      (meta.wcOddsAway ?? 0) > 1 &&
      !(dto.groupedMarkets as { WIN?: unknown[] } | undefined)?.WIN?.length
    ) {
      dto.groupedMarkets = {
        ...(dto.groupedMarkets as object),
        WIN: [
          {
            basis: 'WIN',
            cf: meta.wcOddsHome!,
            isOpen: true,
            market: 'WIN__P1',
            plr: 'P1',
          },
          {
            basis: 'WIN',
            cf: meta.wcOddsAway!,
            isOpen: true,
            market: 'WIN__P2',
            plr: 'P2',
          },
        ],
      };
    }

    if (fixture.live) {
      // Cybersport video = 1win only. Partner Kick is shown via attribution UI, not match meta.
      if (info?.broadcastUrl || info?.statisticsTrackerUrl) {
        dto.meta = {
          ...(dto.meta as object),
          hasBroadcast: Boolean(info.broadcastUrl),
          oneWinBroadcastUrl: info.broadcastUrl,
          oneWinStatisticsTrackerUrl: info.statisticsTrackerUrl,
          streamProvider: info.broadcastUrl ? 'onewin' : undefined,
          wcHasBroadcast: Boolean(info.broadcastUrl),
        };
      }
    }

    return dto;
  }

  async counts(): Promise<Record<string, number>> {
    return this.index.countsByApiSport();
  }

  async listLive(
    sport?: string,
    limit = 24,
    tournamentId?: number,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    const rows = await this.index.list({
      apiSport: sport,
      live: true,
      tournamentId,
    });
    const slice = rows.slice(0, limit);
    // One shared warm-up so broadcastUrl is present when 1win has a stream.
    // Waiting per match made the whole page scale at ~3s per live match.
    await this.pushFeed.warmSnapshots(
      slice.map((row) => row.matchId),
      4_000,
    );
    return this.mapFixtures(slice, { fullMarkets: true });
  }

  /** Bounded-concurrency map — Prisma upserts run per fixture inside the bridge. */
  private async mapFixtures(
    rows: OneWinEsportsFixture[],
    opts?: { fullMarkets?: boolean; waitMs?: number },
  ): Promise<GameDtoWithGroupedMarkets[]> {
    const games: Array<GameDtoWithGroupedMarkets | null> = new Array(
      rows.length,
    ).fill(null);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        const index = cursor++;
        if (index >= rows.length) return;
        const row = rows[index];
        try {
          games[index] = await this.mapFixture(row, opts);
        } catch (err) {
          this.logger.warn(
            `1win esports map ${row.matchId}: ${(err as Error).message}`,
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(MAP_CONCURRENCY, rows.length) }, worker),
    );
    return games.filter((g): g is GameDtoWithGroupedMarkets => g !== null);
  }

  async listLine(
    sport?: string,
    limit = 24,
    offset = 0,
    tournamentId?: number,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    const rows = await this.index.list({
      apiSport: sport,
      live: false,
      tournamentId,
    });
    const slice = rows.slice(offset, offset + limit);
    await this.pushFeed.warmSnapshots(
      slice.map((row) => row.matchId),
      2_000,
    );
    return this.mapFixtures(slice);
  }

  async listTournaments(sport?: string): Promise<
    Array<{
      apiSport: string;
      id: number;
      lineCount: number;
      liveCount: number;
      name: string;
      priorityLevel: number;
      slug: string;
      sportId: number;
    }>
  > {
    const rows = await this.index.tournaments(sport);
    return rows.map((t) => ({
      ...t,
      priorityLevel: t.liveCount > 0 ? 2 : 1,
      slug: slugifyCyberTournament(t.name, t.id) || String(t.id),
    }));
  }

  async getGame(matchId: number): Promise<GameDtoWithGroupedMarkets | null> {
    let fixture = await this.index.get(matchId);
    if (!fixture) {
      // Force refresh once — match may have just gone live.
      await this.index.ensureFresh(true);
      fixture = await this.index.get(matchId);
      if (!fixture) return null;
    }
    return this.mapFixture(fixture, { fullMarkets: true, waitMs: 2_500 });
  }

  disciplines(): Array<{
    apiSport: string;
    iconUrl: null | string;
    label: string;
    pathSlug: string;
    sportId: number;
  }> {
    const icons = this.index.sportIconUrlByApiSport();
    return ONEWIN_ESPORTS_CATALOG.map((e) => ({
      apiSport: e.apiSport,
      iconUrl: icons[e.apiSport] ?? null,
      label: e.label,
      pathSlug: e.pathSlug,
      sportId: e.sportId,
    }));
  }

  resolveSportId(apiSport: string): number | null {
    return oneWinSportIdFromApiSport(apiSport);
  }
}
