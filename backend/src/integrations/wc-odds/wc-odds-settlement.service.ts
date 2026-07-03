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
import { PrismaService } from '~/prisma/prisma.service';

import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';
import { isPointSetSportFeed } from '../olimpbet-wc/point-set-sport-score.util';
import { isOlimpbetEventCompleted } from '../olimpbet-wc/olimpbet-event-result.util';

import { resolveDeterminateBetResult } from './wc-odds-early-settlement.util';
import { resolveWcExpressStatus } from './wc-odds-express-settlement.util';
import { parseBetPlacementContext } from './wc-bet-placement-context.util';
import { captureProbabilitySnapshots } from './wc-match-state-tracker.util';
import { emptyMatchState, parseMatchState, type WcMatchState } from './wc-match-state.types';
import { resolveWcBetResult, type WcBetSettlementInput } from './wc-odds-settlement.util';
import { olimpbetIdFromWcEventId } from './wc-slug.util';

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
      ? await this.olimpbet.fetchEventDetail(olimpbetId)
      : null;

    let eventSettledBets = 0;

    const dbEvent = await this.prisma.wcOddsEvent.findUnique({ where: { id: eventId } });
    const homeScore = detail
      ? this.olimpbet.extractScore(detail).homeScore ?? dbEvent?.homeScore ?? 0
      : dbEvent?.homeScore ?? 0;
    const awayScore = detail
      ? this.olimpbet.extractScore(detail).awayScore ?? dbEvent?.awayScore ?? 0
      : dbEvent?.awayScore ?? 0;

    if (detail && homeScore != null && awayScore != null) {
      const matchState = await this.loadMatchState(eventId);
      const early = await this.trySettleDeterminateBets(
        eventId,
        homeScore,
        awayScore,
        detail,
        matchState,
      );
      eventSettledBets += early.settledBets;
    } else if (dbEvent?.completed && dbEvent.homeScore != null && dbEvent.awayScore != null) {
      const matchState = await this.loadMatchState(eventId);
      const early = await this.trySettleDeterminateBets(
        eventId,
        dbEvent.homeScore,
        dbEvent.awayScore,
        detail ?? undefined,
        matchState,
      );
      eventSettledBets += early.settledBets;
    }

    const result = await this.trySettleEvent(eventId, detail);
    eventSettledBets += result.settledBets;

    return eventSettledBets;
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

    const olimpbetId = olimpbetIdFromWcEventId(eventId);
    if (!olimpbetId) {
      return { settledBets: 0, completed: false };
    }

    const detail = prefetchedDetail ?? await this.olimpbet.fetchEventDetail(olimpbetId);

    const result = detail ? this.olimpbet.resolveEventResult(detail) : null;

    if (!result) {
      const event = await this.prisma.wcOddsEvent.findUnique({ where: { id: eventId } });
      if (
        event?.completed
        && event.homeScore != null
        && event.awayScore != null
      ) {
        const settledBets = await this.settleEventBets(
          eventId,
          event.homeScore,
          event.awayScore,
          detail ?? (await this.olimpbet.fetchEventDetail(olimpbetId)) ?? undefined,
          parseMatchState(event.matchStateJson),
        );
        if (settledBets > 0) {
          await this.prisma.wcOddsEvent.update({
            where: { id: eventId },
            data: { settledAt: new Date() },
          });
        }
        await this.warnPendingDisplayBets(eventId, detail ?? undefined);
        return { settledBets, completed: true };
      }
      return { settledBets: 0, completed: false };
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

    return { settledBets, completed: true };
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

    const detail = await this.olimpbet.fetchEventDetail(olimpbetId);
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

    if (isPointSetSportFeed(settlementDetail)) {
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
   * Re-evaluate WIN/LOSE bets on point-set sports (volleyball, table-tennis)
   * when corrected settlement logic disagrees with stored result.
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

      await this.reverseWinPayout(fresh, eventId);
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

    for (const bet of pending) {
      await this.prisma.$transaction(async (tx) => {
        await tx.wcOddsBet.update({
          where: { id: bet.id },
          data: {
            status: WcOddsBetStatus.VOID,
            settledAt: new Date(),
          },
        });

        await this.operationService.create(tx, bet.userId, {
          amount: bet.stake,
          currencyCode: bet.currencyCode,
          source: OperationSource.WC_BET,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          meta: { wcBetId: bet.id, eventId, void: true, reason: 'cancelled' },
        });
      });

      this.notifyWcBetSettlement(bet, WcOddsBetStatus.VOID);
    }

    return pending.length;
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
    },
    eventId: string,
    result: WcOddsBetStatus,
  ): Promise<void> {
    const expressId = bet.wcExpressBetId ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.wcOddsBet.update({
        where: { id: bet.id },
        data: {
          status: result,
          settledAt: new Date(),
        },
      });

      if (expressId) {
        return;
      }

      if (result === WcOddsBetStatus.WIN) {
        await this.operationService.create(tx, bet.userId, {
          amount: bet.potentialPayout,
          currencyCode: bet.currencyCode,
          source: OperationSource.WC_BET,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          meta: { wcBetId: bet.id, eventId, marketKey: bet.marketKey },
        });
      } else if (result === WcOddsBetStatus.VOID) {
        await this.operationService.create(tx, bet.userId, {
          amount: bet.stake,
          currencyCode: bet.currencyCode,
          source: OperationSource.WC_BET,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          meta: { wcBetId: bet.id, eventId, void: true },
        });
      } else if (result === WcOddsBetStatus.LOSE) {
        const user = await tx.user.findUnique({ where: { id: bet.userId } });
        if (user) {
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

    if (expressId) {
      await this.trySettleExpressBet(expressId);
      return;
    }

    this.notifyWcBetSettlement(bet, result, eventId);

    if (result === WcOddsBetStatus.LOSE) {
      void this.partnersService.notifyCommissionForBet(bet.id);
    }
  }

  private async trySettleExpressBet(expressId: number): Promise<void> {
    const parent = await this.prisma.wcOddsExpressBet.findUnique({
      where: { id: expressId },
      include: { legs: true },
    });
    if (!parent || parent.status !== WcOddsBetStatus.PENDING) return;

    const nextStatus = resolveWcExpressStatus(parent.legs.map((leg) => leg.status));
    if (nextStatus == null) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.wcOddsExpressBet.update({
        where: { id: expressId },
        data: { status: nextStatus, settledAt: new Date() },
      });

      if (nextStatus === WcOddsBetStatus.WIN) {
        await this.operationService.create(tx, parent.userId, {
          amount: parent.potentialPayout,
          currencyCode: parent.currencyCode,
          source: OperationSource.WC_BET,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          meta: { wcExpressBetId: expressId },
        });
      } else if (nextStatus === WcOddsBetStatus.VOID) {
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

    if (nextStatus === WcOddsBetStatus.WIN) {
      this.notifyWcBetSettlement(
        {
          id: expressId,
          userId: parent.userId,
          stake: parent.stake,
          potentialPayout: parent.potentialPayout,
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
}
