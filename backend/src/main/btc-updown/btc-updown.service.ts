import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  BtcUpdownBetStatus,
  BtcUpdownRoundStatus,
  BtcUpdownSide,
  OperationSource,
  OperationStatus,
  OperationType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import { PrismaService } from '~/prisma/prisma.service';
import { computeMainAccountBetDebit } from '~/shared/utils/balance-fractional-reserve.util';
import { displayPublicName } from '~/main/user/nickname';

import { BtcUpdownPriceService } from './btc-updown-price.service';
import {
  BTC_UPDOWN_DAILY_HOUSE_LOSS_PAUSE,
  BTC_UPDOWN_MAX_SIDE_EXPOSURE,
  BTC_UPDOWN_MAX_STAKE,
  BTC_UPDOWN_MAX_USER_BETS_PER_ROUND,
  BTC_UPDOWN_MAX_USER_STAKE_PER_ROUND,
  BTC_UPDOWN_MIN_STAKE,
  BTC_UPDOWN_ODDS,
  BTC_UPDOWN_ROUND_MS,
  BTC_UPDOWN_SYMBOL,
  CRYPTO_UPDOWN_MARKETS,
  CRYPTO_UPDOWN_QUOTE_VALID_MS,
  CRYPTO_UPDOWN_ROUND_MS,
  CRYPTO_UPDOWN_SLIPPAGE_BPS,
  CRYPTO_UPDOWN_SYMBOLS,
  floorWindowStart,
  isRoundAllowedForSymbol,
  isCryptoUpdownSymbol,
  lockMsForRound,
  roundsForSymbol,
  maxStakeForCurrency,
  minStakeForCurrency,
  oddsForRound,
  type CryptoUpdownRoundMs,
  type CryptoUpdownSymbol,
} from './btc-updown.constants';

