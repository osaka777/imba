import { Injectable, Logger } from '@nestjs/common';
import {
  BetStatus,
  OperationSource,
  OperationStatus,
  OperationType,
  WcOddsBetStatus,
  WcOddsPick,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { EventGateway } from '~/main/event/event.gateway';
import { TelegramUserNotifyService } from '~/main/telegram/telegram-user-notify.service';
import { PushUserNotifyService } from '~/main/push/push-user-notify.service';
import { OperationService } from '~/main/operation/operation.service';
import { PartnersService } from '~/main/partners/partners.service';
import { PrismaService, PrismaTransactionClient } from '~/prisma/prisma.service';

import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';
import { isPointSetSportFeed, isTennisGameFeed } from '../olimpbet-wc/point-set-sport-score.util';
import {
  isOlimpbetEventCompleted,
  resolveSettlementScoreFromDetail,
} from '../olimpbet-wc/olimpbet-event-result.util';

import { resolveDeterminateBetResult } from './wc-odds-early-settlement.util';
import { resolveWcExpressStatus, computeExpressWinPayout } from './wc-odds-express-settlement.util';
import { parseBetPlacementContext } from './wc-bet-placement-context.util';
import { captureProbabilitySnapshots } from './wc-match-state-tracker.util';
import { emptyMatchState, parseMatchState, type WcMatchState } from './wc-match-state.types';
import { resolveWcBetResult, type WcBetSettlementInput } from './wc-odds-settlement.util';
import { olimpbetIdFromWcEventId, oneWinMatchIdFromWcEventId } from './wc-slug.util';
import { WC_LIVE_MAX_AGE_MS } from './wc-betting.util';
import { completeBonusWageringIfNeeded } from '~/main/bonus-balance/complete-bonus-wagering.util';
import { OneWinPushFeedService } from '../onewin-wc/onewin-push-feed.service';
import { OneWinEsportsIndexService } from '../onewin-wc/onewin-esports-index.service';
import { resolveOneWinBestOf } from '../onewin-wc/onewin-esports-bestof-resolve.util';
import { resolveOneWinEsportsResult } from '../onewin-wc/onewin-esports-settlement.util';

/** After kickoff, if Olimp still has no settleable result — VOID+refund. Aligns with voidStaleUnresolvedBets. */
const ORPHAN_VOID_GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * 1win esports series (incl. BO5) essentially never run this long. If the
 * push status text never flips to a finished phrase, fall back to the
 * authoritative `closed` flag from `/matches/get` rather than never settling.
 */
const ONEWIN_STALE_LIVE_MS = 3 * 60 * 60 * 1000;

/** Rebuild a minimal finished detail when Olimp 404s but matchState still has period scores. */
function buildSettlementDetailFromMatchState(
  olimpbetId: number,
  homeScore: number,
  awayScore: number,
  state: WcMatchState,
  commenceTime?: Date,
): OlimpbetEventDetail | undefined {
  const periods = state.result?.periodScores ?? state.tennis?.setScores;
  if (!periods?.length) return undefined;

  const scoresByPeriods = periods.map((p) => `${p.home}:${p.away}`).join(',');
  return {
    id: olimpbetId,
    live: false,
    status: 'EVENT_CLOSED',
    competitors: [],
    eventDate: (commenceTime ?? new Date()).toISOString(),
    score: { home: homeScore, away: awayScore },
    statistics: [
      { code: 'score', value: `${homeScore}:${awayScore}` },
      { code: 'scores_by_periods', value: scoresByPeriods },
      { code: 'match_phase', value: '100' },
    ],
  };
}

@Injectable()
export class WcOddsSettlementService {
  private readonly logger = new Logger(WcOddsSettlementService.name);
  private settling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly operationService: OperationService,
    private readonly eventGateway: EventGateway,
    private readonly partnersService: PartnersService,
    private readonly telegramUserNotify: TelegramUserNotifyService,
    private readonly pushUserNotify: PushUserNotifyService,
    private readonly oneWinPush: OneWinPushFeedService,
    private readonly oneWinIndex: OneWinEsportsIndexService,
  ) {}

  async settleFinishedEvents(): Promise<{ settledEvents: number; settledBets: number }> {
    if (!this.olimpbet.isEnabled() || this.settling) {
      return { settledEvents: 0, settledBets: 0 };
    }

    this.settling = true;
    try {
      const pendingRows = await this.prisma.wcOddsBet.findMany({
        where: { status: WcOddsBetStatus.PENDING },
        select: { eventId: true },
        distinct: ['eventId'],
        take: 80,
      });

      if (pendingRows.length === 0) {
        return { settledEvents: 0, settledBets: 0 };
      }

      let settledEvents = 0;
      let settledBets = 0;

      for (const row of pendingRows) {
        const eventSettledBets = await this.settlePendingEvent(row.eventId);
        if (eventSettledBets > 0) {
          settledEvents += 1;
          settledBets += eventSettledBets;
        }
      }

      if (settledBets > 0) {
        this.logger.log(`WC settlement: ${settledEvents} events, ${settledBets} bets`);
      }

      return { settledEvents, settledBets };
    } finally {
      this.settling = false;
    }
  }

  /** Re-attempt settlement for completed events when the feed went stale (EVENT_CLOSED, empty stats). */
  async settleStalePendingBets(): Promise<{ settledEvents: number; settledBets: number }> {
    if (!this.olimpbet.isEnabled() || this.settling) {
      return { settledEvents: 0, settledBets: 0 };
    }

    const staleAfterMs = 90 * 60_000;
    const cutoff = new Date(Date.now() - staleAfterMs);

    const rows = await this.prisma.wcOddsBet.findMany({
      where: {
        status: WcOddsBetStatus.PENDING,
        event: {
          completed: true,
          commenceTime: { lt: cutoff },
        },
      },
      select: { eventId: true },
      distinct: ['eventId'],
      take: 40,
    });

    if (rows.length === 0) {
      return { settledEvents: 0, settledBets: 0 };
    }

    this.settling = true;
    try {
      let settledEvents = 0;
      let settledBets = 0;

      for (const row of rows) {
        const eventSettledBets = await this.settlePendingEvent(row.eventId);
        if (eventSettledBets > 0) {
          settledEvents += 1;
          settledBets += eventSettledBets;
        }
      }

      if (settledBets > 0) {
        this.logger.log(`WC stale settlement: ${settledEvents} events, ${settledBets} bets`);
      }

      return { settledEvents, settledBets };
    } finally {
      this.settling = false;
    }
  }

  private async settlePendingEvent(eventId: string): Promise<number> {
    const olimpbetId = olimpbetIdFromWcEventId(eventId);
    const detail = olimpbetId
      ? await this.olimpbet.fetchEventDetail(olimpbetId, { locale: 'ru' })
      : null;

    let eventSettledBets = 0;

    // Cancel / walkover / retirement / default → VOID+refund all PENDING first.
    // Skip early WIN/LOSE so match-winner is not settled from a walkover score.
    if (detail && this.olimpbet.isEventCancelled(detail)) {
      const voided = await this.voidEventBets(eventId);
      await this.prisma.wcOddsEvent.update({
        where: { id: eventId },
        data: {
          completed: true,
          ...(voided > 0 ? { settledAt: new Date() } : {}),
        },
      });
      return voided;
    }

    const dbEvent = await this.prisma.wcOddsEvent.findUnique({ where: { id: eventId } });
    const resolvedScore = detail
      ? resolveSettlementScoreFromDetail(detail, dbEvent?.homeScore, dbEvent?.awayScore)
      : dbEvent?.homeScore != null && dbEvent?.awayScore != null
        ? { homeScore: dbEvent.homeScore, awayScore: dbEvent.awayScore }
        : null;

    if (detail && resolvedScore) {
      const matchState = await this.loadMatchState(eventId);
      const early = await this.trySettleDeterminateBets(
        eventId,
        resolvedScore.homeScore,
        resolvedScore.awayScore,
        detail,
        matchState,
      );
      eventSettledBets += early.settledBets;
    }

    const result = await this.trySettleEvent(eventId, detail);
    eventSettledBets += result.settledBets;

    // Olimp 404 / empty feed: after grace, refund rather than leave PENDING forever.
    if (!detail && eventSettledBets === 0) {
      eventSettledBets += await this.voidOrphanPendingBets(eventId, 'olimp_detail_missing');
    }

    return eventSettledBets;
  }

  /**
   * Public entry for sync/zombie cleanup: try Olimp settle, then VOID orphans after grace.
   */
  async settlePendingBetsForEvent(eventId: string): Promise<number> {
    return this.settlePendingEvent(eventId);
  }

  async trySettleEvent(
    eventId: string,
    prefetchedDetail?: OlimpbetEventDetail | null,
  ): Promise<{ settledBets: number; completed: boolean }> {
    const pendingCount = await this.prisma.wcOddsBet.count({
      where: { eventId, status: WcOddsBetStatus.PENDING },
    });
    if (pendingCount === 0) {
      return { settledBets: 0, completed: false };
    }

    const oneWinMatchId = oneWinMatchIdFromWcEventId(eventId);
    if (oneWinMatchId) {
      return this.trySettleOneWinEvent(eventId, oneWinMatchId);
    }

    const olimpbetId = olimpbetIdFromWcEventId(eventId);
    if (!olimpbetId) {
      return { settledBets: 0, completed: false };
    }

    const detail = prefetchedDetail ?? await this.olimpbet.fetchEventDetail(olimpbetId, { locale: 'ru' });

    const result = detail ? this.olimpbet.resolveEventResult(detail) : null;

    if (!result) {
      const event = await this.prisma.wcOddsEvent.findUnique({ where: { id: eventId } });
      const fallbackScore = detail
        ? resolveSettlementScoreFromDetail(
          detail,
          event?.homeScore,
          event?.awayScore,
        )
        : event?.homeScore != null && event?.awayScore != null
          ? { homeScore: event.homeScore, awayScore: event.awayScore }
          : null;

      if (event?.completed && fallbackScore) {
        if (
          event.homeScore == null
          || event.awayScore == null
          || event.homeScore !== fallbackScore.homeScore
          || event.awayScore !== fallbackScore.awayScore
        ) {
          await this.prisma.wcOddsEvent.update({
            where: { id: eventId },
            data: {
              homeScore: fallbackScore.homeScore,
              awayScore: fallbackScore.awayScore,
            },
          });
        }

        const settledBets = await this.settleEventBets(
          eventId,
          fallbackScore.homeScore,
          fallbackScore.awayScore,
          detail ?? (olimpbetId ? await this.olimpbet.fetchEventDetail(olimpbetId, { locale: 'ru' }) : undefined),
          parseMatchState(event.matchStateJson),
        );
        if (settledBets > 0) {
          await this.prisma.wcOddsEvent.update({
            where: { id: eventId },
            data: { settledAt: new Date() },
          });
        }
        await this.warnPendingDisplayBets(eventId, detail ?? undefined);
        const voided = detail
          ? await this.voidStaleUnresolvedBets(
            eventId,
            detail,
            fallbackScore.homeScore,
            fallbackScore.awayScore,
          )
          : await this.voidOrphanPendingBets(eventId, 'completed_no_feed_detail');
        return { settledBets: settledBets + voided, completed: true };
      }

      // Completed/zombie with no score and no Olimp detail → VOID after grace.
      const orphanVoided = await this.voidOrphanPendingBets(
        eventId,
        detail ? 'no_settleable_result' : 'olimp_detail_missing',
      );
      return { settledBets: orphanVoided, completed: false };
    }

    if (!detail) return { settledBets: 0, completed: false };

    const matchState = await this.loadMatchState(eventId);

    await this.prisma.wcOddsEvent.update({
      where: { id: eventId },
      data: {
        completed: true,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
      },
    });

    const settledBets = result.cancelled
      ? await this.voidEventBets(eventId)
      : await this.settleEventBets(
        eventId,
        result.homeScore,
        result.awayScore,
        detail,
        matchState,
      );

    if (settledBets > 0) {
      await this.prisma.wcOddsEvent.update({
        where: { id: eventId },
        data: { settledAt: new Date() },
      });
    }

    await this.warnPendingDisplayBets(eventId, detail);

    const voided = await this.voidStaleUnresolvedBets(eventId, detail, result.homeScore, result.awayScore);
    return { settledBets: settledBets + voided, completed: true };
  }

  /** Settle esports bets priced from 1win using match-info score/status (our own book). */
  private async trySettleOneWinEvent(
    eventId: string,
    matchId: number,
  ): Promise<{ settledBets: number; completed: boolean }> {
    this.oneWinPush.subscribe([matchId]);
    const snap =
      this.oneWinPush.getSnapshot(matchId) ??
      (await this.oneWinPush.waitForSnapshot(matchId, 2_000));

    const event = await this.prisma.wcOddsEvent.findUnique({
      where: { id: eventId },
    });

    const prevState = parseMatchState(event?.matchStateJson) ?? emptyMatchState();
    const oddsSnap = this.oneWinPush.getOddsSnapshot(matchId);
    const bestOf = resolveOneWinBestOf({
      leagueName: event?.leagueName,
      oddsGroups: oddsSnap?.oddsGroups ?? [],
      prevState,
    });

    const result = resolveOneWinEsportsResult(
      {
        hasOpenOdds: snap?.hasOpenOdds ?? null,
        matchScore: snap?.matchScore ?? null,
        periodsScore: snap?.periodsScore ?? null,
        status: snap?.status ?? null,
      },
      { bestOf: bestOf ?? undefined },
    );

    const homeScore =
      result.homeScore ||
      event?.homeScore ||
      0;
    const awayScore =
      result.awayScore ||
      event?.awayScore ||
      0;

    let completed =
      result.completed ||
      Boolean(event?.completed) ||
      result.cancelled;

    // Push status text got stuck (no "Закончен" ever arrived) — ask 1win's
    // own `closed` flag directly instead of guessing series length/format.
    if (!completed && event?.commenceTime) {
      const liveForMs = Date.now() - event.commenceTime.getTime();
      if (liveForMs > ONEWIN_STALE_LIVE_MS) {
        try {
          const closed = await this.oneWinIndex.isMatchClosed(matchId);
          if (closed) {
            completed = true;
            this.logger.log(
              `1win ow-${matchId} finished via closed-flag fallback (stuck status "${snap?.status ?? ''}")`,
            );
          }
        } catch (err) {
          this.logger.debug(
            `1win closed-flag check failed ow-${matchId}: ${(err as Error).message}`,
          );
        }
      }
    }

    if (!completed) {
      // Keep scores + bestOf warm for live UI / clinch settlement later.
      const warmState =
        bestOf != null
          ? {
              ...prevState,
              v: 1 as const,
              updatedAt: new Date().toISOString(),
              esports: { ...prevState.esports, bestOf },
            }
          : null;
      if (snap?.matchScore || warmState) {
        await this.prisma.wcOddsEvent.update({
          where: { id: eventId },
          data: {
            ...(snap?.matchScore ? { awayScore, homeScore } : {}),
            ...(warmState ? { matchStateJson: warmState as object } : {}),
          },
        });
      }
      return { settledBets: 0, completed: false };
    }

    const syntheticDetail = buildSettlementDetailFromMatchState(
      matchId,
      homeScore,
      awayScore,
      {
        ...prevState,
        ...(bestOf != null
          ? { esports: { ...prevState.esports, bestOf } }
          : {}),
        result: {
          capturedAt: new Date().toISOString(),
          periodScores: result.periodScores.map((p) => ({
            away: p.away,
            home: p.home,
          })),
        },
      },
      event?.commenceTime,
    );

    await this.prisma.wcOddsEvent.update({
      where: { id: eventId },
      data: {
        awayScore,
        completed: true,
        homeScore,
      },
    });

    if (result.cancelled) {
      const voided = await this.voidOrphanPendingBets(eventId, 'onewin_cancelled');
      return { settledBets: voided, completed: true };
    }

    const matchState = await this.loadMatchState(eventId);
    const settledBets = await this.settleEventBets(
      eventId,
      homeScore,
      awayScore,
      syntheticDetail,
      matchState,
    );

    if (settledBets > 0) {
      await this.prisma.wcOddsEvent.update({
        data: { settledAt: new Date() },
        where: { id: eventId },
      });
    }

    const orphanVoided = await this.voidOrphanPendingBets(
      eventId,
      'onewin_completed_unresolved',
    );
    return { settledBets: settledBets + orphanVoided, completed: true };
  }

  /** Re-run verified settlement for a single PENDING bet (admin). */
  async tryRecalcPendingBet(betId: number): Promise<{ ok: boolean; result?: WcOddsBetStatus; reason?: string }> {
    const bet = await this.prisma.wcOddsBet.findUnique({ where: { id: betId } });
    if (!bet) return { ok: false, reason: 'not_found' };
    if (bet.status !== WcOddsBetStatus.PENDING) {
      return { ok: false, reason: `status_${bet.status}` };
    }

    const olimpbetId = olimpbetIdFromWcEventId(bet.eventId);
    if (!olimpbetId) return { ok: false, reason: 'no_olimpbet_id' };

    const detail = await this.olimpbet.fetchEventDetail(olimpbetId, { locale: 'ru' });
    if (!detail) return { ok: false, reason: 'no_detail' };

    const event = await this.prisma.wcOddsEvent.findUnique({ where: { id: bet.eventId } });
    const { state: matchState, settlementDetail } = await this.refreshMatchStateFromDetail(
      bet.eventId,
      (await this.loadMatchState(bet.eventId)) ?? emptyMatchState(),
      detail,
    );
    const score = this.olimpbet.extractScore(detail);
    const homeScore = score.homeScore ?? event?.homeScore ?? 0;
    const awayScore = score.awayScore ?? event?.awayScore ?? 0;

    const input = this.toBetSettlementInput(bet);
    const result = resolveDeterminateBetResult(input, homeScore, awayScore, settlementDetail, matchState)
      ?? resolveWcBetResult(input, homeScore, awayScore, settlementDetail, matchState);

    if (result == null) return { ok: false, reason: 'still_indeterminate' };

    await this.applyBetSettlement(bet, bet.eventId, result);
    return { ok: true, result };
  }

  /** Re-evaluate settled bets on an event (admin repair after settlement bugfix). */
  async repairEventSettledBets(eventId: string): Promise<{ repaired: number }> {
    const olimpbetId = olimpbetIdFromWcEventId(eventId);
    if (!olimpbetId) return { repaired: 0 };

    const detail = await this.olimpbet.fetchEventDetail(olimpbetId, { locale: 'ru' });
    const event = await this.prisma.wcOddsEvent.findUnique({ where: { id: eventId } });
    if (!event) return { repaired: 0 };

    const baseState = (await this.loadMatchState(eventId)) ?? emptyMatchState();
    const homeScore = detail
      ? this.olimpbet.extractScore(detail).homeScore ?? event.homeScore ?? 0
      : event.homeScore ?? 0;
    const awayScore = detail
      ? this.olimpbet.extractScore(detail).awayScore ?? event.awayScore ?? 0
      : event.awayScore ?? 0;

    let settlementDetail: OlimpbetEventDetail | undefined;
    let state = baseState;

    if (detail) {
      const refreshed = await this.refreshMatchStateFromDetail(eventId, baseState, detail);
      state = refreshed.state;
      settlementDetail = refreshed.settlementDetail;
    } else {
      settlementDetail = buildSettlementDetailFromMatchState(
        olimpbetId,
        homeScore,
        awayScore,
        baseState,
        event.commenceTime,
      );
    }

    if (!settlementDetail) return { repaired: 0 };

    const repaired = await this.repairMisSettledBets(
      eventId,
      homeScore,
      awayScore,
      settlementDetail,
      state,
    );
    return { repaired };
  }

  private toBetSettlementInput(bet: {
    pick: WcOddsPick | null;
    marketKey: string;
    outcomeKey: string | null;
    line: string | null;
    outcomeName?: string | null;
    placementContextJson?: unknown;
  }): WcBetSettlementInput {
    return {
      pick: bet.pick,
      marketKey: bet.marketKey,
      outcomeKey: bet.outcomeKey,
      line: bet.line,
      outcomeName: bet.outcomeName,
      placementContext: parseBetPlacementContext(bet.placementContextJson),
    };
  }

  private async warnPendingDisplayBets(
    eventId: string,
    detail?: OlimpbetEventDetail,
  ): Promise<void> {
    if (!detail || !isOlimpbetEventCompleted(detail)) return;

    const pending = await this.prisma.wcOddsBet.findMany({
      where: { eventId, status: WcOddsBetStatus.PENDING },
      select: { id: true, marketKey: true, outcomeKey: true },
    });

    for (const bet of pending) {
      if (!bet.outcomeKey?.startsWith('DISPLAY_') && !bet.marketKey.startsWith('display_')) continue;
      this.logger.warn(
        `WC bet #${bet.id} still PENDING after event end: ${bet.marketKey}/${bet.outcomeKey ?? '—'}`,
      );
    }
  }

  async trySettleDeterminateBets(
    eventId: string,
    homeScore: number,
    awayScore: number,
    detail?: OlimpbetEventDetail,
    matchState?: WcMatchState | null,
  ): Promise<{ settledBets: number }> {
    const baseState = matchState ?? (await this.loadMatchState(eventId)) ?? emptyMatchState();
    const { state, settlementDetail } = detail
      ? await this.refreshMatchStateFromDetail(eventId, baseState, detail)
      : { state: baseState, settlementDetail: undefined };

    if (isPointSetSportFeed(settlementDetail) || isTennisGameFeed(settlementDetail)) {
      await this.repairMisSettledBets(eventId, homeScore, awayScore, settlementDetail, state);
    }

    const pending = await this.prisma.wcOddsBet.findMany({
      where: { eventId, status: WcOddsBetStatus.PENDING },
    });

    let settled = 0;

    for (const bet of pending) {
      const result = resolveDeterminateBetResult(
        this.toBetSettlementInput(bet),
        homeScore,
        awayScore,
        settlementDetail,
        state,
      );
      if (result == null) continue;

      settled += 1;
      await this.applyBetSettlement(bet, eventId, result);
    }

    return { settledBets: settled };
  }

  /**
   * Re-evaluate WIN/LOSE bets when corrected settlement logic disagrees with stored result.
   */
  async repairMisSettledBets(
    eventId: string,
    homeScore: number,
    awayScore: number,
    detail: OlimpbetEventDetail,
    matchState?: WcMatchState | null,
  ): Promise<number> {
    const settled = await this.prisma.wcOddsBet.findMany({
      where: {
        eventId,
        status: { in: [WcOddsBetStatus.WIN, WcOddsBetStatus.LOSE] },
      },
    });

    let repaired = 0;

    for (const bet of settled) {
      const fresh = await this.prisma.wcOddsBet.findUnique({ where: { id: bet.id } });
      if (!fresh || fresh.status !== bet.status) continue;

      const input = this.toBetSettlementInput(fresh);
      const expected = this.resolveExpectedBetStatus(
        input,
        homeScore,
        awayScore,
        detail,
        matchState,
      );

      if (expected == null) {
        if (fresh.status === WcOddsBetStatus.PENDING) continue;
        await this.reverseWinPayout(fresh, eventId);
        await this.prisma.wcOddsBet.update({
          where: { id: fresh.id },
          data: { status: WcOddsBetStatus.PENDING, settledAt: null },
        });
        repaired += 1;
        this.logger.warn(
          `Reopened mis-settled bet #${fresh.id} on ${eventId} → PENDING (${fresh.outcomeName ?? fresh.marketKey})`,
        );
        continue;
      }

      if (expected === fresh.status) continue;

      if (fresh.status === WcOddsBetStatus.LOSE) {
        await this.prisma.$transaction(async (tx) => {
          await this.partnersService.reverseAffiliateBonusForWcBet(tx, fresh.id);
        });
      }

      await this.reverseWinPayout(fresh, eventId);
      await this.prisma.wcOddsBet.update({
        where: { id: fresh.id },
        data: { status: WcOddsBetStatus.PENDING, settledAt: null },
      });
      await this.applyBetSettlement(fresh, eventId, expected);
      repaired += 1;
      this.logger.warn(
        `Recalculated mis-settled bet #${fresh.id} on ${eventId}: ${fresh.status} → ${expected}`,
      );
    }

    return repaired;
  }

  private resolveExpectedBetStatus(
    input: WcBetSettlementInput,
    homeScore: number,
    awayScore: number,
    detail?: OlimpbetEventDetail,
    matchState?: WcMatchState | null,
  ): WcOddsBetStatus | null {
    const early = resolveDeterminateBetResult(input, homeScore, awayScore, detail, matchState);
    if (early != null) return early;
    if (!detail || !isOlimpbetEventCompleted(detail)) return null;
    return resolveWcBetResult(input, homeScore, awayScore, detail, matchState);
  }

  private async reverseWinPayout(
    bet: {
      id: number;
      userId: number;
      status: WcOddsBetStatus;
      potentialPayout: Decimal;
      currencyCode: string;
      marketKey: string;
    },
    eventId: string,
  ): Promise<void> {
    if (bet.status !== WcOddsBetStatus.WIN) return;

    await this.prisma.$transaction(async (tx) => {
      await this.operationService.create(tx, bet.userId, {
        amount: bet.potentialPayout,
        currencyCode: bet.currencyCode,
        source: OperationSource.WC_BET,
        status: OperationStatus.SUCCESS,
        type: OperationType.OUTCOME,
        meta: { wcBetId: bet.id, eventId, marketKey: bet.marketKey, repair: true },
      });
    });
  }

  private async loadMatchState(eventId: string): Promise<WcMatchState | null> {
    const event = await this.prisma.wcOddsEvent.findUnique({
      where: { id: eventId },
      select: { matchStateJson: true },
    });
    return parseMatchState(event?.matchStateJson);
  }

  /** Merge latest Olimpbet probability results into durable snapshots before settlement. */
  private async refreshMatchStateFromDetail(
    eventId: string,
    state: WcMatchState,
    detail: OlimpbetEventDetail,
  ): Promise<{ state: WcMatchState; settlementDetail: OlimpbetEventDetail }> {
    const settlementDetail = await this.olimpbet.fetchSettlementDetail(detail);
    const enriched = captureProbabilitySnapshots(
      {
        ...state,
        probabilitySnapshots: { ...(state.probabilitySnapshots ?? {}) },
      },
      settlementDetail,
    );
    enriched.updatedAt = new Date().toISOString();

    await this.prisma.wcOddsEvent.update({
      where: { id: eventId },
      data: { matchStateJson: enriched as object },
    });

    return { state: enriched, settlementDetail };
  }

  async voidEventBets(eventId: string): Promise<number> {
    const pending = await this.prisma.wcOddsBet.findMany({
      where: { eventId, status: WcOddsBetStatus.PENDING },
    });

    let voided = 0;

    for (const bet of pending) {
      const applied = await this.applyBetSettlement(bet, eventId, WcOddsBetStatus.VOID);
      if (applied) voided += 1;
    }

    return voided;
  }

  /** Feed resumed live after a false end (VAR pause) — reopen standard-market LOSE bets. */
  async reopenPrematureStandardBets(eventId: string): Promise<number> {
    const settled = await this.prisma.wcOddsBet.findMany({
      where: {
        eventId,
        status: { in: [WcOddsBetStatus.LOSE, WcOddsBetStatus.WIN] },
      },
    });

    let reopened = 0;

    for (const bet of settled) {
      if (bet.marketKey.startsWith('display_') || bet.outcomeKey?.startsWith('DISPLAY_')) {
        continue;
      }
      if (bet.status === WcOddsBetStatus.WIN) {
        this.logger.warn(
          `Cannot auto-reopen WIN bet #${bet.id} after event ${eventId} resumed live — manual review`,
        );
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        if (bet.status === WcOddsBetStatus.LOSE) {
          await this.partnersService.reverseAffiliateBonusForWcBet(tx, bet.id);
        }

        await tx.wcOddsBet.update({
          where: { id: bet.id },
          data: {
            status: WcOddsBetStatus.PENDING,
            settledAt: null,
          },
        });
      });
      reopened += 1;
    }

    if (reopened > 0) {
      await this.prisma.wcOddsEvent.update({
        where: { id: eventId },
        data: { completed: false, settledAt: null },
      });
      this.logger.warn(
        `Reopened ${reopened} prematurely settled bet(s) for event ${eventId} (feed resumed live)`,
      );
    }

    return reopened;
  }

  async settleEventBets(
    eventId: string,
    homeScore: number,
    awayScore: number,
    detail?: OlimpbetEventDetail,
    matchState?: WcMatchState | null,
  ): Promise<number> {
    const baseState = matchState ?? (await this.loadMatchState(eventId)) ?? emptyMatchState();
    const refreshed = detail
      ? await this.refreshMatchStateFromDetail(eventId, baseState, detail)
      : null;
    const state = refreshed?.state ?? baseState;
    const settlementDetail = refreshed?.settlementDetail ?? detail;
    const pending = await this.prisma.wcOddsBet.findMany({
      where: { eventId, status: WcOddsBetStatus.PENDING },
    });

    let settled = 0;

    for (const bet of pending) {
      const result = this.resolveBetResult(bet, homeScore, awayScore, settlementDetail, state);
      if (result == null) continue;

      settled += 1;
      await this.applyBetSettlement(bet, eventId, result);
    }

    return settled;
  }

  private async applyBetSettlement(
    bet: {
      id: number;
      userId: number;
      stake: Decimal;
      potentialPayout: Decimal;
      currencyCode: string;
      marketKey: string;
      outcomeName?: string | null;
      wcExpressBetId?: number | null;
      isBonus?: boolean;
    },
    eventId: string,
    result: WcOddsBetStatus,
  ): Promise<boolean> {
    const expressId = bet.wcExpressBetId ?? null;
    let applied = false;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.wcOddsBet.updateMany({
        where: { id: bet.id, status: WcOddsBetStatus.PENDING },
        data: {
          status: result,
          settledAt: new Date(),
        },
      });
      if (updated.count !== 1) return;
      applied = true;

      if (expressId) {
        return;
      }

      const isBonus = bet.isBonus === true;

      if (result === WcOddsBetStatus.WIN) {
        if (await this.hasWcBetWinIncome(tx, bet.userId, bet.id)) {
          this.logger.warn(`Duplicate WIN income blocked for wcBet #${bet.id}`);
          return;
        }
        if (isBonus) {
          await tx.bonusBalance.updateMany({
            where: {
              userId: bet.userId,
              currencyCode: bet.currencyCode,
              isActive: true,
              isTokenBased: false,
            },
            data: { amount: { increment: bet.potentialPayout } },
          });
          await this.operationService.createWithoutBalanceUpdate(tx, bet.userId, {
            amount: bet.potentialPayout,
            currencyCode: bet.currencyCode,
            source: OperationSource.BONUS_BET,
            status: OperationStatus.SUCCESS,
            type: OperationType.INCOME,
            meta: {
              wcBetId: bet.id,
              eventId,
              marketKey: bet.marketKey,
              accountType: 'bonus',
            },
          });
          await completeBonusWageringIfNeeded(tx, bet.userId, bet.currencyCode);
        } else {
          await this.operationService.create(tx, bet.userId, {
            amount: bet.potentialPayout,
            currencyCode: bet.currencyCode,
            source: OperationSource.WC_BET,
            status: OperationStatus.SUCCESS,
            type: OperationType.INCOME,
            meta: { wcBetId: bet.id, eventId, marketKey: bet.marketKey },
          });
        }
      } else if (result === WcOddsBetStatus.VOID) {
        if (await this.hasWcBetVoidRefund(tx, bet.userId, bet.id)) {
          this.logger.warn(`Duplicate VOID refund blocked for wcBet #${bet.id}`);
          return;
        }
        if (isBonus) {
          await tx.bonusBalance.updateMany({
            where: {
              userId: bet.userId,
              currencyCode: bet.currencyCode,
              isActive: true,
              isTokenBased: false,
            },
            data: { amount: { increment: bet.stake } },
          });
          await this.operationService.createWithoutBalanceUpdate(tx, bet.userId, {
            amount: bet.stake,
            currencyCode: bet.currencyCode,
            source: OperationSource.BONUS_BET,
            status: OperationStatus.SUCCESS,
            type: OperationType.INCOME,
            meta: { wcBetId: bet.id, eventId, void: true, accountType: 'bonus' },
          });
        } else {
          await this.operationService.create(tx, bet.userId, {
            amount: bet.stake,
            currencyCode: bet.currencyCode,
            source: OperationSource.WC_BET,
            status: OperationStatus.SUCCESS,
            type: OperationType.INCOME,
            meta: { wcBetId: bet.id, eventId, void: true },
          });
        }
      } else if (result === WcOddsBetStatus.LOSE) {
        const user = await tx.user.findUnique({ where: { id: bet.userId } });
        if (user && !isBonus) {
          await this.partnersService.processAffiliateBonus(
            tx,
            user,
            bet.id,
            bet.currencyCode,
            bet.stake,
            BetStatus.LOSE,
          );
        }
      }
    });

    if (!applied) return false;

    if (expressId) {
      await this.trySettleExpressBet(expressId);
      return true;
    }

    this.notifyWcBetSettlement(bet, result, eventId);

    if (result === WcOddsBetStatus.LOSE) {
      void this.partnersService.notifyCommissionForBet(bet.id);
    }

    return true;
  }

  private async hasWcBetWinIncome(
    tx: PrismaTransactionClient,
    userId: number,
    wcBetId: number,
  ): Promise<boolean> {
    const existing = await tx.operation.findFirst({
      where: {
        userId,
        source: { in: [OperationSource.WC_BET, OperationSource.BONUS_BET] },
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        meta: { path: ['wcBetId'], equals: wcBetId },
      },
      select: { id: true, meta: true },
    });
    if (!existing) return false;
    const meta = existing.meta as { void?: boolean } | null;
    return meta?.void !== true;
  }

  private async hasWcBetVoidRefund(
    tx: PrismaTransactionClient,
    userId: number,
    wcBetId: number,
  ): Promise<boolean> {
    const existing = await tx.operation.findFirst({
      where: {
        userId,
        source: { in: [OperationSource.WC_BET, OperationSource.BONUS_BET] },
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        meta: { path: ['wcBetId'], equals: wcBetId },
      },
      select: { id: true, meta: true },
    });
    if (!existing) return false;
    const meta = existing.meta as { void?: boolean } | null;
    return meta?.void === true;
  }

  private async hasWcExpressWinIncome(
    tx: PrismaTransactionClient,
    userId: number,
    wcExpressBetId: number,
  ): Promise<boolean> {
    const existing = await tx.operation.findFirst({
      where: {
        userId,
        source: OperationSource.WC_BET,
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        meta: { path: ['wcExpressBetId'], equals: wcExpressBetId },
      },
      select: { id: true, meta: true },
    });
    if (!existing) return false;
    const meta = existing.meta as { void?: boolean } | null;
    return meta?.void !== true;
  }

  private async hasWcExpressVoidRefund(
    tx: PrismaTransactionClient,
    userId: number,
    wcExpressBetId: number,
  ): Promise<boolean> {
    const existing = await tx.operation.findFirst({
      where: {
        userId,
        source: OperationSource.WC_BET,
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        meta: { path: ['wcExpressBetId'], equals: wcExpressBetId },
      },
      select: { id: true, meta: true },
    });
    if (!existing) return false;
    const meta = existing.meta as { void?: boolean } | null;
    return meta?.void === true;
  }

  private async trySettleExpressBet(expressId: number): Promise<void> {
    const parent = await this.prisma.wcOddsExpressBet.findUnique({
      where: { id: expressId },
      include: { legs: true },
    });
    if (!parent || parent.status !== WcOddsBetStatus.PENDING) return;

    const nextStatus = resolveWcExpressStatus(parent.legs.map((leg) => leg.status));
    if (nextStatus == null) return;

    const legInputs = parent.legs.map((leg) => ({
      status: leg.status,
      odds: Number(leg.odds),
    }));
    const winPayoutAmount =
      nextStatus === WcOddsBetStatus.WIN
        ? computeExpressWinPayout(Number(parent.stake), legInputs)
        : null;
    if (nextStatus === WcOddsBetStatus.WIN && (winPayoutAmount == null || winPayoutAmount <= 0)) {
      this.logger.warn(`Express #${expressId}: WIN payout could not be computed`);
      return;
    }
    const winPayout = winPayoutAmount != null ? new Decimal(winPayoutAmount) : null;
    let applied = false;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.wcOddsExpressBet.updateMany({
        where: { id: expressId, status: WcOddsBetStatus.PENDING },
        data: {
          status: nextStatus,
          settledAt: new Date(),
          ...(winPayout
            ? { potentialPayout: winPayout, combinedOdds: winPayout.div(parent.stake).toDecimalPlaces(2) }
            : {}),
        },
      });
      if (updated.count !== 1) return;
      applied = true;

      if (nextStatus === WcOddsBetStatus.WIN && winPayout) {
        if (await this.hasWcExpressWinIncome(tx, parent.userId, expressId)) {
          this.logger.warn(`Duplicate express WIN income blocked for wcExpressBet #${expressId}`);
          return;
        }
        await this.operationService.create(tx, parent.userId, {
          amount: winPayout,
          currencyCode: parent.currencyCode,
          source: OperationSource.WC_BET,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          meta: { wcExpressBetId: expressId, voidLegsAdjusted: legInputs.some((l) => l.status === WcOddsBetStatus.VOID) },
        });
      } else if (nextStatus === WcOddsBetStatus.VOID) {
        if (await this.hasWcExpressVoidRefund(tx, parent.userId, expressId)) {
          this.logger.warn(`Duplicate express VOID refund blocked for wcExpressBet #${expressId}`);
          return;
        }
        await this.operationService.create(tx, parent.userId, {
          amount: parent.stake,
          currencyCode: parent.currencyCode,
          source: OperationSource.WC_BET,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          meta: { wcExpressBetId: expressId, void: true },
        });
      } else if (nextStatus === WcOddsBetStatus.LOSE) {
        const user = await tx.user.findUnique({ where: { id: parent.userId } });
        if (user) {
          await this.partnersService.processAffiliateBonus(
            tx,
            user,
            expressId,
            parent.currencyCode,
            parent.stake,
            BetStatus.LOSE,
          );
        }
      }
    });

    if (!applied) return;

    if (nextStatus === WcOddsBetStatus.WIN && winPayout) {
      this.notifyWcBetSettlement(
        {
          id: expressId,
          userId: parent.userId,
          stake: parent.stake,
          potentialPayout: winPayout,
          currencyCode: parent.currencyCode,
          outcomeName: `Экспресс · ${parent.legs.length} событий`,
        },
        nextStatus,
      );
    } else if (nextStatus === WcOddsBetStatus.VOID) {
      this.notifyWcBetSettlement(
        {
          id: expressId,
          userId: parent.userId,
          stake: parent.stake,
          potentialPayout: parent.stake,
          currencyCode: parent.currencyCode,
          outcomeName: `Экспресс · ${parent.legs.length} событий`,
        },
        nextStatus,
      );
    } else if (nextStatus === WcOddsBetStatus.LOSE) {
      this.notifyWcBetSettlement(
        {
          id: expressId,
          userId: parent.userId,
          stake: parent.stake,
          potentialPayout: new Decimal(0),
          currencyCode: parent.currencyCode,
          outcomeName: `Экспресс · ${parent.legs.length} событий`,
        },
        nextStatus,
      );
    }
  }

  private notifyWcBetSettlement(
    bet: {
      id: number;
      userId: number;
      stake: Decimal;
      potentialPayout: Decimal;
      currencyCode: string;
      outcomeName?: string | null;
    },
    result: WcOddsBetStatus,
    eventId?: string,
  ): void {
    let status: string;
    let amount: number;

    switch (result) {
      case WcOddsBetStatus.WIN:
        status = 'WIN';
        amount = Number(bet.potentialPayout);
        break;
      case WcOddsBetStatus.LOSE:
        status = 'LOSE';
        amount = 0;
        break;
      case WcOddsBetStatus.VOID:
        status = 'RETURN';
        amount = Number(bet.stake);
        break;
      default:
        return;
    }

    try {
      const notification = {
        eventId: `user_${bet.userId}`,
        type: 'bet_status_changed',
        payload: {
          wcBetId: bet.id,
          status,
          amount,
          betAmount: Number(bet.stake),
          currencyCode: bet.currencyCode,
          timestamp: new Date().toISOString(),
        },
      };

      this.eventGateway.sendUserNotification(bet.userId.toString(), notification as {
        type: string;
        payload: unknown;
      });

      void (async () => {
        let homeTeam: string | undefined;
        let awayTeam: string | undefined;
        if (eventId) {
          try {
            const ev = await this.prisma.wcOddsEvent.findUnique({
              where: { id: eventId },
              select: { homeTeam: true, awayTeam: true },
            });
            homeTeam = ev?.homeTeam ?? undefined;
            awayTeam = ev?.awayTeam ?? undefined;
          } catch { /* ignore */ }
        }
        await this.telegramUserNotify.notifyBetSettled({
          userId: bet.userId,
          wcBetId: bet.id,
          status: status as 'WIN' | 'LOSE' | 'RETURN',
          amount,
          betAmount: Number(bet.stake),
          currencyCode: bet.currencyCode,
          outcomeName: bet.outcomeName ?? undefined,
          homeTeam,
          awayTeam,
        });
        void this.pushUserNotify.notifyBetSettled({
          userId: bet.userId,
          status: status as 'WIN' | 'LOSE' | 'RETURN',
          amount,
          betAmount: Number(bet.stake),
          currencyCode: bet.currencyCode,
          outcomeName: bet.outcomeName ?? undefined,
          homeTeam,
          awayTeam,
        }).catch(() => undefined);
      })().catch(() => undefined);
    } catch (error) {
      this.logger.warn(`Failed to send WC bet notification for bet #${bet.id}`, error);
    }
  }

  private resolveBetResult(
    bet: {
      pick: WcOddsPick | null;
      marketKey: string;
      outcomeKey: string | null;
      line: string | null;
      outcomeName?: string | null;
      placementContextJson?: unknown;
    },
    homeScore: number,
    awayScore: number,
    detail?: OlimpbetEventDetail,
    matchState?: WcMatchState | null,
  ): WcOddsBetStatus | null {
    const input = this.toBetSettlementInput(bet);
    const result = resolveWcBetResult(input, homeScore, awayScore, detail, matchState);

    if (
      result == null
      && detail
      && (bet.outcomeKey?.startsWith('DISPLAY_') || bet.marketKey.startsWith('display_'))
      && isOlimpbetEventCompleted(detail)
    ) {
      this.logger.warn(
        `DISPLAY bet ${bet.outcomeKey ?? bet.marketKey} still pending after event end — no verified result`,
      );
    }

    return result;
  }

  /** VOID PENDING bets that cannot be resolved long after the event ended (missing feed data). */
  private async voidStaleUnresolvedBets(
    eventId: string,
    detail: OlimpbetEventDetail,
    homeScore: number,
    awayScore: number,
  ): Promise<number> {
    if (!isOlimpbetEventCompleted(detail)) return 0;

    const kickoffMs = Date.parse(detail.eventDate);
    const hoursSinceKickoff = Number.isFinite(kickoffMs)
      ? (Date.now() - kickoffMs) / 3_600_000
      : null;
    if (hoursSinceKickoff == null || hoursSinceKickoff < 6) return 0;

    const matchState = await this.loadMatchState(eventId);
    const pending = await this.prisma.wcOddsBet.findMany({
      where: { eventId, status: WcOddsBetStatus.PENDING },
    });
    if (!pending.length) return 0;

    let voided = 0;
    for (const bet of pending) {
      const input = this.toBetSettlementInput(bet);
      const expected = this.resolveExpectedBetStatus(
        input,
        homeScore,
        awayScore,
        detail,
        matchState,
      );
      if (expected != null) {
        await this.applyBetSettlement(bet, eventId, expected);
        continue;
      }

      await this.applyBetSettlement(bet, eventId, WcOddsBetStatus.VOID);
      voided += 1;
      this.logger.warn(
        `VOID stale unresolved bet #${bet.id} on ${eventId} (${bet.marketKey}/${bet.outcomeKey ?? '—'})`,
      );
    }

    return voided;
  }

  /**
   * When Olimp returns 404 / no usable result for an aged event — refund PENDING stakes.
   * Does not guess WIN/LOSE. Grace: 6h after kickoff; live-window events stay PENDING during outages.
   */
  private async voidOrphanPendingBets(eventId: string, reason: string): Promise<number> {
    const event = await this.prisma.wcOddsEvent.findUnique({ where: { id: eventId } });
    if (!event) return 0;

    const ageMs = Date.now() - event.commenceTime.getTime();
    if (ageMs < ORPHAN_VOID_GRACE_MS) return 0;
    if (!event.completed && ageMs < WC_LIVE_MAX_AGE_MS) return 0;

    const pending = await this.prisma.wcOddsBet.findMany({
      where: { eventId, status: WcOddsBetStatus.PENDING },
    });
    if (!pending.length) return 0;

    let voided = 0;
    for (const bet of pending) {
      const applied = await this.applyBetSettlement(bet, eventId, WcOddsBetStatus.VOID);
      if (!applied) continue;
      voided += 1;
      this.logger.warn(
        `VOID orphan bet #${bet.id} on ${eventId} reason=${reason} (${bet.marketKey}/${bet.outcomeKey ?? '—'})`,
      );
    }
    return voided;
  }
}
