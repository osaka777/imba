import { Injectable } from '@nestjs/common';

import { EventGateway } from '~/main/event/event.gateway';
import { PushUserNotifyService } from '~/main/push/push-user-notify.service';
import { TelegramUserNotifyService } from '~/main/telegram/telegram-user-notify.service';

export type DepositNotifyStatus = 'approved' | 'rejected' | 'expired';

@Injectable()
export class DepositUserNotifyService {
  constructor(
    private readonly eventGateway: EventGateway,
    private readonly telegramUserNotify: TelegramUserNotifyService,
    private readonly pushUserNotify: PushUserNotifyService,
  ) {}

  notifyDepositStatus(input: {
    userId: number;
    orderId: number;
    publicOrderId?: number;
    status: DepositNotifyStatus;
    amount?: number;
    currency?: string;
  }): boolean {
    const notification = {
      eventId: `user_${input.userId}`,
      type: 'deposit_status_changed',
      payload: {
        orderId: input.orderId,
        publicOrderId: input.publicOrderId ?? input.orderId,
        status: input.status,
        amount: input.amount,
        currency: input.currency,
        timestamp: new Date().toISOString(),
      },
    };

    void this.telegramUserNotify.notifyDeposit(input).catch(() => undefined);
    void this.pushUserNotify.notifyDeposit(input).catch(() => undefined);

    return this.eventGateway.sendUserNotification(
      String(input.userId),
      notification,
    );
  }
}
