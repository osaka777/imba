import { Injectable } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';

import { FcmService } from './fcm.service';

type PushMessage = {
  title: string;
  body: string;
  url?: string;
  type: string;
  /** success | error | info — для цвета/канала в APK */
  tone?: 'success' | 'error' | 'info';
};

@Injectable()
export class PushUserNotifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  private formatAmount(amount: number, currency?: string): string {
    const abs = Math.abs(amount);
    const formatted = new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: Number.isInteger(abs) ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(abs);
    return currency ? `${formatted} ${currency}` : formatted;
  }

  private async sendToUser(
    userId: number,
    type: keyof DevicePrefs,
    message: PushMessage,
  ): Promise<void> {
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId },
    });

    for (const device of devices) {
      if (!this.isEnabled(device, type)) continue;
      await this.fcm.sendToToken(device.fcmToken, {
        title: message.title,
        body: message.body,
        data: {
          type: message.type,
          tone: message.tone ?? 'info',
          ...(message.url ? { url: message.url } : {}),
        },
      });
    }
  }

  private isEnabled(
    device: {
      notifyBets: boolean;
      notifyDeposit: boolean;
      notifyWithdraw: boolean;
      notifyPromo: boolean;
      notifyLiveMatch: boolean;
    },
    type: keyof DevicePrefs,
  ): boolean {
    switch (type) {
      case 'bets':
        return device.notifyBets;
      case 'deposit':
        return device.notifyDeposit;
      case 'withdraw':
        return device.notifyWithdraw;
      case 'promo':
        return device.notifyPromo;
      case 'liveMatch':
        return device.notifyLiveMatch;
      default:
        return true;
    }
  }

  async notifyDeposit(input: {
    userId: number;
    orderId: number;
    publicOrderId?: number;
    status: 'approved' | 'rejected' | 'expired';
    amount?: number;
    currency?: string;
  }): Promise<void> {
    const orderLabel = input.publicOrderId ?? input.orderId;
    const amount =
      input.amount != null
        ? this.formatAmount(input.amount, input.currency)
        : null;

    if (input.status === 'approved') {
      await this.sendToUser(input.userId, 'deposit', {
        type: 'deposit',
        tone: 'success',
        title: '💰 Пополнение · IMBA BET',
        body: amount
          ? `+${amount} зачислено на ваш счёт`
          : `Заявка #${orderLabel} успешно зачислена`,
        url: '/profile/financeHistory',
      });
      return;
    }

    if (input.status === 'rejected') {
      await this.sendToUser(input.userId, 'deposit', {
        type: 'deposit',
        tone: 'error',
        title: 'Пополнение отклонено · IMBA BET',
        body: amount
          ? `Заявка #${orderLabel} · ${amount} не зачислена`
          : `Заявка #${orderLabel} отклонена`,
        url: '/profile/financeHistory',
      });
      return;
    }

    await this.sendToUser(input.userId, 'deposit', {
      type: 'deposit',
      tone: 'info',
      title: 'Время пополнения истекло · IMBA BET',
      body: amount
        ? `Заявка #${orderLabel} · ${amount} больше недействительна`
        : `Заявка #${orderLabel} больше недействительна`,
      url: '/profile/financeHistory',
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
    const amountLine = this.formatAmount(input.amount, input.currency);

    if (input.status === 'completed') {
      await this.sendToUser(input.userId, 'withdraw', {
        type: 'withdraw',
        tone: 'success',
        title: '✅ Вывод · IMBA BET',
        body: `${amountLine} отправлены на карту / кошелёк`,
        url: '/profile/financeHistory',
      });
      return;
    }

    if (input.status === 'processing') {
      await this.sendToUser(input.userId, 'withdraw', {
        type: 'withdraw',
        tone: 'info',
        title: 'Вывод в обработке · IMBA BET',
        body: `${amountLine} · заявка #${input.withdrawId}`,
        url: '/profile/financeHistory',
      });
      return;
    }

    if (input.status === 'cancelled') {
      await this.sendToUser(input.userId, 'withdraw', {
        type: 'withdraw',
        tone: 'info',
        title: 'Вывод отменён · IMBA BET',
        body: `${amountLine} снова на вашем счёте`,
        url: '/profile/financeHistory',
      });
      return;
    }

    const reason = input.reason?.trim();
    await this.sendToUser(input.userId, 'withdraw', {
      type: 'withdraw',
      tone: 'error',
      title: 'Вывод отклонён · IMBA BET',
      body: reason
        ? `${amountLine} возвращены на баланс · ${reason}`
        : `${amountLine} возвращены на баланс`,
      url: '/profile/financeHistory',
    });
  }

  async notifyBetSettled(input: {
    userId: number;
    status: 'WIN' | 'LOSE' | 'RETURN';
    betAmount: number;
    amount: number;
    currencyCode: string;
    outcomeName?: string;
    homeTeam?: string;
    awayTeam?: string;
  }): Promise<void> {
    const title =
      input.status === 'WIN'
        ? '🏆 Выигрыш · IMBA BET'
        : input.status === 'LOSE'
          ? 'Ставка · IMBA BET'
          : 'Возврат · IMBA BET';

    const lines: string[] = [];
    if (input.homeTeam && input.awayTeam) {
      lines.push(`${input.homeTeam} — ${input.awayTeam}`);
    }
    if (input.outcomeName) {
      lines.push(input.outcomeName);
    }
    if (input.status === 'WIN') {
      lines.push(`+${this.formatAmount(input.amount, input.currencyCode)}`);
    } else if (input.status === 'RETURN') {
      lines.push(this.formatAmount(input.amount, input.currencyCode));
    } else {
      lines.push(this.formatAmount(input.betAmount, input.currencyCode));
    }

    await this.sendToUser(input.userId, 'bets', {
      type: 'bet_settled',
      tone: input.status === 'WIN' ? 'success' : input.status === 'LOSE' ? 'error' : 'info',
      title,
      body: lines.join(' · '),
      url: '/profile/betHistory',
    });
  }

  async notifyPromo(input: { userId: number; title: string; body: string; url?: string }): Promise<void> {
    await this.sendToUser(input.userId, 'promo', {
      type: 'promo',
      tone: 'info',
      title: input.title,
      body: input.body,
      url: input.url ?? '/',
    });
  }

  async notifyLiveMatch(input: {
    userId: number;
    title: string;
    body: string;
    url?: string;
  }): Promise<void> {
    await this.sendToUser(input.userId, 'liveMatch', {
      type: 'live_match',
      tone: 'info',
      title: input.title,
      body: input.body,
      url: input.url,
    });
  }
}

type DevicePrefs = {
  bets: boolean;
  deposit: boolean;
  withdraw: boolean;
  promo: boolean;
  liveMatch: boolean;
};