@Injectable()
export class BtcUpdownService implements OnModuleInit {
  private readonly logger = new Logger(BtcUpdownService.name);
  private settling = false;
  /** Cached UTC-day house net; refreshed lazily. */
  private houseDayKey: string | null = null;
  private houseDayNet = 0;
  private bettingPaused = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
    private readonly price: BtcUpdownPriceService,
  ) {}

  async onModuleInit() {
    try {
      await this.refreshHouseDayNet(true);
      for (const market of CRYPTO_UPDOWN_MARKETS) {
        await this.ensureCurrentRound(market.symbol, market.roundMs);
      }
      await this.settleDueRounds();
    } catch (err) {
      this.logger.error(
        `Crypto updown init failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  getConfig(roundMs: number = BTC_UPDOWN_ROUND_MS) {
    const odds = oddsForRound(roundMs);
    return {
      symbol: BTC_UPDOWN_SYMBOL,
      roundMs: BTC_UPDOWN_ROUND_MS,
      lockMs: lockMsForRound(roundMs),
      odds,
      oddsByRoundMs: {
        60000: oddsForRound(60_000),
        300000: oddsForRound(300_000),
        900000: oddsForRound(900_000),
      },
      minStake: BTC_UPDOWN_MIN_STAKE,
      maxStake: BTC_UPDOWN_MAX_STAKE,
      maxStakeByCurrency: {
        KZT: maxStakeForCurrency('KZT'),
        USD: maxStakeForCurrency('USD'),
        USDT: maxStakeForCurrency('USDT'),
        RUB: maxStakeForCurrency('RUB'),
      },
      maxSideExposure: BTC_UPDOWN_MAX_SIDE_EXPOSURE,
      maxUserStakePerRound: BTC_UPDOWN_MAX_USER_STAKE_PER_ROUND,
      maxUserBetsPerRound: BTC_UPDOWN_MAX_USER_BETS_PER_ROUND,
      dailyHouseLossPause: BTC_UPDOWN_DAILY_HOUSE_LOSS_PAUSE,
      bettingPaused: this.bettingPaused,
      houseDayNet: Number(this.houseDayNet.toFixed(2)),
      currencyDefault: 'KZT',
      source: 'binance',
      quoteValidMs: CRYPTO_UPDOWN_QUOTE_VALID_MS,
      slippageBps: CRYPTO_UPDOWN_SLIPPAGE_BPS,
      symbols: [...CRYPTO_UPDOWN_SYMBOLS],
      roundOptionsMs: [...CRYPTO_UPDOWN_ROUND_MS],
      markets: CRYPTO_UPDOWN_MARKETS.map((m) => ({
        symbol: m.symbol,
        roundMs: m.roundMs,
        lockMs: lockMsForRound(m.roundMs),
        odds: oddsForRound(m.roundMs),
        label: this.marketLabel(m.symbol, m.roundMs),
      })),
      settleRule:
        'Each bet settles vs its own entryPrice: UP wins if close >= entry, DOWN wins if close < entry. Round result uses open→close.',
      note: 'In-house crypto Up/Down. No Polymarket.',
    };
  }

  @Interval(1000)
  async tickEngine() {
    if (this.settling) return;
    this.settling = true;
    try {
      for (const market of CRYPTO_UPDOWN_MARKETS) {
        await this.ensureCurrentRound(market.symbol, market.roundMs);
      }
      await this.lockIfNeeded();
      await this.settleDueRounds();
    } catch (err) {
      this.logger.warn(
        `Crypto engine tick: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.settling = false;
    }
  }

  parseMarket(symbolRaw?: string, roundMsRaw?: number) {
    const symbol = (symbolRaw || BTC_UPDOWN_SYMBOL).toUpperCase();
    const roundMs = Number(roundMsRaw ?? BTC_UPDOWN_ROUND_MS);
    if (!isCryptoUpdownSymbol(symbol)) {
      throw new BadRequestException(
        `symbol must be one of ${CRYPTO_UPDOWN_SYMBOLS.join(', ')}`,
      );
    }
    if (!isRoundAllowedForSymbol(symbol, roundMs)) {
      throw new BadRequestException(
        `roundMs for ${symbol} must be one of ${roundsForSymbol(symbol).join(', ')}`,
      );
    }
    return { symbol, roundMs: roundMs as CryptoUpdownRoundMs };
  }

  async getPublicState(
    userId?: number,
    symbolRaw?: string,
    roundMsRaw?: number,
  ) {
    const { symbol, roundMs } = this.parseMarket(symbolRaw, roundMsRaw);
    const round = await this.ensureCurrentRound(symbol, roundMs);
    const now = Date.now();
    const lockMs = lockMsForRound(roundMs);
    const price = this.price.getLastPrice(symbol);
    const openPrice = round.openPrice ? Number(round.openPrice) : null;
    const bettingOpen =
      round.status === BtcUpdownRoundStatus.OPEN &&
      now < round.endsAt.getTime() - lockMs;

    const ticks = this.price.getChartTicks(symbol, 150_000, 2_400);

    let myBets: ReturnType<BtcUpdownService['toBetDto']>[] = [];
    if (userId) {
      const bets = await this.prisma.btcUpdownBet.findMany({
        where: { userId, roundId: round.id },
        orderBy: { id: 'desc' },
      });
      myBets = bets.map((b) => this.toBetDto(b));
    }

    const recent = await this.prisma.btcUpdownRound.findMany({
      where: {
        status: BtcUpdownRoundStatus.SETTLED,
        symbol,
        roundMs,
      },
      orderBy: { startsAt: 'desc' },
      take: 12,
    });

    return {
      serverNow: new Date(now).toISOString(),
      config: {
        ...this.getConfig(roundMs),
        symbol,
        roundMs,
        lockMs,
        odds: oddsForRound(roundMs),
      },
      market: {
        symbol,
        roundMs,
        lockMs,
        label: this.marketLabel(symbol, roundMs),
      },
      price,
      priceAt: this.price.getLastAt(symbol)
        ? new Date(this.price.getLastAt(symbol)).toISOString()
        : null,
      openPrice,
      changePct:
        openPrice && price
          ? Number((((price - openPrice) / openPrice) * 100).toFixed(4))
          : null,
      bettingOpen,
      msToLock: Math.max(0, round.endsAt.getTime() - lockMs - now),
      msToEnd: Math.max(0, round.endsAt.getTime() - now),
      round: this.toRoundDto(round),
      ticks,
      myBets,
      recentRounds: recent.map((r) => this.toRoundDto(r)),
    };
  }

  async getQuote(symbolRaw?: string, roundMsRaw?: number) {
    const { symbol, roundMs } = this.parseMarket(symbolRaw, roundMsRaw);
    const round = await this.ensureCurrentRound(symbol, roundMs);
    const lockMs = lockMsForRound(roundMs);
    const now = Date.now();
    const price = this.price.getLastPrice(symbol);
    const priceAt = this.price.getLastAt(symbol) || now;
    if (!price || !Number.isFinite(price)) {
      throw new BadRequestException('Live price not ready yet');
    }
    const bettingOpen =
      round.status === BtcUpdownRoundStatus.OPEN &&
      now < round.endsAt.getTime() - lockMs;

    return {
      symbol,
      roundMs,
      roundId: round.id,
      price,
      priceAt: new Date(priceAt).toISOString(),
      quotedAt: new Date(now).toISOString(),
      validUntil: new Date(now + CRYPTO_UPDOWN_QUOTE_VALID_MS).toISOString(),
      validMs: CRYPTO_UPDOWN_QUOTE_VALID_MS,
      slippageBps: CRYPTO_UPDOWN_SLIPPAGE_BPS,
      openPrice: round.openPrice ? Number(round.openPrice) : null,
      bettingOpen,
      source: 'binance',
      settleRule:
        'UP wins if closePrice >= entryPrice; DOWN wins if closePrice < entryPrice',
    };
  }

  async getDailyStats(userId: number, currencyCode = 'KZT') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const currency = currencyCode.toUpperCase();

    const bets = await this.prisma.btcUpdownBet.findMany({
      where: {
        userId,
        currencyCode: currency,
        createdAt: { gte: start },
      },
      include: { round: true },
      orderBy: { id: 'desc' },
    });

    let wins = 0;
    let losses = 0;
    let voids = 0;
    let pending = 0;
    let stakeTotal = 0;
    let pnl = 0;

    for (const bet of bets) {
      const stake = Number(bet.stake);
      stakeTotal += stake;
      if (bet.status === BtcUpdownBetStatus.WIN) {
        wins += 1;
        pnl += Number(bet.potentialPayout) - stake;
      } else if (bet.status === BtcUpdownBetStatus.LOSE) {
        losses += 1;
        pnl -= stake;
      } else if (bet.status === BtcUpdownBetStatus.VOID) {
        voids += 1;
      } else {
        pending += 1;
      }
    }

    return {
      day: start.toISOString().slice(0, 10),
      currencyCode: currency,
      bets: bets.length,
      wins,
      losses,
      voids,
      pending,
      stakeTotal: Number(stakeTotal.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      winRate:
        wins + losses > 0
          ? Number(((wins / (wins + losses)) * 100).toFixed(1))
          : null,
    };
  }

  /** Public Imba-wide PnL board (masked names) for the trading hub. */
  async getPublicPnlBoard(params?: {
    range?: string;
    currencyCode?: string;
    limit?: number;
  }) {
    const currency = (params?.currencyCode || 'KZT').toUpperCase();
    const range = (params?.range || '1d').toLowerCase();
    const limit = Math.min(20, Math.max(3, Number(params?.limit) || 8));
    const now = Date.now();
    const rangeMs =
      range === '1w'
        ? 7 * 86_400_000
        : range === '1m'
          ? 30 * 86_400_000
          : range === 'all'
            ? null
            : 86_400_000;
    const since =
      rangeMs != null ? new Date(now - rangeMs) : undefined;

    const bets = await this.prisma.btcUpdownBet.findMany({
      where: {
        currencyCode: currency,
        status: {
          in: [BtcUpdownBetStatus.WIN, BtcUpdownBetStatus.LOSE],
        },
        ...(since
          ? {
              OR: [
                { settledAt: { gte: since } },
                { settledAt: null, createdAt: { gte: since } },
              ],
            }
          : {}),
      },
      select: {
        userId: true,
        stake: true,
        potentialPayout: true,
        status: true,
        settledAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            telegramUsername: true,
            nickname: true,
            avatarPreset: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 8_000,
    });

    type Agg = {
      userId: number;
      name: string;
      nickname: string | null;
      avatarPreset: string | null;
      avatarUrl: string | null;
      bets: number;
      wins: number;
      losses: number;
      stakeTotal: number;
      pnl: number;
    };

    const byUser = new Map<number, Agg>();
    const seriesEvents: Array<{ t: number; d: number }> = [];
    let stakeTotal = 0;
    let wins = 0;
    let losses = 0;
    let pnlTotal = 0;

    for (const bet of bets) {
      const stake = Number(bet.stake);
      const delta =
        bet.status === BtcUpdownBetStatus.WIN
          ? Number(bet.potentialPayout) - stake
          : -stake;
      const t = (bet.settledAt ?? bet.createdAt).getTime();
      seriesEvents.push({ t, d: delta });
      stakeTotal += stake;
      pnlTotal += delta;
      if (bet.status === BtcUpdownBetStatus.WIN) wins += 1;
      else losses += 1;

      const prev = byUser.get(bet.userId);
      if (prev) {
        prev.bets += 1;
        prev.stakeTotal += stake;
        prev.pnl += delta;
        if (bet.status === BtcUpdownBetStatus.WIN) prev.wins += 1;
        else prev.losses += 1;
      } else {
        byUser.set(bet.userId, {
          userId: bet.userId,
          name: this.publicPlayerName(bet.user),
          nickname: bet.user.nickname ?? null,
          avatarPreset: bet.user.avatarPreset ?? null,
          avatarUrl: bet.user.avatarUrl ?? null,
          bets: 1,
          wins: bet.status === BtcUpdownBetStatus.WIN ? 1 : 0,
          losses: bet.status === BtcUpdownBetStatus.LOSE ? 1 : 0,
          stakeTotal: stake,
          pnl: delta,
        });
      }
    }

    seriesEvents.sort((a, b) => a.t - b.t);
    const firstT = seriesEvents[0]?.t ?? now;
    const startT =
      rangeMs != null ? Math.min(now - rangeMs, firstT) : firstT;
    let running = 0;
    const series: Array<{ t: number; v: number }> = [{ t: startT, v: 0 }];
    for (const ev of seriesEvents) {
      running += ev.d;
      series.push({ t: ev.t, v: Number(running.toFixed(2)) });
    }
    if (series.length === 1) series.push({ t: now, v: 0 });

    const players = [...byUser.values()]
      .map((p) => ({
        userId: p.userId,
        name: p.name,
        nickname: p.nickname,
        avatarPreset: p.avatarPreset,
        avatarUrl: p.avatarUrl,
        bets: p.bets,
        wins: p.wins,
        losses: p.losses,
        stakeTotal: Number(p.stakeTotal.toFixed(2)),
        pnl: Number(p.pnl.toFixed(2)),
        winRate:
          p.wins + p.losses > 0
            ? Number(((p.wins / (p.wins + p.losses)) * 100).toFixed(1))
            : null,
      }))
      .sort((a, b) => b.pnl - a.pnl || b.stakeTotal - a.stakeTotal)
      .slice(0, limit);

    return {
      range: range === '1w' || range === '1m' || range === 'all' ? range : '1d',
      currencyCode: currency,
      summary: {
        players: byUser.size,
        bets: wins + losses,
        wins,
        losses,
        stakeTotal: Number(stakeTotal.toFixed(2)),
        pnl: Number(pnlTotal.toFixed(2)),
        winRate:
          wins + losses > 0
            ? Number(((wins / (wins + losses)) * 100).toFixed(1))
            : null,
      },
      series,
      players,
    };
  }

  private publicPlayerName(user: {
    id: number;
    email: string;
    telegramUsername: string | null;
    nickname?: string | null;
  }): string {
    return displayPublicName(user);
  }

  /** Public Polymarket-style trader profile (masked identity + PnL). */
  async getPublicTraderProfile(params: {
    idOrNick?: string;
    userId?: number;
    range?: string;
    currencyCode?: string;
  }) {
    const raw = (params.idOrNick ?? "").trim();
    const asId = Number(params.userId ?? raw);
    const looksLikeId = Number.isFinite(asId) && asId > 0 && String(asId) === raw;

    let user = null as null | {
      id: number;
      email: string;
      telegramUsername: string | null;
      nickname: string | null;
      avatarPreset: string | null;
      avatarUrl: string | null;
      createdAt: Date;
    };

    if (raw && !looksLikeId) {
      user = await this.prisma.user.findFirst({
        where: { nickname: { equals: raw, mode: 'insensitive' } },
        select: {
          id: true,
          email: true,
          telegramUsername: true,
          nickname: true,
          avatarPreset: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
    }

    // Legacy links used truncated display names (email/tg) when nickname was unset.
    if (!user && raw && !looksLikeId) {
      const tg = raw.replace(/^@+/, '');
      const byTelegram = await this.prisma.user.findFirst({
        where: {
          OR: [
            { telegramUsername: { equals: tg, mode: 'insensitive' } },
            { telegramUsername: { equals: `@${tg}`, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          email: true,
          telegramUsername: true,
          nickname: true,
          avatarPreset: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
      if (byTelegram) {
        user = byTelegram;
      } else {
        const candidates = await this.prisma.user.findMany({
          where: {
            OR: [
              { email: { startsWith: raw, mode: 'insensitive' } },
              { telegramUsername: { startsWith: tg, mode: 'insensitive' } },
              {
                telegramUsername: {
                  startsWith: `@${tg}`,
                  mode: 'insensitive',
                },
              },
            ],
          },
          select: {
            id: true,
            email: true,
            telegramUsername: true,
            nickname: true,
            avatarPreset: true,
            avatarUrl: true,
            createdAt: true,
          },
          take: 40,
        });
        const needle = raw.toLowerCase();
        user =
          candidates.find(
            (u) => displayPublicName(u).toLowerCase() === needle,
          ) ?? null;
      }
    }

    if (!user) {
      const userId = looksLikeId
        ? asId
        : Number(params.userId);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new NotFoundException('Trader not found');
      }
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          telegramUsername: true,
          nickname: true,
          avatarPreset: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
    }
    if (!user) {
      throw new NotFoundException('Trader not found');
    }

    const currency = (params.currencyCode || 'KZT').toUpperCase();
    const rangeRaw = (params.range || 'all').toLowerCase();
    const range =
      rangeRaw === '1d' ||
      rangeRaw === '1w' ||
      rangeRaw === '1m' ||
      rangeRaw === '1y' ||
      rangeRaw === 'ytd' ||
      rangeRaw === 'all'
        ? rangeRaw
        : 'all';
    const now = Date.now();
    const since =
      range === 'all'
        ? undefined
        : range === 'ytd'
          ? new Date(new Date(now).getFullYear(), 0, 1)
          : new Date(
              now -
                (range === '1d'
                  ? 86_400_000
                  : range === '1w'
                    ? 7 * 86_400_000
                    : range === '1m'
                      ? 30 * 86_400_000
                      : 365 * 86_400_000),
            );

    const bets = await this.prisma.btcUpdownBet.findMany({
      where: {
        userId: user.id,
        currencyCode: currency,
        status: {
          in: [BtcUpdownBetStatus.WIN, BtcUpdownBetStatus.LOSE],
        },
        ...(since
          ? {
              OR: [
                { settledAt: { gte: since } },
                { settledAt: null, createdAt: { gte: since } },
              ],
            }
          : {}),
      },
      include: {
        round: {
          select: {
            symbol: true,
            roundMs: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 2_000,
    });

    let stakeTotal = 0;
    let wins = 0;
    let losses = 0;
    let pnl = 0;
    let biggestWin = 0;
    const seriesEvents: Array<{ t: number; d: number }> = [];
    const recent: Array<{
      id: number;
      side: string;
      symbol: string;
      roundMs: number;
      stake: number;
      payout: number;
      pnl: number;
      status: string;
      settledAt: string | null;
    }> = [];

    for (const bet of bets) {
      const stake = Number(bet.stake);
      const delta =
        bet.status === BtcUpdownBetStatus.WIN
          ? Number(bet.potentialPayout) - stake
          : -stake;
      const t = (bet.settledAt ?? bet.createdAt).getTime();
      seriesEvents.push({ t, d: delta });
      stakeTotal += stake;
      pnl += delta;
      if (delta > biggestWin) biggestWin = delta;
      if (bet.status === BtcUpdownBetStatus.WIN) wins += 1;
      else losses += 1;
    }

    const settledDesc = [...bets].reverse().slice(0, 50);
    for (const bet of settledDesc) {
      const stake = Number(bet.stake);
      const delta =
        bet.status === BtcUpdownBetStatus.WIN
          ? Number(bet.potentialPayout) - stake
          : -stake;
      recent.push({
        id: bet.id,
        side: bet.side,
        symbol: bet.round.symbol,
        roundMs: bet.round.roundMs,
        stake,
        payout: Number(bet.potentialPayout),
        pnl: Number(delta.toFixed(2)),
        status: bet.status,
        settledAt: bet.settledAt?.toISOString() ?? bet.createdAt.toISOString(),
      });
    }

    seriesEvents.sort((a, b) => a.t - b.t);
    const firstT = seriesEvents[0]?.t ?? now;
    const sinceMs = since?.getTime();
    const startT =
      sinceMs != null ? Math.min(sinceMs, firstT) : firstT;
    let running = 0;
    const series: Array<{ t: number; v: number }> = [{ t: startT, v: 0 }];
    for (const ev of seriesEvents) {
      running += ev.d;
      series.push({ t: ev.t, v: Number(running.toFixed(2)) });
    }
    if (series.length === 1) series.push({ t: now, v: 0 });

    return {
      user: {
        id: user.id,
        name: this.publicPlayerName(user),
        nickname: user.nickname ?? null,
        avatarPreset: user.avatarPreset ?? null,
        avatarUrl: user.avatarUrl ?? null,
        joinedAt: user.createdAt.toISOString(),
      },
      range,
      currencyCode: currency,
      summary: {
        bets: wins + losses,
        wins,
        losses,
        stakeTotal: Number(stakeTotal.toFixed(2)),
        pnl: Number(pnl.toFixed(2)),
        biggestWin: Number(biggestWin.toFixed(2)),
        winRate:
          wins + losses > 0
            ? Number(((wins / (wins + losses)) * 100).toFixed(1))
            : null,
      },
      series,
      recent,
    };
  }

  async placeBet(params: {
    userId: number;
    side: 'UP' | 'DOWN';
    stake: number;
    currencyCode: string;
    symbol?: string;
    roundMs?: number;
    expectedPrice?: number;
  }) {
    const stake = Number(params.stake);
    const currencyCode = (params.currencyCode || 'KZT').toUpperCase();
    const minStake = minStakeForCurrency(currencyCode);
    const maxStake = maxStakeForCurrency(currencyCode);
    if (
      !Number.isFinite(stake) ||
      stake < minStake ||
      stake > maxStake
    ) {
      throw new BadRequestException(
        `Stake must be between ${minStake} and ${maxStake}`,
      );
    }
    if (params.side !== 'UP' && params.side !== 'DOWN') {
      throw new BadRequestException('side must be UP or DOWN');
    }

    await this.refreshHouseDayNet(false);
    if (this.bettingPaused) {
      throw new BadRequestException(
        'Crypto Up/Down временно на паузе (лимит дневного риска). Попробуйте позже.',
      );
    }

    const { symbol, roundMs } = this.parseMarket(params.symbol, params.roundMs);
    const lockMs = lockMsForRound(roundMs);
    const round = await this.ensureCurrentRound(symbol, roundMs);
    const now = Date.now();
    if (round.status !== BtcUpdownRoundStatus.OPEN) {
      throw new BadRequestException('Betting is locked for this round');
    }
    if (now >= round.endsAt.getTime() - lockMs) {
      throw new BadRequestException('Betting closed for this round');
    }
    if (!round.openPrice) {
      throw new BadRequestException('Round price not ready yet');
    }

    const entryPrice = this.price.getLastPrice(symbol);
    if (!entryPrice || !Number.isFinite(entryPrice)) {
      throw new BadRequestException('Live price not ready yet');
    }

    if (
      params.expectedPrice != null &&
      Number.isFinite(params.expectedPrice) &&
      params.expectedPrice > 0
    ) {
      const slip =
        (Math.abs(entryPrice - params.expectedPrice) / params.expectedPrice) *
        10_000;
      if (slip > CRYPTO_UPDOWN_SLIPPAGE_BPS) {
        throw new BadRequestException(
          `Цена изменилась: quote ${params.expectedPrice.toFixed(2)} → live ${entryPrice.toFixed(2)} (slip ${slip.toFixed(1)} bps > ${CRYPTO_UPDOWN_SLIPPAGE_BPS}). Обновите котировку.`,
        );
      }
    }

    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currencyCode: { userId: params.userId, currencyCode },
      },
    });
    if (!balance) {
      throw new BadRequestException('Balance not found');
    }

    const effectiveStake = computeMainAccountBetDebit(
      balance.amount,
      new Decimal(stake),
    );
    if (effectiveStake.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Insufficient funds');
    }

    const odds = new Decimal(oddsForRound(roundMs));
    const potentialPayout = effectiveStake.mul(odds).toDecimalPlaces(2);

    const pendingInRound = await this.prisma.btcUpdownBet.findMany({
      where: {
        roundId: round.id,
        status: BtcUpdownBetStatus.PENDING,
      },
      select: {
        userId: true,
        side: true,
        stake: true,
        potentialPayout: true,
      },
    });

    const userPending = pendingInRound.filter((b) => b.userId === params.userId);
    if (userPending.length >= BTC_UPDOWN_MAX_USER_BETS_PER_ROUND) {
      throw new BadRequestException(
        `Лимит ставок в раунде: максимум ${BTC_UPDOWN_MAX_USER_BETS_PER_ROUND}`,
      );
    }
    const userStakeSum = userPending.reduce(
      (acc, b) => acc + Number(b.stake),
      0,
    );
    if (userStakeSum + Number(effectiveStake) > BTC_UPDOWN_MAX_USER_STAKE_PER_ROUND) {
      throw new BadRequestException(
        `Лимит суммы в раунде: максимум ${BTC_UPDOWN_MAX_USER_STAKE_PER_ROUND}`,
      );
    }

    const sideExposure = pendingInRound
      .filter((b) => b.side === (params.side as BtcUpdownSide))
      .reduce((acc, b) => acc + Number(b.potentialPayout), 0);
    if (sideExposure + Number(potentialPayout) > BTC_UPDOWN_MAX_SIDE_EXPOSURE) {
      throw new BadRequestException(
        `Сторона ${params.side} переполнена на этот раунд. Выберите другую сторону или меньшую сумму.`,
      );
    }

    const bet = await this.prisma.$transaction(async (tx) => {
      const live = await tx.btcUpdownRound.findUnique({
        where: { id: round.id },
      });
      if (!live || live.status !== BtcUpdownRoundStatus.OPEN) {
        throw new BadRequestException('Betting is locked for this round');
      }
      if (Date.now() >= live.endsAt.getTime() - lockMs) {
        throw new BadRequestException('Betting closed for this round');
      }

      await this.operationService.create(tx, params.userId, {
        amount: effectiveStake,
        currencyCode,
        source: OperationSource.BTC_UPDOWN,
        status: OperationStatus.SUCCESS,
        type: OperationType.OUTCOME,
        meta: {
          game: 'btc-updown',
          action: 'place',
          side: params.side,
          roundId: round.id,
          symbol,
          roundMs,
          expectedPrice: params.expectedPrice ?? null,
          entryPrice,
          slippageBps: CRYPTO_UPDOWN_SLIPPAGE_BPS,
        },
      });

      return tx.btcUpdownBet.create({
        data: {
          userId: params.userId,
          roundId: round.id,
          side: params.side as BtcUpdownSide,
          stake: effectiveStake,
          currencyCode,
          odds,
          potentialPayout,
          entryPrice: new Decimal(entryPrice),
          status: BtcUpdownBetStatus.PENDING,
        },
      });
    });

    return {
      ...this.toBetDto(bet),
      audit: this.buildAudit({
        side: bet.side,
        status: bet.status,
        entryPrice: Number(bet.entryPrice),
        openPrice: round.openPrice ? Number(round.openPrice) : null,
        closePrice: null,
        settledAt: null,
        symbol: round.symbol,
        roundMs: round.roundMs,
      }),
    };
  }

  async getMyBets(userId: number, limit = 20) {
    const rows = await this.prisma.btcUpdownBet.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: Math.min(50, Math.max(1, limit)),
      include: { round: true },
    });
    return rows.map((b) => ({
      ...this.toBetDto(b),
      round: this.toRoundDto(b.round),
      audit: this.buildAudit({
        side: b.side,
        status: b.status,
        entryPrice: b.entryPrice != null ? Number(b.entryPrice) : null,
        openPrice: b.round.openPrice ? Number(b.round.openPrice) : null,
        closePrice: b.round.closePrice ? Number(b.round.closePrice) : null,
        settledAt: b.settledAt?.toISOString() ?? null,
        symbol: b.round.symbol,
        roundMs: b.round.roundMs,
      }),
    }));
  }

  private async ensureCurrentRound(
    symbol: CryptoUpdownSymbol,
    roundMs: CryptoUpdownRoundMs,
  ) {
    const now = Date.now();
    const startsAtMs = floorWindowStart(now, roundMs);
    const startsAt = new Date(startsAtMs);
    const endsAt = new Date(startsAtMs + roundMs);

    const existing = await this.prisma.btcUpdownRound.findUnique({
      where: {
        symbol_startsAt_roundMs: { symbol, startsAt, roundMs },
      },
    });
    if (existing) {
      if (!existing.openPrice) {
        const p = this.price.getLastPrice(symbol);
        if (p) {
          return this.prisma.btcUpdownRound.update({
            where: { id: existing.id },
            data: { openPrice: new Decimal(p) },
          });
        }
      }
      return existing;
    }

    const openPrice = this.price.getLastPrice(symbol);
    try {
      return await this.prisma.btcUpdownRound.create({
        data: {
          symbol,
          roundMs,
          startsAt,
          endsAt,
          openPrice: openPrice ? new Decimal(openPrice) : null,
          status: BtcUpdownRoundStatus.OPEN,
        },
      });
    } catch {
      const again = await this.prisma.btcUpdownRound.findUnique({
        where: {
          symbol_startsAt_roundMs: { symbol, startsAt, roundMs },
        },
      });
      if (again) return again;
      throw new BadRequestException('Failed to create crypto round');
    }
  }

  private async lockIfNeeded() {
    const now = Date.now();
    const openRounds = await this.prisma.btcUpdownRound.findMany({
      where: { status: BtcUpdownRoundStatus.OPEN },
      select: { id: true, endsAt: true, roundMs: true },
      take: 40,
    });
    const toLock = openRounds
      .filter((r) => r.endsAt.getTime() - lockMsForRound(r.roundMs) <= now)
      .map((r) => r.id);
    if (!toLock.length) return;
    await this.prisma.btcUpdownRound.updateMany({
      where: { id: { in: toLock } },
      data: { status: BtcUpdownRoundStatus.LOCKED },
    });
  }

  private async settleDueRounds() {
    const due = await this.prisma.btcUpdownRound.findMany({
      where: {
        status: {
          in: [BtcUpdownRoundStatus.OPEN, BtcUpdownRoundStatus.LOCKED],
        },
        endsAt: { lte: new Date() },
      },
      orderBy: { endsAt: 'asc' },
      take: 20,
    });

    for (const round of due) {
      await this.settleRound(round.id);
    }
  }

  private async settleRound(roundId: number) {
    const round = await this.prisma.btcUpdownRound.findUnique({
      where: { id: roundId },
    });
    if (!round) return;
    if (
      round.status === BtcUpdownRoundStatus.SETTLED ||
      round.status === BtcUpdownRoundStatus.VOID
    ) {
      return;
    }

    let closePrice = this.price.getLastPrice(round.symbol);
    const ticksNearEnd = this.price.getTicks(
      round.symbol,
      round.endsAt.getTime() - 5_000,
      round.endsAt.getTime() + 5_000,
    );
    if (ticksNearEnd.length) {
      closePrice = ticksNearEnd[ticksNearEnd.length - 1]!.p;
    }

    const openPrice = round.openPrice ? Number(round.openPrice) : null;
    if (!openPrice || !closePrice) {
      await this.voidRound(roundId);
      return;
    }

    const result: BtcUpdownSide =
      closePrice >= openPrice ? BtcUpdownSide.UP : BtcUpdownSide.DOWN;

    const pending = await this.prisma.btcUpdownBet.findMany({
      where: { roundId, status: BtcUpdownBetStatus.PENDING },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.btcUpdownRound.update({
        where: { id: roundId },
        data: {
          closePrice: new Decimal(closePrice!),
          result,
          status: BtcUpdownRoundStatus.SETTLED,
        },
      });

      for (const bet of pending) {
        const entry =
          bet.entryPrice != null ? Number(bet.entryPrice) : openPrice;
        const won =
          bet.side === BtcUpdownSide.UP
            ? closePrice! >= entry
            : closePrice! < entry;

        if (won) {
          await this.operationService.create(tx, bet.userId, {
            amount: bet.potentialPayout,
            currencyCode: bet.currencyCode,
            source: OperationSource.BTC_UPDOWN,
            status: OperationStatus.SUCCESS,
            type: OperationType.INCOME,
            meta: {
              game: 'btc-updown',
              action: 'win',
              betId: bet.id,
              roundId,
              result,
              entryPrice: entry,
              closePrice,
              symbol: round.symbol,
              roundMs: round.roundMs,
            },
          });
          await tx.btcUpdownBet.update({
            where: { id: bet.id },
            data: {
              status: BtcUpdownBetStatus.WIN,
              settledAt: new Date(),
            },
          });
        } else {
          await tx.btcUpdownBet.update({
            where: { id: bet.id },
            data: {
              status: BtcUpdownBetStatus.LOSE,
              settledAt: new Date(),
            },
          });
        }
      }
    });

    this.logger.log(
      `Settled ${round.symbol}/${round.roundMs}ms #${roundId}: market=${result} open=${openPrice} close=${closePrice} bets=${pending.length}`,
    );

    // Recompute house day PnL after settle (includes this batch).
    await this.refreshHouseDayNet(true);
    if (this.bettingPaused) {
      this.logger.warn(
        `Crypto Up/Down paused: houseDayNet=${this.houseDayNet.toFixed(2)}`,
      );
    }
  }

  private utcDayKey(d = new Date()): string {
    return d.toISOString().slice(0, 10);
  }

  private async refreshHouseDayNet(force: boolean) {
    const key = this.utcDayKey();
    if (!force && this.houseDayKey === key) return;
    this.houseDayKey = key;
    const start = new Date(`${key}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const settled = await this.prisma.btcUpdownBet.findMany({
      where: {
        settledAt: { gte: start, lt: end },
        status: {
          in: [BtcUpdownBetStatus.WIN, BtcUpdownBetStatus.LOSE],
        },
      },
      select: {
        status: true,
        stake: true,
        potentialPayout: true,
      },
    });

    let net = 0;
    for (const bet of settled) {
      const stakeN = Number(bet.stake);
      if (bet.status === BtcUpdownBetStatus.WIN) {
        net -= Number(bet.potentialPayout) - stakeN;
      } else {
        net += stakeN;
      }
    }
    this.houseDayNet = net;
    this.bettingPaused = net <= -BTC_UPDOWN_DAILY_HOUSE_LOSS_PAUSE;
  }

  private async voidRound(roundId: number) {
    const pending = await this.prisma.btcUpdownBet.findMany({
      where: { roundId, status: BtcUpdownBetStatus.PENDING },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.btcUpdownRound.update({
        where: { id: roundId },
        data: { status: BtcUpdownRoundStatus.VOID },
      });

      for (const bet of pending) {
        await this.operationService.create(tx, bet.userId, {
          amount: bet.stake,
          currencyCode: bet.currencyCode,
          source: OperationSource.BTC_UPDOWN,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          meta: {
            game: 'btc-updown',
            action: 'void-refund',
            betId: bet.id,
            roundId,
          },
        });
        await tx.btcUpdownBet.update({
          where: { id: bet.id },
          data: {
            status: BtcUpdownBetStatus.VOID,
            settledAt: new Date(),
          },
        });
      }
    });

    this.logger.warn(
      `Voided crypto round #${roundId} (no price), refunded ${pending.length}`,
    );
  }

  private marketLabel(symbol: string, roundMs: number) {
    const base = symbol.replace('USDT', '');
    const tf =
      roundMs === 60_000 ? '1M' : roundMs === 300_000 ? '5M' : '15M';
    return `${base}/USD · ${tf}`;
  }

  private buildAudit(input: {
    side: BtcUpdownSide;
    status: BtcUpdownBetStatus;
    entryPrice: number | null;
    openPrice: number | null;
    closePrice: number | null;
    settledAt: string | null;
    symbol: string;
    roundMs: number;
  }) {
    const rule =
      input.side === BtcUpdownSide.UP
        ? 'UP wins if closePrice >= entryPrice'
        : 'DOWN wins if closePrice < entryPrice';
    let reason = 'Ожидаем закрытие раунда';
    if (input.status === BtcUpdownBetStatus.VOID) {
      reason = 'Раунд аннулирован — ставка возвращена';
    } else if (
      input.status === BtcUpdownBetStatus.WIN ||
      input.status === BtcUpdownBetStatus.LOSE
    ) {
      if (input.entryPrice != null && input.closePrice != null) {
        const cmp =
          input.side === BtcUpdownSide.UP
            ? `${input.closePrice} ${input.closePrice >= input.entryPrice ? '≥' : '<'} ${input.entryPrice}`
            : `${input.closePrice} ${input.closePrice < input.entryPrice ? '<' : '≥'} ${input.entryPrice}`;
        reason =
          input.status === BtcUpdownBetStatus.WIN
            ? `WIN: ${cmp}`
            : `LOSE: ${cmp}`;
      } else {
        reason = input.status;
      }
    }

    return {
      source: 'binance',
      symbol: input.symbol,
      roundMs: input.roundMs,
      entryPrice: input.entryPrice,
      openPrice: input.openPrice,
      closePrice: input.closePrice,
      rule,
      reason,
      settledAt: input.settledAt,
    };
  }

  private toRoundDto(round: {
    id: number;
    symbol: string;
    roundMs?: number;
    startsAt: Date;
    endsAt: Date;
    openPrice: Decimal | null;
    closePrice: Decimal | null;
    status: BtcUpdownRoundStatus;
    result: BtcUpdownSide | null;
  }) {
    return {
      id: round.id,
      symbol: round.symbol,
      roundMs: round.roundMs ?? BTC_UPDOWN_ROUND_MS,
      startsAt: round.startsAt.toISOString(),
      endsAt: round.endsAt.toISOString(),
      openPrice: round.openPrice ? Number(round.openPrice) : null,
      closePrice: round.closePrice ? Number(round.closePrice) : null,
      status: round.status,
      result: round.result,
    };
  }

  private toBetDto(bet: {
    id: number;
    roundId: number;
    side: BtcUpdownSide;
    stake: Decimal;
    currencyCode: string;
    odds: Decimal;
    potentialPayout: Decimal;
    entryPrice?: Decimal | null;
    status: BtcUpdownBetStatus;
    settledAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: bet.id,
      roundId: bet.roundId,
      side: bet.side,
      stake: Number(bet.stake),
      currencyCode: bet.currencyCode,
      odds: Number(bet.odds),
      potentialPayout: Number(bet.potentialPayout),
      entryPrice: bet.entryPrice != null ? Number(bet.entryPrice) : null,
      status: bet.status,
      settledAt: bet.settledAt?.toISOString() ?? null,
      createdAt: bet.createdAt.toISOString(),
    };
  }
}
