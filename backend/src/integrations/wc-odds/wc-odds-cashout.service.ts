import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OperationSource,
  OperationStatus,
  OperationType,
  WcOddsBetStatus,
  WcOddsPick,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { EventGateway } from '~/main/event/event.gateway';
import { OperationService } from '~/main/operation/operation.service';
import { TelegramUserNotifyService } from '~/main/telegram/telegram-user-notify.service';
import { PrismaService } from '~/prisma/prisma.service';

import { isMarketScopeFinalized } from '../olimpbet-wc/olimpbet-score-scope.util';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';

import { parseBetPlacementContext } from './wc-bet-placement-context.util';
import { isWcBettingOpen } from './wc-betting.util';
import {
  calculateWcCashoutOffer,
  roundCashoutAmount,
  type WcCashoutCalculationResult,
} from './wc-odds-cashout.util';
import { resolveDeterminateBetResult } from './wc-verified-settlement.util';
import {
  findMarketOutcome,
  findOutcomeOdds,
  isTotalsMarketKey,
  isWcBetPlacementAllowed,
  normalizeWcMarketKey,
  type WcGroupedMarkets,
} from './wc-odds-markets.util';
import { WcOddsRealtimeService } from './wc-odds-realtime.service';
import { emptyMatchState, parseMatchState } from './wc-match-state.types';
import { resolveBetPlacementScope } from './wc-scope-market-filter.util';
import { olimpbetIdFromWcEventId } from './wc-slug.util';
import { toPublicEventId } from './wc-public.util';
import type { WcBetSettlementInput } from './wc-odds-settlement.util';

const QUOTE_TTL_MS = 8_000;
const EXECUTE_TOLERANCE = 0.02;

export type WcCashoutQuoteDto =
  | {
      available: false;
      reason: string;
      code: string;
    }
  | {
      available: true;
      amount: string;
      currentOdds: string;
      placedOdds: string;
      mode: 'determinate_win' | 'determinate_void' | 'live_odds';
      expiresAt: string;
    };

@Injectable()
export class WcOddsCashoutService {
  private readonly logger = new Logger(WcOddsCashoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly realtime: WcOddsRealtimeService,
    private readonly operationService: OperationService,
    private readonly config: ConfigService,
    private readonly eventGateway: EventGateway,
    private readonly telegramUserNotify: TelegramUserNotifyService,
  ) {}

  private assertEnabled() {
    if (!this.olimpbet.isEnabled()) {
      throw new ForbiddenException('WC odds module is disabled');
    }
    if (this.config.get<string>('WC_CASHOUT_ENABLED', 'true') !== 'true') {
      throw new ForbiddenException('Cashout is disabled');
    }
  }

  private getCashoutConfig() {
    return {
      margin: Number(this.config.get<string>('WC_CASHOUT_MARGIN', '0.05')),
      winMargin: Number(this.config.get<string>('WC_CASHOUT_WIN_MARGIN', '0.02')),
      minStakeRatio: Number(this.config.get<string>('WC_CASHOUT_MIN_RATIO', '0.05')),
    };
  }

  async getCashoutQuote(userId: number, betId: number): Promise<WcCashoutQuoteDto> {
    this.assertEnabled();
    const calc = await this.evaluateCashout(userId, betId);
    if (calc.available === false) {
      return { available: false, reason: calc.reason, code: calc.code };
    }
    return {
      available: true,
      amount: calc.amount.toFixed(2),
      currentOdds: calc.currentOdds.toFixed(2),
      placedOdds: calc.placedOdds.toFixed(2),
      mode: calc.mode,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    };
  }

