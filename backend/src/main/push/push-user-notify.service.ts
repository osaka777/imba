import { Injectable } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';

import { FcmService } from './fcm.service';

type PushMessage = {
  title: string;
  body: string;
  url?: string;
  type: string;
};

@Injectable()
export class PushUserNotifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  private formatAmount(amount: number, currency?: string): string {
    const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
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
    const amountLine =
      input.amount != null && input.currency
        ? ` · ${this.formatAmount(input.amount, input.currency)}`
        : '';

    const title =
      input.status === 'approved'
        ? 'Пополнение зачислено'
        : input.status === 'rejected'
          ? 'Пополнение отклонено'
          : 'Пополнение истекло';

    await this.sendToUser(input.userId, 'deposit', {
      type: 'deposit',
      title,
      body: `Заявка #${orderLabel}${amountLine}`,
      url: '/profile/financeHistory',
    });
  }

  async notifyWithdraw(input: {
    userId: number;
    withdrawId: number;
    status: 'completed' | 'rejected';
    amount: number;
    currency: string;
    reason?: string;
  }): Promise<void> {
    const amountLine = this.formatAmount(input.amount, input.currency);
    const title = input.status === 'completed' ? 'Вывод выполнен' : 'Вывод отклонён';
    const body =
      input.status === 'completed'
        ? `Заявка #${input.withdrawId} · ${amountLine}`
        : `Заявка #${input.withdrawId} · ${amountLine}${input.reason ? ` · ${input.reason}` : ''}`;

    await this.sendToUser(input.userId, 'withdraw', {
      type: 'withdraw',
      title,
      body,
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
        ? 'Выигрыш!'
        : input.status === 'LOSE'
          ? 'Ставка проиграла'
          : 'Возврат по ставке';

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
      title,
      body: lines.join(' · '),
      url: '/profile/betHistory',
    });
  }

  async notifyPromo(input: { userId: number; title: string; body: string; url?: string }): Promise<void> {
    await this.sendToUser(input.userId, 'promo', {
      type: 'promo',
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
