import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { PrismaService } from '~/prisma/prisma.service';

import type { GameDtoWithGroupedMarkets } from '~/main/game/dto/available-games.dto';

import { buildOlimpbetSportKey } from '../olimpbet-wc/olimpbet-sport.util';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';
import { hasKickEsportsBroadcast } from '../wc-odds/kick-broadcast.util';
import { toPublicEventId } from '../wc-odds/wc-public.util';
import { buildUniqueWcSlug, wcEventIdFromOlimpbet } from '../wc-odds/wc-slug.util';

export type CybersportWcBridgeResult = {
  wcEventRef: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  commenceTime: string;
  completed: boolean;
  hasBroadcast: boolean;
  /** Full WC market tree (maps, totals, …) — not only 1X2. */
  hasGroupedMarkets: boolean;
};

/** Refetch linked-event markets at most once per event per this window. */
const FULL_MARKETS_REFRESH_MS = 20_000;

@Injectable()
export class CybersportWcBridgeService {
  private readonly logger = new Logger(CybersportWcBridgeService.name);

  private readonly lastFullMarketsAt = new Map<number, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly olimpbet: OlimpbetWcService,
  ) {}

  async ensureWcEvent(
    olimpbetEventId: number,
    sportId: number,
    leagueNameHint?: string,
    options?: { fullMarkets?: boolean },
  ): Promise<CybersportWcBridgeResult | null> {
    if (!this.olimpbet.isEnabled()) return null;

    let includeLinked = false;
    if (options?.fullMarkets) {
      const last = this.lastFullMarketsAt.get(olimpbetEventId) ?? 0;
      if (Date.now() - last >= FULL_MARKETS_REFRESH_MS) {
        includeLinked = true;
        this.lastFullMarketsAt.set(olimpbetEventId, Date.now());
      }
    }

    const snapshot = await this.olimpbet.fetchMatchSnapshot(olimpbetEventId, {
      includeLinked,
      locale: 'ru',
    });
    if (!snapshot) return null;

    const main = await this.olimpbet.fetchEventDetail(olimpbetEventId, { locale: 'ru' });
    if (!main) return null;

    const eventId = wcEventIdFromOlimpbet(olimpbetEventId);
    const commenceTime = new Date(snapshot.commenceTimeIso);
    const homeTeam = this.olimpbet.displayTeamName(snapshot.homeTeamRu);
    const awayTeam = this.olimpbet.displayTeamName(snapshot.awayTeamRu);
    const sportKey = buildOlimpbetSportKey(sportId);
    const leagueName = leagueNameHint?.trim() || main.tournament?.name?.trim() || 'Киберспорт';
    const tournamentId = main.tournament?.id ?? null;
    const score = this.olimpbet.extractScore(main);
    const completed = this.olimpbet.isEventCompleted(main);
    const hasBroadcast = hasKickEsportsBroadcast({
      sportKey,
      leagueName,
      tournamentId,
      homeTeam,
      awayTeam,
      olimpbetBroadcastAvailable: snapshot.hasBroadcast ?? false,
      isLive: Boolean(snapshot.live),
    });

    const existing = await this.prisma.wcOddsEvent.findUnique({
      where: { id: eventId },
      select: { slug: true, marketsJson: true },
    });

    // Never downgrade a richer stored snapshot with a main-event-only one.
    const existingCategories = existing?.marketsJson
      ? Object.keys(existing.marketsJson as object).length
      : 0;
    const nextCategories = Object.keys(snapshot.groupedMarkets).length;
    const shouldWriteMarkets =
      includeLinked || nextCategories >= existingCategories;

    const slug = existing?.slug
      ?? await buildUniqueWcSlug(
        this.prisma,
        homeTeam,
        awayTeam,
        commenceTime,
        eventId,
      );

    await this.prisma.wcOddsEvent.upsert({
      where: { id: eventId },
      create: {
        id: eventId,
        slug,
        sportKey,
        leagueName,
        tournamentId,
        homeTeam,
        awayTeam,
        commenceTime,
        oddsHome: snapshot.oddsHome != null ? new Decimal(snapshot.oddsHome) : null,
        oddsDraw: snapshot.oddsDraw != null ? new Decimal(snapshot.oddsDraw) : null,
        oddsAway: snapshot.oddsAway != null ? new Decimal(snapshot.oddsAway) : null,
        bookmakerKey: 'olimpbet',
        bookmakerTitle: 'Olimpbet',
        oddsUpdatedAt: new Date(),
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        completed,
        homeCompetitorId: snapshot.homeCompetitorId ?? undefined,
        awayCompetitorId: snapshot.awayCompetitorId ?? undefined,
        hasBroadcast,
        marketsJson: snapshot.groupedMarkets as object,
      },
      update: {
        ...(shouldWriteMarkets
          ? { marketsJson: snapshot.groupedMarkets as object }
          : {}),
        slug,
        sportKey,
        leagueName,
        tournamentId: tournamentId ?? undefined,
        homeTeam,
        awayTeam,
        commenceTime,
        oddsHome: snapshot.oddsHome != null ? new Decimal(snapshot.oddsHome) : null,
        oddsDraw: snapshot.oddsDraw != null ? new Decimal(snapshot.oddsDraw) : null,
        oddsAway: snapshot.oddsAway != null ? new Decimal(snapshot.oddsAway) : null,
        bookmakerKey: 'olimpbet',
        bookmakerTitle: 'Olimpbet',
        oddsUpdatedAt: new Date(),
        homeScore: score.homeScore ?? undefined,
        awayScore: score.awayScore ?? undefined,
        completed,
        homeCompetitorId: snapshot.homeCompetitorId ?? undefined,
        awayCompetitorId: snapshot.awayCompetitorId ?? undefined,
        hasBroadcast,
      },
    });

    const wcEventRef = slug || toPublicEventId(eventId);
    const hasGroupedMarkets = Math.max(nextCategories, existingCategories) > 0;

    return {
      wcEventRef,
      oddsHome: snapshot.oddsHome,
      oddsDraw: snapshot.oddsDraw,
      oddsAway: snapshot.oddsAway,
      commenceTime: snapshot.commenceTimeIso,
      completed,
      hasBroadcast,
      hasGroupedMarkets,
    };
  }

  async attachWcBettingMeta(
    dto: GameDtoWithGroupedMarkets,
    olimpbetEventId: number,
    sportId: number,
    options?: { fullMarkets?: boolean },
  ): Promise<void> {
    try {
      const bridge = await this.ensureWcEvent(
        olimpbetEventId,
        sportId,
        dto.leagueName,
        options,
      );
      if (!bridge) return;

      const hasH2hOdds =
        (bridge.oddsHome != null && bridge.oddsHome > 1)
        || (bridge.oddsAway != null && bridge.oddsAway > 1);
      // Live esports (LoL/Dota maps) often have map/total markets without a parsed 1X2 row.
      const hasWcBetting = hasH2hOdds || bridge.hasGroupedMarkets;

      dto.meta = {
        ...(dto.meta as Record<string, unknown> | undefined),
        wcEventRef: bridge.wcEventRef,
        wcBetting: hasWcBetting,
        wcOddsHome: bridge.oddsHome,
        wcOddsAway: bridge.oddsAway,
        wcOddsDraw: bridge.oddsDraw,
        wcCommenceTime: bridge.commenceTime,
        wcCompleted: bridge.completed,
        wcHasBroadcast: bridge.hasBroadcast,
        hasBroadcast: bridge.hasBroadcast,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Cybersport WC bridge failed ol-${olimpbetEventId}: ${message.slice(0, 160)}`,
      );
    }
  }
}
