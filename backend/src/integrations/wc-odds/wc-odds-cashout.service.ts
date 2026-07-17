import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
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
import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';
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
const CASHOUT_CONTEXT_TTL_MS = 20_000;
const PLACEMENT_DETAIL_TTL_MS = 30_000;
const CASHOUT_PUSH_DEBOUNCE_MS = 1_500;
const SLOW_OP_MS = 2_000;

type CashoutEventContext = Awaited<ReturnType<WcOddsCashoutService['buildCashoutEventContext']>>;

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
export class WcOddsCashoutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WcOddsCashoutService.name);
  private readonly eventContextCache = new Map<string, { ctx: CashoutEventContext; expiresAt: number }>();
  private readonly placementDetailCache = new Map<
    string,
    { detail: OlimpbetEventDetail | null; expiresAt: number }
  >();
  private readonly pushDebounce = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly olimpbet: OlimpbetWcService,
    private readonly realtime: WcOddsRealtimeService,
    private readonly operationService: OperationService,
    private readonly config: ConfigService,
    private readonly eventGateway: EventGateway,
    private readonly telegramUserNotify: TelegramUserNotifyService,
  ) {}

  onModuleInit(): void {
    this.realtime.registerOddsUpdatedHandler((eventId) => {
      this.schedulePushQuotesForEvent(eventId);
    });
  }

  onModuleDestroy(): void {
    for (const timer of this.pushDebounce.values()) {
      clearTimeout(timer);
    }
    this.pushDebounce.clear();
  }

  private schedulePushQuotesForEvent(eventId: string): void {
    if (this.config.get<string>('WC_CASHOUT_ENABLED', 'true') !== 'true') return;
    if (this.pushDebounce.has(eventId)) return;

    this.pushDebounce.set(
      eventId,
      setTimeout(() => {
        this.pushDebounce.delete(eventId);
        void this.pushQuotesForEvent(eventId);
      }, CASHOUT_PUSH_DEBOUNCE_MS),
    );
  }

  async pushQuotesForEvent(eventId: string): Promise<void> {
    if (!this.olimpbet.isEnabled()) return;

    const bets = await this.prisma.wcOddsBet.findMany({
      where: {
        eventId,
        isProbe: false,
        status: WcOddsBetStatus.PENDING,
        wcExpressBetId: null,
      },
      select: { id: true, userId: true },
    });
    if (!bets.length) return;

    const byUser = new Map<number, number[]>();
    for (const bet of bets) {
      const group = byUser.get(bet.userId) ?? [];
      group.push(bet.id);
      byUser.set(bet.userId, group);
    }

    for (const [userId, betIds] of byUser) {
      try {
        const quotes = await this.getCashoutQuotesForUser(userId, betIds);
        this.eventGateway.sendUserNotification(String(userId), {
          eventId: `user_${userId}`,
          type: 'wc_cashout_quotes',
          payload: { quotes, ts: Date.now() },
        } as { type: string; payload: unknown });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.debug(`Cashout WS push skipped for user ${userId}: ${message.slice(0, 120)}`);
      }
    }
  }

  private logSlowOp(label: string, startedAt: number): void {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= SLOW_OP_MS) {
      this.logger.warn(`[perf] ${label} took ${elapsed}ms`);
    }
  }

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
    const quotes = await this.getCashoutQuotesForUser(userId, [betId]);
    const quote = quotes[betId];
    if (!quote) {
      throw new NotFoundException('Bet not found');
    }
    return quote;
  }

  async getCashoutQuotesForUser(
    userId: number,
    betIds?: number[],
  ): Promise<Record<number, WcCashoutQuoteDto>> {
    const startedAt = Date.now();
    this.assertEnabled();

    const bets = await this.prisma.wcOddsBet.findMany({
      where: {
        userId,
        isProbe: false,
        status: WcOddsBetStatus.PENDING,
        wcExpressBetId: null,
        ...(betIds?.length ? { id: { in: betIds } } : {}),
      },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
      take: betIds?.length ? betIds.length : 50,
    });

    const result: Record<number, WcCashoutQuoteDto> = {};
    const byEvent = new Map<string, typeof bets>();

    for (const bet of bets) {
      if (!bet.event) {
        result[bet.id] = {
          available: false,
          reason: 'Событие недоступно',
          code: 'event_missing',
        };
        continue;
      }
      const group = byEvent.get(bet.eventId) ?? [];
      group.push(bet);
      byEvent.set(bet.eventId, group);
    }

    for (const eventBets of byEvent.values()) {
      const event = eventBets[0]!.event!;
      const ctx = await this.loadCashoutEventContext(event);

      for (const bet of eventBets) {
        result[bet.id] = this.toQuoteDto(this.evaluateCashoutForBet(bet, ctx));
      }
    }

    this.logSlowOp(`getCashoutQuotesForUser user=${userId} bets=${betIds?.length ?? 'all'}`, startedAt);
    return result;
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
    this.invalidateCashoutEventCache(bet.eventId);
    this.logger.log(`WC cashout bet #${betId} user ${userId}: ${amount} ${bet.currencyCode}`);

    return { ok: true, amount: amount.toFixed(2), betId };
  }

  private toQuoteDto(calc: WcCashoutCalculationResult): WcCashoutQuoteDto {
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

  private async loadCashoutEventContext(event: {
    id: string;
    slug: string | null;
    homeScore: number | null;
    awayScore: number | null;
    completed: boolean;
    commenceTime: Date;
    matchStateJson: unknown;
    marketsJson: unknown;
    oddsHome: Decimal | null;
    oddsDraw: Decimal | null;
    oddsAway: Decimal | null;
  }): Promise<CashoutEventContext> {
    const cached = this.eventContextCache.get(event.id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.ctx;
    }

    const ctx = await this.buildCashoutEventContext(event);
    this.eventContextCache.set(event.id, {
      ctx,
      expiresAt: Date.now() + CASHOUT_CONTEXT_TTL_MS,
    });
    return ctx;
  }

  private async buildCashoutEventContext(event: {
    id: string;
    slug: string | null;
    homeScore: number | null;
    awayScore: number | null;
    completed: boolean;
    commenceTime: Date;
    matchStateJson: unknown;
    marketsJson: unknown;
    oddsHome: Decimal | null;
    oddsDraw: Decimal | null;
    oddsAway: Decimal | null;
  }) {
    const publicRef = event.slug?.trim() || toPublicEventId(event.id);
    let refreshed = this.realtime.getEventCache(publicRef);

    const cacheAgeMs = refreshed?.oddsUpdatedAt
      ? Date.now() - new Date(refreshed.oddsUpdatedAt).getTime()
      : Number.POSITIVE_INFINITY;

    if (!refreshed || cacheAgeMs > CASHOUT_CONTEXT_TTL_MS) {
      refreshed = await this.realtime.refreshEvent(publicRef, false, {
        oddsOnly: true,
        persistOdds: false,
        skipStructuredStats: true,
      }) ?? refreshed;
    }

    const matchState = parseMatchState(event.matchStateJson) ?? emptyMatchState();
    const homeScore = refreshed?.homeScore ?? event.homeScore ?? 0;
    const awayScore = refreshed?.awayScore ?? event.awayScore ?? 0;

    const olimpbetId = olimpbetIdFromWcEventId(event.id);
    let placementDetail: OlimpbetEventDetail | null = null;
    if (olimpbetId) {
      const detailCached = this.placementDetailCache.get(event.id);
      if (detailCached && detailCached.expiresAt > Date.now()) {
        placementDetail = detailCached.detail;
      } else {
        placementDetail = await this.olimpbet.fetchEventDetail(olimpbetId, { locale: 'ru' });
        this.placementDetailCache.set(event.id, {
          detail: placementDetail,
          expiresAt: Date.now() + PLACEMENT_DETAIL_TTL_MS,
        });
      }
    }

    const bettingClosed =
      event.completed
      || refreshed?.bettingOpen === false
      || !isWcBettingOpen(event.completed, event.commenceTime);

    const groupedMarkets = (refreshed?.groupedMarkets ?? event.marketsJson ?? {}) as WcGroupedMarkets;

    return {
      event,
      refreshed,
      matchState,
      homeScore,
      awayScore,
      placementDetail,
      bettingClosed,
      groupedMarkets,
    };
  }

  private invalidateCashoutEventCache(eventId: string): void {
    this.eventContextCache.delete(eventId);
    this.placementDetailCache.delete(eventId);
  }

  private evaluateCashoutForBet(
    bet: {
      marketKey: string;
      outcomeKey: string | null;
      line: string | null;
      outcomeName: string | null;
      pick: WcOddsPick | null;
      stake: Decimal;
      odds: Decimal;
      potentialPayout: Decimal;
      placementContextJson: unknown;
    },
    ctx: CashoutEventContext,
  ): WcCashoutCalculationResult {
    const rawMarketKey = bet.marketKey;
    if (!isWcBetPlacementAllowed(rawMarketKey, bet.outcomeKey)) {
      return { available: false, reason: 'Продажа недоступна для этого рынка', code: 'market_blocked' };
    }

    const placementCtx = parseBetPlacementContext(bet.placementContextJson);
    const settlementInput = this.toBetSettlementInput(bet);
    let determinateResult = resolveDeterminateBetResult(
      settlementInput,
      ctx.homeScore,
      ctx.awayScore,
      undefined,
      ctx.matchState,
    );

    if (ctx.placementDetail && determinateResult == null) {
      determinateResult = resolveDeterminateBetResult(
        settlementInput,
        ctx.homeScore,
        ctx.awayScore,
        ctx.placementDetail,
        ctx.matchState,
      );
    }

    if (ctx.placementDetail && determinateResult == null) {
      const scope = resolveBetPlacementScope({
        marketKey: rawMarketKey,
        outcomeKey: bet.outcomeKey,
        outcomeName: bet.outcomeName,
        totalsGroupLabel: placementCtx?.totalsGroupLabel ?? null,
      });
      if (scope && isMarketScopeFinalized(ctx.placementDetail, scope)) {
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
    const marketKey = normalizeWcMarketKey(rawMarketKey);
    const outcomeKey = bet.outcomeKey;
    const line = bet.line;
    const { event, groupedMarkets, bettingClosed } = ctx;

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

    const ctx = await this.loadCashoutEventContext(bet.event);
    return this.evaluateCashoutForBet(bet, ctx);
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
