import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AffilatorStatus, DepositStatus, OperationType, Prisma, WcOddsBetStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { hash } from 'bcrypt';

import { PaymentSystemService } from '~/integrations/payment-system/payment-system.service';
import { AffiliatePostbackService } from '~/main/partners/affiliate-postback.service';
import { PartnersService } from '~/main/partners/partners.service';
import { WithdrawDto } from '~/main/partners/profile/dto/withdraw.dto';
import { CreatePartnerPromoDto } from '~/main/partners/profile/dto/create-partner-promo.dto';
import { PrismaService } from '~/prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paymentService: PaymentSystemService,
    private readonly config: ConfigService,
    private readonly partnersService: PartnersService,
    private readonly affiliatePostbackService: AffiliatePostbackService,
  ) {}

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private async sumAffiliateNetForPeriod(
    userId: number,
    startDate?: Date,
    currencyCode?: string,
  ): Promise<Record<string, number>> {
    const whereCondition: Prisma.OperationWhereInput = {
      userId,
      source: 'AFFILIATE',
      status: 'SUCCESS',
      ...(startDate
        ? {
            createdAt: {
              gte: startDate,
            },
          }
        : {}),
      ...(currencyCode ? { currencyCode } : {}),
    };

    const data = await this.prismaService.operation.findMany({
      where: whereCondition,
      select: {
        amount: true,
        currencyCode: true,
        type: true,
      },
    });

    return data.reduce((acc, operation) => {
      const currency = operation.currencyCode;
      if (!acc[currency]) acc[currency] = 0;
      const amount = operation.amount.toNumber();
      if (operation.type === OperationType.INCOME) {
        acc[currency] += amount;
      } else if (operation.type === OperationType.OUTCOME) {
        acc[currency] -= amount;
      }
      return acc;
    }, {} as Record<string, number>);
  }

  async findById(userId: number) {
    return this.prismaService.user.findFirst({
      include: {
        affilator: true,
        balances: true,
      },
      where: { id: userId },
    });
  }

  async getBalanceForPeriod(period: number, userId: number, currencyCode?: string) {
    const now = new Date();
    now.setDate(new Date().getDate() - period);
    return this.sumAffiliateNetForPeriod(userId, now, currencyCode);
  }

  async getBalanceForAllTime(userId: number, currencyCode?: string) {
    return this.sumAffiliateNetForPeriod(userId, undefined, currencyCode);
  }

  async getBalances(userId: number) {
    const balances = [];
    const data = await this.prismaService.balance.findMany({
      where: {
        userId,
      },
    });
    for (let i = 0; i < data.length; i++) {
      balances.push({
        amount: data[i].amount.toString(),
        currencyCode: data[i].currencyCode,
        id: data[i].id,
      });
    }
    return balances;
  }

  async getStatsForPartner(userId: number, currencyCode?: string) {
    const allTimeAffiliated = await this.prismaService.user.count({
      where: { affiliatedById: userId },
    });

    const firstDeposits = await this.countFirstDepositsForPartner(userId);

    // Получаем статистику по периодам
    const dayStats = await this.getBalanceForPeriod(1, userId, currencyCode);
    const weekStats = await this.getBalanceForPeriod(7, userId, currencyCode);
    const monthStats = await this.getBalanceForPeriod(30, userId, currencyCode);
    const allTimeStats = await this.getBalanceForAllTime(userId, currencyCode);

    // Если указана конкретная валюта, возвращаем только её
    if (currencyCode) {
      return {
        allTimeAffiliated: allTimeAffiliated.toString(),
        firstDeposits: firstDeposits.toString(),
        balanceForDay: (dayStats[currencyCode] || 0).toString(),
        balanceForWeek: (weekStats[currencyCode] || 0).toString(),
        balanceForMonth: (monthStats[currencyCode] || 0).toString(),
        balanceForAll: (allTimeStats[currencyCode] || 0).toString(),
        currency: currencyCode,
      };
    }

    // Иначе возвращаем общую сумму по всем валютам (временное решение)
    const totalDay = Object.values(dayStats).reduce((sum, amount) => sum + amount, 0);
    const totalWeek = Object.values(weekStats).reduce((sum, amount) => sum + amount, 0);
    const totalMonth = Object.values(monthStats).reduce((sum, amount) => sum + amount, 0);
    const totalAllTime = Object.values(allTimeStats).reduce((sum, amount) => sum + amount, 0);

    return {
      allTimeAffiliated: allTimeAffiliated.toString(),
      firstDeposits: firstDeposits.toString(),
      balanceForDay: totalDay.toString(),
      balanceForWeek: totalWeek.toString(),
      balanceForMonth: totalMonth.toString(),
      balanceForAll: totalAllTime.toString(),
      currency: 'USD', // По умолчанию USD
    };
  }

  private async countFirstDepositsForPartner(partnerUserId: number): Promise<number> {
    const referredUsers = await this.prismaService.user.findMany({
      where: { affiliatedById: partnerUserId },
      select: { id: true },
    });

    if (referredUsers.length === 0) return 0;

    const userIds = referredUsers.map((user) => user.id);
    const deposits = await this.prismaService.deposit.findMany({
      where: {
        userId: { in: userIds },
        status: DepositStatus.SUCCESS,
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const seen = new Set<number>();
    let count = 0;
    for (const deposit of deposits) {
      if (!seen.has(deposit.userId)) {
        seen.add(deposit.userId);
        count += 1;
      }
    }
    return count;
  }

  private getChartPeriodConfig(period: 'day' | 'week' | 'month' | 'all') {
    const now = new Date();
    let points = 0;
    let bucketDurationMs = 0;
    let startDate = new Date(now);

    if (period === 'day') {
      points = 24;
      bucketDurationMs = 60 * 60 * 1000;
      startDate = new Date(now.getTime() - points * bucketDurationMs);
    } else if (period === 'week') {
      points = 7;
      bucketDurationMs = 24 * 60 * 60 * 1000;
      startDate = new Date(now.getTime() - points * bucketDurationMs);
    } else if (period === 'month') {
      points = 30;
      bucketDurationMs = 24 * 60 * 60 * 1000;
      startDate = new Date(now.getTime() - points * bucketDurationMs);
    } else {
      points = 12;
      bucketDurationMs = 30 * 24 * 60 * 60 * 1000;
      const startAll = new Date(now);
      startAll.setMonth(startAll.getMonth() - (points - 1));
      startAll.setHours(0, 0, 0, 0);
      startAll.setDate(1);
      startDate = startAll;
    }

    return { now, points, bucketDurationMs, startDate, period };
  }

  private formatChartLabel(date: Date, period: 'day' | 'week' | 'month' | 'all') {
    if (period === 'day') {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    if (period === 'week' || period === 'month') {
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
  }

  private buildChartBuckets(
    period: 'day' | 'week' | 'month' | 'all',
    points: number,
    startDate: Date,
    bucketDurationMs: number,
  ) {
    return Array.from({ length: points }, (_, i) => {
      let bucketStart = new Date(startDate);
      if (period === 'all') {
        bucketStart = new Date(startDate);
        bucketStart.setMonth(startDate.getMonth() + i);
        bucketStart.setDate(1);
        bucketStart.setHours(0, 0, 0, 0);
      } else {
        bucketStart = new Date(startDate.getTime() + i * bucketDurationMs);
      }
      return {
        date: this.formatChartLabel(bucketStart, period),
        value: 0,
        bucketStart,
      };
    });
  }

  private bucketIndexForDate(
    date: Date,
    period: 'day' | 'week' | 'month' | 'all',
    startDate: Date,
    points: number,
    bucketDurationMs: number,
  ) {
    if (period === 'all') {
      const monthsDiff =
        (date.getFullYear() - startDate.getFullYear()) * 12
        + (date.getMonth() - startDate.getMonth());
      return monthsDiff >= 0 && monthsDiff < points ? monthsDiff : -1;
    }

    const diffMs = date.getTime() - startDate.getTime();
    const index = Math.floor(diffMs / bucketDurationMs);
    return index >= 0 && index < points ? index : -1;
  }

  async getChartDataForPartner(
    userId: number,
    currencyCode: string | undefined,
    period: 'day' | 'week' | 'month' | 'all',
    metric: 'income' | 'registrations' | 'ftd' = 'income',
  ) {
    const { now, points, bucketDurationMs, startDate } =
      this.getChartPeriodConfig(period);

    const buckets = this.buildChartBuckets(
      period,
      points,
      startDate,
      bucketDurationMs,
    );

    if (metric === 'registrations') {
      const registrations = await this.prismaService.user.findMany({
        where: {
          affiliatedById: userId,
          createdAt: { gte: startDate, lte: now },
        },
        select: { createdAt: true },
      });

      registrations.forEach((row) => {
        const index = this.bucketIndexForDate(
          new Date(row.createdAt),
          period,
          startDate,
          points,
          bucketDurationMs,
        );
        if (index >= 0) buckets[index].value += 1;
      });
    } else if (metric === 'ftd') {
      const referredUsers = await this.prismaService.user.findMany({
        where: { affiliatedById: userId },
        select: { id: true },
      });
      const userIds = referredUsers.map((user) => user.id);

      if (userIds.length > 0) {
        const deposits = await this.prismaService.deposit.findMany({
          where: {
            userId: { in: userIds },
            status: DepositStatus.SUCCESS,
            createdAt: { gte: startDate, lte: now },
          },
          select: { userId: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        });

        const firstDepositAt = new Map<number, Date>();
        for (const deposit of deposits) {
          if (!firstDepositAt.has(deposit.userId)) {
            firstDepositAt.set(deposit.userId, deposit.createdAt);
          }
        }

        firstDepositAt.forEach((createdAt) => {
          const index = this.bucketIndexForDate(
            new Date(createdAt),
            period,
            startDate,
            points,
            bucketDurationMs,
          );
          if (index >= 0) buckets[index].value += 1;
        });
      }
    } else {
      const whereCondition: Prisma.OperationWhereInput = {
        userId,
        source: 'AFFILIATE',
        createdAt: { gte: startDate, lte: now },
      };
      if (currencyCode) {
        whereCondition.currencyCode = currencyCode;
      }

      const operations = await this.prismaService.operation.findMany({
        where: whereCondition,
        select: {
          amount: true,
          createdAt: true,
          type: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      operations.forEach((op) => {
        const index = this.bucketIndexForDate(
          new Date(op.createdAt),
          period,
          startDate,
          points,
          bucketDurationMs,
        );
        if (index >= 0) {
          const signed =
            op.type === OperationType.OUTCOME
              ? -op.amount.toNumber()
              : op.amount.toNumber();
          buckets[index].value += signed;
        }
      });
    }

    const data = buckets.map((bucket) => ({
      date: bucket.date,
      value: Math.round(bucket.value * 100) / 100,
    }));

    const total = data.reduce((sum, point) => sum + point.value, 0);

    return {
      data,
      currency: currencyCode || 'USD',
      metric,
      total: Math.round(total * 100) / 100,
    } as const;
  }

  async operations(userId: number) {
    const waitData = await this.prismaService.operation.findMany({
      where: {
        source: 'PAYMENT_SYSTEM',
        type: 'OUTCOME',
        userId,
      },
    });
    const successData = await this.prismaService.operation.findMany({
      where: {
        source: 'PAYMENT_SYSTEM',
        status: 'SUCCESS',
        type: 'OUTCOME',
        userId,
      },
    });
    return {
      amount: successData.length,
      data: waitData,
    };
  }

  async updatePassword(userId: number, pass: string | undefined) {
    if (pass) {
      const hashedPassword = await hash(
        pass,
        this.config.get<string>('PASSWORD_HASH_SALT'),
      );
      await this.prismaService.user.update({
        data: {
          password: hashedPassword,
        },
        where: {
          id: userId,
        },
      });
    }
  }

  async updateProfileMeta(userId: number, meta: Prisma.InputJsonValue) {
    const current = await this.prismaService.affilator.findUnique({
      where: { userId },
      select: { meta: true },
    });

    const currentMeta =
      current?.meta && typeof current.meta === 'object' && !Array.isArray(current.meta)
        ? (current.meta as Record<string, unknown>)
        : {};

    const nextMeta =
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {};

    return this.prismaService.affilator.update({
      data: {
        meta: {
          ...currentMeta,
          ...nextMeta,
        } as Prisma.InputJsonValue,
      },
      where: { userId },
    });
  }

  async withdraw(userId: number, data: WithdrawDto) {
    const affiliator = await this.prismaService.affilator.findFirst({
      where: {
        userId,
      },
    });
    if (!(affiliator.meta as { wallet: string })?.wallet) {
      throw new BadRequestException(['Укажите адрес кошелька (в профиле)']);
    }

    const validationError = await this.partnersService.validatePartnerWithdraw(
      userId,
      data.amount,
      data.currency,
    );
    if (validationError) {
      throw new BadRequestException([validationError]);
    }

    const isFirstWithdrawal =
      await this.partnersService.isFirstAffiliateWithdrawal(userId);

    await this.paymentService.withdraw({
      amount: new Decimal(data.amount),
      currency: data.currency,
      userId,
      method: 'affiliate',
      wallet: (affiliator.meta as { wallet: string }).wallet,
      meta: {
        isFirstAffiliateWithdrawal: isFirstWithdrawal,
        requiresReview: isFirstWithdrawal,
      },
    });
    return HttpStatus.OK;
  }

  async getAffiliateCommissions(userId: number, limit?: number) {
    return this.partnersService.getPartnerCommissions(userId, limit);
  }

  async getPostbackLogs(userId: number, limit?: number) {
    return this.partnersService.getPostbackLogs(userId, limit);
  }

  async testPostback(userId: number) {
    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId },
    });

    if (!affiliator) {
      throw new BadRequestException(['Партнёр не найден']);
    }

    const url = this.partnersService.getPartnerPostbackUrl(affiliator);

    if (!url?.trim()) {
      throw new BadRequestException(['Укажите Postback URL в профиле']);
    }

    return this.affiliatePostbackService.sendTest(userId, url.trim(), affiliator.uid);
  }

  async getPartnerAccountStatus(userId: number) {
    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId },
      select: { status: true },
    });

    return {
      status: affiliator?.status ?? AffilatorStatus.PENDING,
    };
  }

  async getWithdrawalSummary(userId: number) {
    return this.partnersService.getPartnerWithdrawalSummary(userId);
  }

  async getReferralLink(userId: number) {
    const affiliator = await this.prismaService.affilator.findFirst({
      where: {
        userId,
      },
    });

    if (!affiliator) {
      throw new BadRequestException(['Партнер не найден']);
    }

    const baseUrl = this.config.get<string>('AFFILIATE_BASE_URL') || 'https://imba.bet/';
    const url = new URL(baseUrl);
    url.searchParams.set('tag', affiliator.uid);

    const meta =
      affiliator.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
        ? (affiliator.meta as Record<string, unknown>)
        : {};
    const kickMeta =
      meta.kick && typeof meta.kick === 'object' && !Array.isArray(meta.kick)
        ? (meta.kick as Record<string, unknown>)
        : {};

    const channelSlug =
      affiliator.kickChannelSlug?.trim()
      || (typeof meta.kickChannel === 'string'
        ? String(meta.kickChannel).trim().replace(/^@/, '')
        : typeof kickMeta.channelSlug === 'string'
          ? kickMeta.channelSlug.trim().replace(/^@/, '')
          : '');

    if (channelSlug) {
      url.searchParams.set('sub1', 'kick');
      url.searchParams.set('sub2', channelSlug.slice(0, 64));
      const sessionId =
        typeof kickMeta.activeSessionId === 'string'
          ? kickMeta.activeSessionId.trim().slice(0, 64)
          : '';
      if (sessionId) {
        url.searchParams.set('sub3', sessionId);
      }
    }

    const referralLink = url.toString();
    const promoCodes = await this.partnersService.getPartnerPromoCodes(userId);

    return {
      referralLink,
      uid: affiliator.uid,
      percent: affiliator.percent.toString(),
      promoCodes,
    };
  }

  async getPartnerPromoCodes(userId: number) {
    return this.partnersService.getPartnerPromoCodes(userId);
  }

  async createPartnerSelfPromo(userId: number, body: CreatePartnerPromoDto) {
    return this.partnersService.createPartnerSelfPromo(userId, body);
  }

  async getSubIdStats(
    userId: number,
    dimension: 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'sub5',
    currencyCode?: string,
  ) {
    return this.partnersService.getSubIdStatsForPartner(
      userId,
      dimension,
      currencyCode,
    );
  }

  async getReferredClients(partnerUserId: number) {
    const clients = await this.prismaService.user.findMany({
      where: { affiliatedById: partnerUserId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        wcOddsBets: {
          select: {
            id: true,
            stake: true,
            status: true,
            currencyCode: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return clients.map((client) => {
      const totalBets = client.wcOddsBets.length;
      const totalLosses = client.wcOddsBets.filter(
        (bet) => bet.status === WcOddsBetStatus.LOSE,
      ).length;
      const totalWins = client.wcOddsBets.filter(
        (bet) => bet.status === WcOddsBetStatus.WIN,
      ).length;
      const totalStake = client.wcOddsBets.reduce(
        (sum, bet) => sum + bet.stake.toNumber(),
        0,
      );

      return {
        id: client.id,
        email: this.maskEmail(client.email),
        registeredAt: client.createdAt.toISOString(),
        totalBets,
        totalWins,
        totalLosses,
        totalStake: Math.round(totalStake * 100) / 100,
        recentBets: client.wcOddsBets.slice(0, 5).map((bet) => ({
          id: bet.id,
          stake: bet.stake.toString(),
          status: bet.status,
          currencyCode: bet.currencyCode,
          createdAt: bet.createdAt.toISOString(),
        })),
      };
    });
  }
}
