import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '~/prisma/prisma.service';
import { CreateWithdrawalDto, WithdrawalMethod, CardType, CurrencyCode } from './dto/create-withdrawal.dto';
import { OperationStatus, OperationSource, OperationType } from '@prisma/client';
import { OperationService } from '~/main/operation/operation.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WithdrawalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
  ) {}

  async create(userId: number, dto: CreateWithdrawalDto) {
    console.log('[WithdrawalService] Starting withdrawal creation:', {
      userId,
      amount: dto.amount,
      currency: dto.currency,
      method: dto.method,
      cardType: dto.cardType
    });

    // Проверяем минимальную сумму в зависимости от валюты
    const minAmount = dto.currency === CurrencyCode.KZT ? 3000 : 100;
    if (dto.amount < minAmount) {
      console.log('[WithdrawalService] Amount too small:', {
        userId,
        amount: dto.amount,
        minAmount,
        currency: dto.currency
      });
      throw new BadRequestException(`Минимальная сумма для вывода: ${minAmount} ${dto.currency}`);
    }

    // Простая валидация номера карты/кошелька
    if (!dto.cardNumber || dto.cardNumber.trim() === '') {
      throw new BadRequestException('Номер карты/кошелька обязателен');
    }

    // Для карт проверяем формат номера
    if (dto.method === WithdrawalMethod.CARD) {
      const cleanCardNumber = dto.cardNumber.replace(/[\s\-]/g, '');
      if (!/^\d{13,19}$/.test(cleanCardNumber)) {
        throw new BadRequestException('Неверный формат номера карты. Требуется 13-19 цифр');
      }
    }

    // Банк не обязателен - админ будет обрабатывать заявки вручную
    // if (dto.type === WithdrawalType.CARD && !dto.bank) {
    //   console.log('[WithdrawalService] Missing bank name for card:', {
    //     userId,
    //     type: dto.type
    //   });
    //   throw new BadRequestException('Для вывода на карту укажите название банка');
    // }

    // Проверка: не было ли такого же запроса за последние 10 секунд
    const duplicate = await this.prisma.withdrawRequest.findFirst({
      where: {
        userId,
        amount: dto.amount,
        wallet: dto.cardNumber,
        currencyCode: dto.currency,
        status: OperationStatus.WAITING,
        createdAt: {
          gte: new Date(Date.now() - 10_000)
        },
      },
    });

    if (duplicate) {
      console.log('[WithdrawalService] Duplicate request detected:', {
        userId,
        existingId: duplicate.id,
        amount: dto.amount,
        method: dto.method,
        createdAt: duplicate.createdAt
      });
      throw new BadRequestException("Такой же запрос на вывод уже был отправлен недавно");
    }

    // Проверяем баланс пользователя
    const balance = await this.prisma.balance.findFirst({
      where: {
        userId,
        currencyCode: dto.currency,
      },
    });

    if (!balance || balance.amount.lessThan(dto.amount)) {
      console.log('[WithdrawalService] Insufficient balance:', {
        userId,
        balance: balance?.amount.toString(),
        requested: dto.amount
      });
      throw new BadRequestException('Недостаточно средств');
    }

    // Проверяем наличие других необработанных выводов
    const pendingWithdrawals = await this.prisma.withdrawRequest.count({
      where: {
        userId,
        status: OperationStatus.WAITING,
      },
    });

    if (pendingWithdrawals >= 10) {
      console.log('[WithdrawalService] Too many pending withdrawals:', {
        userId,
        pendingCount: pendingWithdrawals
      });
      throw new BadRequestException('У вас уже есть 10 необработанных запросов на вывод');
    }

    console.log('[WithdrawalService] Creating withdrawal request:', {
      userId,
      amount: dto.amount,
      currency: dto.currency,
      method: dto.method,
      cardType: dto.cardType,
      cardNumber: dto.cardNumber
    });

    // Создаем запрос на вывод и списываем средства в транзакции
    const withdrawRequest = await this.prisma.$transaction(async (tx) => {
      // Создаем запрос на вывод
      const request = await tx.withdrawRequest.create({
        data: {
          userId,
          amount: dto.amount,
          currencyCode: dto.currency,
          type: dto.method, // Сохраняем как строку для совместимости
          wallet: dto.cardNumber,
          bank: dto.cardType, // Используем поле bank для хранения типа карты
          status: OperationStatus.WAITING,
        },
      });

      // Списываем средства сразу при создании запроса
      await this.operationService.create(tx, userId, {
        type: OperationType.OUTCOME,
        amount: new Decimal(dto.amount),
        currencyCode: dto.currency,
        source: OperationSource.PAYMENT_SYSTEM,
        status: OperationStatus.SUCCESS,
        meta: {
          title: 'Вывод средств',
          withdrawalId: request.id,
          method: dto.method,
          cardType: dto.cardType,
          cardNumber: dto.cardNumber
        }
      });

      return request;
    });

    console.log('[WithdrawalService] Withdrawal request created successfully:', {
      id: withdrawRequest.id,
      userId,
      amount: dto.amount,
      method: dto.method,
      status: withdrawRequest.status
    });

    return withdrawRequest;
  }



  async getUserWithdrawals(userId: number) {
    return this.prisma.withdrawRequest.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Admin methods
  async getAllWithdrawals(filter?: string) {
    const where = filter && filter !== 'all' ? {
      status: this.mapStatus(filter)
    } : {};

    const withdrawals = await this.prisma.withdrawRequest.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return withdrawals.map(w => ({
      id: w.id,
      userEmail: w.user.email,
      amount: Number(w.amount),
      currency: w.currencyCode,
      method: w.type,
      wallet: w.wallet || 'Не указан',
      status: this.mapStatusBack(w.status),
      createdAt: w.createdAt,
    }));
  }

  async updateStatus(id: number, status: string, reason?: string) {
    const operationStatus = this.mapStatus(status);

    const withdrawRequest = await this.prisma.withdrawRequest.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!withdrawRequest) {
      throw new NotFoundException('Withdrawal request not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: any = { status: operationStatus };
      if (reason) {
        updateData.reason = reason;
      }
      
      await tx.withdrawRequest.update({
        where: { id },
        data: updateData,
      });

      if (operationStatus === OperationStatus.FAILED) {
        await tx.balance.updateMany({
          where: {
            userId: withdrawRequest.userId,
            currencyCode: withdrawRequest.currencyCode,
          },
          data: {
            amount: {
              increment: withdrawRequest.amount,
            },
          },
        });

        await tx.operation.create({
          data: {
            userId: withdrawRequest.userId,
            amount: withdrawRequest.amount,
            currencyCode: withdrawRequest.currencyCode,
            type: OperationType.INCOME,
            source: OperationSource.PAYMENT_SYSTEM,
            status: OperationStatus.SUCCESS,
            meta: {
              withdrawRequestId: id,
              action: 'withdrawal_rejected',
              method: withdrawRequest.type,
              wallet: withdrawRequest.wallet,
              reason: reason || 'No reason provided',
            },
          },
        });
      } else if (operationStatus === OperationStatus.SUCCESS) {
        // Создаем операцию подтверждения вывода (средства уже списаны при создании запроса)
        await tx.operation.create({
          data: {
            userId: withdrawRequest.userId,
            amount: withdrawRequest.amount,
            currencyCode: withdrawRequest.currencyCode,
            type: OperationType.OUTCOME,
            source: OperationSource.PAYMENT_SYSTEM,
            status: OperationStatus.SUCCESS,
            meta: {
              withdrawRequestId: id,
              action: 'withdrawal_completed',
              method: withdrawRequest.type,
              wallet: withdrawRequest.wallet,
            },
          },
        });
      }
    }, {
      timeout: 10000,
      isolationLevel: 'Serializable'
    });

    // Все выводы обрабатываются только через админку
    console.log('[WithdrawalService] Withdrawal status updated, admin processing required:', {
      withdrawRequestId: id,
      status: operationStatus,
      currency: withdrawRequest.currencyCode
    });
  }

  async processWithdrawal(id: number) {
    const withdrawRequest = await this.prisma.withdrawRequest.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!withdrawRequest) {
      throw new NotFoundException('Withdrawal request not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.operation.create({
        data: {
          userId: withdrawRequest.userId,
          amount: withdrawRequest.amount,
          currencyCode: withdrawRequest.currencyCode,
          type: OperationType.OUTCOME,
          source: OperationSource.PAYMENT_SYSTEM,
          status: OperationStatus.SUCCESS,
          meta: {
            withdrawRequestId: id,
            action: 'withdrawal_processed',
            method: withdrawRequest.type,
            wallet: withdrawRequest.wallet,
          },
        },
      });

      await tx.withdrawRequest.update({
        where: { id },
        data: { status: OperationStatus.SUCCESS },
      });
    });
  }

  async getAllWithdrawalsWithUserData() {
    const withdrawals = await this.prisma.withdrawRequest.findMany({
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return withdrawals.map(w => ({
      id: w.id.toString(),
      userId: w.userId.toString(),
      userEmail: w.user.email,
      amount: Number(w.amount),
      currency: w.currencyCode,
      method: w.type,
      cardNumber: w.wallet || 'Не указан',
      cardType: w.bank || null, // Поле bank содержит тип карты/криптовалюты
      reason: w.reason || null,
      createdAt: w.createdAt.toISOString(),
      status: this.mapStatusToAdminPanel(w.status),
      processedAt: w.updatedAt ? w.updatedAt.toISOString() : undefined,
    }));
  }

  private mapStatus(status?: string): OperationStatus {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return OperationStatus.WAITING;
      case 'COMPLETED':
        return OperationStatus.SUCCESS;
      case 'REJECTED':
        return OperationStatus.FAILED;
      default:
        return OperationStatus.WAITING;
    }
  }

  private mapStatusToAdminPanel(status: OperationStatus): string {
    switch (status) {
      case OperationStatus.WAITING:
        return 'pending';
      case OperationStatus.SUCCESS:
        return 'completed';
      case OperationStatus.FAILED:
        return 'rejected';
      default:
        return 'pending';
    }
  }

  private mapStatusBack(status: OperationStatus): string {
    switch (status) {
      case OperationStatus.WAITING:
        return 'PENDING';
      case OperationStatus.SUCCESS:
        return 'COMPLETED';
      case OperationStatus.FAILED:
        return 'REJECTED';
    }
  }

  private isValidWalletFormat(type: string, wallet: string): boolean {
    if (!wallet || wallet.trim() === '' || wallet === '-') {
      return false; // Wallet обязателен для всех типов вывода
    }

    const patterns = {
      'CARD': /^[\d\s\-]{13,19}$/, // Номера карт 13-19 цифр с пробелами и дефисами
      'CRYPTO': /^[a-zA-Z0-9]{20,100}$/, 
      'QIWI': /^[\+]?[\d\s\-\(\)]{10,20}$/, 
      'YOOMONEY': /^[\d]{11,20}$/, 
      'NIRVANAPAY': /^[\d\s\-]{13,19}$/, // Номера карт для NirvanaPay
    };

    if (!patterns[type]) {
      return wallet.length >= 3;
    }

    // Для карт проверяем только цифры (убираем пробелы и дефисы)
    if (type === 'CARD') {
      const cleanWallet = wallet.replace(/[\s\-]/g, '');
      return /^[\d]{13,19}$/.test(cleanWallet);
    }

    return patterns[type].test(wallet);
  }
}