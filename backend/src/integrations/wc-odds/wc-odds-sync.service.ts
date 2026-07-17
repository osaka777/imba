import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Decimal } from '@prisma/client/runtime/library';
import { WcOddsBetStatus } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';

import { buildOlimpbetSportKey, olimpbetSportKeyToSlug } from '../olimpbet-wc/olimpbet-sport.util';
import { OlimpbetWcService, type OlimpbetLineEventRow } from '../olimpbet-wc/olimpbet-wc.service';

import { wcLineEventWhere, wcLiveEventWhere } from './wc-betting.util';
import { WC_LINE_WINDOW_MS, WC_LINE_WINDOW_MS_MMA, WC_MMA_SPORT_KEY } from './wc-line-time.util';
import { advanceMatchState } from './wc-match-state-tracker.util';
import { WcOddsSettlementService } from './wc-odds-settlement.service';
import { WcTelegramPulseService } from './wc-telegram-pulse.service';
import { buildUniqueWcSlug, isBrokenWcSlug, olimpbetIdFromWcEventId, wcEventIdFromOlimpbet } from './wc-slug.util';

const LIVE_REFRESH_MIN_MS = 3_000;
const LIVE_ENRICH_STALE_MS = 8_000;
const ENRICH_BATCH_SIZE = 60;
const ENRICH_CONCURRENCY = 2;
const ENRICH_STALE_MS = 60_000;
const LIVE_ENRICH_BATCH_SIZE = 8;
const LIVE_ROTATING_REFRESH_BATCH = 5;

@Injectable()
export class WcOddsSyncService implements OnModuleInit {
  private readonly logger = new Logger(WcOddsSyncService.name);
  private syncing = false;
  private liveSyncing = false;
  private liveRefreshCursor = 0;
  private readonly lastLiveRefreshMs = new Map<string, number>();

