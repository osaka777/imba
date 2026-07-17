import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OperationSource,
  OperationStatus,
  OperationType,
  SnakeRoundStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import { PrismaService } from '~/prisma/prisma.service';
import { computeMainAccountBetDebit } from '~/shared/utils/balance-fractional-reserve.util';

import {
  computeSnakeMultiplier,
  computeSnakePayout,
  SNAKE_MAX_MULTIPLIER,
  SNAKE_MAX_STAKE,
  SNAKE_MIN_STAKE,
} from './snake-multiplier.util';

/** After this, PENDING rounds auto-lose (refresh / AFK / closed tab). */
const SNAKE_MAX_ROUND_MS = 90_000;
const HEARTBEAT_GAP_CAP_MS = 800;

type BoostTracker = {
  userId: number;
  boostMs: number;
  lastAt: number;
  boosting: boolean;
};

@Injectable()
export class SnakeService {
  /** In-process boost accounting — authoritative for burn. */
  private readonly boostByRound = new Map<number, BoostTracker>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
    private readonly config: ConfigService,
  ) {}

  getConfig() {
    return {
      minStake: Number(this.config.get('SNAKE_MIN_STAKE') ?? SNAKE_MIN_STAKE),
      maxStake: Number(this.config.get('SNAKE_MAX_STAKE') ?? SNAKE_MAX_STAKE),
      maxMultiplier: SNAKE_MAX_MULTIPLIER,
      maxRoundMs: SNAKE_MAX_ROUND_MS,
      currencyDefault: 'KZT',
    };
  }

  private async findPending(userId: number) {
    return this.prisma.snakeRound.findFirst({
      where: { userId, status: SnakeRoundStatus.PENDING },
      orderBy: { id: 'desc' },
    });
  }

  private ensureTracker(roundId: number, userId: number): BoostTracker {
    let t = this.boostByRound.get(roundId);
    if (!t) {
      t = { userId, boostMs: 0, lastAt: Date.now(), boosting: false };
      this.boostByRound.set(roundId, t);
    }
    return t;
  }

  private flushBoost(tracker: BoostTracker, now = Date.now()) {
    if (!tracker.boosting) {
      tracker.lastAt = now;
      return;
    }
    const delta = Math.min(HEARTBEAT_GAP_CAP_MS, Math.max(0, now - tracker.lastAt));
    tracker.boostMs += delta;
    tracker.lastAt = now;
  }

  private takeServerBoostMs(roundId: number, userId: number, elapsedMs: number): number {
    const t = this.boostByRound.get(roundId);
    if (!t || t.userId !== userId) return 0;
    this.flushBoost(t);
    return Math.max(0, Math.min(t.boostMs, elapsedMs));
  }

  private clearTracker(roundId: number) {
    this.boostByRound.delete(roundId);
  }

  /** Mark abandoned / timed-out PENDING rounds as LOST. */
  private async expireIfStale(round: {
    id: number;
    startedAt: Date;
    status: SnakeRoundStatus;
  }) {
    if (round.status !== SnakeRoundStatus.PENDING) return null;
    const age = Date.now() - round.startedAt.getTime();
    if (age < SNAKE_MAX_ROUND_MS) return null;
    this.clearTracker(round.id);
    return this.prisma.snakeRound.update({
      where: { id: round.id },
      data: {
        status: SnakeRoundStatus.LOST,
        multiplier: new Decimal(1),
        payout: new Decimal(0),
        lengthAtEnd: 0,
        killsAtEnd: 0,
        boostMs: 0,
        elapsedMs: age,
        settledAt: new Date(),
      },
    });
  }

  async getActiveRound(userId: number) {
    const existing = await this.findPending(userId);
    if (!existing) return null;
    const expired = await this.expireIfStale(existing);
    if (expired) return null;
    return this.toDto(existing);
  }

  async getHistory(userId: number, limit = 10) {
    const rows = await this.prisma.snakeRound.findMany({
      where: {
        userId,
        status: { in: [SnakeRoundStatus.CASHED_OUT, SnakeRoundStatus.LOST] },
      },
      orderBy: { id: 'desc' },
      take: Math.min(20, Math.max(1, limit)),
    });
    return rows.map((r) => this.toDto(r));
  }

  async placeRound(params: {
    userId: number;
    stake: number;
    currencyCode: string;
  }) {
    const cfg = this.getConfig();
    const stake = Number(params.stake);
    if (!Number.isFinite(stake) || stake < cfg.minStake || stake > cfg.maxStake) {
      throw new BadRequestException(
        `Stake must be between ${cfg.minStake} and ${cfg.maxStake}`,
      );
    }

    const currencyCode = (params.currencyCode || 'KZT').toUpperCase();
    const existing = await this.findPending(params.userId);
    if (existing) {
      const expired = await this.expireIfStale(existing);
      if (!expired) {
        throw new BadRequestException('You already have an active Snake round');
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

    const effectiveStake = computeMainAccountBetDebit(balance.amount, new Decimal(stake));
    if (effectiveStake.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Insufficient funds');
    }

    const round = await this.prisma.$transaction(async (tx) => {
      await this.operationService.create(tx, params.userId, {
        amount: effectiveStake,
        currencyCode,
        source: OperationSource.SNAKE,
        status: OperationStatus.SUCCESS,
        type: OperationType.OUTCOME,
        meta: { game: 'snake', action: 'place' },
      });

      return tx.snakeRound.create({
        data: {
          userId: params.userId,
          stake: effectiveStake,
          currencyCode,
          status: SnakeRoundStatus.PENDING,
        },
      });
    });

    this.ensureTracker(round.id, params.userId);
    return this.toDto(round);
  }

  async heartbeat(params: {
    userId: number;
    roundId: number;
    boosting: boolean;
    length?: number;
    kills?: number;
  }) {
    const round = await this.prisma.snakeRound.findUnique({
      where: { id: params.roundId },
    });
    if (!round || round.userId !== params.userId) {
      throw new NotFoundException('Round not found');
    }
    if (round.status !== SnakeRoundStatus.PENDING) {
      throw new BadRequestException('Round already settled');
    }
    const age = Date.now() - round.startedAt.getTime();
    if (age >= SNAKE_MAX_ROUND_MS) {
      await this.expireIfStale(round);
      throw new BadRequestException('Round expired');
    }

    const tracker = this.ensureTracker(round.id, params.userId);
    this.flushBoost(tracker);
    tracker.boosting = Boolean(params.boosting);

    return {
      ok: true,
      boostMs: Math.min(tracker.boostMs, age),
      serverNow: new Date().toISOString(),
      elapsedMs: age,
    };
  }

  async cashout(params: {
    userId: number;
    roundId: number;
    length: number;
    kills: number;
    boostMs?: number;
  }) {
    const round = await this.prisma.snakeRound.findUnique({
      where: { id: params.roundId },
    });
    if (!round || round.userId !== params.userId) {
      throw new NotFoundException('Round not found');
    }
    if (round.status !== SnakeRoundStatus.PENDING) {
      throw new BadRequestException('Round already settled');
    }

    const age = Date.now() - round.startedAt.getTime();
    if (age >= SNAKE_MAX_ROUND_MS) {
      await this.expireIfStale(round);
      throw new BadRequestException('Round expired');
    }
    if (age < 1_500) {
      throw new BadRequestException('Cash out available after 1.5s');
    }

    const elapsedMs = Math.min(age, SNAKE_MAX_ROUND_MS);
    // Server heartbeat is source of truth; client value cannot reduce burn.
    const serverBoost = this.takeServerBoostMs(round.id, params.userId, elapsedMs);
    const clientBoost = Math.max(0, Math.min(params.boostMs ?? 0, elapsedMs));
    const boostMs = Math.max(serverBoost, clientBoost);
    const multiplier = computeSnakeMultiplier(
      elapsedMs,
      params.length,
      params.kills,
    );
    const stake = Number(round.stake);
    const payoutNum = computeSnakePayout(stake, multiplier, boostMs, elapsedMs);
    const payout = new Decimal(payoutNum);

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.snakeRound.findUnique({ where: { id: round.id } });
      if (!locked || locked.status !== SnakeRoundStatus.PENDING) {
        throw new BadRequestException('Round already settled');
      }

      await this.operationService.create(tx, params.userId, {
        amount: payout,
        currencyCode: round.currencyCode,
        source: OperationSource.SNAKE,
        status: OperationStatus.SUCCESS,
        type: OperationType.INCOME,
        meta: {
          game: 'snake',
          action: 'cashout',
          roundId: round.id,
          multiplier,
          boostMs,
          serverBoost,
          clientBoost,
        },
      });

      return tx.snakeRound.update({
        where: { id: round.id },
        data: {
          status: SnakeRoundStatus.CASHED_OUT,
          multiplier: new Decimal(multiplier),
          payout,
          lengthAtEnd: Math.floor(params.length),
          killsAtEnd: Math.floor(params.kills),
          boostMs: Math.floor(boostMs),
          elapsedMs,
          settledAt: new Date(),
        },
      });
    });

    this.clearTracker(round.id);
    return this.toDto(updated);
  }

  async crash(params: {
    userId: number;
    roundId: number;
    length: number;
    kills: number;
    boostMs?: number;
  }) {
    const round = await this.prisma.snakeRound.findUnique({
      where: { id: params.roundId },
    });
    if (!round || round.userId !== params.userId) {
      throw new NotFoundException('Round not found');
    }
    if (round.status !== SnakeRoundStatus.PENDING) {
      return this.toDto(round);
    }

    const elapsedMs = Math.min(
      Date.now() - round.startedAt.getTime(),
      SNAKE_MAX_ROUND_MS,
    );
    const serverBoost = this.takeServerBoostMs(round.id, params.userId, elapsedMs);
    const clientBoost = Math.max(0, Math.min(params.boostMs ?? 0, elapsedMs));
    const boostMs = Math.max(serverBoost, clientBoost);
    const multiplier = computeSnakeMultiplier(
      elapsedMs,
      params.length,
      params.kills,
    );

    const updated = await this.prisma.snakeRound.update({
      where: { id: round.id },
      data: {
        status: SnakeRoundStatus.LOST,
        multiplier: new Decimal(multiplier),
        payout: new Decimal(0),
        lengthAtEnd: Math.floor(params.length),
        killsAtEnd: Math.floor(params.kills),
        boostMs: Math.floor(boostMs),
        elapsedMs,
        settledAt: new Date(),
      },
    });

    this.clearTracker(round.id);
    return this.toDto(updated);
  }

  private toDto(round: {
    id: number;
    stake: Decimal;
    currencyCode: string;
    status: SnakeRoundStatus;
    multiplier: Decimal | null;
    payout: Decimal | null;
    lengthAtEnd: number | null;
    killsAtEnd: number | null;
    boostMs?: number | null;
    elapsedMs: number | null;
    startedAt: Date;
    settledAt: Date | null;
  }) {
    return {
      id: round.id,
      stake: Number(round.stake),
      currencyCode: round.currencyCode,
      status: round.status,
      multiplier: round.multiplier != null ? Number(round.multiplier) : null,
      payout: round.payout != null ? Number(round.payout) : null,
      lengthAtEnd: round.lengthAtEnd,
      killsAtEnd: round.killsAtEnd,
      boostMs: round.boostMs ?? null,
      elapsedMs: round.elapsedMs,
      startedAt: round.startedAt.toISOString(),
      settledAt: round.settledAt?.toISOString() ?? null,
      serverNow: new Date().toISOString(),
    };
  }
}
