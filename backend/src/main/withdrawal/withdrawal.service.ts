import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '~/prisma/prisma.service';
import { CreateWithdrawalDto, WithdrawalMethod, CardType, CurrencyCode } from './dto/create-withdrawal.dto';
import { OperationStatus, OperationSource, OperationType } from '@prisma/client';
import { OperationService } from '~/main/operation/operation.service';
import { TelegramUserNotifyService } from '~/main/telegram/telegram-user-notify.service';
import { TelegramNotifyService } from '~/main/telegram/telegram-notify.service';
import { PushUserNotifyService } from '~/main/push/push-user-notify.service';
import { BonusBalanceService } from '~/main/bonus-balance/bonus-balance.service';
import { PhoneVerificationService } from '~/main/user/phone-verification.service';
import { loadPaymentSettings } from '~/main/payment-settings/payment-settings.store';
import { Decimal } from '@prisma/client/runtime/library';

const WITHDRAWAL_ALERT_THRESHOLDS: Record<string, number> = {
  KZT: 50_000,
  RUB: 10_000,
  USD: 100,
  USDT: 100,
  UAH: 5_000,
  TRY: 3_000,
  UZS: 1_000_000,
};

@Injectable()
export class WithdrawalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
    private readonly telegramUserNotify: TelegramUserNotifyService,
    private readonly telegramNotify: TelegramNotifyService,
    private readonly pushUserNotify: PushUserNotifyService,
    private readonly bonusBalanceService: BonusBalanceService,
    private readonly phoneVerification: PhoneVerificationService,
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

    await this.bonusBalanceService.assertWithdrawalAllowed(userId, dto.currency);

    await this.phoneVerification.assertWithdrawalWithinLimit(
      userId,
      Number(dto.amount),
      dto.currency,
    );

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
        status: { in: [OperationStatus.WAITING, OperationStatus.PROCESSING] },
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

    void this.notifyAdminWithdrawal({
      id: withdrawRequest.id,
      userId,
      amount: dto.amount,
      currency: dto.currency,
      method: dto.method,
      cardType: dto.cardType,
      cardNumber: dto.cardNumber,
    }).catch(() => undefined);

    return withdrawRequest;
  }

  private isLargeWithdrawal(amount: number, currency: string): boolean {
    const threshold = WITHDRAWAL_ALERT_THRESHOLDS[currency] ?? 10_000;
    return amount >= threshold;
  }

  private async notifyAdminWithdrawal(args: {
    id: number;
    userId: number;
    amount: number;
    currency: string;
    method: string;
    cardType?: string;
    cardNumber: string;
  }) {
    const settings = loadPaymentSettings();
    if (!settings.notifications.telegramWithdrawNotify) return;

    const user = await this.prisma.user.findUnique({
      where: { id: args.userId },
      select: { email: true },
    });

    const large = this.isLargeWithdrawal(args.amount, args.currency);
    const headline = large ? 'Крупная заявка на вывод' : 'Новая заявка на вывод';
    const adminUrl = `https://cdn.imba.bet/users/${args.userId}`;

    const lines = [
      `💸 ${headline}`,
      `ID: ${args.id}`,
      `User: #${args.userId}${user?.email ? ` (${user.email})` : ''}`,
      `Сумма: ${args.amount} ${args.currency}`,
      `Метод: ${args.method}${args.cardType ? ` / ${args.cardType}` : ''}`,
      `Реквизиты: ${args.cardNumber}`,
      `Admin: ${adminUrl}`,
    ];

    await this.telegramNotify.sendSystemAlert(
      large ? `🚨 ${headline}` : headline,
      lines.join('\n'),
    );
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

  /** Пользователь отменяет свою заявку в статусе WAITING — средства возвращаются на баланс. */
  async cancelByUser(userId: number, withdrawRequestId: number) {
    const existing = await this.prisma.withdrawRequest.findFirst({
      where: { id: withdrawRequestId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Заявка на вывод не найдена');
    }

    if (existing.status !== OperationStatus.WAITING) {
      throw new BadRequestException('Отменить можно только заявку в статусе «Ожидает»');
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawRequest.updateMany({
        where: {
          id: withdrawRequestId,
          userId,
          status: OperationStatus.WAITING,
        },
        data: {
          status: OperationStatus.FAILED,
          reason: 'Отменено пользователем',
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException('Заявка уже обработана или отменена');
      }

      await this.operationService.create(tx, userId, {
        type: OperationType.INCOME,
        amount: existing.amount,
        currencyCode: existing.currencyCode,
        source: OperationSource.PAYMENT_SYSTEM,
        status: OperationStatus.SUCCESS,
        meta: {
          title: 'Отмена вывода',
          withdrawalId: withdrawRequestId,
          action: 'withdrawal_cancelled_by_user',
          method: existing.type,
          wallet: existing.wallet,
        },
      });
    });

    void this.telegramUserNotify.notifyWithdraw({
      userId,
      withdrawId: withdrawRequestId,
      status: 'cancelled',
      amount: Number(existing.amount),
      currency: existing.currencyCode,
      reason: 'Отменено пользователем',
    }).catch(() => undefined);

    void this.pushUserNotify.notifyWithdraw({
      userId,
      withdrawId: withdrawRequestId,
      status: 'cancelled',
      amount: Number(existing.amount),
      currency: existing.currencyCode,
    }).catch(() => undefined);

    return { ok: true, id: withdrawRequestId, refunded: Number(existing.amount) };
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

    const current = withdrawRequest.status;
    if (current === OperationStatus.SUCCESS || current === OperationStatus.FAILED) {
      throw new BadRequestException('Заявка уже закрыта');
    }
    if (
      operationStatus === OperationStatus.PROCESSING
      && current !== OperationStatus.WAITING
    ) {
      throw new BadRequestException('В обработку можно взять только новую заявку');
    }
    if (
      (operationStatus === OperationStatus.SUCCESS || operationStatus === OperationStatus.FAILED)
      && current !== OperationStatus.WAITING
      && current !== OperationStatus.PROCESSING
    ) {
      throw new BadRequestException('Нельзя изменить статус этой заявки');
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: { status: OperationStatus; reason?: string } = {
        status: operationStatus,
      };
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
        // Средства уже списаны при создании запроса — фиксируем факт выплаты
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
      // PROCESSING — только смена статуса, без движения баланса
    }, {
      timeout: 10000,
      isolationLevel: 'Serializable'
    });

    console.log('[WithdrawalService] Withdrawal status updated:', {
      withdrawRequestId: id,
      from: current,
      status: operationStatus,
      currency: withdrawRequest.currencyCode
    });

    if (operationStatus === OperationStatus.PROCESSING) {
      void this.telegramUserNotify.notifyWithdraw({
        userId: withdrawRequest.userId,
        withdrawId: id,
        status: 'processing',
        amount: Number(withdrawRequest.amount),
        currency: withdrawRequest.currencyCode,
      }).catch(() => undefined);
      void this.pushUserNotify.notifyWithdraw({
        userId: withdrawRequest.userId,
        withdrawId: id,
        status: 'processing',
        amount: Number(withdrawRequest.amount),
        currency: withdrawRequest.currencyCode,
      }).catch(() => undefined);
    } else if (operationStatus === OperationStatus.SUCCESS) {
      void this.telegramUserNotify.notifyWithdraw({
        userId: withdrawRequest.userId,
        withdrawId: id,
        status: 'completed',
        amount: Number(withdrawRequest.amount),
        currency: withdrawRequest.currencyCode,
      }).catch(() => undefined);
      void this.pushUserNotify.notifyWithdraw({
        userId: withdrawRequest.userId,
        withdrawId: id,
        status: 'completed',
        amount: Number(withdrawRequest.amount),
        currency: withdrawRequest.currencyCode,
      }).catch(() => undefined);
    } else if (operationStatus === OperationStatus.FAILED) {
      void this.telegramUserNotify.notifyWithdraw({
        userId: withdrawRequest.userId,
        withdrawId: id,
        status: 'rejected',
        amount: Number(withdrawRequest.amount),
        currency: withdrawRequest.currencyCode,
        reason,
      }).catch(() => undefined);
      void this.pushUserNotify.notifyWithdraw({
        userId: withdrawRequest.userId,
        withdrawId: id,
        status: 'rejected',
        amount: Number(withdrawRequest.amount),
        currency: withdrawRequest.currencyCode,
        reason,
      }).catch(() => undefined);
    }
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
      case 'WAITING':
        return OperationStatus.WAITING;
      case 'PROCESSING':
      case 'IN_PROGRESS':
        return OperationStatus.PROCESSING;
      case 'COMPLETED':
      case 'SUCCESS':
        return OperationStatus.SUCCESS;
      case 'REJECTED':
      case 'FAILED':
        return OperationStatus.FAILED;
      default:
        throw new BadRequestException(`Неизвестный статус вывода: ${status}`);
    }
  }

  private mapStatusToAdminPanel(status: OperationStatus): string {
    switch (status) {
      case OperationStatus.WAITING:
        return 'pending';
      case OperationStatus.PROCESSING:
        return 'processing';
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
      case OperationStatus.PROCESSING:
        return 'PROCESSING';
      case OperationStatus.SUCCESS:
        return 'COMPLETED';
      case OperationStatus.FAILED:
        return 'REJECTED';
      default:
        return 'PENDING';
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
