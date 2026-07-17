import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Decimal } from '@prisma/client/runtime/library';
import { OperationSource, OperationStatus, OperationType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TelegramUserNotifyService } from '../telegram/telegram-user-notify.service';
import { PushUserNotifyService } from '../push/push-user-notify.service';

const CASHBACK_RATE = 0.05;
const MIN_NET_LOSS = 500;
const MAX_CASHBACK: Record<string, number> = {
  KZT: 5000,
  RUB: 3000,
  USD: 50,
  USDT: 50,
  BRL: 150,
  TRY: 2500,
};

function getWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class WeeklyCashbackService {
  private readonly logger = new Logger(WeeklyCashbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramUserNotify: TelegramUserNotifyService,
    private readonly pushUserNotify: PushUserNotifyService,
  ) {}

  /** Каждый понедельник в 06:00 UTC */
  @Cron('0 6 * * 1')
  async grantWeeklyCashback(): Promise<void> {
    const now = new Date();
    const weekStart = getWeekStart(now);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const betOps = await this.prisma.operation.findMany({
      where: {
        source: { in: [OperationSource.BET, OperationSource.BONUS_BET, OperationSource.WC_BET] },
        status: OperationStatus.SUCCESS,
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      select: { userId: true, currencyCode: true, type: true, amount: true },
    });

    const netByUserCurrency = new Map<string, { userId: number; currencyCode: string; netLoss: number }>();

    for (const op of betOps) {
      const key = `${op.userId}:${op.currencyCode}`;
      const entry = netByUserCurrency.get(key) ?? {
        userId: op.userId,
        currencyCode: op.currencyCode,
        netLoss: 0,
      };
      const amount = Number(op.amount);
      if (op.type === OperationType.OUTCOME) {
        entry.netLoss += amount;
      } else if (op.type === OperationType.INCOME) {
        entry.netLoss -= amount;
      }
      netByUserCurrency.set(key, entry);
    }

    let granted = 0;

    for (const entry of netByUserCurrency.values()) {
      if (entry.netLoss < MIN_NET_LOSS) continue;

      const maxCb = MAX_CASHBACK[entry.currencyCode] ?? 50;
      const cashbackAmount = Math.min(
        Math.floor(entry.netLoss * CASHBACK_RATE),
        maxCb,
      );
      if (cashbackAmount <= 0) continue;

      try {
        await this.prisma.$transaction(async (tx) => {
          const existing = await tx.weeklyCashbackGrant.findUnique({
            where: {
              userId_currencyCode_weekStart: {
                userId: entry.userId,
                currencyCode: entry.currencyCode,
                weekStart,
              },
            },
          });
          if (existing) return;

          await tx.weeklyCashbackGrant.create({
            data: {
              userId: entry.userId,
              currencyCode: entry.currencyCode,
              weekStart,
              netLoss: new Decimal(entry.netLoss),
              cashbackAmount: new Decimal(cashbackAmount),
            },
          });

          await tx.balance.upsert({
            where: {
              userId_currencyCode: {
                userId: entry.userId,
                currencyCode: entry.currencyCode,
              },
            },
            update: { amount: { increment: new Decimal(cashbackAmount) } },
            create: {
              userId: entry.userId,
              currencyCode: entry.currencyCode,
              amount: new Decimal(cashbackAmount),
            },
          });

          await tx.operation.create({
            data: {
              userId: entry.userId,
              source: OperationSource.PROMO,
              status: OperationStatus.SUCCESS,
              type: OperationType.INCOME,
              amount: new Decimal(cashbackAmount),
              currencyCode: entry.currencyCode,
              meta: {
                type: 'WEEKLY_CASHBACK',
                weekStart: weekStart.toISOString(),
                netLoss: entry.netLoss,
                rate: CASHBACK_RATE,
              },
            },
          });
        });

        void this.telegramUserNotify.notifyPromo({
          userId: entry.userId,
          message: `💸 Еженедельный кэшбэк: +${cashbackAmount} ${entry.currencyCode}\n5% от проигрыша за неделю зачислено на основной счёт.`,
        }).catch(() => undefined);
        void this.pushUserNotify.notifyPromo({
          userId: entry.userId,
          title: 'Еженедельный кэшбэк',
          body: `+${cashbackAmount} ${entry.currencyCode} зачислено на счёт`,
          url: '/profile/wallets',
        }).catch(() => undefined);

        granted += 1;
      } catch (error) {
        this.logger.warn(
          `Cashback failed user=${entry.userId} currency=${entry.currencyCode}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (granted > 0) {
      this.logger.log(`Granted weekly cashback to ${granted} user(s)`);
    }
  }
}
