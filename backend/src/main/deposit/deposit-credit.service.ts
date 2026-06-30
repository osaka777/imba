import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { PartnersService } from '~/main/partners/partners.service';
import { PrismaService } from '~/prisma/prisma.service';
import { DepositUserNotifyService } from './deposit-user-notify.service';
import { readPublicOrderId } from './deposit-public-order-id.util';

@Injectable()
export class DepositCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depositUserNotify: DepositUserNotifyService,
    private readonly partnersService: PartnersService,
  ) {}

  async creditDeposit(depositId: number, extraMeta?: Record<string, unknown>) {
    const depo = await this.prisma.deposit.findUnique({ where: { id: depositId } });
    if (!depo) throw new Error('Deposit not found');
    if (depo.status !== 'PENDING' && depo.status !== 'PROCESSING') {
      return { ok: false, alreadyProcessed: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.balance.upsert({
        where: {
          userId_currencyCode: { userId: depo.userId, currencyCode: depo.currencyCode },
        },
        update: { amount: { increment: depo.amount } },
        create: {
          userId: depo.userId,
          currencyCode: depo.currencyCode,
          amount: depo.amount,
        },
      });

      const depositOp = await tx.operation.create({
        data: {
          userId: depo.userId,
          source: 'PAYMENT_SYSTEM' as any,
          status: 'SUCCESS' as any,
          type: 'INCOME' as any,
          amount: depo.amount,
          currencyCode: depo.currencyCode,
          meta: { depositId: depo.id, paymentSystem: depo.paymentSystem },
        },
      });

      const oldMeta = (depo.meta as Record<string, unknown>) || {};
      await tx.deposit.update({
        where: { id: depo.id },
        data: {
          status: 'SUCCESS' as any,
          operationId: depositOp.id,
          meta: { ...oldMeta, ...extraMeta, creditedAt: new Date().toISOString() } as any,
          updatedAt: new Date(),
        },
      });
    });

    const publicOrderId = readPublicOrderId(depo.meta) ?? depo.id;
    this.depositUserNotify.notifyDepositStatus({
      userId: depo.userId,
      orderId: depo.id,
      publicOrderId,
      status: 'approved',
      amount: Number(depo.amount),
      currency: depo.currencyCode,
    });

    void this.partnersService.notifyFirstDeposit(
      depo.userId,
      depo.amount,
      depo.currencyCode,
    );

    return { ok: true };
  }
}
