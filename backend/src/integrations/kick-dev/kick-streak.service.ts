import { Injectable, Logger } from '@nestjs/common';
import {
  OperationSource,
  OperationStatus,
  OperationType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import { PrismaService } from '~/prisma/prisma.service';

import {
  KICK_PARTNER_CURRENCY,
  KICK_STREAK_BONUS_USD,
  KICK_STREAK_GOAL,
  KICK_STREAK_TYPE,
} from './kick-affiliate.constants';
import type { KickPartnerMeta } from './kick-partner.types';

export type KickStreakProgress = {
  goal: number;
  current: number;
  bonusUsd: number;
};

@Injectable()
export class KickStreakService {
  private readonly logger = new Logger(KickStreakService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
  ) {}

  private readKickMeta(meta: unknown): KickPartnerMeta {
    if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  /**
   * Текущая серия: сколько завершённых эфиров подряд (от последнего к прошлым)
   * шли с imba-брендингом. Серия рвётся на первом эфире без брендинга.
   */
  async getStreakProgress(partnerUserId: number): Promise<KickStreakProgress> {
    const sessions = await this.prisma.kickPartnerSession.findMany({
      where: { partnerUserId, endedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: KICK_STREAK_GOAL,
      select: { hadBranding: true },
    });

    let current = 0;
    for (const session of sessions) {
      if (!session.hadBranding) break;
      current += 1;
    }

    return { goal: KICK_STREAK_GOAL, current, bonusUsd: KICK_STREAK_BONUS_USD };
  }

  /** Вызывается при завершении эфира. Начисляет бонус за каждые 3 брендированных эфира подряд. */
  async maybeGrantStreak(partnerUserId: number): Promise<boolean> {
    const sessions = await this.prisma.kickPartnerSession.findMany({
      where: { partnerUserId, endedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: KICK_STREAK_GOAL,
      select: { id: true, hadBranding: true },
    });

    if (sessions.length < KICK_STREAK_GOAL) return false;
    if (!sessions.every((session) => session.hadBranding)) return false;

    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    if (!affiliator) return false;

    const kick = this.readKickMeta(affiliator.meta);
    const latestSessionId = sessions[0].id;

    // Каждая сессия закрывает серию максимум один раз: если бонус уже выдан
    // за одну из сессий текущего окна, ждём следующие 3 эфира.
    const lastGrantId = kick.streakBonus?.lastGrantSessionId;
    if (lastGrantId && sessions.some((session) => session.id === lastGrantId)) {
      return false;
    }

    const existing = await this.prisma.operation.findFirst({
      where: {
        userId: partnerUserId,
        source: OperationSource.AFFILIATE,
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        currencyCode: KICK_PARTNER_CURRENCY,
        meta: { path: ['sessionId'], equals: latestSessionId },
      },
      select: { id: true },
    });
    if (existing) return false;

    await this.prisma.$transaction(async (tx) => {
      await this.operationService.create(tx, partnerUserId, {
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        source: OperationSource.AFFILIATE,
        amount: new Decimal(KICK_STREAK_BONUS_USD),
        currencyCode: KICK_PARTNER_CURRENCY,
        meta: {
          bonusType: KICK_STREAK_TYPE,
          reason: 'kick_branding_streak',
          sessionId: latestSessionId,
          streakLength: KICK_STREAK_GOAL,
        },
      });
    });

    const root =
      affiliator.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
        ? { ...(affiliator.meta as Record<string, unknown>) }
        : {};

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: {
          ...root,
          kick: {
            ...kick,
            streakBonus: {
              lastGrantSessionId: latestSessionId,
              grantedAt: new Date().toISOString(),
            },
          },
        },
      },
    });

    this.logger.log(
      `Kick branding streak $${KICK_STREAK_BONUS_USD} → partner ${partnerUserId} (${KICK_STREAK_GOAL} branded streams)`,
    );
    return true;
  }
}
