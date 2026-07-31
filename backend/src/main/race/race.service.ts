import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  OperationSource,
  OperationStatus,
  OperationType,
  RaceBetStatus,
  RaceRoundStatus,
  RaceSide,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { BtcUpdownPriceService } from '~/main/btc-updown/btc-updown-price.service';
import { OperationService } from '~/main/operation/operation.service';
import { PrismaService } from '~/prisma/prisma.service';
import { computeMainAccountBetDebit } from '~/shared/utils/balance-fractional-reserve.util';

import {
  findRacePair,
  floorRaceWindowStart,
  oddsForRaceRound,
  raceLockMs,
  raceMaxStakeForCurrency,
  raceMinStakeForCurrency,
  RACE_DAILY_HOUSE_LOSS_PAUSE,
  RACE_MARKETS,
  RACE_MAX_SIDE_EXPOSURE,
  RACE_MAX_USER_BETS_PER_ROUND,
  RACE_MAX_USER_STAKE_PER_ROUND,
  RACE_PAIRS,
  RACE_DEFAULT_ROUND_MS,
  isRaceRoundMs,
  type RacePairDef,
  type RaceRoundMs,
} from './race.constants';

@Injectable()
export class RaceService implements OnModuleInit {
  private readonly logger = new Logger(RaceService.name);
  private settling = false;
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
      for (const market of RACE_MARKETS) {
        await this.ensureCurrentRound(market.pairKey, market.roundMs);
      }
      await this.settleDueRounds();
    } catch (err) {
      this.logger.error(
        `Race init failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  getConfig() {
    return {
      pairs: RACE_PAIRS.map((p) => this.pairSummary(p)),
      roundOptionsMs: [300_000, 900_000],
      minStakeByCurrency: {
        KZT: raceMinStakeForCurrency('KZT'),
        USD: raceMinStakeForCurrency('USD'),
        USDT: raceMinStakeForCurrency('USDT'),
        RUB: raceMinStakeForCurrency('RUB'),
      },
      maxStakeByCurrency: {
        KZT: raceMaxStakeForCurrency('KZT'),
        USD: raceMaxStakeForCurrency('USD'),
        USDT: raceMaxStakeForCurrency('USDT'),
        RUB: raceMaxStakeForCurrency('RUB'),
      },
      maxSideExposure: RACE_MAX_SIDE_EXPOSURE,
      maxUserStakePerRound: RACE_MAX_USER_STAKE_PER_ROUND,
      maxUserBetsPerRound: RACE_MAX_USER_BETS_PER_ROUND,
      dailyHouseLossPause: RACE_DAILY_HOUSE_LOSS_PAUSE,
      bettingPaused: this.bettingPaused,
      houseDayNet: Number(this.houseDayNet.toFixed(2)),
      currencyDefault: 'KZT',
      source: 'binance',
      settleRule:
        'Winner = the leg with the larger % change from round open to round close. Ties void the round.',
      note: 'In-house "связка" race markets. Derived from live Binance prices, no external market.',
    };
  }

  @Interval(1000)
  async tickEngine() {
    if (this.settling) return;
    this.settling = true;
    try {
      for (const market of RACE_MARKETS) {
        await this.ensureCurrentRound(market.pairKey, market.roundMs);
      }
      await this.lockIfNeeded();
      await this.settleDueRounds();
    } catch (err) {
      this.logger.warn(
        `Race engine tick: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.settling = false;
    }
  }

  parseMarket(pairKeyRaw?: string, roundMsRaw?: number) {
    const pairKey = (pairKeyRaw || RACE_PAIRS[0]!.key).toUpperCase();
    const pair = findRacePair(pairKey);
    if (!pair) {
      throw new BadRequestException(
        `pairKey must be one of ${RACE_PAIRS.map((p) => p.key).join(', ')}`,
      );
    }
    const roundMs = Number(roundMsRaw ?? RACE_DEFAULT_ROUND_MS);
    if (!isRaceRoundMs(roundMs)) {
      throw new BadRequestException('roundMs must be one of 300000, 900000');
    }
    return { pair, roundMs: roundMs as RaceRoundMs };
  }

  async getPublicState(
    userId?: number,
    pairKeyRaw?: string,
    roundMsRaw?: number,
  ) {
    const { pair, roundMs } = this.parseMarket(pairKeyRaw, roundMsRaw);
    const round = await this.ensureCurrentRound(pair.key, roundMs);
    const now = Date.now();
    const lockMs = raceLockMs(roundMs);
    const priceA = this.price.getLastPrice(pair.symbolA);
    const priceB = this.price.getLastPrice(pair.symbolB);
    const openA = round.openPriceA ? Number(round.openPriceA) : null;
    const openB = round.openPriceB ? Number(round.openPriceB) : null;
    const bettingOpen =
      round.status === RaceRoundStatus.OPEN &&
      now < round.endsAt.getTime() - lockMs;

    // Full round window so the Race chart starts at round open, not mid-plot.
    // Cap points a bit higher — 15m rounds need denser history than the live tip.
    const chartWindowMs = Math.max(roundMs + 20_000, 180_000);
    const ticksA = this.price.getChartTicks(pair.symbolA, chartWindowMs, 2_400);
    const ticksB = this.price.getChartTicks(pair.symbolB, chartWindowMs, 2_400);

    let myBets: ReturnType<RaceService['toBetDto']>[] = [];
    if (userId) {
      const bets = await this.prisma.raceBet.findMany({
        where: { userId, roundId: round.id },
        orderBy: { id: 'desc' },
      });
      myBets = bets.map((b) => this.toBetDto(b));
    }

    const recent = await this.prisma.raceRound.findMany({
      where: {
        status: RaceRoundStatus.SETTLED,
        pairKey: pair.key,
        roundMs,
      },
      orderBy: { startsAt: 'desc' },
      take: 12,
    });

    return {
      serverNow: new Date(now).toISOString(),
      pair: this.pairSummary(pair),
      roundMs,
      lockMs,
      odds: oddsForRaceRound(roundMs),
      priceA,
      priceB,
      openPriceA: openA,
      openPriceB: openB,
      changePctA: openA && priceA ? Number((((priceA - openA) / openA) * 100).toFixed(4)) : null,
      changePctB: openB && priceB ? Number((((priceB - openB) / openB) * 100).toFixed(4)) : null,
      bettingOpen,
      msToLock: Math.max(0, round.endsAt.getTime() - lockMs - now),
      msToEnd: Math.max(0, round.endsAt.getTime() - now),
      round: this.toRoundDto(round),
      ticksA,
      ticksB,
      myBets,
      recentRounds: recent.map((r) => this.toRoundDto(r)),
    };
  }

  async getMyBets(userId: number, limit = 20) {
    const rows = await this.prisma.raceBet.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: Math.min(50, Math.max(1, limit)),
      include: { round: true },
    });
    return rows.map((b) => ({
      ...this.toBetDto(b),
      round: this.toRoundDto(b.round),
      pair: this.pairSummary(findRacePair(b.round.pairKey) ?? RACE_PAIRS[0]!),
    }));
  }

  async placeBet(params: {
    userId: number;
    pairKey: string;
    side: 'A' | 'B';
    stake: number;
    currencyCode: string;
    roundMs?: number;
  }) {
    const stake = Number(params.stake);
    const currencyCode = (params.currencyCode || 'KZT').toUpperCase();
    const minStake = raceMinStakeForCurrency(currencyCode);
    const maxStake = raceMaxStakeForCurrency(currencyCode);
    if (!Number.isFinite(stake) || stake < minStake || stake > maxStake) {
      throw new BadRequestException(
        `Stake must be between ${minStake} and ${maxStake}`,
      );
    }
    if (params.side !== 'A' && params.side !== 'B') {
      throw new BadRequestException('side must be A or B');
    }

    await this.refreshHouseDayNet(false);
    if (this.bettingPaused) {
      throw new BadRequestException(
        'Race-рынки временно на паузе (лимит дневного риска). Попробуйте позже.',
      );
    }

    const { pair, roundMs } = this.parseMarket(params.pairKey, params.roundMs);
    const lockMs = raceLockMs(roundMs);
    const round = await this.ensureCurrentRound(pair.key, roundMs);
    const now = Date.now();
    if (round.status !== RaceRoundStatus.OPEN) {
      throw new BadRequestException('Betting is locked for this round');
    }
    if (now >= round.endsAt.getTime() - lockMs) {
      throw new BadRequestException('Betting closed for this round');
    }
    if (!round.openPriceA || !round.openPriceB) {
      throw new BadRequestException('Round price not ready yet');
    }

    const balance = await this.prisma.balance.findUnique({
      where: { userId_currencyCode: { userId: params.userId, currencyCode } },
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

    const odds = new Decimal(oddsForRaceRound(roundMs));
    const potentialPayout = effectiveStake.mul(odds).toDecimalPlaces(2);

    const pendingInRound = await this.prisma.raceBet.findMany({
      where: { roundId: round.id, status: RaceBetStatus.PENDING },
      select: { userId: true, side: true, stake: true, potentialPayout: true },
    });

    const userPending = pendingInRound.filter((b) => b.userId === params.userId);
    if (userPending.length >= RACE_MAX_USER_BETS_PER_ROUND) {
      throw new BadRequestException(
        `Лимит ставок в раунде: максимум ${RACE_MAX_USER_BETS_PER_ROUND}`,
      );
    }
    const userStakeSum = userPending.reduce((acc, b) => acc + Number(b.stake), 0);
    if (userStakeSum + Number(effectiveStake) > RACE_MAX_USER_STAKE_PER_ROUND) {
      throw new BadRequestException(
        `Лимит суммы в раунде: максимум ${RACE_MAX_USER_STAKE_PER_ROUND}`,
      );
    }
    const sideExposure = pendingInRound
      .filter((b) => b.side === (params.side as RaceSide))
      .reduce((acc, b) => acc + Number(b.potentialPayout), 0);
    if (sideExposure + Number(potentialPayout) > RACE_MAX_SIDE_EXPOSURE) {
      throw new BadRequestException(
        `Нога ${params.side === 'A' ? pair.shortA : pair.shortB} переполнена на этот раунд. Выберите другую сторону или меньшую сумму.`,
      );
    }

    const bet = await this.prisma.$transaction(async (tx) => {
      const live = await tx.raceRound.findUnique({ where: { id: round.id } });
      if (!live || live.status !== RaceRoundStatus.OPEN) {
        throw new BadRequestException('Betting is locked for this round');
      }
      if (Date.now() >= live.endsAt.getTime() - lockMs) {
        throw new BadRequestException('Betting closed for this round');
      }

      await this.operationService.create(tx, params.userId, {
        amount: effectiveStake,
        currencyCode,
        source: OperationSource.RACE,
        status: OperationStatus.SUCCESS,
        type: OperationType.OUTCOME,
        meta: {
          game: 'race',
          action: 'place',
          side: params.side,
          roundId: round.id,
          pairKey: pair.key,
          roundMs,
        },
      });

      return tx.raceBet.create({
        data: {
          userId: params.userId,
          roundId: round.id,
          side: params.side as RaceSide,
          stake: effectiveStake,
          currencyCode,
          odds,
          potentialPayout,
          status: RaceBetStatus.PENDING,
        },
      });
    });

    return this.toBetDto(bet);
  }

  private async ensureCurrentRound(pairKey: string, roundMs: RaceRoundMs) {
    const pair = findRacePair(pairKey);
    if (!pair) throw new BadRequestException('Unknown race pair');
    const now = Date.now();
    const startsAtMs = floorRaceWindowStart(now, roundMs);
    const startsAt = new Date(startsAtMs);
    const endsAt = new Date(startsAtMs + roundMs);

    const existing = await this.prisma.raceRound.findUnique({
      where: { pairKey_startsAt_roundMs: { pairKey: pair.key, startsAt, roundMs } },
    });
    if (existing) {
      if (!existing.openPriceA || !existing.openPriceB) {
        const a = this.price.getLastPrice(pair.symbolA);
        const b = this.price.getLastPrice(pair.symbolB);
        if (a && b) {
          return this.prisma.raceRound.update({
            where: { id: existing.id },
            data: { openPriceA: new Decimal(a), openPriceB: new Decimal(b) },
          });
        }
      }
      return existing;
    }

    const a = this.price.getLastPrice(pair.symbolA);
    const b = this.price.getLastPrice(pair.symbolB);
    try {
      return await this.prisma.raceRound.create({
        data: {
          pairKey: pair.key,
          symbolA: pair.symbolA,
          symbolB: pair.symbolB,
          roundMs,
          startsAt,
          endsAt,
          openPriceA: a ? new Decimal(a) : null,
          openPriceB: b ? new Decimal(b) : null,
          status: RaceRoundStatus.OPEN,
        },
      });
    } catch {
      const again = await this.prisma.raceRound.findUnique({
        where: { pairKey_startsAt_roundMs: { pairKey: pair.key, startsAt, roundMs } },
      });
      if (again) return again;
      throw new BadRequestException('Failed to create race round');
    }
  }

  private async lockIfNeeded() {
    const now = Date.now();
    const openRounds = await this.prisma.raceRound.findMany({
      where: { status: RaceRoundStatus.OPEN },
      select: { id: true, endsAt: true, roundMs: true },
      take: 40,
    });
    const toLock = openRounds
      .filter((r) => r.endsAt.getTime() - raceLockMs(r.roundMs) <= now)
      .map((r) => r.id);
    if (!toLock.length) return;
    await this.prisma.raceRound.updateMany({
      where: { id: { in: toLock } },
      data: { status: RaceRoundStatus.LOCKED },
    });
  }

  private async settleDueRounds() {
    const due = await this.prisma.raceRound.findMany({
      where: {
        status: { in: [RaceRoundStatus.OPEN, RaceRoundStatus.LOCKED] },
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
    const round = await this.prisma.raceRound.findUnique({ where: { id: roundId } });
    if (!round) return;
    if (round.status === RaceRoundStatus.SETTLED || round.status === RaceRoundStatus.VOID) {
      return;
    }

    const closeA = this.lastPriceNear(round.symbolA, round.endsAt.getTime());
    const closeB = this.lastPriceNear(round.symbolB, round.endsAt.getTime());
    const openA = round.openPriceA ? Number(round.openPriceA) : null;
    const openB = round.openPriceB ? Number(round.openPriceB) : null;

    if (!openA || !openB || !closeA || !closeB) {
      await this.voidRound(roundId);
      return;
    }

    const pctA = (closeA - openA) / openA;
    const pctB = (closeB - openB) / openB;

    if (pctA === pctB) {
      await this.voidRound(roundId);
      return;
    }

    const result: RaceSide = pctA > pctB ? RaceSide.A : RaceSide.B;

    const pending = await this.prisma.raceBet.findMany({
      where: { roundId, status: RaceBetStatus.PENDING },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.raceRound.update({
        where: { id: roundId },
        data: {
          closePriceA: new Decimal(closeA),
          closePriceB: new Decimal(closeB),
          result,
          status: RaceRoundStatus.SETTLED,
        },
      });

      for (const bet of pending) {
        const won = bet.side === result;
        if (won) {
          await this.operationService.create(tx, bet.userId, {
            amount: bet.potentialPayout,
            currencyCode: bet.currencyCode,
            source: OperationSource.RACE,
            status: OperationStatus.SUCCESS,
            type: OperationType.INCOME,
            meta: {
              game: 'race',
              action: 'win',
              betId: bet.id,
              roundId,
              result,
              pctA: Number((pctA * 100).toFixed(4)),
              pctB: Number((pctB * 100).toFixed(4)),
              pairKey: round.pairKey,
              roundMs: round.roundMs,
            },
          });
          await tx.raceBet.update({
            where: { id: bet.id },
            data: { status: RaceBetStatus.WIN, settledAt: new Date() },
          });
        } else {
          await tx.raceBet.update({
            where: { id: bet.id },
            data: { status: RaceBetStatus.LOSE, settledAt: new Date() },
          });
        }
      }
    });

    this.logger.log(
      `Settled race ${round.pairKey}/${round.roundMs}ms #${roundId}: winner=${result} pctA=${(pctA * 100).toFixed(3)}% pctB=${(pctB * 100).toFixed(3)}% bets=${pending.length}`,
    );

    await this.refreshHouseDayNet(true);
    if (this.bettingPaused) {
      this.logger.warn(`Race markets paused: houseDayNet=${this.houseDayNet.toFixed(2)}`);
    }
  }

  private lastPriceNear(symbol: string, atMs: number): number | null {
    const ticks = this.price.getTicks(symbol, atMs - 5_000, atMs + 5_000);
    if (ticks.length) return ticks[ticks.length - 1]!.p;
    return this.price.getLastPrice(symbol);
  }

  private async voidRound(roundId: number) {
    const pending = await this.prisma.raceBet.findMany({
      where: { roundId, status: RaceBetStatus.PENDING },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.raceRound.update({
        where: { id: roundId },
        data: { status: RaceRoundStatus.VOID },
      });

      for (const bet of pending) {
        await this.operationService.create(tx, bet.userId, {
          amount: bet.stake,
          currencyCode: bet.currencyCode,
          source: OperationSource.RACE,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          meta: { game: 'race', action: 'void-refund', betId: bet.id, roundId },
        });
        await tx.raceBet.update({
          where: { id: bet.id },
          data: { status: RaceBetStatus.VOID, settledAt: new Date() },
        });
      }
    });

    this.logger.warn(`Voided race round #${roundId} (no price/tie), refunded ${pending.length}`);
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

    const settled = await this.prisma.raceBet.findMany({
      where: {
        settledAt: { gte: start, lt: end },
        status: { in: [RaceBetStatus.WIN, RaceBetStatus.LOSE] },
      },
      select: { status: true, stake: true, potentialPayout: true },
    });

    let net = 0;
    for (const bet of settled) {
      const stakeN = Number(bet.stake);
      if (bet.status === RaceBetStatus.WIN) {
        net -= Number(bet.potentialPayout) - stakeN;
      } else {
        net += stakeN;
      }
    }
    this.houseDayNet = net;
    this.bettingPaused = net <= -RACE_DAILY_HOUSE_LOSS_PAUSE;
  }

  private pairSummary(pair: RacePairDef) {
    return {
      key: pair.key,
      symbolA: pair.symbolA,
      symbolB: pair.symbolB,
      shortA: pair.shortA,
      shortB: pair.shortB,
      name: pair.name,
      tagline: pair.tagline,
    };
  }

  private toRoundDto(round: {
    id: number;
    pairKey: string;
    symbolA: string;
    symbolB: string;
    roundMs: number;
    startsAt: Date;
    endsAt: Date;
    openPriceA: Decimal | null;
    openPriceB: Decimal | null;
    closePriceA: Decimal | null;
    closePriceB: Decimal | null;
    status: RaceRoundStatus;
    result: RaceSide | null;
  }) {
    return {
      id: round.id,
      pairKey: round.pairKey,
      symbolA: round.symbolA,
      symbolB: round.symbolB,
      roundMs: round.roundMs,
      startsAt: round.startsAt.toISOString(),
      endsAt: round.endsAt.toISOString(),
      openPriceA: round.openPriceA ? Number(round.openPriceA) : null,
      openPriceB: round.openPriceB ? Number(round.openPriceB) : null,
      closePriceA: round.closePriceA ? Number(round.closePriceA) : null,
      closePriceB: round.closePriceB ? Number(round.closePriceB) : null,
      status: round.status,
      result: round.result,
    };
  }

  private toBetDto(bet: {
    id: number;
    roundId: number;
    side: RaceSide;
    stake: Decimal;
    currencyCode: string;
    odds: Decimal;
    potentialPayout: Decimal;
    status: RaceBetStatus;
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
      status: bet.status,
      settledAt: bet.settledAt?.toISOString() ?? null,
      createdAt: bet.createdAt.toISOString(),
    };
  }
}
