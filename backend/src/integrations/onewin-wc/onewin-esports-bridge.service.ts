import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { PrismaService } from '~/prisma/prisma.service';

import type { GameDtoWithGroupedMarkets } from '~/main/game/dto/available-games.dto';
import { GameDtoWithGroupedMarkets as GameDtoClass } from '~/main/game/dto/available-games.dto';
import { GameStatus } from '@prisma/client';

import { toPublicEventId } from '../wc-odds/wc-public.util';
import { buildUniqueWcSlug, wcSlugWithEventId } from '../wc-odds/wc-slug.util';

function isSlugConflict(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  if (code !== 'P2002') return false;
  const target = (err as { meta?: { target?: string[] | string } }).meta
    ?.target;
  const fields = Array.isArray(target) ? target : [target ?? ''];
  return fields.includes('slug');
}

import {
  cyberGameRefFromOlimpbetId,
  maskCybersportLabel,
  maskCybersportTeamName,
} from '../cybersport/cybersport-mask.util';

import { resolveOneWinEsportsTeamIcon } from './onewin-esports-logos.util';
import { mapOneWinOddsToGroupedMarkets } from './onewin-esports-markets.util';
import { isOneWinBookOpen } from './onewin-esports-book.util';
import { resolveOneWinBestOf } from './onewin-esports-bestof-resolve.util';
import { resolveOneWinEsportsResult } from './onewin-esports-settlement.util';
import type { OneWinEsportsFixture } from './onewin-esports-index.service';
import { OneWinPushFeedService } from './onewin-push-feed.service';
import {
  emptyMatchState,
  parseMatchState,
} from '../wc-odds/wc-match-state.types';

export function wcEventIdFromOneWin(matchId: number): string {
  return `ow-${matchId}`;
}

