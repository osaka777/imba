import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import { TelegramUserNotifyService } from '../telegram/telegram-user-notify.service';
import { getPublicSiteBaseUrl } from '../telegram/public-site-url.util';

import { getBonusRemainingMs } from './bonus-expiry.util';
import { getWelcomeBonusConfig } from './welcome-bonus.config';

const WARNING_WINDOWS = [
  { cursorKey: '12h', minMs: 11.5 * 60 * 60 * 1000, maxMs: 12.5 * 60 * 60 * 1000, label: '12 часов', lockedOnly: true },
  { cursorKey: '6h', minMs: 5.75 * 60 * 60 * 1000, maxMs: 6.25 * 60 * 60 * 1000, label: '6 часов', lockedOnly: true },
  { cursorKey: '2h', minMs: 115 * 60 * 1000, maxMs: 125 * 60 * 1000, label: '2 часа', lockedOnly: false },
  { cursorKey: '30m', minMs: 25 * 60 * 1000, maxMs: 35 * 60 * 1000, label: '30 минут', lockedOnly: false },
] as const;

@Injectable()
export class BonusExpiryNotifyService {
  private readonly logger = new Logger(BonusExpiryNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramUserNotify: TelegramUserNotifyService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendExpiryWarnings(): Promise<void> {
    const bonuses = await this.prisma.bonusBalance.findMany({
      where: {
        expiresAt: { not: null },
        OR: [
          { isActive: true },
          { requiresDeposit: true, depositActivated: false },
        ],
      },
      select: {
        userId: true,
        currencyCode: true,
        expiresAt: true,
        requiresDeposit: true,
        depositActivated: true,
        amount: true,
        totalWagered: true,
        requiredWager: true,
        user: { select: { telegramUserId: true } },
      },
      take: 300,
    });

    let sent = 0;
    const siteUrl = getPublicSiteBaseUrl();

    for (const bonus of bonuses) {
      if (!bonus.expiresAt || !bonus.user.telegramUserId) continue;

      const remainingMs = getBonusRemainingMs(bonus.expiresAt);
      if (remainingMs <= 0) continue;

      const isLocked = bonus.requiresDeposit && !bonus.depositActivated;
      const config = getWelcomeBonusConfig(bonus.currencyCode);

      for (const window of WARNING_WINDOWS) {
        if (window.lockedOnly && !isLocked) continue;
        if (remainingMs < window.minMs || remainingMs > window.maxMs) continue;

        const marked = await this.markNotified(
          bonus.userId,
          bonus.currencyCode,
          bonus.expiresAt,
          window.cursorKey,
        );
        if (!marked) continue;

        const phase = isLocked
          ? `пополнить счёт от ${config.minDeposit} ${bonus.currencyCode} и активировать бонус`
          : 'завершить отыгрыш бонуса';

        const amount = Number(bonus.amount);
        const amountLine = Number.isFinite(amount) && amount > 0
          ? `\nБонус: ${amount} ${bonus.currencyCode}`
          : '';

        let wagerLine = '';
        if (!isLocked) {
          const wagered = Number(bonus.totalWagered);
          const required = Number(bonus.requiredWager);
          if (Number.isFinite(required) && required > 0) {
            const pct = Math.min(100, Math.round((wagered / required) * 100));
            wagerLine = `\nОтыграно: ${pct}%`;
          }
        }

        await this.telegramUserNotify.notifyBonusExpiry({
          userId: bonus.userId,
          telegramUserId: bonus.user.telegramUserId,
          message: [
            `⏱ Welcome-бонус сгорит через ${window.label}!`,
            `Нужно ${phase}.${amountLine}${wagerLine}`,
            `\n${siteUrl}/profile`,
          ].join(''),
          type: `bonus_expiry_${window.cursorKey}`,
        });
        sent += 1;
      }
    }

    if (sent > 0) {
      this.logger.log(`Sent ${sent} bonus expiry warning(s)`);
    }
  }

  private async markNotified(
    userId: number,
    currencyCode: string,
    expiresAt: Date,
    cursorKey: string,
  ): Promise<boolean> {
    try {
      await this.prisma.bonusExpiryNotifyCursor.create({
        data: { userId, currencyCode, expiresAt, cursorKey },
      });
      return true;
    } catch {
      return false;
    }
  }
}
