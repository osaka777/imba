import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  OperationSource,
  OperationStatus,
  OperationType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import { TelegramNotifyService } from '~/main/telegram/telegram-notify.service';
import { parseAffiliateSubsJson } from '~/main/partners/affiliate-subs.util';
import { PrismaService } from '~/prisma/prisma.service';

import {
  KICK_MONTH_SPRINT_BONUS_USD,
  KICK_MONTH_SPRINT_MIN_REGS,
  KICK_MONTH_SPRINT_TYPE,
  KICK_PARTNER_CURRENCY,
} from './kick-affiliate.constants';
import type { KickPartnerMeta } from './kick-partner.types';

export type KickMonthSprintStanding = {
  monthKey: string;
  endsAt: string;
  bonusUsd: number;
  minRegs: number;
  leader: {
    channelSlug: string;
    kickRegistrations: number;
  } | null;
};

@Injectable()
export class KickMonthSprintService {
  private readonly logger = new Logger(KickMonthSprintService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
    private readonly telegram: TelegramNotifyService,
  ) {}

  private monthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private monthRange(monthKey: string) {
    const [year, month] = monthKey.split('-').map(Number);
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);
    return { start, end };
  }

  private readKickMeta(meta: unknown): KickPartnerMeta {
    if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  private async computeLeaderboard(monthKey: string) {
    const { start, end } = this.monthRange(monthKey);

    const partners = await this.prisma.affilator.findMany({
      where: { kickChannelSlug: { not: null }, status: 'ACTIVE' },
      select: { userId: true, kickChannelSlug: true, meta: true },
    });
    if (partners.length === 0) return [];

    const referred = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        affiliatedById: { in: partners.map((p) => p.userId) },
      },
      select: { affiliatedById: true, affiliateSubs: true },
    });

    const regs = new Map<number, number>();
    for (const row of referred) {
      if (!row.affiliatedById) continue;
      const subs = parseAffiliateSubsJson(row.affiliateSubs);
      if (subs.sub1?.toLowerCase() !== 'kick') continue;
      regs.set(row.affiliatedById, (regs.get(row.affiliatedById) ?? 0) + 1);
    }

    return partners
      .map((partner) => ({
        partnerUserId: partner.userId,
        channelSlug: partner.kickChannelSlug ?? '',
        kickRegistrations: regs.get(partner.userId) ?? 0,
        meta: partner.meta,
      }))
      .filter((item) => item.kickRegistrations > 0)
      .sort((a, b) => b.kickRegistrations - a.kickRegistrations);
  }

  /** Текущее положение спринта — для публичного табло. */
  async getCurrentStanding(): Promise<KickMonthSprintStanding> {
    const monthKey = this.monthKey();
    const { end } = this.monthRange(monthKey);
    const leaderboard = await this.computeLeaderboard(monthKey);
    const top = leaderboard[0] ?? null;

    return {
      monthKey,
      endsAt: new Date(end.getTime() - 1).toISOString(),
      bonusUsd: KICK_MONTH_SPRINT_BONUS_USD,
      minRegs: KICK_MONTH_SPRINT_MIN_REGS,
      leader: top
        ? { channelSlug: top.channelSlug, kickRegistrations: top.kickRegistrations }
        : null,
    };
  }

  /** 1-го числа в 12:00 — награда лучшему каналу прошлого месяца. */
  @Cron('0 12 1 * *')
  async grantPreviousMonthSprint() {
    if (this.running) return;
    this.running = true;

    try {
      const prev = new Date();
      prev.setDate(0); // последний день прошлого месяца
      const monthKey = this.monthKey(prev);

      const leaderboard = await this.computeLeaderboard(monthKey);
      const winner = leaderboard[0];
      if (!winner || winner.kickRegistrations < KICK_MONTH_SPRINT_MIN_REGS) {
        this.logger.log(
          `Kick month sprint ${monthKey}: no winner (top regs: ${winner?.kickRegistrations ?? 0}, min: ${KICK_MONTH_SPRINT_MIN_REGS})`,
        );
        return;
      }

      const kick = this.readKickMeta(winner.meta);
      if (kick.monthSprint?.monthKey === monthKey && kick.monthSprint?.grantedAt) {
        return;
      }

      const existing = await this.prisma.operation.findFirst({
        where: {
          userId: winner.partnerUserId,
          source: OperationSource.AFFILIATE,
          type: OperationType.INCOME,
          status: OperationStatus.SUCCESS,
          currencyCode: KICK_PARTNER_CURRENCY,
          meta: { path: ['monthKey'], equals: monthKey },
        },
        select: { id: true },
      });
      if (existing) return;

      await this.prisma.$transaction(async (tx) => {
        await this.operationService.create(tx, winner.partnerUserId, {
          type: OperationType.INCOME,
          status: OperationStatus.SUCCESS,
          source: OperationSource.AFFILIATE,
          amount: new Decimal(KICK_MONTH_SPRINT_BONUS_USD),
          currencyCode: KICK_PARTNER_CURRENCY,
          meta: {
            bonusType: KICK_MONTH_SPRINT_TYPE,
            reason: 'kick_month_sprint',
            monthKey,
            kickRegistrations: winner.kickRegistrations,
          },
        });
      });

      const affiliator = await this.prisma.affilator.findUnique({
        where: { userId: winner.partnerUserId },
        select: { meta: true },
      });
      const root =
        affiliator?.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
          ? { ...(affiliator.meta as Record<string, unknown>) }
          : {};
      const currentKick = this.readKickMeta(affiliator?.meta ?? null);

      await this.prisma.affilator.update({
        where: { userId: winner.partnerUserId },
        data: {
          meta: {
            ...root,
            kick: {
              ...currentKick,
              monthSprint: { monthKey, grantedAt: new Date().toISOString() },
            },
          },
        },
      });

      this.logger.log(
        `Kick month sprint ${monthKey}: $${KICK_MONTH_SPRINT_BONUS_USD} → @${winner.channelSlug} (${winner.kickRegistrations} regs)`,
      );

      void this.telegram.sendSupportMessage(
        [
          `🏆 Kick спринт месяца (${monthKey})`,
          `Победитель: @${winner.channelSlug}`,
          `Регистраций: ${winner.kickRegistrations}`,
          `Начислено: $${KICK_MONTH_SPRINT_BONUS_USD}`,
        ].join('\n'),
      );
    } finally {
      this.running = false;
    }
  }
}
