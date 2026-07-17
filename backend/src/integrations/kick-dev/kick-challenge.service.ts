import { Injectable, Logger } from '@nestjs/common';
import {
  OperationSource,
  OperationStatus,
  OperationType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import { parseAffiliateSubsJson } from '~/main/partners/affiliate-subs.util';
import { PrismaService } from '~/prisma/prisma.service';

import {
  KICK_PARTNER_CURRENCY,
  KICK_WEEKLY_CHALLENGE_BONUS_USD,
  KICK_WEEKLY_CHALLENGE_GOAL,
  KICK_WEEKLY_CHALLENGE_TYPE,
} from './kick-affiliate.constants';
import type { KickPartnerMeta } from './kick-partner.types';

@Injectable()
export class KickChallengeService {
  private readonly logger = new Logger(KickChallengeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
  ) {}

  weekKey(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNo =
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
      );
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  weekEndsAt(date = new Date()) {
    const end = new Date(date);
    const day = end.getDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    end.setDate(end.getDate() + daysUntilSunday);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private readKickMeta(meta: unknown): KickPartnerMeta {
    if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  async countWeeklyKickRegistrations(partnerUserId: number): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const referred = await this.prisma.user.findMany({
      where: {
        affiliatedById: partnerUserId,
        createdAt: { gte: since },
      },
      select: { affiliateSubs: true },
    });

    return referred.filter((row) => {
      const subs = parseAffiliateSubsJson(row.affiliateSubs);
      return subs.sub1?.toLowerCase() === 'kick';
    }).length;
  }

  async maybeGrantWeeklyChallenge(partnerUserId: number): Promise<boolean> {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true, kickChannelSlug: true },
    });
    if (!affiliator?.kickChannelSlug) return false;

    const kick = this.readKickMeta(affiliator.meta);
    const currentWeek = this.weekKey();
    if (kick.weeklyChallenge?.weekKey === currentWeek && kick.weeklyChallenge?.grantedAt) {
      return false;
    }

    const kickRegs = await this.countWeeklyKickRegistrations(partnerUserId);
    if (kickRegs < KICK_WEEKLY_CHALLENGE_GOAL) return false;

    const existing = await this.prisma.operation.findMany({
      where: {
        userId: partnerUserId,
        source: OperationSource.AFFILIATE,
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        currencyCode: KICK_PARTNER_CURRENCY,
        createdAt: { gte: new Date(Date.now() - 8 * 86_400_000) },
      },
      select: { meta: true },
      take: 50,
    });
    const alreadyGranted = existing.some((op) => {
      const meta = (op.meta ?? {}) as Record<string, unknown>;
      return meta.bonusType === KICK_WEEKLY_CHALLENGE_TYPE;
    });
    if (alreadyGranted) return false;

    await this.prisma.$transaction(async (tx) => {
      await this.operationService.create(tx, partnerUserId, {
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        source: OperationSource.AFFILIATE,
        amount: new Decimal(KICK_WEEKLY_CHALLENGE_BONUS_USD),
        currencyCode: KICK_PARTNER_CURRENCY,
        meta: {
          bonusType: KICK_WEEKLY_CHALLENGE_TYPE,
          reason: 'kick_weekly_challenge',
          weekKey: currentWeek,
          kickRegistrations: kickRegs,
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
            weeklyChallenge: {
              weekKey: currentWeek,
              grantedAt: new Date().toISOString(),
            },
          },
        },
      },
    });

    this.logger.log(
      `Kick weekly challenge $${KICK_WEEKLY_CHALLENGE_BONUS_USD} → partner ${partnerUserId} (${kickRegs} regs)`,
    );
    return true;
  }
}
