import { Injectable, BadRequestException } from '@nestjs/common';
import {
  Operation,
  OperationSource,
  OperationStatus,
  OperationType,
} from '@prisma/client';

import { CurrencyService } from '~/main/currency/currency.service';
import { OperationService } from '~/main/operation/operation.service';
import {
  PrismaService,
  PrismaTransactionClient,
} from '~/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

import { PaymentSystemDepositDto } from './dto/payment-system-deposit.dto';
import { PaymentSystemWithdrawDto } from './dto/payment-system-withdraw.dto';
import { PaymentNotFoundException } from './exception/payment-not-found.exception';

type PromoValue = {
  percentage: number;
  minDeposit: number;
  currency: string;
  partnerPercentage?: number;
  userPercentage?: number;
};

@Injectable()
export class PaymentSystemService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly operationService: OperationService,
    private readonly currencyService: CurrencyService,
  ) {}

  private async applyPromo(
    prisma: PrismaTransactionClient,
    operation: Operation,
  ) {
    const onDepositCriteria =
      operation.status === 'SUCCESS' &&
      operation.source === 'PAYMENT_SYSTEM' &&
      operation.type === 'INCOME';

    if (!onDepositCriteria) {
      return;
    }

    // Автобонус функциональность удалена вместе с промо-кодами
  }

  private async checkBalance(userId: number, amount: Decimal, currencyCode: string): Promise<void> {
    // Получаем баланс пользователя
    const balance = await this.prismaService.balance.findFirst({
      where: {
        userId,
        currencyCode,
      },
    });

    if (!balance) {
      throw new BadRequestException(`У пользователя нет баланса в валюте ${currencyCode}`);
    }

    if (balance.amount.lessThan(amount)) {
      throw new BadRequestException('Недостаточно средств на балансе');
    }
  }

  async deposit({ amount, currency, userId }: PaymentSystemDepositDto) {
    const { isoCode } = await this.currencyService.getCurrency(currency);
    return this.prismaService.$transaction(async (prisma) => {
      return this.operationService.create(prisma, userId, {
        amount: amount,
        currencyCode: isoCode,
        meta: {
          title: 'Topup',
        },
        source: OperationSource.PAYMENT_SYSTEM,
        status: OperationStatus.WAITING,
        type: OperationType.INCOME,
      });
    });
  }

  async findPaymentById(id: number) {
    const payment = await this.prismaService.operation.findFirst({
      include: {
        user: true,
      },
      where: {
        id,
      },
    });
    if (!payment) {
      throw new PaymentNotFoundException();
    }
    return payment;
  }

  async updateOperation(status: OperationStatus, id: number) {
    return this.prismaService.$transaction(async (prisma) => {
      const operation = await this.operationService.updateStatus(
        prisma,
        id,
        status,
      );

      await this.applyPromo(prisma, operation);
    });
  }

  async withdraw(data: PaymentSystemWithdrawDto) {
    const callStack = new Error().stack;

    if (!data.method) {
      throw new BadRequestException('Withdrawal method is required');
    }

    return this.prismaService.$transaction(async (tx) => {
      // Проверяем баланс с блокировкой строки
      const balance = await tx.balance.findFirst({
        where: {
          userId: data.userId,
          currencyCode: data.currency
        },
        orderBy: { id: 'asc' }
      });

      if (!balance || balance.amount.lessThan(data.amount)) {
        throw new BadRequestException(`Insufficient balance for user ${data.userId} and currency ${data.currency}`);
      }

      // Проверяем наличие дублирующего запроса
      const existingRequest = await tx.withdrawRequest.findFirst({
        where: {
          userId: data.userId,
          amount: data.amount,
          currencyCode: data.currency,
          type: data.method,
          wallet: data.wallet || null,
          status: OperationStatus.WAITING,
          createdAt: {
            gte: new Date(Date.now() - 10000)
          }
        }
      });

      if (existingRequest) {
        throw new BadRequestException('Duplicate withdrawal request detected');
      }

      // Дополнительная проверка - ищем любые похожие запросы за последние 30 секунд
      const similarRequests = await tx.withdrawRequest.findMany({
        where: {
          userId: data.userId,
          amount: data.amount,
          currencyCode: data.currency,
          status: OperationStatus.WAITING,
          createdAt: {
            gte: new Date(Date.now() - 30000)
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (similarRequests.length > 0) {
        const exactMatch = similarRequests.find(r => 
          r.type === data.method && r.wallet === (data.wallet || null)
        );
        
        if (exactMatch) {
          throw new BadRequestException('Identical withdrawal request already exists');
        }
      }

      // Проверяем количество ожидающих выводов
      const pendingWithdrawals = await tx.withdrawRequest.count({
        where: {
          userId: data.userId,
          status: OperationStatus.WAITING,
        }
      });

      if (pendingWithdrawals >= 10) {
     
        throw new BadRequestException('У вас уже есть 10 необработанных запросов на вывод');
      }

      // Создаем запись в WithdrawRequest
      const withdrawRequest = await tx.withdrawRequest.create({
        data: {
          userId: data.userId,
          amount: data.amount,
          currencyCode: data.currency,
          status: OperationStatus.WAITING,
          type: data.method,
          wallet: data.wallet || null
        }
      });

    // Создаем операцию вывода
      const operation = await this.operationService.create(tx, data.userId, {
        amount: data.amount,
        currencyCode: data.currency,
        meta: {
          title: 'Withdraw',
          withdrawRequestId: withdrawRequest.id,
          method: data.method,
          wallet: data.wallet || null
        },
        source: OperationSource.PAYMENT_SYSTEM,
        status: OperationStatus.WAITING,
        type: OperationType.OUTCOME
      });

    

    return {
      operationId: operation.id,
        withdrawRequestId: withdrawRequest.id
    };
    }, {
      timeout: 10000,
      isolationLevel: 'Serializable'
    });
  }

  async processWithdrawal(id: number) {
    const withdrawRequest = await this.prismaService.withdrawRequest.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!withdrawRequest) {
      throw new Error('Withdrawal request not found');
    }

    return withdrawRequest;
  }
}