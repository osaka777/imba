import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '~/prisma/prisma.service';
import { DepositUserNotifyService } from './deposit-user-notify.service';
import { readPublicOrderId } from './deposit-public-order-id.util';

@Injectable()
export class DepositCleanupService {
  private readonly logger = new Logger(DepositCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly depositUserNotify: DepositUserNotifyService,
  ) {}

  // Run every minute to expire timed-out manual foreign card deposits
  @Cron(CronExpression.EVERY_MINUTE)
  async cancelStaleDeposits() {
    try {
      const now = Date.now();
      const cutoff = new Date(now - 15 * 60 * 1000); // 15 minutes ago

      const stale = await this.prisma.deposit.findMany({
        where: {
          paymentSystem: {
            in: ['KZT_FOREIGN_CARD', 'KZT_KASPI', 'RUB_FOREIGN_CARD', 'RUB_SBERBANK', 'RUB_YANDEX_BANK', 'RUB_VTB_BANK', 'USDT_TRC20'] as any,
          },
          status: { in: ['PENDING', 'PROCESSING'] as any },
          createdAt: { lt: cutoff },
        },
        select: {
          id: true,
          meta: true,
          userId: true,
          amount: true,
          currencyCode: true,
          paymentSystem: true,
          createdAt: true,
        },
      });

      if (stale.length === 0) return;

      let updatedCount = 0;
      for (const d of stale) {
        const expiresMinutes =
          d.paymentSystem === 'USDT_TRC20'
            ? Number((d.meta as any)?.expiresInMinutes) || 45
            : 15;
        const expiresAt = new Date(d.createdAt).getTime() + expiresMinutes * 60 * 1000;
        if (expiresAt > now) continue;

        const oldMeta = (d.meta as any) || {};
        const newMeta = {
          ...oldMeta,
          autoCancelled: true,
          autoCancelledReason: 'Timeout: no confirmation within 15 minutes',
          autoCancelledAt: new Date().toISOString(),
          lifecycle: 'EXPIRED',
        };

        await this.prisma.deposit.update({
          where: { id: d.id },
          data: {
            status: 'CANCELLED' as any,
            meta: newMeta as any,
          },
        });
        updatedCount++;

        const publicOrderId = readPublicOrderId(newMeta) ?? d.id;
        this.depositUserNotify.notifyDepositStatus({
          userId: d.userId,
          orderId: d.id,
          publicOrderId,
          status: 'expired',
          amount: Number(d.amount),
          currency: d.currencyCode,
        });
      }

      this.logger.warn(
        `Auto-expired ${updatedCount} manual foreign card deposits older than 15 minutes.`,
      );
    } catch (error) {
      this.logger.error('Failed to expire stale deposits', error as any);
    }
  }
}
