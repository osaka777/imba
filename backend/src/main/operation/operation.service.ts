import { Inject, Injectable, forwardRef } from '@nestjs/common';
import {
  Balance,
  OperationSource,
  OperationStatus,
  OperationType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Logger } from 'winston';

import {
  PrismaService,
  PrismaTransactionClient,
} from '~/prisma/prisma.service';

import { CreateOperationDto } from './dto/create-operation.dto';
import { InsufficientFundsException } from './exception/insufficient-funds.exception';
import { InvalidAmountException } from './exception/wrong-data.exception';

@Injectable()
export class OperationService {
  // Кэш балансов для быстрого доступа
  private readonly balanceCache = new Map<string, { balance: any; timestamp: number }>();
  private readonly BALANCE_CACHE_TTL = 5000; // 5 секунд кэш балансов
  
  constructor(
    @Inject('winston') private readonly logger: Logger,
    private readonly prismaService: PrismaService,
  ) {}

  // Быстрый доступ к балансам с кэшированием
  private async getCachedBalance(prisma: PrismaTransactionClient, currencyCode: string, userId: number) {
    const cacheKey = `balance:${userId}:${currencyCode}`;
    const cached = this.balanceCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.BALANCE_CACHE_TTL) {
      return cached.balance;
    }
    
    const balance = await this.getOrCreateBalance(prisma, currencyCode, userId);
    this.balanceCache.set(cacheKey, { balance, timestamp: Date.now() });
    
