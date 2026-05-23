import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { DepositStatus, OperationSource, OperationStatus, OperationType } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';
import { OperationService } from '~/main/operation/operation.service';
import { CreateOperationDto } from '~/main/operation/dto/create-operation.dto';

export interface CreateDepositData {
  userId: number;
  externalId: string;
  paymentSystem: string;
  amount: Decimal;
  currencyCode: string;
  paymentUrl?: string;
  meta?: any;
}

export interface ProcessDepositCallbackData {
  externalId: string;
  status: 'ACCEPTED' | 'ERROR' | 'SUCCESS';
  callbackData?: any;
  amount?: Decimal;
}

@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly operationService: OperationService,
  ) {}

  /**
   * Создает новый депозит в базе данных
   */
  async createDeposit(data: CreateDepositData) {
    this.logger.log(`[DEBUG] Creating deposit for user ${data.userId}, amount: ${data.amount} ${data.currencyCode}`);
    this.logger.log(`[DEBUG] Deposit data:`, JSON.stringify(data, null, 2));

    try {
      this.logger.log(`[DEBUG] About to call prismaService.deposit.create`);
      
      const deposit = await this.prismaService.deposit.create({
        data: {
          userId: data.userId,
          externalId: data.externalId,
          paymentSystem: data.paymentSystem,
          amount: data.amount,
          currencyCode: data.currencyCode,
          status: DepositStatus.PENDING,
          paymentUrl: data.paymentUrl,
          meta: data.meta,
        },
        include: {
          user: true,
          currency: true,
        },
      });

      this.logger.log(`[DEBUG] Deposit created successfully with ID: ${deposit.id}, externalId: ${deposit.externalId}`);
      return deposit;
    } catch (error) {
      this.logger.error(`[DEBUG] Error creating deposit in database:`, error);
      throw error;
    }
  }

  /**
   * Обрабатывает callback от платежной системы
   */
  async processCallback(data: ProcessDepositCallbackData): Promise<{ success: boolean; error?: string; deposit?: any }> {
    this.logger.log(`Processing callback for deposit ${data.externalId}, status: ${data.status}`);

    try {
      const deposit = await this.prismaService.$transaction(async (prisma) => {
      // Находим депозит по externalId
      const deposit = await prisma.deposit.findUnique({
        where: { externalId: data.externalId },
        include: { user: true, currency: true },
      });

      if (!deposit) {
        this.logger.error(`Deposit not found for externalId: ${data.externalId}`);
        throw new NotFoundException(`Deposit not found for externalId: ${data.externalId}`);
      }

      // Проверяем, что депозит еще не обработан
      if (deposit.status !== DepositStatus.PENDING && deposit.status !== DepositStatus.PROCESSING) {
        this.logger.warn(`Deposit ${data.externalId} already processed with status: ${deposit.status}`);
        return deposit;
      }

      let newStatus: DepositStatus;
      let operation = null;

      if (data.status === 'SUCCESS') {
        newStatus = DepositStatus.SUCCESS;

        // Создаем операцию зачисления средств
        const operationDto = new CreateOperationDto({
          amount: data.amount || deposit.amount,
          currencyCode: deposit.currencyCode,
          source: OperationSource.PAYMENT_SYSTEM,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          meta: {
            depositId: deposit.id,
            externalId: deposit.externalId,
            paymentSystem: deposit.paymentSystem,
            callbackData: data.callbackData,
          },
        });

        operation = await this.operationService.create(prisma, deposit.userId, operationDto);

        this.logger.log(`Operation created for deposit ${deposit.externalId}: ${operation.id}`);
      } else if (data.status === 'ACCEPTED') {
        newStatus = DepositStatus.PROCESSING;
        // Для статуса ACCEPTED операцию не создаем, только обновляем статус
      } else if (data.status === 'ERROR') {
        newStatus = DepositStatus.FAILED;
      } else {
        this.logger.error(`Unknown callback status: ${data.status}`);
        throw new Error(`Unknown callback status: ${data.status}`);
      }

      // Обновляем депозит
      const updatedDeposit = await prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: newStatus,
          operationId: operation?.id,
          callbackData: data.callbackData,
          updatedAt: new Date(),
        },
        include: {
          user: true,
          currency: true,
          operation: true,
        },
      });

      this.logger.log(`Deposit ${data.externalId} updated to status: ${newStatus}`);
      return updatedDeposit;
    });

    return { success: true, deposit };
    } catch (error) {
      this.logger.error(`Error processing callback for ${data.externalId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получает депозит по externalId
   */
  async getDepositByExternalId(externalId: string) {
    return await this.prismaService.deposit.findUnique({
      where: { externalId },
      include: {
        user: true,
        currency: true,
        operation: true,
      },
    });
  }

  async getDepositById(id: number) {
    return this.prismaService.deposit.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  /**
   * Получает депозиты пользователя
   */
  async getUserDeposits(userId: number, limit = 50, offset = 0) {
    return await this.prismaService.deposit.findMany({
      where: { userId },
      include: {
        currency: true,
        operation: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Обновляет статус депозита на PROCESSING
   */
  async markAsProcessing(externalId: string) {
    return await this.prismaService.deposit.update({
      where: { externalId },
      data: { status: DepositStatus.PROCESSING },
    });
  }
}