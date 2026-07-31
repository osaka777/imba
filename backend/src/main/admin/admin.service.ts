import { Injectable, NotFoundException, Optional, BadRequestException } from '@nestjs/common';
import { AffilatorStatus, OperationType, OperationStatus, BetStatus, OperationSource, DepositStatus, WcOddsBetStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '../operation/operation.service';
import { PartnersService } from '../partners/partners.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DepositUserNotifyService } from '../deposit/deposit-user-notify.service';
import { KickPartnerService } from '../../integrations/kick-dev/kick-partner.service';
import { readPublicOrderId } from '../deposit/deposit-public-order-id.util';
import { BonusBalanceService } from '../bonus-balance/bonus-balance.service';
import {
  calcDepositBonusAmount,
  calcMaxCashout,
  calcRequiredWager,
  parsePromoBonusPolicy,
} from '../bonus-balance/bonus-policy.util';
import { buildPaymentFingerprint } from '../bonus-balance/payment-fingerprint.util';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private depositUserNotify: DepositUserNotifyService,
    private partnersService: PartnersService,
    private kickPartnerService: KickPartnerService,
    private operationService: OperationService,
    @Optional() private bonusBalanceService?: BonusBalanceService,
  ) {}

  private getDateFilter(period: string) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    return {
      gte: startDate,
      lte: now,
    };
  }

  async getFinancialStatistics(period: string) {
    const dateFilter = this.getDateFilter(period);

    const [depositGroups, withdrawalGroups, bonusGroups] = await Promise.all([
      this.prisma.operation.groupBy({
        by: ['currencyCode'],
        where: {
          type: OperationType.INCOME,
          status: OperationStatus.SUCCESS,
          source: OperationSource.PAYMENT_SYSTEM,
          createdAt: dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.operation.groupBy({
        by: ['currencyCode'],
        where: {
          type: OperationType.OUTCOME,
          status: OperationStatus.SUCCESS,
          source: OperationSource.PAYMENT_SYSTEM,
          createdAt: dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.operation.groupBy({
        by: ['currencyCode'],
        where: {
          source: OperationSource.BONUS_COMPLETE,
          status: OperationStatus.SUCCESS,
          createdAt: dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const currencies = new Set([
      ...depositGroups.map((g) => g.currencyCode),
      ...withdrawalGroups.map((g) => g.currencyCode),
      ...bonusGroups.map((g) => g.currencyCode),
    ]);

    const byCurrency = Array.from(currencies).map((currency) => {
      const deposits = Number(
        depositGroups.find((g) => g.currencyCode === currency)?._sum.amount || 0,
      );
      const withdrawals = Number(
        withdrawalGroups.find((g) => g.currencyCode === currency)?._sum.amount || 0,
      );
      const bonuses = Number(
        bonusGroups.find((g) => g.currencyCode === currency)?._sum.amount || 0,
      );
      return {
        currency,
        deposits,
        withdrawals,
        bonuses,
        revenue: deposits - withdrawals,
      };
    }).sort((a, b) => b.deposits - a.deposits);

    // Keep legacy totals as KZT-first preferred sum display only when single currency;
    // multi-currency totals are misleading — prefer primary currency (most deposits).
    const primary = byCurrency[0];

    return {
      totalDeposits: primary?.deposits ?? 0,
      totalWithdrawals: primary?.withdrawals ?? 0,
      totalBonuses: primary?.bonuses ?? 0,
      totalRevenue: primary?.revenue ?? 0,
      primaryCurrency: primary?.currency ?? null,
      byCurrency,
      chartData: await this.getFinancialChartData(period),
    };
  }

  async getGamesStatistics(period: string) {
    const dateFilter = this.getDateFilter(period);

    const [winGroups, loseGroups, totalGames] = await Promise.all([
      this.prisma.bet.groupBy({
        by: ['currencyCode'],
        where: {
          status: BetStatus.WIN,
          createdAt: dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.bet.groupBy({
        by: ['currencyCode'],
        where: {
          status: BetStatus.LOSE,
          createdAt: dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.bet.count({
        where: {
          createdAt: dateFilter,
        },
      }),
    ]);

    const currencies = new Set([
      ...winGroups.map((g) => g.currencyCode),
      ...loseGroups.map((g) => g.currencyCode),
    ]);

    const byCurrency = Array.from(currencies).map((currency) => {
      const wins = Number(winGroups.find((g) => g.currencyCode === currency)?._sum.amount || 0);
      const losses = Number(loseGroups.find((g) => g.currencyCode === currency)?._sum.amount || 0);
      const winCount = winGroups.find((g) => g.currencyCode === currency)?._count || 0;
      const loseCount = loseGroups.find((g) => g.currencyCode === currency)?._count || 0;
      return {
        currency,
        wins,
        losses,
        ggr: Math.max(0, losses - wins),
        games: Number(winCount) + Number(loseCount),
      };
    }).sort((a, b) => b.games - a.games);

    const primary = byCurrency[0];

    return {
      totalWins: primary?.wins ?? 0,
      totalLosses: primary?.losses ?? 0,
      totalGames,
      primaryCurrency: primary?.currency ?? null,
      byCurrency,
      chartData: await this.getGamesChartData(period),
    };
  }

  async getPartnersStatistics(period: string) {
    const dateFilter = this.getDateFilter(period);

    const partners = await this.prisma.affilator.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
        users: {
          select: {
            id: true,
          },
        },
      },
    });

    const partnersData = await Promise.all(
      partners.map(async (partner) => {
        const [earnedIncome, earnedReversals, wcBets] = await Promise.all([
          this.prisma.operation.aggregate({
            where: {
              userId: partner.userId,
              source: OperationSource.AFFILIATE,
              type: OperationType.INCOME,
              status: OperationStatus.SUCCESS,
              createdAt: dateFilter,
            },
            _sum: { amount: true },
          }),
          this.prisma.operation.aggregate({
            where: {
              userId: partner.userId,
              source: OperationSource.AFFILIATE,
              type: OperationType.OUTCOME,
              status: OperationStatus.SUCCESS,
              createdAt: dateFilter,
            },
            _sum: { amount: true },
          }),
          this.prisma.wcOddsBet.findMany({
            where: {
              user: { affiliatedById: partner.userId },
              createdAt: dateFilter,
            },
            select: { status: true },
          }),
        ]);

        const totalWins = wcBets.filter((bet) => bet.status === WcOddsBetStatus.WIN).length;
        const totalLosses = wcBets.filter((bet) => bet.status === WcOddsBetStatus.LOSE).length;
        const totalEarned =
          Number(earnedIncome._sum.amount ?? 0) - Number(earnedReversals._sum.amount ?? 0);

        return {
          id: partner.userId,
          name: partner.user.email.split('@')[0],
          email: partner.user.email,
          totalEarned,
          clientsCount: partner.users.length,
          clientsWins: totalWins,
          clientsLosses: totalLosses,
          totalGames: wcBets.length,
          conversionRate: wcBets.length > 0 ? (totalWins / wcBets.length) * 100 : 0,
          status: 'active' as const,
        };
      }),
    );

    return {
      activeCount: partners.length,
      data: partnersData,
    };
  }

  async getReferralsOverview(limit = 200) {
    const referredUsers = await this.prisma.user.findMany({
      where: { affiliatedById: { not: null } },
      include: {
        affiliatedBy: {
          include: {
            user: { select: { id: true, email: true } },
          },
        },
        deposits: {
          where: { status: DepositStatus.SUCCESS },
          select: { amount: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        wcOddsBets: {
          select: { status: true, stake: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const rows = await Promise.all(
      referredUsers.map(async (player) => {
        const partner = player.affiliatedBy;
        if (!partner) return null;

        const partnerEarned = await this.prisma.operation.aggregate({
          where: {
            userId: partner.userId,
            source: OperationSource.AFFILIATE,
            type: OperationType.INCOME,
            status: OperationStatus.SUCCESS,
            meta: {
              path: ['originalUserId'],
              equals: player.id,
            },
          },
          _sum: { amount: true },
        });

        const totalDeposits = player.deposits.reduce(
          (sum, deposit) => sum + Number(deposit.amount),
          0,
        );

        return {
          playerId: player.id,
          playerEmail: player.email,
          playerRegisteredAt: player.createdAt.toISOString(),
          registrationIp: player.registrationIp,
          partnerId: partner.userId,
          partnerEmail: partner.user.email,
          partnerUid: partner.uid,
          totalDeposits,
          firstDepositAt: player.deposits[0]?.createdAt?.toISOString() ?? null,
          totalBets: player.wcOddsBets.length,
          totalLosses: player.wcOddsBets.filter((bet) => bet.status === WcOddsBetStatus.LOSE).length,
          affiliateEarnedFromPlayer: Number(partnerEarned._sum.amount ?? 0),
        };
      }),
    );

    return {
      total: rows.filter(Boolean).length,
      items: rows.filter((row): row is NonNullable<typeof row> => row != null),
    };
  }

  async getAffiliatePartners(limit = 200) {
    const items = await this.partnersService.getAffiliatePartnersOverview(limit);
    return { total: items.length, items };
  }

  async updateAffiliatePartnerStatus(userId: number, status: AffilatorStatus) {
    return this.partnersService.updatePartnerStatus(userId, status);
  }

  async updateAffiliatePartnerPercent(userId: number, percent: number) {
    await this.partnersService.updatePartnerPercent(userId, percent);
    return { ok: true, userId, percent };
  }

  async updateAffiliatePartnerCpa(
    userId: number,
    cpaPayoutAmount: number,
    cpaCurrencyCode: string,
  ) {
    await this.partnersService.updatePartnerCpa(userId, cpaPayoutAmount, cpaCurrencyCode);
    return { ok: true, userId, cpaPayoutAmount, cpaCurrencyCode };
  }

  async getAffiliatePartnerPromos(userId: number) {
    const items = await this.partnersService.getPartnerPromoCodes(userId);
    return { items };
  }

  async getKickPartnersOverview(limit = 200) {
    return this.kickPartnerService.listKickPartnersForAdmin(limit);
  }

  async getKickPartnerSessions(userId: number, limit = 50) {
    const items = await this.kickPartnerService.getPartnerSessions(userId, limit);
    return { items };
  }

  async getRecentKickSessions(limit = 50) {
    const items = await this.kickPartnerService.listRecentKickSessionsForAdmin(limit);
    return { total: items.length, items };
  }

  async grantKickBrandBonus(
    _userId: number,
    _tier: 'pro',
    _currencyCode = 'USD',
  ) {
    throw new BadRequestException(
      'Ручной бренд-бонус отключён. Welcome $10 начисляется автоматически при первом подключении Kick.',
    );
  }

  async getUsersStatistics(period: string) {
    const dateFilter = this.getDateFilter(period);

    const [totalUsers, newUsers, activeUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          createdAt: dateFilter,
        },
      }),
      this.prisma.user.count({
        where: {
          bets: {
            some: {
              createdAt: dateFilter,
            },
          },
        },
      }),
    ]);

    return {
      totalUsers,
      newUsers,
      activeUsers,
    };
  }

  async getAllStatistics(period: string) {
    const [financialStats, gamesStats, partnersStats, usersStats] = await Promise.all([
      this.getFinancialStatistics(period),
      this.getGamesStatistics(period),
      this.getPartnersStatistics(period),
      this.getUsersStatistics(period),
    ]);

    return {
      totalDeposits: financialStats.totalDeposits,
      totalWithdrawals: financialStats.totalWithdrawals,
      totalBonuses: financialStats.totalBonuses,
      totalWins: gamesStats.totalWins,
      totalLosses: gamesStats.totalLosses,
      totalGames: gamesStats.totalGames,
      activePartners: partnersStats.activeCount,
      totalRevenue: financialStats.totalRevenue,
      primaryCurrency: financialStats.primaryCurrency || gamesStats.primaryCurrency || null,
      byCurrency: financialStats.byCurrency,
      gamesByCurrency: gamesStats.byCurrency,
      revenueChart: financialStats.chartData,
      gamesChart: gamesStats.chartData,
      partnersData: partnersStats.data,
      totalUsers: usersStats.totalUsers,
      newUsers: usersStats.newUsers,
      activeUsers: usersStats.activeUsers,
    };
  }

  private async getFinancialChartData(period: string) {
    const dateFilter = this.getDateFilter(period);
    
    // Get actual financial data from database
    const operations = await this.prisma.operation.findMany({
      where: {
        status: OperationStatus.SUCCESS,
        createdAt: dateFilter,
      },
      select: {
        amount: true,
        type: true,
        source: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group data by time period
    const groupedData = this.groupFinancialDataByPeriod(operations, period);
    return groupedData;
  }

  private async getGamesChartData(period: string) {
    const dateFilter = this.getDateFilter(period);
    
    // Get actual games data from database
    const bets = await this.prisma.bet.findMany({
      where: {
        createdAt: dateFilter,
      },
      select: {
        amount: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group data by time period
    const groupedData = this.groupGamesDataByPeriod(bets, period);
    return groupedData;
  }

  private groupFinancialDataByPeriod(operations: any[], period: string) {
    const grouped: Record<string, { deposits: number; withdrawals: number; profit: number }> = {};
    
    operations.forEach(operation => {
      const key = this.getTimeKey(operation.createdAt, period);
      
      if (!grouped[key]) {
        grouped[key] = { deposits: 0, withdrawals: 0, profit: 0 };
      }
      
      const amount = Number(operation.amount);
      if (operation.type === OperationType.INCOME && operation.source === OperationSource.PAYMENT_SYSTEM) {
        grouped[key].deposits += amount;
        grouped[key].profit += amount;
      } else if (operation.type === OperationType.OUTCOME && operation.source === OperationSource.PAYMENT_SYSTEM) {
        grouped[key].withdrawals += amount;
        grouped[key].profit -= amount;
      }
    });

    // Fill missing periods with zero values
    const result = this.fillMissingPeriods(grouped, period);
    
    return result.map(([name, data]) => ({
      name,
      deposits: data.deposits,
      withdrawals: data.withdrawals,
      profit: data.profit,
    }));
  }

  private groupGamesDataByPeriod(bets: any[], period: string) {
    const grouped: Record<string, { wins: number; losses: number; games: number }> = {};
    
    bets.forEach(bet => {
      const key = this.getTimeKey(bet.createdAt, period);
      
      if (!grouped[key]) {
        grouped[key] = { wins: 0, losses: 0, games: 0 };
      }
      
      const amount = Number(bet.amount);
      grouped[key].games += 1;
      
      if (bet.status === BetStatus.WIN) {
        grouped[key].wins += amount;
      } else if (bet.status === BetStatus.LOSE) {
        grouped[key].losses += amount;
      }
    });

    // Fill missing periods with zero values
    const result = this.fillMissingPeriods(grouped, period);
    
    return result.map(([name, data]) => ({
      name,
      wins: data.wins,
      losses: data.losses,
      games: data.games,
    }));
  }

  private fillMissingPeriods(grouped: Record<string, any>, period: string): Array<[string, any]> {
    const now = new Date();
    const periods: string[] = [];
    
    if (period === 'day') {
      // Generate 24 hours
      for (let i = 0; i < 24; i++) {
        periods.push(`${i}:00`);
      }
    } else if (period === 'week') {
      // Generate 7 days
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      periods.push(...days);
    } else if (period === 'month') {
      // Generate days of current month
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        periods.push(`Day ${i}`);
      }
    }

    return periods.map(periodKey => {
      const defaultData = period === 'day' || period === 'week' || period === 'month' 
        ? { deposits: 0, withdrawals: 0, profit: 0, wins: 0, losses: 0, games: 0 }
        : {};
      
      return [periodKey, { ...defaultData, ...grouped[periodKey] }];
    });
  }

  private getTimeKey(date: Date, period: string): string {
    const d = new Date(date);
    
    switch (period) {
      case 'day':
        return `${d.getHours()}:00`;
      case 'week':
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[d.getDay()];
      case 'month':
        return `Day ${d.getDate()}`;
      default:
        return d.toISOString().split('T')[0];
    }
  }

  private groupDataByPeriod(data: any[], period: string) {
    // Implementation for grouping data by day/week/month
    const grouped: Record<string, { deposits: number; withdrawals: number }> = {};
    
    data.forEach(item => {
      let key: string;
      const date = new Date(item.createdAt);
      
      if (period === 'day') {
        key = date.toLocaleDateString('ru-RU', { weekday: 'short' });
      } else if (period === 'week') {
        const weekNum = Math.ceil(date.getDate() / 7);
        key = `Нед ${weekNum}`;
      } else {
        key = date.toLocaleDateString('ru-RU', { month: 'short' });
      }
      
      if (!grouped[key]) {
        grouped[key] = { deposits: 0, withdrawals: 0 };
      }
      
      if (item.type === 'DEPOSIT') {
        grouped[key].deposits += item.amount;
      } else if (item.type === 'WITHDRAWAL') {
        grouped[key].withdrawals += item.amount;
      }
    });

    return Object.entries(grouped).map(([name, data]) => ({
      name,
      ...data
    }));
  }

  // Bonus Management Methods
  async getAllBonuses(status?: string) {
    const whereClause: any = {};
    if (status) {
      whereClause.status = status.toUpperCase();
    }

    // Existing user-targeted bonus operations
    const operations = await this.prisma.operation.findMany({
      where: {
        source: OperationSource.BONUS_COMPLETE,
        ...whereClause,
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Giveaway promos (created without userEmail)
    const promos = await this.prisma.promo.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        _count: { select: { promoOnUsers: true } },
      },
    });

    const opMapped = operations.map((bonus) => ({
      id: bonus.id.toString(),
      userId: bonus.userId.toString(),
      userEmail: bonus.user.email,
      amount: Number(bonus.amount),
      type: this.getBonusTypeFromMeta(bonus.meta),
      status: bonus.status.toLowerCase(),
      createdAt: bonus.createdAt.toISOString(),
      description: this.getBonusDescriptionFromMeta(bonus.meta),
      currencyCode: bonus.currencyCode,
      available: 1,
      remaining: 0,
    }));

    const promoMapped = promos.map((p) => {
      const value: any = p.value as any;
      const amount =
        typeof value?.amount === 'number'
          ? Number(value.amount)
          : typeof value?.amount === 'string'
          ? Number(value.amount)
          : p.type === 'DEPOSIT_BONUS' && value && value.minDeposit != null
          ? Number(value.minDeposit)
          : 0;
      const used = (p as any)._count?.promoOnUsers || 0;
      const remaining = (p.available || 0) - Number(used);
      return {
        id: `promo_${p.id}`,
        userId: '0',
        userEmail: '',
        amount,
        type: p.type, // DIRECT_BONUS | DEPOSIT_BONUS | VOUCHER
        status: 'waiting',
        createdAt: p.createdAt.toISOString(),
        description: `Промо ${p.code}`,
        promoCode: p.code,
        startDate: p.createdAt.toISOString(),
        endDate: p.validUntil.toISOString(),
        currencyCode: p.currencyCode,
        available: p.available,
        remaining: remaining < 0 ? 0 : remaining,
        partnerId: p.partnerId || undefined,
      };
    });

    // Merge and sort by createdAt desc
    const merged = [...opMapped, ...promoMapped].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return { bonuses: merged };
  }

  async createBonus(bonusData: {
    userEmail?: string;
    amount: number;
    type: string;
    description: string;
    currencyCode?: string;
    promoCode?: string;
    bonusType?: 'DIRECT_BONUS' | 'DEPOSIT_BONUS' | 'VOUCHER';
    bonusCurrency?: string;
    couponCount?: string;
    bonusPercentage?: string;
    bonusAmount?: string;
    partnerPercentage?: string;
    minDeposit?: string;
    startDate?: string;
    endDate?: string;
    partnerId?: string;
    totalTokens?: string;
    tokensPerBet?: string;
    tokenMinOdds?: string;
  }) {
    // If userEmail is not provided -> create a Promo (giveaway mode)
    if (!bonusData.userEmail) {
      const typeMap: Record<string, any> = {
        'direct-bonus': 'DIRECT_BONUS',
        'deposit-bonus': 'DEPOSIT_BONUS',
        'voucher': 'VOUCHER',
      };
      const promoType = (typeMap[bonusData.type] || bonusData.bonusType || 'DIRECT_BONUS') as any;
      const now = new Date();
      const validUntil = bonusData.endDate ? new Date(bonusData.endDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const available = bonusData.couponCount ? parseInt(bonusData.couponCount) : 1;
      const totalTokens = bonusData.totalTokens ? parseInt(bonusData.totalTokens) : 0;
      const tokensPerBet = bonusData.tokensPerBet ? parseInt(bonusData.tokensPerBet) : 1;
      const tokenMinOdds = bonusData.tokenMinOdds ? Number(bonusData.tokenMinOdds) : 1.8;
      const minDeposit = bonusData.minDeposit ? Number(bonusData.minDeposit) : undefined;
      const bonusPercentage = bonusData.bonusPercentage ? Number(bonusData.bonusPercentage) : undefined;

      let value: any = {};
      const partnerPct = bonusData.partnerPercentage
        ? Number(bonusData.partnerPercentage)
        : 0;
      if (promoType === 'DEPOSIT_BONUS') {
        value = {
          percentage: bonusPercentage || 0,
          minDeposit: minDeposit || 0,
          totalTokens,
          tokensPerBet,
          tokenMinOdds,
          partnerPercentage: partnerPct,
        };
      } else {
        // DIRECT_BONUS or VOUCHER
        value = {
          amount: Number(bonusData.amount || bonusData.bonusAmount || 0),
          totalTokens,
          tokensPerBet,
          tokenMinOdds,
          partnerPercentage: partnerPct,
        };
      }

      const promo = await this.prisma.promo.create({
        data: {
          code: bonusData.promoCode || `PROMO${Date.now()}`,
          validUntil,
          available,
          type: promoType,
          value,
          currencyCode: bonusData.currencyCode || bonusData.bonusCurrency || 'RUB',
          partnerId: bonusData.partnerId,
        }
      });

      return {
        id: promo.id.toString(),
        userId: '0',
        userEmail: '',
        amount: Number(bonusData.amount || 0),
        type: bonusData.type,
        status: 'waiting',
        createdAt: promo.createdAt.toISOString(),
        description: bonusData.description,
      };
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: bonusData.userEmail }
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Create bonus operation with meta data
    const bonus = await this.prisma.operation.create({
      data: {
        userId: user.id,
        amount: bonusData.amount,
        type: OperationType.INCOME,
        source: OperationSource.BONUS_COMPLETE,
        status: OperationStatus.WAITING,
        meta: {
          type: bonusData.type,
          description: bonusData.description
        },
        currencyCode: bonusData.currencyCode || 'RUB'
      }
    });

    return {
      id: bonus.id.toString(),
      userId: bonus.userId.toString(),
      userEmail: bonusData.userEmail,
      amount: Number(bonus.amount),
      type: bonusData.type,
      status: bonus.status.toLowerCase(),
      createdAt: bonus.createdAt.toISOString(),
      description: bonusData.description
    };
  }

  async updateBonusStatus(bonusId: string, newStatus: 'approved' | 'rejected') {
    const bonus = await this.prisma.operation.findUnique({
      where: { id: parseInt(bonusId) },
      include: {
        user: true
      }
    });

    if (!bonus) {
      throw new Error('Бонус не найден');
    }

    const status = newStatus === 'approved' ? OperationStatus.SUCCESS : OperationStatus.FAILED;
    
    const updatedBonus = await this.prisma.operation.update({
      where: { id: parseInt(bonusId) },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    // If approved, add to user's balance
    if (newStatus === 'approved') {
      await this.prisma.balance.upsert({
        where: {
          userId_currencyCode: {
            userId: bonus.userId,
            currencyCode: bonus.currencyCode
          }
        },
        update: {
          amount: { increment: bonus.amount }
        },
        create: {
          userId: bonus.userId,
          currencyCode: bonus.currencyCode,
          amount: bonus.amount
        }
      });
    }

    return {
      id: updatedBonus.id.toString(),
      userId: updatedBonus.userId.toString(),
      userEmail: updatedBonus.user.email,
      amount: Number(updatedBonus.amount),
      status: updatedBonus.status.toLowerCase(),
      createdAt: updatedBonus.createdAt.toISOString(),
      description: this.getBonusDescriptionFromMeta(updatedBonus.meta)
    };
  }

  // Helper methods for bonus meta data
  private getBonusTypeFromMeta(meta: any): string {
    if (meta && typeof meta === 'object' && meta.type) {
      return meta.type;
    }
    return 'bonus';
  }

  private getBonusDescriptionFromMeta(meta: any): string {
    if (meta && typeof meta === 'object' && meta.description) {
      return meta.description;
    }
    return 'Бонус';
  }

  // Withdrawals Management Methods
  async getAllWithdrawals(status?: string) {
    const whereClause: any = {
      type: OperationType.OUTCOME,
      source: OperationSource.PAYMENT_SYSTEM
    };
    
    if (status && status !== 'all') {
      whereClause.status = status.toUpperCase();
    }

    const withdrawals = await this.prisma.operation.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      withdrawals: await Promise.all(withdrawals.map(async withdrawal => {
        const meta = withdrawal.meta as any;
        let method = 'unknown';
        let cardNumber = '';
        let cardType = '';

        // Пытаемся найти связанный WithdrawRequest
        const requestId = meta?.withdrawRequestId ?? meta?.withdrawalId;
        if (requestId) {
          try {
            const withdrawRequest = await this.prisma.withdrawRequest.findUnique({
              where: { id: Number(requestId) }
            });
            
            if (withdrawRequest) {
              method = withdrawRequest.type || 'unknown'; // CARD или CRYPTO
              cardNumber = withdrawRequest.wallet || '';
              cardType = withdrawRequest.bank || ''; // FOREIGN, KAZAKHSTAN или пусто для крипто
            }
          } catch (error) {
            // Если не удалось найти WithdrawRequest, используем данные из meta
            method = meta?.method || 'unknown';
            cardNumber = meta?.cardNumber || '';
          }
        } else {
          // Fallback к данным из meta
          method = meta?.method || 'unknown';
          cardNumber = meta?.cardNumber || '';
        }

        return {
          id: withdrawal.id.toString(),
          userId: withdrawal.userId.toString(),
          userEmail: withdrawal.user.email,
          amount: Number(withdrawal.amount),
          status: withdrawal.status.toLowerCase(),
          createdAt: withdrawal.createdAt.toISOString(),
          currencyCode: withdrawal.currencyCode,
          method: method,
          cardNumber: cardNumber,
          cardType: cardType,
          isAffiliate: method === 'affiliate',
          requiresReview: meta?.requiresReview === true,
          meta: withdrawal.meta
        };
      }))
    };
  }

  async updateWithdrawalStatus(withdrawalId: string, newStatus: 'approved' | 'rejected') {
    const withdrawal = await this.prisma.operation.findUnique({
      where: { id: parseInt(withdrawalId) },
      include: {
        user: true
      }
    });

    if (!withdrawal) {
      throw new Error('Вывод не найден');
    }

    const status = newStatus === 'approved' ? OperationStatus.SUCCESS : OperationStatus.FAILED;
    
    const updatedWithdrawal = await this.prisma.operation.update({
      where: { id: parseInt(withdrawalId) },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    return {
      id: updatedWithdrawal.id.toString(),
      userId: updatedWithdrawal.userId.toString(),
      userEmail: updatedWithdrawal.user.email,
      amount: Number(updatedWithdrawal.amount),
      status: updatedWithdrawal.status.toLowerCase(),
      createdAt: updatedWithdrawal.createdAt.toISOString(),
      currencyCode: updatedWithdrawal.currencyCode
    };
  }

  // Users Management Methods
  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        balances: true,
        bets: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            game: true
          }
        },
        bonusBalances: true,
        operations: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return users.map(user => {
      const balances = user.balances.map((balance) => ({
        amount: parseFloat(balance.amount.toString()),
        currency: balance.currencyCode,
      }));

      const bonusBalances = user.bonusBalances.map((bonus) => ({
        amount: parseFloat(bonus.amount.toString()),
        currency: bonus.currencyCode,
      }));

      // Prefer default currency, else largest balance, else first.
      const preferredCurrency =
        user.defaultCurrencyCode
        || [...balances].sort((a, b) => b.amount - a.amount)[0]?.currency
        || balances[0]?.currency
        || null;

      const totalBalance = balances.reduce((sum, balance) => sum + balance.amount, 0);
      const bonusBalance = bonusBalances.reduce((sum, bonus) => sum + bonus.amount, 0);

      const totalBets = user.bets.length;
      const winningBets = user.bets.filter(bet => bet.status === BetStatus.WIN).length;
      const losingBets = user.bets.filter(bet => bet.status === BetStatus.LOSE).length;
      const winRate = totalBets > 0 ? (winningBets / totalBets) * 100 : 0;

      return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        username: user.nickname || user.email.split('@')[0],
        defaultCurrencyCode: preferredCurrency,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        totalBalance,
        bonusBalance,
        balances,
        bonusBalances,
        totalBets,
        winningBets,
        losingBets,
        winRate: Math.round(winRate * 100) / 100,
        recentBets: user.bets.slice(0, 3),
        recentOperations: user.operations.slice(0, 3)
      };
    });
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: {
        balances: true,
        bets: {
          orderBy: { createdAt: 'desc' },
          include: {
            game: true
          }
        },
        bonusBalances: true,
        operations: {
          orderBy: { createdAt: 'desc' }
        },
        bonusBets: true,
        bonusHistories: true,
        promoOnUsers: {
          include: {
            promo: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Подсчитываем общий баланс
    const totalBalance = user.balances.reduce((sum, balance) => 
      sum + parseFloat(balance.amount.toString()), 0
    );

    // Подсчитываем бонусный баланс
    const bonusBalance = user.bonusBalances.reduce((sum, bonus) => 
      sum + parseFloat(bonus.amount.toString()), 0
    );

    // Подсчитываем статистику ставок
    const totalBets = user.bets.length;
    const winningBets = user.bets.filter(bet => bet.status === BetStatus.WIN).length;
    const losingBets = user.bets.filter(bet => bet.status === BetStatus.LOSE).length;
    const pendingBets = user.bets.filter(bet => bet.status === BetStatus.PENDING).length;
    const winRate = totalBets > 0 ? (winningBets / totalBets) * 100 : 0;

    // Подсчитываем общую сумму ставок
    const totalBetAmount = user.bets.reduce((sum, bet) => 
      sum + parseFloat(bet.amount.toString()), 0
    );

    // Подсчитываем общую сумму выигрышей
    const totalWinAmount = user.bets
      .filter(bet => bet.status === BetStatus.WIN)
      .reduce((sum, bet) => sum + parseFloat(bet.amountOut?.toString() || '0'), 0);

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      username: user.nickname || user.email.split('@')[0],
      defaultCurrencyCode: user.defaultCurrencyCode
        || user.balances[0]?.currencyCode
        || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      totalBalance,
      bonusBalance,
      balances: user.balances.map(b => ({
        id: b.id,
        amount: parseFloat(b.amount.toString()),
        currency: b.currencyCode,
        createdAt: b.createdAt,
      })),
      statistics: {
        totalBets,
        winningBets,
        losingBets,
        pendingBets,
        winRate: Math.round(winRate * 100) / 100,
        totalBetAmount,
        totalWinAmount,
        profit: totalWinAmount - totalBetAmount
      },
      operations: user.operations.map(op => ({
        id: op.id,
        type: op.type,
        amount: parseFloat(op.amount.toString()),
        currency: op.currencyCode,
        createdAt: op.createdAt,
        source: op.source,
        status: op.status
      })),
      bets: user.bets.map(bet => ({
        id: bet.id,
        amount: parseFloat(bet.amount.toString()),
        currency: bet.currencyCode,
        cf: parseFloat(bet.cf.toString()),
        status: bet.status,
        betType: bet.betType,
        betInfo: bet.betInfo,
        createdAt: bet.createdAt,
        game: bet.game ? {
          eventId: bet.game.eventId,
          eventName: `${bet.game.team1 || ''} vs ${bet.game.team2 || ''}`.trim(),
          team1: bet.game.team1,
          team2: bet.game.team2,
          status: bet.game.status,
        } : null,
      })),
      bonusBalances: user.bonusBalances.map(b => ({
        id: b.id,
        amount: parseFloat(b.amount.toString()),
        currency: b.currencyCode,
        createdAt: b.createdAt,
      })),
      bonuses: user.promoOnUsers.map((p) => ({
        promoId: p.promoId,
        promoCode: p.promo?.code || '',
        status: p.status,
        type: p.promo?.type || '',
        validUntil: p.promo?.validUntil || '',
      })),
    };
  }

  // ===== Deposits (admin) =====
  async getExpiringBonuses(withinHours = 24) {
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
          ? Math.max(0, Math.round(remainingMs / (60 * 60 * 1000) * 10) / 10)
          : null,
        totalWagered: Number(row.totalWagered),
        requiredWager: Number(row.requiredWager),
        telegramLinked: Boolean(row.user?.telegramUserId),
      };
    });
  }

  async getWelcomeBonusAnalytics(period: string = 'week') {
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
    ]);

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

    return {
      period,
      offersInPeriod,
      activatedInPeriod,
      depositConversionPct,
      registrationToWelcomePct,
      lockedNow,
      wageringActive,
      wageringCompleted,
      expiringSoon,
      expiredLocked,
      telegramWarnings,
      newUsersInPeriod,
    };
  }

  async getInboxCounts() {
    const [pendingDeposits, pendingWithdrawals] = await Promise.all([
      this.prisma.deposit.count({
        where: {
          status: {
            in: [DepositStatus.PENDING, DepositStatus.PROCESSING],
          },
        },
      }),
      this.prisma.withdrawRequest.count({
        where: {
          status: {
            in: [OperationStatus.WAITING, OperationStatus.PROCESSING],
          },
        },
      }),
    ]);

    return {
      pendingDeposits,
      pendingWithdrawals,
      pendingPredictionSettles: 0,
      total: pendingDeposits + pendingWithdrawals,
    };
  }

  async listDeposits(status: 'pending' | 'approved' | 'rejected' = 'pending') {
    const map: Record<string, DepositStatus> = {
      pending: DepositStatus.PENDING,
      approved: DepositStatus.SUCCESS,
      rejected: DepositStatus.FAILED,
    };

    const where =
      status === 'pending'
        ? {
            status: {
              in: [DepositStatus.PENDING, DepositStatus.PROCESSING],
            },
          }
        : { status: map[status] ?? DepositStatus.PENDING };

    const items = await this.prisma.deposit.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const statusLabel = (s: DepositStatus) => {
      if (s === DepositStatus.PROCESSING) return 'processing';
      if (s === DepositStatus.PENDING) return 'pending';
      if (s === DepositStatus.SUCCESS) return 'approved';
      if (s === DepositStatus.FAILED) return 'rejected';
      return String(s).toLowerCase();
    };

    return items.map((d) => ({
      id: d.id,
      userId: d.userId,
      email: d.user?.email,
      amount: Number(d.amount),
      currency: d.currencyCode,
      method: d.paymentSystem,
      imageUrl: typeof d.meta === 'object' && (d.meta as any)?.imageUrl ? String((d.meta as any).imageUrl) : undefined,
      createdAt: d.createdAt,
      status: statusLabel(d.status),
    }));
  }

  async approveDeposit(id: number) {
    const depo = await this.prisma.deposit.findUnique({ where: { id } });
    if (!depo) throw new Error('Deposit not found');
    if (depo.status !== DepositStatus.PENDING && depo.status !== DepositStatus.PROCESSING) {
      throw new Error('Deposit already processed');
    }

    let bonusApplied = false;
    let bonusAmountCredited = 0;
    let bonusCurrencyUsed: string | null = null;
    let tokensGranted = 0;
    let tokensPerBet = 0;
    let tokenMinOdds = 0;
    let redeemedPromo: { id: number; code: string; partnerId: string | null; value: unknown } | null = null;
    let diagnostics: any = { path: 'approveDeposit', promoFound: false, alreadyUsed: null as null | boolean, remaining: null as null | number, voucher: null as null | string };

    const voucherPrecheck: string | undefined = (depo.meta as any)?.voucher;
    if (voucherPrecheck) {
      const promoPre = await this.prisma.promo.findFirst({
        where: { code: { equals: voucherPrecheck, mode: 'insensitive' } as any },
      });
      if (promoPre) {
        await this.partnersService.assertPartnerPromoRedeemable(promoPre);
      }
    }

    console.log(`[approveDeposit] start id=${id}`);
    await this.prisma.$transaction(async (tx) => {
      // Upsert balance
      await tx.balance.upsert({
        where: { userId_currencyCode: { userId: depo.userId, currencyCode: depo.currencyCode } },
        update: { amount: { increment: depo.amount } },
        create: { userId: depo.userId, currencyCode: depo.currencyCode, amount: depo.amount },
      });

      // Create operation (deposit income) and link to deposit.operationId
      const depositOp = await tx.operation.create({
        data: {
          userId: depo.userId,
          source: OperationSource.PAYMENT_SYSTEM,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          amount: depo.amount,
          currencyCode: depo.currencyCode,
          meta: { depositId: depo.id, paymentSystem: depo.paymentSystem },
        },
      });
      await tx.deposit.update({ where: { id: depo.id }, data: { operationId: depositOp.id } });

      // Apply promo/voucher if present and valid, only once per user
      const voucher: string | undefined = (depo.meta as any)?.voucher;
      if (voucher) {
        diagnostics.voucher = voucher;
        console.log(`[approveDeposit] voucher detected code=${voucher} depositId=${depo.id} userId=${depo.userId}`);
        const promo = await tx.promo.findFirst({
          where: { code: { equals: voucher, mode: 'insensitive' } as any },
          include: { _count: { select: { promoOnUsers: true } } } as any,
        } as any);
        if (promo) {
          diagnostics.promoFound = true;
          console.log(`[approveDeposit] promo found id=${promo.id} code=${promo.code} type=${promo.type}`);
          // Ensure user has not used this promo before
          const alreadyUsed = await tx.promoOnUsers.findUnique({
            where: { promoId_userId: { promoId: promo.id, userId: depo.userId } },
          });
          diagnostics.alreadyUsed = !!alreadyUsed;
          console.log(`[approveDeposit] usage check alreadyUsed=${!!alreadyUsed}`);
          
          if (alreadyUsed) {
            console.log(`[approveDeposit] ❌ User ${depo.userId} already used promo ${promo.code} (id=${promo.id})`);
            diagnostics.error = 'Промокод уже использован этим пользователем';
          }
          
          if (!alreadyUsed) {
            // Сразу записываем использование, чтобы предотвратить повторное использование
            await tx.promoOnUsers.create({
              data: {
                promoId: promo.id,
                userId: depo.userId,
                status: 'APPLIED' as any,
              },
            });
            console.log(`[approveDeposit] ✅ Usage recorded EARLY promoId=${promo.id} userId=${depo.userId}`);
            
            // Validate availability
            const usedCount = (promo as any)._count?.promoOnUsers || 0;
            const remaining = (promo.available || 0) - Number(usedCount);
            diagnostics.remaining = remaining;
            // Allow credit for this user even if remaining <= 0; wrap logic in an explicit block
            {
              // Compute values
              const value: any = promo.value as any;
              const policy = parsePromoBonusPolicy(value, promo.type);
              const totalTokens = Number((value?.totalTokens ?? 0));
              const tokensPerBetVal = Number((value?.tokensPerBet ?? 1));
              const tokenMinOddsVal = Number((value?.tokenMinOdds ?? 1.8));

              // Compute bonus amount
              let bonusAmount = 0;
              if (promo.type === 'DIRECT_BONUS' || promo.type === 'VOUCHER') {
                bonusAmount = Number(value?.amount || 0);
              } else if (promo.type === 'DEPOSIT_BONUS') {
                const depoAmountNum = parseFloat((depo.amount as any)?.toString?.() || String(depo.amount));
                bonusAmount = calcDepositBonusAmount(depoAmountNum, policy);
              }
              const bonusCurrency = promo.currencyCode || depo.currencyCode;
              const allowApply = !(promo.currencyCode && String(promo.currencyCode).toUpperCase() !== String(depo.currencyCode).toUpperCase());
              if (!allowApply) {
                (diagnostics as any).currencyMismatch = { promo: promo.currencyCode, deposit: depo.currencyCode };
                console.log(`[approveDeposit] currency mismatch, promo=${promo.currencyCode} deposit=${depo.currencyCode}; skipping bonus apply`);
              }
              console.log(`[approveDeposit] computed bonusAmount=${bonusAmount} currency=${bonusCurrency} tokens=${totalTokens}`);

              if (allowApply && (bonusAmount > 0 || totalTokens > 0)) {
                // Create or update BonusBalance with bonus amount
                const existingBB = await tx.bonusBalance.findUnique({
                  where: { userId_currencyCode: { userId: depo.userId, currencyCode: bonusCurrency } },
                });

                const requiredWagerAmount = bonusAmount > 0
                  ? new Decimal(
                    calcRequiredWager(
                      parseFloat((depo.amount as any)?.toString?.() || String(depo.amount)),
                      bonusAmount,
                      policy,
                    ),
                  )
                  : new Decimal(0);
                const depoAmountNum = parseFloat((depo.amount as any)?.toString?.() || String(depo.amount));
                const maxCashoutAmount = calcMaxCashout(depoAmountNum, policy);

                const replacingLockedWelcome = Boolean(
                  existingBB?.requiresDeposit && !existingBB?.depositActivated,
                );

                if (existingBB) {
                  await tx.bonusBalance.update({
                    where: { userId_currencyCode: { userId: depo.userId, currencyCode: bonusCurrency } },
                    data: {
                      amount: replacingLockedWelcome
                        ? new Decimal(bonusAmount)
                        : { increment: new Decimal(bonusAmount) },
                      totalBonusReceived: replacingLockedWelcome
                        ? new Decimal(bonusAmount)
                        : { increment: new Decimal(bonusAmount) },
                      totalWagered: replacingLockedWelcome
                        ? new Decimal(0)
                        : existingBB.totalWagered,
                      requiredWager: replacingLockedWelcome
                        ? requiredWagerAmount
                        : { increment: requiredWagerAmount },
                      totalTokens: totalTokens > 0 ? { increment: totalTokens } : existingBB.totalTokens,
                      remainingTokens: totalTokens > 0 ? { increment: totalTokens } : existingBB.remainingTokens,
                      tokensPerBet: totalTokens > 0 ? tokensPerBetVal : existingBB.tokensPerBet,
                      minOdds: new Decimal(tokenMinOddsVal),
                      isTokenBased: totalTokens > 0 || existingBB.isTokenBased,
                      isActive: true,
                      requiresDeposit: false,
                      depositActivated: true,
                      activationDepositAmount: new Decimal(depoAmountNum),
                      maxCashout: maxCashoutAmount ? new Decimal(maxCashoutAmount) : null,
                      wagerMultiplier: policy.wagerMultiplier,
                      promoId: promo.id,
                    } as any,
                  });
                } else {
                  await tx.bonusBalance.create({
                    data: {
                      userId: depo.userId,
                      currencyCode: bonusCurrency,
                      amount: new Decimal(bonusAmount),
                      totalBonusReceived: new Decimal(bonusAmount),
                      totalWagered: new Decimal(0),
                      requiredWager: requiredWagerAmount,
                      minOdds: new Decimal(tokenMinOddsVal),
                      consecutiveWins: 0,
                      requiredConsecutiveWins: 0,
                      currentBetAmount: new Decimal(0),
                      isActive: true,
                      requiresDeposit: false,
                      depositActivated: true,
                      activationDepositAmount: new Decimal(depoAmountNum),
                      maxCashout: maxCashoutAmount ? new Decimal(maxCashoutAmount) : null,
                      wagerMultiplier: policy.wagerMultiplier,
                      totalTokens: totalTokens,
                      remainingTokens: totalTokens,
                      tokensPerBet: tokensPerBetVal,
                      isTokenBased: totalTokens > 0,
                      promoId: promo.id,
                    },
                  });
                }
                console.log(`[approveDeposit] BonusBalance created/updated for userId=${depo.userId} amount=${bonusAmount} requiredWager=${requiredWagerAmount.toString()}`);

                if (bonusAmount > 0) {
                  await tx.operation.create({
                    data: {
                      userId: depo.userId,
                      source: OperationSource.PROMO,
                      status: OperationStatus.SUCCESS,
                      type: OperationType.INCOME,
                      amount: new Decimal(bonusAmount),
                      currencyCode: bonusCurrency,
                      meta: { promoId: promo.id, promoCode: promo.code, type: promo.type, depositId: depo.id, target: 'BonusBalance' },
                    },
                  });
                  console.log(`[approveDeposit] bonus operation created for userId=${depo.userId} amount=${bonusAmount}`);
                }

                // Record bonus history entry for visibility
                await tx.bonusHistory.create({
                  data: {
                    userId: depo.userId,
                    promoId: promo.id,
                    promoCode: promo.code,
                    promoType: promo.type as any,
                    promoValue: promo.value as any,
                    status: 'PENDING' as any,
                    totalBonusReceived: new Decimal(bonusAmount),
                    totalWagered: new Decimal(0),
                    requiredWager: requiredWagerAmount,
                    totalTokens: totalTokens,
                    remainingTokens: totalTokens,
                    tokensPerBet: tokensPerBetVal,
                    isTokenBased: totalTokens > 0,
                    currencyCode: bonusCurrency,
                  },
                });
                console.log(`[approveDeposit] bonus history created depositId=${depo.id}`);

                bonusApplied = true;
                bonusAmountCredited = bonusAmount;
                bonusCurrencyUsed = bonusCurrency;
                redeemedPromo = {
                  id: promo.id,
                  code: promo.code,
                  partnerId: promo.partnerId,
                  value: promo.value,
                };
                
                tokensGranted = totalTokens;
                tokensPerBet = tokensPerBetVal;
                tokenMinOdds = tokenMinOddsVal;
              } else {
                console.log(`[approveDeposit] Computed bonusAmount <= 0 and no tokens for promo ${promo.code}`);
              }
            }
          }
        }
      }

      if (!bonusApplied) {
        const priorSuccess = await tx.deposit.count({
          where: { userId: depo.userId, status: DepositStatus.SUCCESS },
        });
        const fingerprint = buildPaymentFingerprint({
          paymentSystem: depo.paymentSystem,
          externalId: depo.externalId,
          meta: depo.meta,
        });
        await this.bonusBalanceService?.afterDepositCredited({
          userId: depo.userId,
          currencyCode: depo.currencyCode,
          depositAmount: parseFloat((depo.amount as any)?.toString?.() || String(depo.amount)),
          paymentSystem: depo.paymentSystem,
          externalId: depo.externalId,
          meta: depo.meta,
          depositOrdinal: priorSuccess + 1,
          tx,
        });
      }

      // Update deposit status
      await tx.deposit.update({
        where: { id: depo.id },
        data: { status: DepositStatus.SUCCESS, updatedAt: new Date() },
      });
    });

    if (bonusApplied && redeemedPromo && bonusCurrencyUsed) {
      await this.partnersService.handlePromoRedemption(
        depo.userId,
        redeemedPromo,
        bonusAmountCredited,
        bonusCurrencyUsed,
      );
    }

    const summary = {
      ok: true,
      bonusApplied,
      bonusAmountCredited,
      bonusCurrencyUsed,
      tokensGranted,
      tokensPerBet,
      tokenMinOdds,
      diagnostics,
    };
    console.log(`[approveDeposit] end id=${id}`, summary);

    const publicOrderId = readPublicOrderId(depo.meta) ?? depo.id;
    this.depositUserNotify.notifyDepositStatus({
      userId: depo.userId,
      orderId: depo.id,
      publicOrderId,
      status: 'approved',
      amount: Number(depo.amount),
      currency: depo.currencyCode,
    });

    return summary;
  }

  async rejectDeposit(id: number) {
    const depo = await this.prisma.deposit.findUnique({ where: { id } });
    if (!depo) throw new Error('Deposit not found');
    if (depo.status !== DepositStatus.PENDING && depo.status !== DepositStatus.PROCESSING) {
      throw new Error('Deposit already processed');
    }

    await this.prisma.deposit.update({
      where: { id: depo.id },
      data: { status: DepositStatus.FAILED, updatedAt: new Date() },
    });

    const publicOrderId = readPublicOrderId(depo.meta) ?? depo.id;
    this.depositUserNotify.notifyDepositStatus({
      userId: depo.userId,
      orderId: depo.id,
      publicOrderId,
      status: 'rejected',
      amount: Number(depo.amount),
      currency: depo.currencyCode,
    });

    return { ok: true };
  }

  // List usages for a promo by code
  async getPromoUsages(code: string) {
    const promo = await this.prisma.promo.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } as any },
      include: {
        promoOnUsers: { include: { user: { select: { id: true, email: true } } } },
        _count: { select: { promoOnUsers: true } } as any,
      } as any,
    } as any);
    if (!promo) throw new Error('Promo not found');
    const used = (promo as any)._count?.promoOnUsers || 0;
    const remaining = (promo.available || 0) - Number(used);
    const usages = (promo as any).promoOnUsers.map((it: any) => ({
      userId: it.userId,
      userEmail: it.user?.email || '',
      status: it.status,
    }));
    return {
      promo: { id: promo.id, code: promo.code, type: promo.type, available: promo.available, remaining },
      usages,
    };
  }

  // Grant promo manually to a user (counts as used if not already), always credits bonus and history
  async grantPromoManually(code: string, userEmail: string) {
    const user = await this.prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) throw new Error('User not found');
    const promo = await this.prisma.promo.findFirst({ where: { code: { equals: code, mode: 'insensitive' } as any } } as any);
    if (!promo) throw new Error('Promo not found');

    return await this.prisma.$transaction(async (tx) => {
      // Ensure usage row exists (so it's counted as used)
      const exists = await tx.promoOnUsers.findUnique({ where: { promoId_userId: { promoId: promo.id, userId: user.id } } });
      if (!exists) {
        await tx.promoOnUsers.create({ data: { promoId: promo.id, userId: user.id, status: 'APPLIED' as any } });
      }

      // Compute bonus
      const value: any = promo.value as any;
      let bonusAmount = 0;
      if (promo.type === 'DIRECT_BONUS' || promo.type === 'VOUCHER') {
        bonusAmount = Number(value?.amount || 0);
      } else if (promo.type === 'DEPOSIT_BONUS') {
        const pct = Number(value?.percentage || 0);
        // For manual grant with deposit bonus, if no deposit context, grant minDeposit * pct
        const base = Number(value?.minDeposit || 0);
        bonusAmount = base * (pct / 100);
      }
      const bonusCurrency = promo.currencyCode || 'RUB';

      if (bonusAmount > 0) {
        await tx.balance.upsert({
          where: { userId_currencyCode: { userId: user.id, currencyCode: bonusCurrency } },
          update: { amount: { increment: new Decimal(bonusAmount) } },
          create: { userId: user.id, currencyCode: bonusCurrency, amount: new Decimal(bonusAmount) },
        });
        await tx.operation.create({
          data: {
            userId: user.id,
            source: OperationSource.BONUS_COMPLETE,
            status: OperationStatus.SUCCESS,
            type: OperationType.INCOME,
            amount: new Decimal(bonusAmount),
            currencyCode: bonusCurrency,
            meta: { promoId: promo.id, promoCode: promo.code, type: promo.type, grant: 'manual' },
          },
        });
      }

      const totalTokens = Number((value?.totalTokens ?? 0));
      const tokensPerBet = Number((value?.tokensPerBet ?? 1));
      const tokenMinOdds = Number((value?.tokenMinOdds ?? 1.8));
      if (totalTokens > 0) {
        const existingBB = await tx.bonusBalance.findUnique({ where: { userId_currencyCode: { userId: user.id, currencyCode: bonusCurrency } } });
        if (existingBB) {
          await tx.bonusBalance.update({
            where: { userId_currencyCode: { userId: user.id, currencyCode: bonusCurrency } },
            data: {
              totalTokens: { increment: totalTokens },
              remainingTokens: { increment: totalTokens },
              tokensPerBet,
              minOdds: new Decimal(tokenMinOdds),
              isTokenBased: true,
              isActive: true,
            } as any,
          });
        } else {
          await tx.bonusBalance.create({
            data: {
              userId: user.id,
              currencyCode: bonusCurrency,
              amount: new Decimal(0),
              totalBonusReceived: new Decimal(0),
              totalWagered: new Decimal(0),
              requiredWager: new Decimal(0),
              minOdds: new Decimal(tokenMinOdds),
              consecutiveWins: 0,
              requiredConsecutiveWins: 0,
              currentBetAmount: new Decimal(0),
              isActive: true,
              totalTokens,
              remainingTokens: totalTokens,
              tokensPerBet,
              isTokenBased: true,
              promoId: promo.id,
            },
          });
        }
      }

      await tx.bonusHistory.create({
        data: {
          userId: user.id,
          promoId: promo.id,
          promoCode: promo.code,
          promoType: promo.type as any,
          promoValue: promo.value as any,
          status: 'PENDING' as any,
          totalBonusReceived: new Decimal(bonusAmount),
          totalWagered: new Decimal(0),
          requiredWager: new Decimal(0),
          totalTokens,
          remainingTokens: totalTokens,
          tokensPerBet,
          isTokenBased: totalTokens > 0,
          currencyCode: bonusCurrency,
          notes: 'manual grant',
        },
      });

      return { ok: true, bonusAmount, bonusCurrency, totalTokens };
    });
  }

  // Cancel a usage (mark as EXPIRED/CANCELLED), keep it counted as used (do not delete row)
  async cancelPromoUsage(code: string, userEmail: string) {
    const user = await this.prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) throw new Error('User not found');
    const promo = await this.prisma.promo.findFirst({ where: { code: { equals: code, mode: 'insensitive' } as any } } as any);
    if (!promo) throw new Error('Promo not found');

    await this.prisma.$transaction(async (tx) => {
      const usage = await tx.promoOnUsers.findUnique({ where: { promoId_userId: { promoId: promo.id, userId: user.id } } });
      if (usage) {
        await tx.promoOnUsers.update({
          where: { promoId_userId: { promoId: promo.id, userId: user.id } },
          data: { status: 'EXPIRED' as any },
        });
      }

      // Find last bonus history entry to know what to revoke
      const bh = await tx.bonusHistory.findFirst({
        where: { userId: user.id, promoId: promo.id, status: { in: ['PENDING'] as any } },
        orderBy: { appliedAt: 'desc' },
      });

      let revokeAmount = 0;
      let currencyCode = promo.currencyCode || 'RUB';
      let revokeTokens = 0;
      const value: any = promo.value as any;
      if (bh) {
        revokeAmount = parseFloat((bh.totalBonusReceived as any)?.toString?.() || String(bh.totalBonusReceived || 0));
        currencyCode = bh.currencyCode || currencyCode;
        revokeTokens = Number(bh.totalTokens || 0);
      }

      // Revoke money: decrease user's balance and create reversal operation
      if (revokeAmount > 0) {
        await tx.balance.upsert({
          where: { userId_currencyCode: { userId: user.id, currencyCode } },
          update: { amount: { decrement: new Decimal(revokeAmount) } },
          create: { userId: user.id, currencyCode, amount: new Decimal(0) },
        });

        await tx.operation.create({
          data: {
            userId: user.id,
            source: OperationSource.PROMO,
            status: OperationStatus.SUCCESS,
            type: OperationType.OUTCOME,
            amount: new Decimal(revokeAmount),
            currencyCode,
            meta: { promoId: promo.id, promoCode: promo.code, action: 'revoke', reason: 'manual cancel' },
          },
        });
      }

      // Revoke tokens and clean bonus balance if empty
      const bb = await tx.bonusBalance.findUnique({ where: { userId_currencyCode: { userId: user.id, currencyCode } } });
      if (bb) {
        // If this bonus balance is tied to this promo, force-clear tokens entirely
        const belongsToPromo = bb.promoId === promo.id;
        const currentRemaining = Number(bb.remainingTokens || 0);
        const currentTotalTokens = Number(bb.totalTokens || 0);
        const newRemaining = belongsToPromo ? 0 : Math.max(0, currentRemaining - (revokeTokens || 0));
        const newTotalTokens = belongsToPromo ? 0 : Math.max(0, currentTotalTokens - (revokeTokens || 0));

        const dataUpdate: any = {
          remainingTokens: newRemaining,
          totalTokens: newTotalTokens,
          amount: new Decimal(0),
          totalBonusReceived: new Decimal(0),
          totalWagered: new Decimal(0),
          requiredWager: new Decimal(0),
          currentBetAmount: new Decimal(0),
        };

        const willBeEmpty = newRemaining === 0 && newTotalTokens === 0;
        if (willBeEmpty && belongsToPromo) {
          // If empty and belongs to this promo, remove the bonus balance row entirely
          await tx.bonusBalance.delete({ where: { userId_currencyCode: { userId: user.id, currencyCode } } });
        } else {
          // Otherwise, just update and detach promo if tokens are gone
          if (belongsToPromo && willBeEmpty) {
            dataUpdate.isActive = false;
            dataUpdate.isTokenBased = false;
            dataUpdate.promoId = null;
          }
          await tx.bonusBalance.update({
            where: { userId_currencyCode: { userId: user.id, currencyCode } },
            data: dataUpdate,
          });
        }
      }

      // Update bonus history status to CANCELLED
      await tx.bonusHistory.updateMany({
        where: { userId: user.id, promoId: promo.id, status: { in: ['PENDING'] as any } },
        data: { status: 'CANCELLED' as any, notes: 'manual cancel' },
      });
    });
    return { ok: true };
  }
}
