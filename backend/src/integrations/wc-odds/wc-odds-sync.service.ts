import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WcOddsBetStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { PrismaService } from '~/prisma/prisma.service';

import {
  buildOlimpbetSportKey,
  olimpbetSportKeyToSlug,
} from '../olimpbet-wc/olimpbet-sport.util';
import {
  type OlimpbetLineEventRow,
  OlimpbetWcService,
} from '../olimpbet-wc/olimpbet-wc.service';
import { OneWinWcService } from '../onewin-wc/onewin-wc.service';
import {
  WC_LIVE_MAX_AGE_MS,
  wcLineEventWhere,
  wcLiveEventWhere,
} from './wc-betting.util';
import {
  WC_LINE_WINDOW_MS,
  WC_LINE_WINDOW_MS_MMA,
  WC_MMA_SPORT_KEY,
} from './wc-line-time.util';
import { advanceMatchState } from './wc-match-state-tracker.util';
import { emptyMatchState, parseMatchState } from './wc-match-state.types';
import { WcOddsSettlementService } from './wc-odds-settlement.service';
import {
  buildUniqueWcSlug,
  isBrokenWcSlug,
  olimpbetIdFromWcEventId,
  oneWinMatchIdFromWcEventId,
  wcEventIdFromOlimpbet,
} from './wc-slug.util';
import { WcTelegramPulseService } from './wc-telegram-pulse.service';

const LIVE_REFRESH_MIN_MS = 3_000;
const LIVE_ENRICH_STALE_MS = 8_000;
const ENRICH_BATCH_SIZE = 40;
const ENRICH_CONCURRENCY = 2;
/** Cap sports media warm so we don't refill the shared 1win socket. */
const ONEWIN_SPORTS_MEDIA_WARM_TAKE = 40;
const ENRICH_STALE_MS = 60_000;
/** Null-odds live backlog grows fast from list upserts; keep enrich ahead of index. */
const LIVE_ENRICH_BATCH_SIZE = 40;
/** ~250 live events: 20/cycle @ 8s ≈ full pass ~1.5–2 min (was ~3 min with 5/30s). */
const LIVE_ROTATING_REFRESH_BATCH = 20;

@Injectable()
export class WcOddsSyncService implements OnModuleInit {
  private bootReadyAt = 0;
  private readonly lastLiveRefreshMs = new Map<string, number>();
  /** Separate from liveSyncing so list-index sync does not block odds rotate. */
  private liveOddsRotating = false;
  private liveRefreshCursor = 0;
  private liveSyncing = false;
  private readonly logger = new Logger(WcOddsSyncService.name);
  private sportsMediaWarming = false;