  async executeCashout(
    userId: number,
    betId: number,
    expectedAmount?: number,
  ): Promise<{ ok: true; amount: string; betId: number }> {
    this.assertEnabled();
    const calc = await this.evaluateCashout(userId, betId);
    if (calc.available === false) {
      throw new BadRequestException(calc.reason);
    }

    if (
      expectedAmount != null
      && Number.isFinite(expectedAmount)
      && Math.abs(calc.amount - expectedAmount) > EXECUTE_TOLERANCE
    ) {
      throw new BadRequestException('Сумма продажи изменилась — обновите котировку');
    }

    const amount = roundCashoutAmount(calc.amount);

    const bet = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.wcOddsBet.findFirst({
        where: { id: betId, userId, isProbe: false, status: WcOddsBetStatus.PENDING },
      });
      if (!fresh) {
        throw new NotFoundException('Bet not available for cashout');
      }

      const updated = await tx.wcOddsBet.updateMany({
        where: { id: betId, status: WcOddsBetStatus.PENDING },
        data: {
          status: WcOddsBetStatus.CASHED_OUT,
          cashoutAmount: new Decimal(amount),
          settledAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Ставка уже закрыта');
      }

      await this.operationService.create(tx, userId, {
        amount: new Decimal(amount),
        currencyCode: fresh.currencyCode,
        source: OperationSource.WC_BET,
        status: OperationStatus.SUCCESS,
        type: OperationType.INCOME,
        meta: {
          wcBetId: fresh.id,
          eventId: fresh.eventId,
          marketKey: fresh.marketKey,
          cashout: true,
        },
      });

      return fresh;
    });

    this.notifyCashout(bet, amount);
    this.logger.log(`WC cashout bet #${betId} user ${userId}: ${amount} ${bet.currencyCode}`);

    return { ok: true, amount: amount.toFixed(2), betId };
  }

  private async evaluateCashout(
    userId: number,
    betId: number,
  ): Promise<WcCashoutCalculationResult> {
    const bet = await this.prisma.wcOddsBet.findFirst({
      where: { id: betId, userId, isProbe: false },
      include: { event: true },
    });
    if (!bet) throw new NotFoundException('Bet not found');
    if (bet.status !== WcOddsBetStatus.PENDING) {
      return { available: false, reason: 'Ставка уже закрыта', code: 'not_pending' };
    }
    if (bet.wcExpressBetId != null) {
      return { available: false, reason: 'Продажа недоступна для экспресса', code: 'express_leg' };
    }
    if (!bet.event) {
      return { available: false, reason: 'Событие недоступно', code: 'event_missing' };
    }

    const rawMarketKey = bet.marketKey;
    if (!isWcBetPlacementAllowed(rawMarketKey, bet.outcomeKey)) {
      return { available: false, reason: 'Продажа недоступна для этого рынка', code: 'market_blocked' };
    }

    const event = bet.event;
    const publicRef = event.slug?.trim() || toPublicEventId(event.id);
    const refreshed = await this.realtime.refreshEvent(publicRef, true, {
      fullMarkets: true,
      persistOdds: false,
    });

    const placementCtx = parseBetPlacementContext(bet.placementContextJson);
    const matchState = parseMatchState(event.matchStateJson) ?? emptyMatchState();
    const homeScore = refreshed?.homeScore ?? event.homeScore ?? placementCtx?.homeScore ?? 0;
    const awayScore = refreshed?.awayScore ?? event.awayScore ?? placementCtx?.awayScore ?? 0;

    const settlementInput = this.toBetSettlementInput(bet);
    let determinateResult = resolveDeterminateBetResult(
      settlementInput,
      homeScore,
      awayScore,
      undefined,
      matchState,
    );

    const olimpbetId = olimpbetIdFromWcEventId(event.id);
    let placementDetail = null;
    if (olimpbetId) {
      placementDetail = await this.olimpbet.fetchEventDetail(olimpbetId);
      if (placementDetail && determinateResult == null) {
        determinateResult = resolveDeterminateBetResult(
          settlementInput,
          homeScore,
          awayScore,
          placementDetail,
          matchState,
        );
      }
    }

    const bettingClosed =
      event.completed
      || refreshed?.bettingOpen === false
      || !isWcBettingOpen(event.completed, event.commenceTime);

    if (placementDetail && determinateResult == null) {
      const scope = resolveBetPlacementScope({
        marketKey: rawMarketKey,
        outcomeKey: bet.outcomeKey,
        outcomeName: bet.outcomeName,
        totalsGroupLabel: placementCtx?.totalsGroupLabel ?? null,
      });
      if (scope && isMarketScopeFinalized(placementDetail, scope)) {
        return {
          available: false,
          reason: 'Ожидается расчёт ставки',
          code: 'scope_finalized',
        };
      }
    }

    const stake = Number(bet.stake);
    const placedOdds = Number(bet.odds);
    const potentialPayout = Number(bet.potentialPayout);
    const groupedMarkets = (refreshed?.groupedMarkets ?? event.marketsJson ?? {}) as WcGroupedMarkets;
    const marketKey = normalizeWcMarketKey(rawMarketKey);
    const outcomeKey = bet.outcomeKey;
    const line = bet.line;

    let currentOdds: number | null = null;
    let outcomeSuspended = false;

    if (determinateResult == null) {
      if (marketKey === 'h2h' && bet.pick) {
        const pickOdds: Record<WcOddsPick, Decimal | null> = {
          [WcOddsPick.HOME]: event.oddsHome,
          [WcOddsPick.DRAW]: event.oddsDraw,
          [WcOddsPick.AWAY]: event.oddsAway,
        };
        currentOdds = findOutcomeOdds(groupedMarkets, rawMarketKey, outcomeKey ?? bet.pick, null)
          ?? findOutcomeOdds(groupedMarkets, marketKey, outcomeKey ?? bet.pick, null);
        if (currentOdds == null && bet.pick) {
          const dec = pickOdds[bet.pick];
          currentOdds = dec ? Number(dec) : null;
        }
      } else if (outcomeKey) {
        if (isTotalsMarketKey(marketKey) && line) {
          currentOdds = findOutcomeOdds(groupedMarkets, rawMarketKey, outcomeKey, line)
            ?? findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, line);
        } else {
          currentOdds = findOutcomeOdds(groupedMarkets, rawMarketKey, outcomeKey, line)
            ?? findOutcomeOdds(groupedMarkets, marketKey, outcomeKey, line);
        }
      }

      const matchedOutcome = outcomeKey
        ? findMarketOutcome(groupedMarkets, rawMarketKey, outcomeKey, line)
          ?? findMarketOutcome(groupedMarkets, marketKey, outcomeKey, line)
        : null;
      outcomeSuspended = Boolean(matchedOutcome?.suspended);
      if (matchedOutcome && (!Number.isFinite(matchedOutcome.price) || matchedOutcome.price <= 1)) {
        currentOdds = null;
      }
    }

