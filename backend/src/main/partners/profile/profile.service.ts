import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { hash } from 'bcrypt';

import { PaymentSystemService } from '~/integrations/payment-system/payment-system.service';
import { WithdrawDto } from '~/main/partners/profile/dto/withdraw.dto';
import { PrismaService } from '~/prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paymentService: PaymentSystemService,
    private readonly config: ConfigService,
  ) {}

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
    
    const whereCondition: any = {
      createdAt: {
        gte: now,
      },
      source: 'AFFILIATE',
      userId,
    };

    // Если указана валюта, фильтруем по ней
    if (currencyCode) {
      whereCondition.currencyCode = currencyCode;
    }

    const data = await this.prismaService.operation.findMany({
      where: whereCondition,
    });

    // Группируем по валютам
    const summaryByCurrency = data.reduce((acc, operation) => {
      const currency = operation.currencyCode;
      if (!acc[currency]) {
        acc[currency] = 0;
      }
      acc[currency] += operation.amount.toNumber();
      return acc;
    }, {} as Record<string, number>);

    return summaryByCurrency;
  }

  async getBalanceForAllTime(userId: number, currencyCode?: string) {
    const whereCondition: any = {
      source: 'AFFILIATE',
      userId,
    };

    // Если указана валюта, фильтруем по ней
    if (currencyCode) {
      whereCondition.currencyCode = currencyCode;
    }

    const data = await this.prismaService.operation.findMany({
      where: whereCondition,
    });

    // Группируем по валютам
    const summaryByCurrency = data.reduce((acc, operation) => {
      const currency = operation.currencyCode;
      if (!acc[currency]) {
        acc[currency] = 0;
      }
      acc[currency] += operation.amount.toNumber();
      return acc;
    }, {} as Record<string, number>);

    return summaryByCurrency;
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

    // Получаем статистику по периодам
    const dayStats = await this.getBalanceForPeriod(1, userId, currencyCode);
    const weekStats = await this.getBalanceForPeriod(7, userId, currencyCode);
    const monthStats = await this.getBalanceForPeriod(30, userId, currencyCode);
    const allTimeStats = await this.getBalanceForAllTime(userId, currencyCode);

    // Если указана конкретная валюта, возвращаем только её
    if (currencyCode) {
      return {
        allTimeAffiliated: allTimeAffiliated.toString(),
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
      balanceForDay: totalDay.toString(),
      balanceForWeek: totalWeek.toString(),
      balanceForMonth: totalMonth.toString(),
      balanceForAll: totalAllTime.toString(),
      currency: 'USD', // По умолчанию USD
    };
  }

  async getChartDataForPartner(
    userId: number,
    currencyCode: string | undefined,
    period: 'day' | 'week' | 'month' | 'all',
  ) {
    // Определяем интервал и количество точек
    const now = new Date();
    let points = 0;
    let bucketDurationMs = 0;
    let startDate = new Date(now);

    if (period === 'day') {
      points = 24; // почасовые точки за последние 24 часа
      bucketDurationMs = 60 * 60 * 1000;
      startDate = new Date(now.getTime() - points * bucketDurationMs);
    } else if (period === 'week') {
      points = 7; // по дням за 7 дней
      bucketDurationMs = 24 * 60 * 60 * 1000;
      startDate = new Date(now.getTime() - points * bucketDurationMs);
    } else if (period === 'month') {
      points = 30; // по дням за 30 дней
      bucketDurationMs = 24 * 60 * 60 * 1000;
      startDate = new Date(now.getTime() - points * bucketDurationMs);
    } else {
      // all
      points = 12; // по месяцам за 12 месяцев
      // bucketDurationMs используется только для вычисления индекса; для месяцев посчитаем отдельно
      bucketDurationMs = 30 * 24 * 60 * 60 * 1000;
      const startAll = new Date(now);
      startAll.setMonth(startAll.getMonth() - (points - 1));
      startAll.setHours(0, 0, 0, 0);
      startAll.setDate(1); // начало первого месяца
      startDate = startAll;
    }

    // Загружаем операции
    const whereCondition: any = {
      userId,
      source: 'AFFILIATE',
      createdAt: {
        gte: startDate,
        lte: now,
      },
    };
    if (currencyCode) {
      whereCondition.currencyCode = currencyCode;
    }

    const operations = await this.prismaService.operation.findMany({
      where: whereCondition,
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Инициализируем корзины нулями
    const buckets = Array.from({ length: points }, () => 0);

    // Вспомогательные форматтеры меток
    const formatLabel = (date: Date) => {
      if (period === 'day') {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      }
      if (period === 'week' || period === 'month') {
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      }
      return date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
    };

    // Заполняем корзины
    if (period === 'all') {
      // индексация по месяцу
      operations.forEach((op) => {
        const opDate = new Date(op.createdAt);
        const monthsDiff = (opDate.getFullYear() - startDate.getFullYear()) * 12 + (opDate.getMonth() - startDate.getMonth());
        if (monthsDiff >= 0 && monthsDiff < points) {
          buckets[monthsDiff] += op.amount.toNumber();
        }
      });
    } else {
      operations.forEach((op) => {
        const opDate = new Date(op.createdAt);
        const diffMs = opDate.getTime() - startDate.getTime();
        const index = Math.floor(diffMs / bucketDurationMs);
        if (index >= 0 && index < points) {
          buckets[index] += op.amount.toNumber();
        }
      });
    }

    // Собираем точки данных с корректными датами начала корзин
    const data = Array.from({ length: points }).map((_, i) => {
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
        date: formatLabel(bucketStart),
        value: Math.round(buckets[i] * 100) / 100,
      };
    });

    return {
      data,
      currency: currencyCode || 'USD',
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
    return this.prismaService.affilator.update({
      data: {
        meta,
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
    await this.paymentService.withdraw({
      amount: new Decimal(data.amount),
      currency: data.currency,
      userId,
      method: 'affiliate',
      wallet: (affiliator.meta as { wallet: string }).wallet
    });
    return HttpStatus.OK;
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
    const referralLink = `${baseUrl}?tag=${affiliator.uid}`;

    return {
      referralLink,
      uid: affiliator.uid,
      percent: affiliator.percent.toString(),
    };
  }
}