  private syncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly onewin: OneWinWcService,
    private readonly settlement: WcOddsSettlementService,
    private readonly pulse: WcTelegramPulseService,
  ) {}

  private isEventLive(
    event: {
      awayScore: null | number;
      commenceTime: Date;
      completed: boolean;
      homeScore: null | number;
    } | null,
  ): boolean {
    if (!event || event.completed) return false;
    if (event.homeScore != null || event.awayScore != null) return true;
    return event.commenceTime.getTime() <= Date.now();
  }

  private async pruneOutsideLineWindow(): Promise<void> {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + WC_LINE_WINDOW_MS);
    const mmaEnd = new Date(now.getTime() + WC_LINE_WINDOW_MS_MMA);
    await this.prisma.wcOddsEvent.deleteMany({
      where: {
        OR: [
          { commenceTime: { gt: mmaEnd }, sportKey: WC_MMA_SPORT_KEY },
          {
            commenceTime: { gt: weekEnd },
            sportKey: { not: WC_MMA_SPORT_KEY },
          },
        ],
        completed: false,
      },
    });
  }

  /** Force-refresh DB live rows that Olimpbet no longer lists as live (match ended). */
  private async reconcileDroppedLiveEvents(
    liveOlimpbetIds: Set<number>,
  ): Promise<void> {
    const dbLive = await this.prisma.wcOddsEvent.findMany({
      orderBy: [
        { priorityLevel: 'desc' },
        { commenceTime: 'desc' },
        { id: 'asc' },
      ],
      select: { id: true },
      take: 80,
      where: wcLiveEventWhere(),
    });

    for (const row of dbLive) {
      const olimpbetId = olimpbetIdFromWcEventId(row.id);
      if (!olimpbetId || liveOlimpbetIds.has(olimpbetId)) continue;
      await this.refreshEvent(row.id, true);
    }
  }

  /** Rotate through live events — avoid refreshing all 200 every 10s. */
  private async refreshLiveRotatingBatch(): Promise<number> {
    if (!this.olimpbet.isEnabled()) return 0;

    const live = await this.prisma.wcOddsEvent.findMany({
      orderBy: [
        { priorityLevel: 'desc' },
        { commenceTime: 'desc' },
        { id: 'asc' },
      ],
      select: { id: true },
      take: 200,
      where: wcLiveEventWhere(),
    });

    if (!live.length) return 0;

    const start = this.liveRefreshCursor % live.length;
    this.liveRefreshCursor =
      (start + LIVE_ROTATING_REFRESH_BATCH) % live.length;

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

  private async upsertFromOlimpbet(
    olimpbetEventId: number,
    fast = false,
  ): Promise<boolean> {
    const snapshot = fast
      ? await this.olimpbet.fetchQuickLineSnapshot(olimpbetEventId, {
          locale: 'ru',
        })
      : await this.olimpbet.fetchMatchSnapshot(olimpbetEventId, {
          includeLinked: true,
          locale: 'ru',
        });
    if (!snapshot) return false;

    const eventId = wcEventIdFromOlimpbet(olimpbetEventId);
    let homeScore: null | number = null;
    let awayScore: null | number = null;
    let completed = false;
    let main: Awaited<ReturnType<OlimpbetWcService['fetchEventDetail']>> = null;
    let matchState: ReturnType<typeof advanceMatchState> | undefined;

    const existing = await this.prisma.wcOddsEvent.findUnique({
      select: {
        awayScore: true,
        awayTeam: true,
        commenceTime: true,
        completed: true,
        hasBroadcast: true,
        homeScore: true,
        homeTeam: true,
        leagueName: true,
        matchStateJson: true,
        slug: true,
        sportKey: true,
        tournamentId: true,
      },
      where: { id: eventId },
    });

    if (!fast) {
      main = await this.olimpbet.fetchEventDetail(olimpbetEventId, {
        locale: 'ru',
      });
      if (!main) return false;
      const score = this.olimpbet.extractScore(main);
      homeScore = score.homeScore;
      awayScore = score.awayScore;
      completed = this.olimpbet.isEventCompleted(main);

      const sportSlug = olimpbetSportKeyToSlug(
        existing?.sportKey ?? buildOlimpbetSportKey(100),
      );
      const pendingDisplayBets = await this.prisma.wcOddsBet.count({
        where: {
          OR: [
            { marketKey: { startsWith: 'display_' } },
            { outcomeKey: { startsWith: 'DISPLAY_' } },
          ],
          eventId,
          status: WcOddsBetStatus.PENDING,
        },
      });
      const detailForState =
        pendingDisplayBets > 0
          ? await this.olimpbet.fetchSettlementDetail(main)
          : main;
      matchState = advanceMatchState(
        existing?.matchStateJson,
        detailForState,
        sportSlug,
      );
    }

    const commenceTime = new Date(snapshot.commenceTimeIso);
    const homeTeam = this.olimpbet.displayTeamName(snapshot.homeTeamRu);
    const awayTeam = this.olimpbet.displayTeamName(snapshot.awayTeamRu);

    // Olimpbet has no stream for this event — cheap, cached check against the
    // 1win fixture index/push-feed before we give up on the broadcast badge.
    // Cold 1win cache must not wipe a previously confirmed badge.
    const likelyBroadcast = await this.onewin.hasLikelyBroadcast(
      commenceTime,
      homeTeam,
      awayTeam,
    );
    const hasBroadcast =
      snapshot.hasBroadcast ||
      likelyBroadcast ||
      Boolean(existing?.hasBroadcast);

    const slug =
      existing?.slug ??
      (await buildUniqueWcSlug(
        this.prisma,
        homeTeam,
        awayTeam,
        commenceTime,
        eventId,
      ));

    await this.prisma.wcOddsEvent.upsert({
      create: {
        awayCompetitorId: snapshot.awayCompetitorId ?? undefined,
        awayScore,
        awayTeam,
        bookmakerKey: 'olimpbet',
        bookmakerTitle: 'Olimpbet',
        commenceTime,
        completed,
        hasBroadcast,
        homeCompetitorId: snapshot.homeCompetitorId ?? undefined,
        homeScore,
        homeTeam,
        id: eventId,
        leagueName: existing?.leagueName ?? 'Olimpbet',
        marketsJson: snapshot.groupedMarkets as object,
        matchStateJson: matchState as object | undefined,
        oddsAway: snapshot.oddsAway ? new Decimal(snapshot.oddsAway) : null,
        oddsDraw: snapshot.oddsDraw ? new Decimal(snapshot.oddsDraw) : null,
        oddsHome: snapshot.oddsHome ? new Decimal(snapshot.oddsHome) : null,
        oddsUpdatedAt: new Date(),
        slug,
        sportKey: existing?.sportKey ?? buildOlimpbetSportKey(100),
        tournamentId: existing?.tournamentId ?? null,
      },
      update: {
        awayCompetitorId: snapshot.awayCompetitorId ?? undefined,
        awayScore: awayScore ?? undefined,
        awayTeam,
        bookmakerKey: 'olimpbet',
        bookmakerTitle: 'Olimpbet',
        commenceTime,
        completed,
        hasBroadcast,
        homeCompetitorId: snapshot.homeCompetitorId ?? undefined,
        homeScore: homeScore ?? undefined,
        homeTeam,
        marketsJson: snapshot.groupedMarkets as object,
        matchStateJson: matchState as object | undefined,
        oddsAway: snapshot.oddsAway
          ? new Decimal(snapshot.oddsAway)
          : undefined,
        oddsDraw:
          snapshot.oddsDraw != null ? new Decimal(snapshot.oddsDraw) : null,
        oddsHome: snapshot.oddsHome
          ? new Decimal(snapshot.oddsHome)
          : undefined,
        oddsUpdatedAt: new Date(),
      },
      where: { id: eventId },
    });

    if (!fast) {
      const pulseEvent = {
        awayScore: awayScore ?? existing?.awayScore ?? null,
        awayTeam,
        commenceTime,
        completed,
        homeScore: homeScore ?? existing?.homeScore ?? null,
        homeTeam,
        id: eventId,
        slug,
        sportKey: existing?.sportKey ?? null,
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
            this.logger.warn(
              `WC live pulse score failed ${eventId}: ${message.slice(0, 120)}`,
            );
          });
      }

      const wasLive = this.isEventLive(existing);
      const isLive = this.isEventLive(pulseEvent);
      void this.pulse
        .detectLiveTransition(pulseEvent, wasLive, isLive)
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `WC live pulse start failed ${eventId}: ${message.slice(0, 120)}`,
          );
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

  private async upsertListRow(row: OlimpbetLineEventRow): Promise<boolean> {
    const eventId = wcEventIdFromOlimpbet(row.olimpbetEventId);
    const commenceTime = new Date(row.commenceTimeIso);
    const homeTeam = this.olimpbet.displayTeamName(row.homeTeamRu);
    const awayTeam = this.olimpbet.displayTeamName(row.awayTeamRu);
    const sportKey = buildOlimpbetSportKey(row.olimpbetSportId);
    const leagueName = row.tournamentName;

    const existing = await this.prisma.wcOddsEvent.findUnique({
      select: { slug: true },
      where: { id: eventId },
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
      create: {
        awayTeam,
        bookmakerKey: 'olimpbet',
        bookmakerTitle: 'Olimpbet',
        commenceTime,
        completed: false,
        homeTeam,
        id: eventId,
        leagueName,
        marketsJson: {},
        priorityLevel: row.priorityLevel,
        slug,
        sportKey,
        tournamentId: row.tournamentId,
      },
      update: {
        awayTeam,
        bookmakerKey: 'olimpbet',
        bookmakerTitle: 'Olimpbet',
        commenceTime,
        homeTeam,
        leagueName,
        priorityLevel: row.priorityLevel,
        slug,
        sportKey,
        tournamentId: row.tournamentId ?? undefined,
      },
      where: { id: eventId },
    });

    return true;
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

  async enrichLiveStaleBatch(take: number): Promise<number> {
    const staleBefore = new Date(Date.now() - LIVE_ENRICH_STALE_MS);
    const rows = await this.prisma.wcOddsEvent.findMany({
      // Never-enriched / null 1X2 first — commenceTime-desc alone starved empty rows.
      orderBy: [
        { oddsUpdatedAt: { nulls: 'first', sort: 'asc' } },
        { commenceTime: 'desc' },
        { id: 'asc' },
      ],
      select: { id: true },
      take,
      where: {
        ...wcLiveEventWhere(),
        OR: [
          { oddsAway: null, oddsHome: null },
          { oddsUpdatedAt: null },
          { oddsUpdatedAt: { lt: staleBefore } },
          { marketsJson: { equals: {} } },
        ],
      },
    });

    return this.enrichEvents(
      rows.map((row) => row.id),
      true,
    );
  }

  async enrichStaleBatch(take: number): Promise<number> {
    const staleBefore = new Date(Date.now() - ENRICH_STALE_MS);
    const rows = await this.prisma.wcOddsEvent.findMany({
      orderBy: [
        { oddsUpdatedAt: { nulls: 'first', sort: 'asc' } },
        { commenceTime: 'asc' },
        { id: 'asc' },
      ],
      select: { id: true },
      take,
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
    });

    return this.enrichEvents(
      rows.map((row) => row.id),
      true,
    );
  }

  needsEnrich(row: {
    marketsJson?: unknown;
    oddsAway?: Decimal | null;
    oddsHome?: Decimal | null;
    oddsUpdatedAt?: Date | null;
  }): boolean {
    if (!row.oddsHome && !row.oddsAway) return true;
    if (!row.oddsUpdatedAt) return true;
    if (Date.now() - row.oddsUpdatedAt.getTime() > ENRICH_STALE_MS) return true;
    const markets = row.marketsJson;
    if (!markets || typeof markets !== 'object') return true;
    return Object.keys(markets as object).length === 0;
  }

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

  /**
   * Fast live odds rotate without re-indexing the Olimp live list.
   * List index stays on the 30s cron; this keeps 1X2 closer to Olimp mid-cycle.
   */
  @Cron('*/8 * * * * *')
  async scheduledLiveOddsRotate() {
    if (!this.olimpbet.isEnabled()) return;
    if (Date.now() < this.bootReadyAt) return;
    if (this.olimpbet.isFetchBlocked()) return;
    if (this.liveOddsRotating || this.liveSyncing) return;

    this.liveOddsRotating = true;
    try {
      const enriched = await this.enrichLiveStaleBatch(LIVE_ENRICH_BATCH_SIZE);
      const refreshed = await this.refreshLiveRotatingBatch();
      if (enriched > 0 || refreshed > 0) {
        this.logger.log(
          `WC Olimpbet live odds rotate: refreshed=${refreshed} enriched=${enriched}`,
        );
      }
    } finally {
      this.liveOddsRotating = false;
    }
  }

  @Cron('*/30 * * * * *')
  async scheduledLiveSync() {
    if (!this.olimpbet.isEnabled()) return;
    if (Date.now() < this.bootReadyAt) return;
    await this.syncLiveOdds();
  }

  /**
   * Keep 1win sports broadcast/tracker warm for live events Olimpbet has no
   * stream for. Bounded warmSnapshots — cybersport shares the same push-feed
   * and must stay healthy.
   */
  @Cron('0 * * * * *')
  async scheduledOneWinSportsMediaWarm() {
    if (!this.onewin.isEnabled()) return;
    if (Date.now() < this.bootReadyAt) return;
    if (this.sportsMediaWarming) return;

    this.sportsMediaWarming = true;
    try {
      const rows = await this.prisma.wcOddsEvent.findMany({
        orderBy: [{ commenceTime: 'asc' }, { id: 'asc' }],
        select: {
          awayTeam: true,
          commenceTime: true,
          hasBroadcast: true,
          homeTeam: true,
          id: true,
          matchStateJson: true,
        },
        take: ONEWIN_SPORTS_MEDIA_WARM_TAKE,
        where: {
          ...wcLiveEventWhere(),
          hasBroadcast: false,
        },
      });

      // Prefer events missing broadcast; also include some missing tracker.
      const missingTracker = await this.prisma.wcOddsEvent.findMany({
        orderBy: [{ commenceTime: 'asc' }, { id: 'asc' }],
        select: {
          awayTeam: true,
          commenceTime: true,
          hasBroadcast: true,
          homeTeam: true,
          id: true,
          matchStateJson: true,
        },
        take: Math.min(20, ONEWIN_SPORTS_MEDIA_WARM_TAKE),
        where: {
          ...wcLiveEventWhere(),
          hasBroadcast: true,
        },
      });

      const byId = new Map<string, (typeof rows)[number]>();
      for (const row of [...rows, ...missingTracker]) {
        if (oneWinMatchIdFromWcEventId(row.id)) continue;
        byId.set(row.id, row);
      }
      const batch = [...byId.values()].slice(0, ONEWIN_SPORTS_MEDIA_WARM_TAKE);

      const matchIds: number[] = [];
      const byMatchId = new Map<
        number,
        {
          hasBroadcast: boolean;
          hasLiveTracker: boolean;
          id: string;
          matchStateJson: unknown;
        }
      >();

      for (const row of batch) {
        const fixture = await this.onewin.resolveFixture(
          row.commenceTime,
          row.homeTeam,
          row.awayTeam,
        );
        if (!fixture) continue;
        matchIds.push(fixture.matchId);
        byMatchId.set(fixture.matchId, {
          hasBroadcast: row.hasBroadcast,
          hasLiveTracker: Boolean(
            parseMatchState(row.matchStateJson)?.result?.hasLiveTracker,
          ),
          id: row.id,
          matchStateJson: row.matchStateJson,
        });
      }

      if (matchIds.length === 0) return;

      await this.onewin.warmSportsMediaBatch(matchIds, 3_000);

      let withMedia = 0;
      let badgeUpdates = 0;
      let trackerUpdates = 0;
      for (const [matchId, meta] of byMatchId) {
        const hasBc = this.onewin.hasCachedBroadcast(matchId);
        const hasTr = this.onewin.hasCachedTracker(matchId);
        if (hasBc || hasTr) withMedia += 1;

        if (!meta.hasBroadcast && hasBc) {
          await this.prisma.wcOddsEvent.update({
            data: { hasBroadcast: true },
            where: { id: meta.id },
          });
          badgeUpdates += 1;
        }

        if (hasTr && !meta.hasLiveTracker) {
          const base =
            parseMatchState(meta.matchStateJson) ?? emptyMatchState();
          const patched = {
            ...base,
            result: {
              ...base.result,
              capturedAt: base.result?.capturedAt ?? new Date().toISOString(),
              hasLiveTracker: true,
            },
            updatedAt: new Date().toISOString(),
          };
          await this.prisma.wcOddsEvent.update({
            data: {
              ...(hasBc && !meta.hasBroadcast ? { hasBroadcast: true } : {}),
              matchStateJson: patched as object,
            },
            where: { id: meta.id },
          });
          trackerUpdates += 1;
        }
      }

      if (withMedia > 0 || badgeUpdates > 0 || trackerUpdates > 0) {
        this.logger.log(
          `WC 1win sports media warm: matched=${matchIds.length} withMedia=${withMedia} badges=${badgeUpdates} trackers=${trackerUpdates}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `WC 1win sports media warm failed: ${message.slice(0, 200)}`,
      );
    } finally {
      this.sportsMediaWarming = false;
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledOddsSync() {
    if (!this.olimpbet.isEnabled()) return;
    if (Date.now() < this.bootReadyAt) return;
    await this.syncOdds();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledPreMatchReminders() {
    if (!this.olimpbet.isEnabled()) return;
    try {
      await this.pulse.sendPreMatchReminders();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `WC pre-match reminders failed: ${message.slice(0, 200)}`,
      );
    }
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

  async syncLiveEvents(): Promise<{ refreshed: number }> {
    const refreshed = await this.refreshLiveRotatingBatch();
    return { refreshed };
  }

  async syncLiveOdds(): Promise<{
    enriched: number;
    indexed: number;
    refreshed: number;
  }> {
    if (!this.olimpbet.isEnabled() || this.liveSyncing) {
      return { enriched: 0, indexed: 0, refreshed: 0 };
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
        this.logger.warn(
          'WC live list empty — skip reconcileDroppedLiveEvents',
        );
      }
      await this.prisma.wcOddsEvent.updateMany({
        data: { completed: true },
        where: {
          OR: [
            { leagueName: { contains: 'Статистика', mode: 'insensitive' } },
            { leagueName: { contains: 'Statistic', mode: 'insensitive' } },
          ],
          completed: false,
        },
      });

      // Drop zombies left incomplete after Olimp removed them (404 forever).
      // Settle/VOID pending bets first — marking completed alone would leave stake hung.
      const zombieCutoff = new Date(Date.now() - WC_LIVE_MAX_AGE_MS);
      const zombieRows = await this.prisma.wcOddsEvent.findMany({
        select: { id: true },
        take: 120,
        where: {
          commenceTime: { lte: zombieCutoff },
          completed: false,
        },
      });
      if (zombieRows.length > 0) {
        const zombieIds = zombieRows.map((row) => row.id);
        const pendingEvents = await this.prisma.wcOddsBet.findMany({
          distinct: ['eventId'],
          select: { eventId: true },
          where: {
            eventId: { in: zombieIds },
            status: WcOddsBetStatus.PENDING,
          },
        });
        for (const row of pendingEvents) {
          try {
            await this.settlement.settlePendingBetsForEvent(row.eventId);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `WC zombie settle failed ${row.eventId}: ${message.slice(0, 200)}`,
            );
          }
        }

        const zombies = await this.prisma.wcOddsEvent.updateMany({
          data: { completed: true },
          where: {
            completed: false,
            id: { in: zombieIds },
          },
        });
        if (zombies.count > 0) {
          this.logger.warn(
            `WC live sync: closed ${zombies.count} zombie events older than ${WC_LIVE_MAX_AGE_MS / 3_600_000}h (pendingEvents=${pendingEvents.length})`,
          );
        }
      }

      if (this.olimpbet.isFetchBlocked()) {
        this.logger.warn(
          'WC live sync: Olimpbet circuit open — skip enrich/refresh',
        );
        return { enriched: 0, indexed, refreshed: 0 };
      }

      const enriched = await this.enrichLiveStaleBatch(LIVE_ENRICH_BATCH_SIZE);
      const refreshed = await this.refreshLiveRotatingBatch();

      if (indexed > 0 || refreshed > 0) {
        this.logger.log(
          `WC Olimpbet live sync: indexed=${indexed} refreshed=${refreshed} enriched=${enriched}`,
        );
      }

      return { enriched, indexed, refreshed };
    } finally {
      this.liveSyncing = false;
    }
  }

  async syncOdds(): Promise<{ enriched: number; indexed: number }> {
    if (!this.olimpbet.isEnabled()) return { enriched: 0, indexed: 0 };
    if (this.syncing) return { enriched: 0, indexed: 0 };

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
      this.logger.log(
        `WC Olimpbet sync: indexed=${indexed} enriched=${enriched}`,
      );
      return { enriched, indexed };
    } finally {
      this.syncing = false;
    }
  }
}
