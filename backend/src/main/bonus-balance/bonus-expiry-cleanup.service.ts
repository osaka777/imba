import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';

import { BonusBalanceService } from './bonus-balance.service';

@Injectable()
export class BonusExpiryCleanupService {
  private readonly logger = new Logger(BonusExpiryCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bonusBalanceService: BonusBalanceService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleBonuses(): Promise<void> {
    const now = new Date();
    const stale = await this.prisma.bonusBalance.findMany({
      where: {
        expiresAt: { lte: now },
        OR: [
          { isActive: true },
          { requiresDeposit: true, depositActivated: false },
        ],
      },
      select: { userId: true, currencyCode: true },
      take: 200,
    });

    if (!stale.length) return;

    for (const row of stale) {
      try {
        await this.bonusBalanceService.expireBonusIfNeeded(
          row.userId,
          row.currencyCode,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to expire bonus user=${row.userId} currency=${row.currencyCode}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(`Expired ${stale.length} stale bonus balance(s)`);
  }
}
