import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaTransactionClient } from '../../prisma/types';
import { Operation } from '@prisma/client';

@Injectable()
export class AutoBonusService {
  private readonly logger = new Logger(AutoBonusService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Создает бонусный счет для пользователя при первом пополнении от партнера
   */
  async createBonusAccountForPartner(
    prisma: PrismaTransactionClient,
    operation: Operation,
    partnerId: number,
  ) {
    try {
      this.logger.log(`Creating bonus account for user ${operation.userId} with partner ${partnerId}`);

      // Проверяем, есть ли уже бонусный счет у пользователя
      const existingBonusBalance = await prisma.bonusBalance.findUnique({
        where: {
          userId_currencyCode: {
            userId: operation.userId,
            currencyCode: operation.currencyCode,
          }
        }
      });

      // Если бонусный счет уже существует, не создаем новый
      if (existingBonusBalance) {
        this.logger.log(`Bonus account already exists for user ${operation.userId}, currency ${operation.currencyCode}`);
        return;
      }

      // Промо-функциональность удалена
      this.logger.log(`Auto-bonus functionality disabled for partner ${partnerId}`);

      this.logger.log(`Deposit bonus created successfully:`, {
        userId: operation.userId,
        partnerId,
        bonusAmount: "0"
      });

    } catch (error) {
      this.logger.error(`Error creating bonus account for user ${operation.userId}:`, error);
      // Не прерываем основную операцию пополнения из-за ошибки создания бонусного счета
    }
  }
} 