export function oneWinMatchIdFromWcEventId(eventId: string): number | null {
  const m = /^ow-(\d+)$/i.exec(eventId);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function isOneWinWcEventId(ref: string): boolean {
  return /^ow-\d+$/i.test(ref);
}

const FULL_MARKETS_REFRESH_MS = 15_000;

@Injectable()
export class OneWinEsportsBridgeService {
  private readonly lastFullMarketsAt = new Map<number, number>();
  private readonly logger = new Logger(OneWinEsportsBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushFeed: OneWinPushFeedService,
  ) {}

  async ensureWcEvent(
    fixture: OneWinEsportsFixture,
    options?: { fullMarkets?: boolean; waitMs?: number },
  ): Promise<{
    completed: boolean;
    hasBroadcast: boolean;
    hasGroupedMarkets: boolean;
    oddsAway: null | number;
    oddsDraw: null | number;
    oddsHome: null | number;
    wcEventRef: string;
  } | null> {
    if (!this.pushFeed.isEnabled()) return null;

    const matchId = fixture.matchId;
    this.pushFeed.subscribe([matchId]);
    this.pushFeed.subscribeOdds([matchId]);

    const waitMs = options?.waitMs ?? (options?.fullMarkets ? 2_500 : 0);
    if (waitMs > 0) {
      await Promise.all([
        this.pushFeed.waitForSnapshot(matchId, waitMs),
        this.pushFeed.waitForOdds(matchId, waitMs),
      ]);
    }

    let includeFull = false;
    if (options?.fullMarkets) {
      const last = this.lastFullMarketsAt.get(matchId) ?? 0;
      if (Date.now() - last >= FULL_MARKETS_REFRESH_MS) {
        includeFull = true;
        this.lastFullMarketsAt.set(matchId, Date.now());
      }
    }

    const info = this.pushFeed.getSnapshot(matchId);
    const odds = this.pushFeed.getOddsSnapshot(matchId);
    const homeTeam = maskCybersportTeamName(fixture.homeTeam.name);
    const awayTeam = maskCybersportTeamName(fixture.awayTeam.name);
    const leagueName = maskCybersportLabel(fixture.tournamentName);
    const mapped = mapOneWinOddsToGroupedMarkets(
      odds?.oddsGroups ?? [],
      homeTeam,
      awayTeam,
    );

    const sportKey = fixture.apiSport;
    const eventId = wcEventIdFromOneWin(matchId);
    const commenceTime = new Date(fixture.startAtMs);
    // Only claim broadcast when 1win actually has a stream URL.
    // Kick heuristics here caused camera icons with no playable /play result.
    const hasBroadcast = Boolean(info?.broadcastUrl);

    const existing = await this.prisma.wcOddsEvent.findUnique({
      select: {
        homeScore: true,
        awayScore: true,
        marketsJson: true,
        matchStateJson: true,
        slug: true,
      },
      where: { id: eventId },
    });

    const prevState =
      parseMatchState(existing?.matchStateJson) ?? emptyMatchState();
    const bestOf = resolveOneWinBestOf({
      leagueName,
      oddsGroups: odds?.oddsGroups ?? [],
      prevState,
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

    const existingCategories = existing?.marketsJson
      ? Object.keys(existing.marketsJson as object).length
      : 0;
    const nextCategories = Object.keys(mapped.groupedMarkets).length;
    const shouldWriteMarkets =
      includeFull || nextCategories >= existingCategories;

    const homeScore = info?.matchScore
      ? result.homeScore
      : (existing?.homeScore ?? result.homeScore);
    const awayScore = info?.matchScore
      ? result.awayScore
      : (existing?.awayScore ?? result.awayScore);

    const periodDetails = result.periodScores.map(
      (p) => [p.home, p.away] as [number, number],
    );
    const parsedScore =
      periodDetails.length > 0 || info?.matchScore
        ? {
            currentScore: [homeScore, awayScore] as [number, number],
            details: periodDetails.length > 0 ? periodDetails : undefined,
            period: periodDetails.length || undefined,
            text: {
              currentScore: `${homeScore}:${awayScore}`,
              details:
                periodDetails.length > 0
                  ? periodDetails.map((d) => `${d[0]}:${d[1]}`).join(', ')
                  : undefined,
            },
          }
        : null;

    const matchStateJson = {
      ...prevState,
      v: 1 as const,
      updatedAt: new Date().toISOString(),
      ...(bestOf != null ? { esports: { ...prevState.esports, bestOf } } : {}),
      ...(parsedScore
        ? {
            result: {
              ...(prevState.result ?? {}),
              capturedAt: new Date().toISOString(),
              parsedScore,
              periodScores: result.periodScores.map((p) => ({
                away: p.away,
                home: p.home,
              })),
            },
          }
        : {}),
    };

    let slug =
      existing?.slug ??
      (await buildUniqueWcSlug(
        this.prisma,
        homeTeam,
        awayTeam,
        commenceTime,
        eventId,
      ));

    const writeEvent = (eventSlug: string) =>
      this.prisma.wcOddsEvent.upsert({
        create: {
          awayCompetitorId: fixture.awayTeam.id,
          awayScore,
          awayTeam,
          bookmakerKey: 'onewin',
          bookmakerTitle: '1win',
          commenceTime,
          completed: result.completed,
          hasBroadcast,
          homeCompetitorId: fixture.homeTeam.id,
          homeScore,
          homeTeam,
          id: eventId,
          leagueName,
          marketsJson: mapped.groupedMarkets as object,
          ...(matchStateJson
            ? { matchStateJson: matchStateJson as object }
            : {}),
          oddsAway:
            mapped.oddsAway != null ? new Decimal(mapped.oddsAway) : null,
          oddsDraw:
            mapped.oddsDraw != null ? new Decimal(mapped.oddsDraw) : null,
          oddsHome:
            mapped.oddsHome != null ? new Decimal(mapped.oddsHome) : null,
          oddsUpdatedAt: new Date(),
          slug: eventSlug,
          sportKey,
          tournamentId: fixture.tournamentId,
        },
        update: {
          ...(shouldWriteMarkets
            ? { marketsJson: mapped.groupedMarkets as object }
            : {}),
          ...(matchStateJson
            ? { matchStateJson: matchStateJson as object }
            : {}),
          awayCompetitorId: fixture.awayTeam.id,
          ...(info?.matchScore ? { awayScore, homeScore } : {}),
          awayTeam,
          bookmakerKey: 'onewin',
          bookmakerTitle: '1win',
          commenceTime,
          completed: result.completed,
          hasBroadcast,
          homeCompetitorId: fixture.homeTeam.id,
          homeTeam,
          leagueName,
          oddsAway:
            mapped.oddsAway != null ? new Decimal(mapped.oddsAway) : null,
          oddsDraw:
            mapped.oddsDraw != null ? new Decimal(mapped.oddsDraw) : null,
          oddsHome:
            mapped.oddsHome != null ? new Decimal(mapped.oddsHome) : null,
          oddsUpdatedAt: new Date(),
          slug: eventSlug,
          sportKey,
          tournamentId: fixture.tournamentId ?? undefined,
        },
        where: { id: eventId },
      });

    try {
      await writeEvent(slug);
    } catch (err) {
      // buildUniqueWcSlug reads before it writes, so two fixtures mapped in
      // parallel can claim the same slug. The id-suffixed form cannot clash.
      if (!isSlugConflict(err)) throw err;
      slug = wcSlugWithEventId(homeTeam, awayTeam, eventId);
      await writeEvent(slug);
    }

    return {
      completed: result.completed,
      hasBroadcast,
      hasGroupedMarkets: Math.max(nextCategories, existingCategories) > 0,
      oddsAway: mapped.oddsAway,
      oddsDraw: mapped.oddsDraw,
      oddsHome: mapped.oddsHome,
      wcEventRef: slug || toPublicEventId(eventId),
    };
  }

  async attachWcBettingMeta(
    dto: GameDtoWithGroupedMarkets,
    fixture: OneWinEsportsFixture,
    options?: { fullMarkets?: boolean; waitMs?: number },
  ): Promise<void> {
    try {
      const bridge = await this.ensureWcEvent(fixture, options);
      if (!bridge) return;

      const hasH2h =
        (bridge.oddsHome != null && bridge.oddsHome > 1) ||
        (bridge.oddsAway != null && bridge.oddsAway > 1);
      const hasWcBetting = hasH2h || bridge.hasGroupedMarkets;
      const bookOpen = isOneWinBookOpen(
        this.pushFeed.getSnapshot(fixture.matchId),
        bridge.completed,
      );

      dto.meta = {
        ...(dto.meta as Record<string, unknown> | undefined),
        marketsCount: bridge.hasGroupedMarkets
          ? Math.max(
              1,
              (dto.meta as { marketsCount?: number } | undefined)
                ?.marketsCount ?? 1,
            )
          : 0,
        wcBetting: hasWcBetting,
        wcBettingOpen: bookOpen,
        wcEventRef: bridge.wcEventRef,
        wcOddsAway: bridge.oddsAway,
        wcOddsDraw: bridge.oddsDraw,
        wcOddsHome: bridge.oddsHome,
      };

      // Always mirror bridge 1/2 into list WIN markets so hub rows are not blank.
      if (hasH2h) {
        const winnerMarkets = [];
        if (bridge.oddsHome != null && bridge.oddsHome > 1) {
          winnerMarkets.push({
            basis: 'WIN',
            cf: bridge.oddsHome,
            isOpen: bookOpen,
            market: 'WIN__P1',
            plr: 'P1',
          });
        }
        if (bridge.oddsAway != null && bridge.oddsAway > 1) {
          winnerMarkets.push({
            basis: 'WIN',
            cf: bridge.oddsAway,
            isOpen: bookOpen,
            market: 'WIN__P2',
            plr: 'P2',
          });
        }
        dto.groupedMarkets = {
          ...(dto.groupedMarkets as object),
          WIN: winnerMarkets,
        };
      }

      if (bridge.hasBroadcast) {
        dto.meta = {
          ...(dto.meta as Record<string, unknown> | undefined),
          hasBroadcast: true,
          wcHasBroadcast: true,
        };
      }
    } catch (err) {
      this.logger.debug(
        `1win WC bridge failed ow-${fixture.matchId}: ${(err as Error).message}`,
      );
    }
  }

  mapFixtureToGameDto(
    fixture: OneWinEsportsFixture,
    extras?: {
      awayScore?: number;
      homeScore?: number;
      oddsAway?: null | number;
      oddsHome?: null | number;
      periodScores?: Array<{ away: number; home: number }>;
      status?: null | string;
    },
  ): GameDtoWithGroupedMarkets {
    const homeTeam = maskCybersportTeamName(fixture.homeTeam.name);
    const awayTeam = maskCybersportTeamName(fixture.awayTeam.name);
    const homeScore = extras?.homeScore ?? 0;
    const awayScore = extras?.awayScore ?? 0;
    const details = (extras?.periodScores ?? []).map(
      (p) => [p.home, p.away] as [number, number],
    );

    const winnerMarkets = [];
    if (extras?.oddsHome != null && extras.oddsHome > 1) {
      winnerMarkets.push({
        basis: 'WIN',
        cf: extras.oddsHome,
        isOpen: true,
        market: 'WIN__P1',
        plr: 'P1',
      });
    }
    if (extras?.oddsAway != null && extras.oddsAway > 1) {
      winnerMarkets.push({
        basis: 'WIN',
        cf: extras.oddsAway,
        isOpen: true,
        market: 'WIN__P2',
        plr: 'P2',
      });
    }

    const now = new Date();
    return new GameDtoClass({
      createdAt: now,
      eventId: cyberGameRefFromOlimpbetId(fixture.matchId),
      eventName: `${homeTeam} — ${awayTeam}`,
      groupedMarkets: winnerMarkets.length > 0 ? { WIN: winnerMarkets } : {},
      leagueName: maskCybersportLabel(fixture.tournamentName),
      meta: {
        apiSport: fixture.apiSport,
        commenceTime: new Date(fixture.startAtMs).toISOString(),
        // Real stream flag is set later when push snapshot has broadcastUrl.
        hasBroadcast: false,
        live: fixture.live,
        matchId: fixture.matchId,
        source: 'onewin',
        sportId: fixture.sportId,
        status: extras?.status ?? null,
        tournamentId: fixture.tournamentId,
      },
      parsedScore: {
        currentScore: [homeScore, awayScore],
        details: details.length > 0 ? details : undefined,
        period: details.length || undefined,
        text: {
          currentScore: `${homeScore}:${awayScore}`,
          details:
            details.length > 0
              ? details.map((d) => `${d[0]}:${d[1]}`).join(', ')
              : undefined,
        },
      },
      score: `${homeScore}:${awayScore}`,
      sport: fixture.apiSport,
      status: fixture.live ? GameStatus.IN_PROGRESS : GameStatus.PREMATCH,
      team1: homeTeam,
      team1Icon: resolveOneWinEsportsTeamIcon(fixture.homeTeam),
      team2: awayTeam,
      team2Icon: resolveOneWinEsportsTeamIcon(fixture.awayTeam),
      updatedAt: now,
    });
  }
}
