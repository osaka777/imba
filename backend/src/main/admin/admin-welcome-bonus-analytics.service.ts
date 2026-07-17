import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminWelcomeBonusAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateFilter(period: string) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'week':
      default: {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        break;
      }
    }

    return { gte: startDate };
  }

  async getAnalytics(period: string = 'week') {
    const dateFilter = this.getDateFilter(period);
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [
      offersInPeriod,
      activatedInPeriod,
      lockedNow,
      expiringSoon,
      expiredLocked,
      telegramWarnings,
      wageringRows,
      newUsersInPeriod,
      wageringStartedNow,
      activatedInPeriodRows,
    ] = await Promise.all([
      this.prisma.welcomeBonusClaim.count({ where: { createdAt: dateFilter } }),
      this.prisma.bonusBalance.count({
        where: {
          requiresDeposit: true,
          depositActivated: true,
          updatedAt: dateFilter,
        },
      }),
      this.prisma.bonusBalance.count({
        where: {
          requiresDeposit: true,
          depositActivated: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prisma.bonusBalance.count({
        where: {
          expiresAt: { gte: now, lte: in24h },
          OR: [
            { isActive: true },
            { requiresDeposit: true, depositActivated: false },
          ],
        },
      }),
      this.prisma.bonusBalance.count({
        where: {
          requiresDeposit: true,
          depositActivated: false,
          expiresAt: { lt: now },
        },
      }),
      this.prisma.bonusExpiryNotifyCursor.count({ where: { createdAt: dateFilter } }),
      this.prisma.bonusBalance.findMany({
        where: {
          requiresDeposit: true,
          depositActivated: true,
          requiredWager: { gt: 0 },
        },
        select: {
          totalWagered: true,
          requiredWager: true,
          isActive: true,
        },
      }),
      this.prisma.user.count({ where: { createdAt: dateFilter } }),
      this.prisma.bonusBalance.count({
        where: {
          requiresDeposit: true,
          depositActivated: true,
          totalWagered: { gt: 0 },
        },
      }),
      this.prisma.bonusBalance.findMany({
        where: {
          requiresDeposit: true,
          depositActivated: true,
          updatedAt: dateFilter,
        },
        select: {
          totalWagered: true,
          requiredWager: true,
        },
      }),
    ]);

    const wageringStartedInPeriod = activatedInPeriodRows.filter(
      (row) => Number(row.totalWagered) > 0,
    ).length;
    const completedInPeriod = activatedInPeriodRows.filter(
      (row) =>
        Number(row.requiredWager) > 0
        && Number(row.totalWagered) >= Number(row.requiredWager),
    ).length;

    const wageringActive = wageringRows.filter(
      (row) => row.isActive && Number(row.totalWagered) < Number(row.requiredWager),
    ).length;
    const wageringCompleted = wageringRows.filter(
      (row) => Number(row.totalWagered) >= Number(row.requiredWager),
    ).length;

    const depositConversionPct = offersInPeriod > 0
      ? Math.round((activatedInPeriod / offersInPeriod) * 1000) / 10
      : 0;

    const registrationToWelcomePct = newUsersInPeriod > 0
      ? Math.round((offersInPeriod / newUsersInPeriod) * 1000) / 10
      : 0;

    const stepPct = (part: number, whole: number) =>
      whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

    const funnel = [
      {
        step: 'registration',
        label: 'Регистрация',
        count: newUsersInPeriod,
        conversionPct: 100,
      },
      {
        step: 'welcome_offer',
        label: 'Welcome-оффер',
        count: offersInPeriod,
        conversionPct: stepPct(offersInPeriod, newUsersInPeriod),
      },
      {
        step: 'deposit',
        label: 'Депозит',
        count: activatedInPeriod,
        conversionPct: stepPct(activatedInPeriod, offersInPeriod),
      },
      {
        step: 'wagering_started',
        label: 'Начали отыгрыш',
        count: wageringStartedInPeriod,
        conversionPct: stepPct(wageringStartedInPeriod, activatedInPeriod),
      },
      {
        step: 'wagering_completed',
        label: 'Отыграли',
        count: completedInPeriod,
        conversionPct: stepPct(completedInPeriod, wageringStartedInPeriod),
      },
    ];

    return {
      period,
      offersInPeriod,
      activatedInPeriod,
      depositConversionPct,
      registrationToWelcomePct,
      lockedNow,
      wageringActive,
      wageringCompleted,
      wageringStartedNow,
      wageringStartedInPeriod,
      completedInPeriod,
      expiringSoon,
      expiredLocked,
      telegramWarnings,
      newUsersInPeriod,
      funnel,
    };
  }

  async getExpiring(withinHours = 24) {
    const now = new Date();
    const until = new Date(now.getTime() + withinHours * 60 * 60 * 1000);

    const rows = await this.prisma.bonusBalance.findMany({
      where: {
        expiresAt: { gte: now, lte: until },
        OR: [
          { isActive: true },
          { requiresDeposit: true, depositActivated: false },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            telegramUserId: true,
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });

    return rows.map((row) => {
      const isLocked = row.requiresDeposit && !row.depositActivated;
      const remainingMs = row.expiresAt
        ? row.expiresAt.getTime() - now.getTime()
        : null;

      return {
        id: row.id,
        userId: row.userId,
        email: row.user?.email ?? null,
        currency: row.currencyCode,
        amount: Number(row.amount),
        phase: isLocked ? 'awaiting_deposit' : 'wagering',
        expiresAt: row.expiresAt?.toISOString() ?? null,
        remainingHours: remainingMs != null
          ? Math.max(0, Math.round((remainingMs / (60 * 60 * 1000)) * 10) / 10)
          : null,
        totalWagered: Number(row.totalWagered),
        requiredWager: Number(row.requiredWager),
        telegramLinked: Boolean(row.user?.telegramUserId),
      };
    });
  }
}