    return balance;
  }

  // Инвалидация кэша баланса
  private invalidateBalanceCache(userId: number, currencyCode: string) {
    const cacheKey = `balance:${userId}:${currencyCode}`;
    this.balanceCache.delete(cacheKey);
  }

  private calculateNewBalance(
    balance: Balance,
    type: OperationType,
    state: OperationStatus,
    source: OperationSource,
    amount: Decimal,
  ): Decimal {
    if (amount.lessThan(0)) {
      throw new InvalidAmountException();
    }

    // Для INCOME операций баланс изменяется только при SUCCESS
    if (state !== OperationStatus.SUCCESS && type === OperationType.INCOME)
      return balance.amount;

    // Для OUTCOME операций баланс изменяется при WAITING и SUCCESS, но не при FAILED
    if (type === OperationType.OUTCOME && state === OperationStatus.FAILED) {
      // При FAILED статусе для OUTCOME операций баланс должен быть восстановлен
      // Но поскольку мы работаем с текущим балансом, нужно добавить сумму обратно
      return balance.amount.add(amount);
    }

    if (type === 'INCOME') {
      return balance.amount.add(amount);
    }

    if (type === 'OUTCOME') {
      const newBalance = balance.amount.sub(amount);
      if (newBalance.lessThan(0)) {
        throw new InsufficientFundsException();
      }
      return newBalance;
    }

    throw new Error('Unknown operation');
  }

  private async getOrCreateBalance(
    prisma: PrismaTransactionClient,
    currencyCode: string,
    userId: number,
  ): Promise<Balance> {
    let balance = await prisma.balance.findUnique({
      where: {
        userId_currencyCode: {
          currencyCode,
          userId,
        },
      },
    });

    if (!balance) {
      // Проверяем существование валюты перед созданием баланса
      const currency = await prisma.currency.findUnique({
        where: { isoCode: currencyCode }
      });

      if (!currency) {
        // Создаем валюту если её нет
        await prisma.currency.create({
          data: {
            isoCode: currencyCode,
            name: this.getCurrencyName(currencyCode)
          }
        });
      }

      // Создаем новый баланс с upsert для избежания race condition
      balance = await prisma.balance.upsert({
        where: {
          userId_currencyCode: {
            currencyCode,
            userId,
          },
        },
        update: {}, // Ничего не обновляем, если баланс уже существует
        create: {
          amount: new Decimal(0),
          currencyCode,
          userId,
        },
      });
    }

    return balance;
  }

  private getCurrencyName(isoCode: string): string {
    const currencyNames = {
      'USD': 'US Dollar',
      'RUB': 'Russian Ruble',
      'UAH': 'Ukrainian Hryvnia',
      'KZT': 'Kazakhstani Tenge',
      'TRY': 'Turkish Lira',
      'UZS': 'Uzbekistan Som'
    };
    return currencyNames[isoCode] || isoCode;
  }

  /**
   * Creates a new operation for a profile.
   *
   * @param prisma - A client in a transaction
   * @param userId - The profile for whom the operation is being created.
   * @param dto - The data for the operation.
   * @throws InsufficientFundsException - If the profile does not have enough funds for the operation.
   * @returns The created operation.
   */
  async create(
    prisma: PrismaTransactionClient,
    userId: number,
    dto: CreateOperationDto,
  ) {
    const startTime = Date.now();
    
    try {
      // Используем кэшированный доступ к балансу
      const balance = await this.getCachedBalance(prisma, dto.currencyCode, userId);

      const newBalance = await this.calculateNewBalance(
        balance,
        dto.type,
        dto.status,
        dto.source,
        dto.amount,
      );

      this.logger.debug(`[OperationService] Creating operation:`, {
        userId,
        type: dto.type,
        status: dto.status,
        amount: dto.amount.toString(),
        currency: dto.currencyCode,
        currentBalance: balance.amount.toString(),
        newBalance: newBalance.toString(),
        balanceChange: newBalance.minus(balance.amount).toString(),
        timing: `${Date.now() - startTime}ms`
      });

      // Создаем операцию и обновляем баланс атомарно
      const [operation] = await Promise.all([
        prisma.operation.create({
          data: {
            amount: dto.amount,
            currencyCode: dto.currencyCode,
            meta: dto.meta ?? {},
            source: dto.source,
            status: dto.status,
            type: dto.type,
            userId,
          },
        }),
        prisma.balance.update({
          data: { amount: newBalance },
          where: { id: balance.id },
        })
      ]);

      // Инвалидируем кэш баланса
      this.invalidateBalanceCache(userId, dto.currencyCode);

      this.logger.debug(`[OperationService] Operation created successfully:`, {
        operationId: operation.id,
        balanceUpdated: true,
        totalTime: `${Date.now() - startTime}ms`
      });

      return operation;
    } catch (error) {
      this.logger.error(`[OperationService] Operation creation failed in ${Date.now() - startTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Creates a new operation without updating the balance (for bonus bets).
   *
   * @param prisma - A client in a transaction
   * @param userId - The profile for whom the operation is being created.
   * @param dto - The data for the operation.
   * @returns The created operation.
   */
  async createWithoutBalanceUpdate(
    prisma: PrismaTransactionClient,
    userId: number,
    dto: CreateOperationDto,
  ) {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`[OperationService] Creating operation without balance update:`, {
        userId,
        type: dto.type,
        status: dto.status,
        amount: dto.amount.toString(),
        currency: dto.currencyCode,
        source: dto.source,
        timing: `${Date.now() - startTime}ms`
      });

      // Создаем только операцию без обновления баланса
      const operation = await prisma.operation.create({
        data: {
          amount: dto.amount,
          currencyCode: dto.currencyCode,
          meta: dto.meta ?? {},
          source: dto.source,
          status: dto.status,
          type: dto.type,
          userId,
        },
      });

      this.logger.debug(`[OperationService] Operation created without balance update:`, {
        operationId: operation.id,
        totalTime: `${Date.now() - startTime}ms`
      });

      return operation;
    } catch (error) {
      this.logger.error(`[OperationService] Operation creation without balance update failed in ${Date.now() - startTime}ms:`, error);
      throw error;
    }
  }

  async getBalances(userId: number) {
    return this.prismaService.balance.findMany({
      where: {
        userId,
      },
    });
  }

  async getOperations(userId: number) {
    return this.prismaService.operation.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        userId,
      },
    });
  }

  async updateMeta(
    prisma: PrismaTransactionClient,
    id: number,
    meta: Record<string, unknown>,
  ) {
    return prisma.$executeRaw`UPDATE "Operation" SET meta = meta || ${JSON.stringify(meta)}::jsonb
       WHERE id = ${id}`;
  }

  /**
   * updates a operation for a profile.
   *
   * @throws InsufficientFundsException - If the profile does not have enough funds for the operation.
   * @returns The created operation.
   * @param prisma - A client in a transaction
   * @param transactionId
   * @param status
   */
  async updateStatus(
    prisma: PrismaTransactionClient,
    transactionId: number,
    status: OperationStatus,
  ) {
    const operation = await prisma.operation.findFirst({
      where: {
        id: transactionId,
      },
    });

    console.log('[OperationService] Updating operation status:', {
      operationId: transactionId,
      oldStatus: operation.status,
      newStatus: status,
      type: operation.type,
      amount: operation.amount.toString(),
      currency: operation.currencyCode,
      userId: operation.userId
    });

    if (operation.status === status) {
      console.log('[OperationService] Status unchanged, skipping update');
      return operation;
    }

    const balance = await this.getOrCreateBalance(
      prisma,
      operation.currencyCode,
      operation.userId,
    );

    console.log('[OperationService] Current balance before status update:', {
      balanceId: balance.id,
      currentAmount: balance.amount.toString(),
      operationType: operation.type,
      oldStatus: operation.status,
      newStatus: status
    });

    const newBalance = await this.calculateNewBalance(
      balance,
      operation.type,
      status,
      operation.source,
      operation.amount,
    );

    console.log('[OperationService] Balance calculation result:', {
      operationId: transactionId,
      oldBalance: balance.amount.toString(),
      newBalance: newBalance.toString(),
      balanceChange: newBalance.minus(balance.amount).toString(),
      operationType: operation.type,
      statusChange: `${operation.status} → ${status}`
    });

    await prisma.balance.update({
      data: { amount: newBalance },
      where: { id: balance.id },
    });
    
    const updatedOperation = await prisma.operation.update({
      data: {
        status: status,
      },
      where: {
        id: transactionId,
      },
    });

    console.log('[OperationService] Operation status updated successfully:', {
      operationId: transactionId,
      finalStatus: status,
      balanceUpdated: true
    });

    return updatedOperation;
  }
}