  private bootReadyAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly settlement: WcOddsSettlementService,
    private readonly pulse: WcTelegramPulseService,
  ) {}

  onModuleInit() {
    // Delay boot sync — immediate syncOdds+syncLiveOdds was storming Olimpbet after every deploy.
    this.bootReadyAt = Date.now() + 60_000;
    if (this.olimpbet.isEnabled()) {
      setTimeout(() => {
        void this.syncOdds();
        void this.syncLiveOdds();
      }, 60_000).unref?.();
    }
  }

  @Cron('*/20 * * * * *')
  async scheduledEnrich() {
    if (!this.olimpbet.isEnabled()) return;
    if (Date.now() < this.bootReadyAt) return;
    if (this.olimpbet.isFetchBlocked()) return;
    const enriched = await this.enrichStaleBatch(ENRICH_BATCH_SIZE);
    if (enriched > 0) {
      this.logger.log(`WC Olimpbet line enrich: enriched=${enriched}`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledOddsSync() {
    if (!this.olimpbet.isEnabled()) return;
    if (Date.now() < this.bootReadyAt) return;
    await this.syncOdds();
  }

  @Cron('*/30 * * * * *')
  async scheduledLiveSync() {
    if (!this.olimpbet.isEnabled()) return;
    if (Date.now() < this.bootReadyAt) return;
    await this.syncLiveOdds();
  }

  @Cron('*/30 * * * * *')
  async scheduledSettlement() {
    if (!this.olimpbet.isEnabled()) return;
    await this.settlement.settleFinishedEvents();
  }

  @Cron('*/2 * * * * *')
  async scheduledStaleSettlement() {
    if (!this.olimpbet.isEnabled()) return;
    await this.settlement.settleStalePendingBets();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledPreMatchReminders() {
    if (!this.olimpbet.isEnabled()) return;
    try {
      await this.pulse.sendPreMatchReminders();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WC pre-match reminders failed: ${message.slice(0, 200)}`);
    }
  }

  private isEventLive(event: {
    homeScore: number | null;
    awayScore: number | null;
    completed: boolean;
    commenceTime: Date;
  } | null): boolean {
    if (!event || event.completed) return false;
    if (event.homeScore != null || event.awayScore != null) return true;
    return event.commenceTime.getTime() <= Date.now();
  }

  async syncOdds(): Promise<{ indexed: number; enriched: number }> {
    if (!this.olimpbet.isEnabled()) return { indexed: 0, enriched: 0 };
    if (this.syncing) return { indexed: 0, enriched: 0 };

    this.syncing = true;
    try {
      const rows = await this.olimpbet.listAllLineEvents();
      let indexed = 0;

      for (const row of rows) {
        try {
          if (await this.upsertListRow(row)) indexed += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `WC list upsert failed ol-${row.olimpbetEventId}: ${message.slice(0, 200)}`,
          );
        }
      }

      // Warm EN competitor labels for UI overlay (does not rewrite DB).
      void this.olimpbet.ensureLocalizedNames('en');

      await this.pruneOutsideLineWindow();

      const enriched = await this.enrichStaleBatch(ENRICH_BATCH_SIZE);
      this.logger.log(`WC Olimpbet sync: indexed=${indexed} enriched=${enriched}`);
      return { indexed, enriched };
    } finally {
      this.syncing = false;
    }
  }

  private async pruneOutsideLineWindow(): Promise<void> {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + WC_LINE_WINDOW_MS);
    const mmaEnd = new Date(now.getTime() + WC_LINE_WINDOW_MS_MMA);
    await this.prisma.wcOddsEvent.deleteMany({
      where: {
        completed: false,
        OR: [
          { sportKey: WC_MMA_SPORT_KEY, commenceTime: { gt: mmaEnd } },
          { sportKey: { not: WC_MMA_SPORT_KEY }, commenceTime: { gt: weekEnd } },
        ],
      },
    });
  }

  private async upsertListRow(row: OlimpbetLineEventRow): Promise<boolean> {
    const eventId = wcEventIdFromOlimpbet(row.olimpbetEventId);
    const commenceTime = new Date(row.commenceTimeIso);
    const homeTeam = this.olimpbet.displayTeamName(row.homeTeamRu);
    const awayTeam = this.olimpbet.displayTeamName(row.awayTeamRu);
    const sportKey = buildOlimpbetSportKey(row.olimpbetSportId);
    const leagueName = row.tournamentName;

    const existing = await this.prisma.wcOddsEvent.findUnique({
      where: { id: eventId },
      select: { slug: true },
    });

    const needsSlugRepair = !existing?.slug || isBrokenWcSlug(existing.slug);
    const slug = needsSlugRepair
      ? await buildUniqueWcSlug(
        this.prisma,
        homeTeam,
        awayTeam,
        commenceTime,
        eventId,
      )
      : existing!.slug!;

    await this.prisma.wcOddsEvent.upsert({
      where: { id: eventId },
      create: {
        id: eventId,
        slug,
        sportKey,
        leagueName,
        tournamentId: row.tournamentId,
        homeTeam,
        awayTeam,
        commenceTime,
        bookmakerKey: 'olimpbet',
        bookmakerTitle: 'Olimpbet',
        completed: false,
        marketsJson: {},
        priorityLevel: row.priorityLevel,
      },
      update: {
        slug,
        sportKey,
        leagueName,
        tournamentId: row.tournamentId ?? undefined,
        homeTeam,
        awayTeam,
        commenceTime,
        bookmakerKey: 'olimpbet',
        bookmakerTitle: 'Olimpbet',
        priorityLevel: row.priorityLevel,
      },
    });

    return true;
  }

  needsEnrich(row: {
    oddsUpdatedAt?: Date | null;
    oddsHome?: Decimal | null;
    oddsAway?: Decimal | null;
    marketsJson?: unknown;
  }): boolean {
    if (!row.oddsHome && !row.oddsAway) return true;
    if (!row.oddsUpdatedAt) return true;
    if (Date.now() - row.oddsUpdatedAt.getTime() > ENRICH_STALE_MS) return true;
    const markets = row.marketsJson;
    if (!markets || typeof markets !== 'object') return true;
    return Object.keys(markets as object).length === 0;
  }

  async enrichEvents(eventIds: string[], fast = true): Promise<number> {
    if (!this.olimpbet.isEnabled() || eventIds.length === 0) return 0;

    let enriched = 0;
    let cursor = 0;

    const worker = async () => {
      while (cursor < eventIds.length) {
        const index = cursor;
        cursor += 1;
        const eventId = eventIds[index];
        const olimpbetId = olimpbetIdFromWcEventId(eventId);
        if (!olimpbetId) continue;
        if (await this.upsertFromOlimpbet(olimpbetId, fast)) enriched += 1;
      }
    };

    const workers = Array.from(
      { length: Math.min(ENRICH_CONCURRENCY, eventIds.length) },
      () => worker(),
    );
    await Promise.all(workers);
    return enriched;
  }

  async enrichStaleBatch(take: number): Promise<number> {
    const staleBefore = new Date(Date.now() - ENRICH_STALE_MS);
    const rows = await this.prisma.wcOddsEvent.findMany({
      where: {
        AND: [
          wcLineEventWhere(),
          {
            OR: [
              { oddsUpdatedAt: null },
              { oddsUpdatedAt: { lt: staleBefore } },
              { marketsJson: { equals: {} } },
            ],
          },
        ],
      },
      orderBy: [{ oddsUpdatedAt: { sort: 'asc', nulls: 'first' } }, { commenceTime: 'asc' }, { id: 'asc' }],
      take,
      select: { id: true },
    });

    return this.enrichEvents(rows.map((row) => row.id), true);
  }

  async syncLiveOdds(): Promise<{ indexed: number; refreshed: number; enriched: number }> {
    if (!this.olimpbet.isEnabled() || this.liveSyncing) {
      return { indexed: 0, refreshed: 0, enriched: 0 };
    }

    this.liveSyncing = true;
    try {
      const rows = await this.olimpbet.listAllLiveEvents();
      const liveOlimpbetIds = new Set(rows.map((row) => row.olimpbetEventId));
      let indexed = 0;

      for (const row of rows) {
        try {
          if (await this.upsertListRow(row)) indexed += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `WC live list upsert failed ol-${row.olimpbetEventId}: ${message.slice(0, 200)}`,
          );
        }
      }

      void this.olimpbet.ensureLocalizedNames('en');

      // Empty list usually means Olimpbet /v2/events failed (rate-limit / network),
      // not "zero live matches" — never mass-reconcile DB live as dropped in that case.
      if (liveOlimpbetIds.size > 0) {
        await this.reconcileDroppedLiveEvents(liveOlimpbetIds);
      } else {
        this.logger.warn('WC live list empty — skip reconcileDroppedLiveEvents');
      }
      await this.prisma.wcOddsEvent.updateMany({
        where: {
          completed: false,
          OR: [
            { leagueName: { contains: 'Статистика', mode: 'insensitive' } },
            { leagueName: { contains: 'Statistic', mode: 'insensitive' } },
          ],
        },
        data: { completed: true },
      });

      if (this.olimpbet.isFetchBlocked()) {
        this.logger.warn('WC live sync: Olimpbet circuit open — skip enrich/refresh');
        return { indexed, refreshed: 0, enriched: 0 };
      }

      const enriched = await this.enrichLiveStaleBatch(LIVE_ENRICH_BATCH_SIZE);
      const refreshed = await this.refreshLiveRotatingBatch();

      if (indexed > 0 || refreshed > 0) {
        this.logger.log(`WC Olimpbet live sync: indexed=${indexed} refreshed=${refreshed} enriched=${enriched}`);
      }

      return { indexed, refreshed, enriched };
    } finally {
      this.liveSyncing = false;
    }
  }

  /** Force-refresh DB live rows that Olimpbet no longer lists as live (match ended). */
  private async reconcileDroppedLiveEvents(liveOlimpbetIds: Set<number>): Promise<void> {
    const dbLive = await this.prisma.wcOddsEvent.findMany({
      where: wcLiveEventWhere(),
      select: { id: true },
      orderBy: [{ priorityLevel: 'desc' }, { commenceTime: 'desc' }, { id: 'asc' }],
      take: 80,
    });

    for (const row of dbLive) {
      const olimpbetId = olimpbetIdFromWcEventId(row.id);
      if (!olimpbetId || liveOlimpbetIds.has(olimpbetId)) continue;
      await this.refreshEvent(row.id, true);
    }
  }

  async syncLiveEvents(): Promise<{ refreshed: number }> {
    const refreshed = await this.refreshLiveRotatingBatch();
    return { refreshed };
  }

  /** Rotate through live events — avoid refreshing all 200 every 10s. */
  private async refreshLiveRotatingBatch(): Promise<number> {
    if (!this.olimpbet.isEnabled()) return 0;

    const live = await this.prisma.wcOddsEvent.findMany({
      where: wcLiveEventWhere(),
      select: { id: true },
      take: 200,
      orderBy: [{ priorityLevel: 'desc' }, { commenceTime: 'desc' }, { id: 'asc' }],
    });

    if (!live.length) return 0;

    const start = this.liveRefreshCursor % live.length;
    this.liveRefreshCursor = (start + LIVE_ROTATING_REFRESH_BATCH) % live.length;

    const batch: typeof live = [];
    const count = Math.min(LIVE_ROTATING_REFRESH_BATCH, live.length);
    for (let i = 0; i < count; i += 1) {
      batch.push(live[(start + i) % live.length]!);
    }

    let refreshed = 0;
    for (const row of batch) {
      if (await this.refreshEvent(row.id)) refreshed += 1;
    }

    return refreshed;
  }

  async enrichLiveStaleBatch(take: number): Promise<number> {
    const staleBefore = new Date(Date.now() - LIVE_ENRICH_STALE_MS);
    const rows = await this.prisma.wcOddsEvent.findMany({
      where: {
        ...wcLiveEventWhere(),
        OR: [
          { oddsUpdatedAt: null },
          { oddsUpdatedAt: { lt: staleBefore } },
          { marketsJson: { equals: {} } },
        ],
      },
      orderBy: [{ commenceTime: 'desc' }, { id: 'asc' }],
      take,
      select: { id: true },
    });

    return this.enrichEvents(rows.map((row) => row.id), true);
  }

  async refreshEvent(eventId: string, force = false): Promise<boolean> {
    if (!this.olimpbet.isEnabled()) return false;

    const now = Date.now();
    const last = this.lastLiveRefreshMs.get(eventId) ?? 0;
    if (!force && now - last < LIVE_REFRESH_MIN_MS) return false;

    const olimpbetId = olimpbetIdFromWcEventId(eventId);
    if (!olimpbetId) return false;

    const ok = await this.upsertFromOlimpbet(olimpbetId, false);
    if (ok) this.lastLiveRefreshMs.set(eventId, now);
    return ok;
  }

  private async upsertFromOlimpbet(olimpbetEventId: number, fast = false): Promise<boolean> {
    const snapshot = fast
      ? await this.olimpbet.fetchQuickLineSnapshot(olimpbetEventId, { locale: 'ru' })
      : await this.olimpbet.fetchMatchSnapshot(olimpbetEventId, { includeLinked: true, locale: 'ru' });
    if (!snapshot) return false;

    const eventId = wcEventIdFromOlimpbet(olimpbetEventId);
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let completed = false;
    let main: Awaited<ReturnType<OlimpbetWcService['fetchEventDetail']>> = null;
    let matchState: ReturnType<typeof advanceMatchState> | undefined;

    const existing = await this.prisma.wcOddsEvent.findUnique({
      where: { id: eventId },
      select: {
        sportKey: true,
        leagueName: true,
        tournamentId: true,
        slug: true,
        matchStateJson: true,
        homeTeam: true,
        awayTeam: true,
        commenceTime: true,
        homeScore: true,
        awayScore: true,
        completed: true,
      },
    });

    if (!fast) {
      main = await this.olimpbet.fetchEventDetail(olimpbetEventId, { locale: 'ru' });
      if (!main) return false;
      const score = this.olimpbet.extractScore(main);
      homeScore = score.homeScore;
      awayScore = score.awayScore;
      completed = this.olimpbet.isEventCompleted(main);

      const sportSlug = olimpbetSportKeyToSlug(existing?.sportKey ?? buildOlimpbetSportKey(100));
      const pendingDisplayBets = await this.prisma.wcOddsBet.count({
        where: {
          eventId,
          status: WcOddsBetStatus.PENDING,
          OR: [
            { marketKey: { startsWith: 'display_' } },
            { outcomeKey: { startsWith: 'DISPLAY_' } },
          ],
        },
      });
      const detailForState = pendingDisplayBets > 0
        ? await this.olimpbet.fetchSettlementDetail(main)
        : main;
      matchState = advanceMatchState(existing?.matchStateJson, detailForState, sportSlug);
    }

    const commenceTime = new Date(snapshot.commenceTimeIso);
    const homeTeam = this.olimpbet.displayTeamName(snapshot.homeTeamRu);
    const awayTeam = this.olimpbet.displayTeamName(snapshot.awayTeamRu);

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
        sportKey: existing?.sportKey ?? buildOlimpbetSportKey(100),
        leagueName: existing?.leagueName ?? 'Olimpbet',
        tournamentId: existing?.tournamentId ?? null,
        homeTeam,
        awayTeam,
        commenceTime,
        oddsHome: snapshot.oddsHome ? new Decimal(snapshot.oddsHome) : null,
        oddsDraw: snapshot.oddsDraw ? new Decimal(snapshot.oddsDraw) : null,
        oddsAway: snapshot.oddsAway ? new Decimal(snapshot.oddsAway) : null,
        bookmakerKey: 'olimpbet',
        bookmakerTitle: 'Olimpbet',
        oddsUpdatedAt: new Date(),
        homeScore,
        awayScore,
        completed,
        homeCompetitorId: snapshot.homeCompetitorId ?? undefined,
        awayCompetitorId: snapshot.awayCompetitorId ?? undefined,
        hasBroadcast: snapshot.hasBroadcast ?? false,
        marketsJson: snapshot.groupedMarkets as object,
        matchStateJson: matchState as object | undefined,
      },
      update: {
        homeTeam,
        awayTeam,
        commenceTime,
        oddsHome: snapshot.oddsHome ? new Decimal(snapshot.oddsHome) : undefined,
        oddsDraw: snapshot.oddsDraw != null ? new Decimal(snapshot.oddsDraw) : null,
        oddsAway: snapshot.oddsAway ? new Decimal(snapshot.oddsAway) : undefined,
        bookmakerKey: 'olimpbet',
        bookmakerTitle: 'Olimpbet',
        oddsUpdatedAt: new Date(),
        homeScore: homeScore ?? undefined,
        awayScore: awayScore ?? undefined,
        completed,
        homeCompetitorId: snapshot.homeCompetitorId ?? undefined,
        awayCompetitorId: snapshot.awayCompetitorId ?? undefined,
        hasBroadcast: snapshot.hasBroadcast ?? false,
        marketsJson: snapshot.groupedMarkets as object,
        matchStateJson: matchState as object | undefined,
      },
    });

    if (!fast) {
      const pulseEvent = {
        id: eventId,
        slug,
        homeTeam,
        awayTeam,
        commenceTime,
        homeScore: homeScore ?? existing?.homeScore ?? null,
        awayScore: awayScore ?? existing?.awayScore ?? null,
        completed,
      };

      if (homeScore != null && awayScore != null) {
        void this.pulse
          .onScoreChange(
            pulseEvent,
            existing?.homeScore ?? null,
            existing?.awayScore ?? null,
            homeScore,
            awayScore,
          )
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`WC live pulse score failed ${eventId}: ${message.slice(0, 120)}`);
          });
      }

      const wasLive = this.isEventLive(existing);
      const isLive = this.isEventLive(pulseEvent);
      void this.pulse
        .detectLiveTransition(pulseEvent, wasLive, isLive)
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`WC live pulse start failed ${eventId}: ${message.slice(0, 120)}`);
        });
    }

    if (!fast && main && homeScore != null && awayScore != null) {
      const pendingCount = await this.prisma.wcOddsBet.count({
        where: { eventId, status: WcOddsBetStatus.PENDING },
      });
      if (pendingCount > 0) {
        await this.settlement.trySettleDeterminateBets(
          eventId,
          homeScore,
          awayScore,
          main,
          matchState,
        );
      }

      if (completed) {
        await this.settlement.trySettleEvent(eventId, main);
      }
    }

    return true;
  }
}
