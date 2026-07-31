import { Injectable } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';

import { TelegramNotificationLogService } from './telegram-notification-log.service';
import { TelegramNotifyService, type TelegramUserMessageOptions } from './telegram-notify.service';
import { getPublicSiteBaseUrl } from './public-site-url.util';

type NotifyContext = {
  telegramUserId: string;
  telegramNotifyDeposit: boolean;
  telegramNotifyWithdraw: boolean;
  telegramNotifyBets: boolean;
  telegramNotifyPromo: boolean;
};

@Injectable()
export class TelegramUserNotifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramNotify: TelegramNotifyService,
    private readonly logService: TelegramNotificationLogService,
  ) {}

  private async getContext(userId: number): Promise<NotifyContext | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramUserId: true,
        telegramNotifyDeposit: true,
        telegramNotifyWithdraw: true,
        telegramNotifyBets: true,
        telegramNotifyPromo: true,
      },
    });
    if (!user?.telegramUserId) return null;
    return {
      telegramUserId: user.telegramUserId,
      telegramNotifyDeposit: user.telegramNotifyDeposit,
      telegramNotifyWithdraw: user.telegramNotifyWithdraw,
      telegramNotifyBets: user.telegramNotifyBets,
      telegramNotifyPromo: user.telegramNotifyPromo,
    };
  }

  private formatAmount(amount: number, currency?: string): string {
    const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    return currency ? `${formatted} ${currency}` : formatted;
  }

  private async deliver(input: {
    userId: number;
    telegramUserId: string;
    type: string;
    message: string;
    options?: TelegramUserMessageOptions;
  }): Promise<void> {
    const result = await this.telegramNotify.sendUserMessage(
      input.telegramUserId,
      input.message,
      input.options,
    );
    await this.logService.log({
      userId: input.userId,
      telegramUserId: input.telegramUserId,
      type: input.type,
      status: result.ok ? 'sent' : 'failed',
      error: result.error,
    });
  }

  private async skip(userId: number, type: string): Promise<void> {
    await this.logService.log({ userId, type, status: 'skipped' });
  }

  async notifyDeposit(input: {
    userId: number;
    orderId: number;
    publicOrderId?: number;
    status: 'approved' | 'rejected' | 'expired';
    amount?: number;
    currency?: string;
  }): Promise<void> {
    const ctx = await this.getContext(input.userId);
    if (!ctx) return;
    if (!ctx.telegramNotifyDeposit) {
      await this.skip(input.userId, 'deposit');
      return;
    }

    const orderLabel = input.publicOrderId ?? input.orderId;
    const amountLine =
      input.amount != null && input.currency
        ? this.formatAmount(input.amount, input.currency)
        : null;

    const message =
      input.status === 'approved'
        ? `💰 Пополнение · IMBA BET\n${amountLine ? `+${amountLine} зачислено на ваш счёт` : `Заявка #${orderLabel} зачислена`}`
        : input.status === 'rejected'
          ? `❌ Пополнение отклонено · IMBA BET\nЗаявка #${orderLabel}${amountLine ? ` · ${amountLine}` : ''}`
          : `⏱ Время пополнения истекло · IMBA BET\nЗаявка #${orderLabel}${amountLine ? ` · ${amountLine}` : ''}`;

    await this.deliver({
      userId: input.userId,
      telegramUserId: ctx.telegramUserId,
      type: 'deposit',
      message,
    });
  }

  async notifyWithdraw(input: {
    userId: number;
    withdrawId: number;
    status: 'completed' | 'rejected' | 'cancelled' | 'processing';
    amount: number;
    currency: string;
    reason?: string;
  }): Promise<void> {
    const ctx = await this.getContext(input.userId);
    if (!ctx) return;
    if (!ctx.telegramNotifyWithdraw) {
      await this.skip(input.userId, 'withdraw');
      return;
    }

    const amountLine = this.formatAmount(input.amount, input.currency);
    const message =
      input.status === 'completed'
        ? `✅ Вывод · IMBA BET\n${amountLine} отправлены на карту / кошелёк\nЗаявка #${input.withdrawId}`
        : input.status === 'processing'
          ? `🔄 Вывод в обработке · IMBA BET\n${amountLine}\nЗаявка #${input.withdrawId}`
          : input.status === 'cancelled'
            ? `↩️ Вывод отменён · IMBA BET\n${amountLine} снова на вашем счёте\nЗаявка #${input.withdrawId}`
            : `❌ Вывод отклонён · IMBA BET\n${amountLine} возвращены на баланс\nЗаявка #${input.withdrawId}${input.reason ? `\nПричина: ${input.reason}` : ''}`;

    await this.deliver({
      userId: input.userId,
      telegramUserId: ctx.telegramUserId,
      type: 'withdraw',
      message,
    });
  }

  async notifyBetSettled(input: {
    userId: number;
    status: 'WIN' | 'LOSE' | 'RETURN';
    betAmount: number;
    amount: number;
    currencyCode: string;
    betCode?: string;
    wcBetId?: number;
    outcomeName?: string;
    homeTeam?: string;
    awayTeam?: string;
  }): Promise<void> {
    const ctx = await this.getContext(input.userId);
    if (!ctx) return;
    if (!ctx.telegramNotifyBets) {
      await this.skip(input.userId, 'bet_settled');
      return;
    }

    const statusText =
      input.status === 'WIN'
        ? '🏆 Выигрыш!'
        : input.status === 'LOSE'
          ? '📉 Проигрыш'
          : '↩️ Возврат';

    const lines: string[] = [statusText];

    // Match line
    if (input.homeTeam && input.awayTeam) {
      lines.push(`${input.homeTeam} — ${input.awayTeam}`);
    }

    // What was bet on
    if (input.outcomeName) {
      lines.push(`Ставка: ${input.outcomeName}`);
    } else if (input.betCode) {
      lines.push(`Купон: ${input.betCode}`);
    } else if (input.wcBetId) {
      lines.push(`WC #${input.wcBetId}`);
    }

    // Stake amount
    lines.push(`Сумма: ${this.formatAmount(input.betAmount, input.currencyCode)}`);

    // Payout
    if (input.status === 'WIN') {
      lines.push(`💰 Выплата: +${this.formatAmount(input.amount, input.currencyCode)}`);
    } else if (input.status === 'RETURN') {
      lines.push(`↩️ Возврат: ${this.formatAmount(input.amount, input.currencyCode)}`);
    }

    const baseUrl = getPublicSiteBaseUrl();
    if (input.status === 'WIN') {
      lines.push('', `🎉 Поздравляем!`);
      lines.push(`${baseUrl}/profile/betHistory`);
    }

    await this.deliver({
      userId: input.userId,
      telegramUserId: ctx.telegramUserId,
      type: 'bet_settled',
      message: lines.join('\n'),
    });
  }

  async notifyPromo(input: {
    userId: number;
    message: string;
  }): Promise<void> {
    const ctx = await this.getContext(input.userId);
    if (!ctx) return;
    if (!ctx.telegramNotifyPromo) {
      await this.skip(input.userId, 'promo');
      return;
    }

    await this.deliver({
      userId: input.userId,
      telegramUserId: ctx.telegramUserId,
      type: 'promo',
      message: input.message,
    });
  }

  /** Важное уведомление о сгорании бонуса — без проверки promo-настроек */
  async notifyBonusExpiry(input: {
    userId: number;
    telegramUserId: string;
    message: string;
    type: string;
  }): Promise<void> {
    await this.deliver({
      userId: input.userId,
      telegramUserId: input.telegramUserId,
      type: input.type,
      message: input.message,
      options: undefined,
    });
  }

  async notifySecurity(input: {
    userId: number;
    telegramUserId: string;
    message: string;
    type: string;
  }): Promise<void> {
    await this.deliver({
      userId: input.userId,
      telegramUserId: input.telegramUserId,
      type: input.type,
      message: input.message,
    });
  }

  async notifyRaw(input: {
    userId: number;
    telegramUserId: string;
    type: string;
    message: string;
    buttonUrl?: string;
    buttonText?: string;
  }): Promise<void> {
    const options: TelegramUserMessageOptions | undefined =
      input.buttonUrl
        ? { buttonUrl: input.buttonUrl, buttonText: input.buttonText ?? 'Открыть матч' }
        : undefined;

    await this.deliver({
      userId: input.userId,
      telegramUserId: input.telegramUserId,
      type: input.type,
      message: input.message,
      options,
    });
  }
}