    const { margin, winMargin, minStakeRatio } = this.getCashoutConfig();

    return calculateWcCashoutOffer({
      stake,
      placedOdds,
      potentialPayout,
      currentOdds,
      outcomeSuspended,
      determinateResult,
      bettingClosed,
      margin,
      winMargin,
      minStakeRatio,
    });
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

  private notifyCashout(
    bet: {
      id: number;
      userId: number;
      stake: Decimal;
      currencyCode: string;
      outcomeName?: string | null;
      eventId: string;
    },
    amount: number,
  ): void {
    try {
      const notification = {
        eventId: `user_${bet.userId}`,
        type: 'bet_status_changed',
        payload: {
          wcBetId: bet.id,
          status: 'CASHOUT',
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
        try {
          const ev = await this.prisma.wcOddsEvent.findUnique({
            where: { id: bet.eventId },
            select: { homeTeam: true, awayTeam: true },
          });
          homeTeam = ev?.homeTeam ?? undefined;
          awayTeam = ev?.awayTeam ?? undefined;
        } catch { /* ignore */ }

        const outcomeLabel = bet.outcomeName
          ? `Продажа · ${bet.outcomeName}`
          : 'Продажа ставки';

        await this.telegramUserNotify.notifyBetSettled({
          userId: bet.userId,
          wcBetId: bet.id,
          status: 'WIN',
          amount,
          betAmount: Number(bet.stake),
          currencyCode: bet.currencyCode,
          outcomeName: outcomeLabel,
          homeTeam,
          awayTeam,
        });
      })().catch(() => undefined);
    } catch (error) {
      this.logger.warn(`Failed to send cashout notification for bet #${bet.id}`, error);
    }
  }
}
