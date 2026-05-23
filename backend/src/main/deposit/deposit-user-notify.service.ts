import { Injectable } from '@nestjs/common';

import { EventGateway } from '~/main/event/event.gateway';

export type DepositNotifyStatus = 'approved' | 'rejected' | 'expired';

@Injectable()
export class DepositUserNotifyService {
  constructor(private readonly eventGateway: EventGateway) {}

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

    return this.eventGateway.sendUserNotification(
      String(input.userId),
      notification,
    );
  }
}
