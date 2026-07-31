import { Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { OperationSource, OperationStatus, OperationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

import { PartnersService } from '../partners/partners.service';
import { TelegramUserNotifyService } from '../telegram/telegram-user-notify.service';
import { getPublicSiteBaseUrl } from '../telegram/public-site-url.util';
import {
  calcDepositBonusAmount,
  calcMaxCashout,
  calcRequiredWager,
  getWelcomeBonusDisplayAmount,
  parsePromoBonusPolicy,
  PromoBonusPolicy,
} from './bonus-policy.util';
import { completeBonusWageringIfNeeded } from './complete-bonus-wagering.util';
import { getWelcomeBonusConfig } from './welcome-bonus.config';
import {
  buildBonusExpiresAt,
  isBonusExpired,
} from './bonus-expiry.util';
import { buildPaymentFingerprint } from './payment-fingerprint.util';
import { getReloadBonusTier } from './reload-bonus.config';
import { BONUS_WAGERING_RULES } from './bonus-wagering-rules.config';

@Injectable()
export class BonusBalanceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly partnersService: PartnersService,
    @Optional() private readonly telegramUserNotify?: TelegramUserNotifyService,
  ) {}

  async expireBonusIfNeeded(
    userId: number,
    currencyCode: string,
    tx?: any,
  ): Promise<boolean> {
    const prisma = tx ?? this.prismaService;
    const bonusBalance = await prisma.bonusBalance.findUnique({
      where: { userId_currencyCode: { userId, currencyCode } },
    });
    if (!bonusBalance || !isBonusExpired(bonusBalance.expiresAt)) {
      return false;
    }

    await prisma.bonusBalance.update({
      where: { userId_currencyCode: { userId, currencyCode } },
      data: {
        isActive: false,
        amount: 0,
        remainingTokens: 0,
        requiresDeposit: false,
        depositActivated: false,
      },
    });

    await prisma.bonusHistory.updateMany({
      where: {
        userId,
        currencyCode,
        status: 'PENDING',
      },
      data: {
        status: 'EXPIRED',
        expiredAt: new Date(),
        completedAt: new Date(),
        notes: 'Бонус сгорел — истёк срок действия',
      },
    });

    return true;
  }

  async assertBonusUsable(userId: number, currencyCode: string, tx?: any) {
    await this.expireBonusIfNeeded(userId, currencyCode, tx);
    const prisma = tx ?? this.prismaService;
    const bonusBalance = await prisma.bonusBalance.findUnique({
      where: { userId_currencyCode: { userId, currencyCode } },
    });
    if (!bonusBalance?.isActive && bonusBalance?.requiresDeposit && !bonusBalance.depositActivated) {
      if (isBonusExpired(bonusBalance.expiresAt)) {
        throw new BadRequestException('Срок действия бонуса истёк — пополните счёт в течение 24 часов');
      }
    }
    if (bonusBalance?.isActive && isBonusExpired(bonusBalance.expiresAt)) {
      throw new BadRequestException('Срок отыгрыша бонуса истёк');
    }
    return bonusBalance;
  }

  /**
   * Получает историю бонусов пользователя
   */
  async getBonusHistory(userId: number) {
    const history = await this.prismaService.bonusHistory.findMany({
      where: { userId },
      orderBy: { appliedAt: 'desc' },
      include: {
        promo: true,
      },
    });

    return history.map(item => {
      const progressPercentage = Number(item.requiredWager) > 0 
        ? Math.min(100, Math.round((Number(item.totalWagered) / Number(item.requiredWager)) * 100))
        : 0;

      return {
        id: item.id,
        promoCode: item.promoCode,
        promoType: item.promoType,
        promoTypeText: this.getPromoTypeText(item.promoType),
        status: item.status,
        statusText: this.getStatusText(item.status),
        appliedAt: item.appliedAt.toISOString(),
        expiredAt: item.expiredAt?.toISOString(),
        completedAt: item.completedAt?.toISOString(),
        totalBonusReceived: item.totalBonusReceived.toString(),
        totalWagered: item.totalWagered.toString(),
        requiredWager: item.requiredWager.toString(),
        consecutiveWins: item.consecutiveWins,
        requiredConsecutiveWins: item.requiredConsecutiveWins,
        totalTokens: item.totalTokens,
        remainingTokens: item.remainingTokens,
        tokensPerBet: item.tokensPerBet,
        isTokenBased: item.isTokenBased,
        currencyCode: item.currencyCode,
        notes: item.notes,
        progressPercentage,
      };
    });
  }

  /**
   * Получает статистику по бонусам пользователя
   */
  async getBonusHistoryStats(userId: number) {
    const allBonuses = await this.prismaService.bonusHistory.findMany({
      where: { userId },
    });

    const stats = {
      total: allBonuses.length,
      active: allBonuses.filter(b => b.status === 'PENDING').length,
      won: allBonuses.filter(b => b.status === 'WIN').length,
      lost: allBonuses.filter(b => b.status === 'LOSE').length,
      expired: allBonuses.filter(b => b.status === 'EXPIRED').length,
      totalBonusReceived: allBonuses.reduce((sum, b) => sum + Number(b.totalBonusReceived), 0).toString(),
      totalWagered: allBonuses.reduce((sum, b) => sum + Number(b.totalWagered), 0).toString(),
    };

    return stats;
  }

  private getPromoTypeText(type: string): string {
    switch (type) {
      case 'DIRECT_BONUS':
        return 'Прямой бонус';
      case 'DEPOSIT_BONUS':
        return 'Бонус на депозит';
      case 'VOUCHER':
        return 'Ваучер';
      default:
        return type;
    }
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'Активен';
      case 'WIN':
        return 'Выигран';
      case 'LOSE':
        return 'Проигран';
      case 'EXPIRED':
        return 'Истек';
      case 'CANCELLED':
        return 'Отменен';
      default:
        return status;
    }
  }

  /**
   * Создает бонусный счет для пользователя (промо-функциональность отключена)
   */
  async createBonusAccount(
    userId: number, 
    currencyCode: string, 
    customParams?: {
      amount?: number;
      totalTokens?: number;
      tokensPerBet?: number;
      minOdds?: number;
      isTokenBased?: boolean;
    }
  ) {
    // Промо-функциональность удалена
    throw new Error('Бонусные счета отключены');
  }

  /**
   * Обновляет партнерский бонусный счет
   */
  async updatePartnerBonusAccount(partnerId: string, currencyCode: string, bonusGiven: number, commissionEarned: number) {
    await this.prismaService.partnerBonusAccount.upsert({
      where: {
        partnerId_currencyCode: {
          partnerId,
          currencyCode
        }
      },
      update: {
        totalBonusGiven: { increment: bonusGiven },
        commissionEarned: { increment: commissionEarned }
      },
      create: {
        partnerId,
        currencyCode,
        totalBonusGiven: bonusGiven,
        commissionEarned: commissionEarned
      }
    });
  }

  /**
   * Проверяет возможность вывода бонусных средств
   */
  async checkWithdrawalEligibility(userId: number, currencyCode: string, amount: number) {
    const bonusBalance = await this.prismaService.bonusBalance.findUnique({
      where: {
        userId_currencyCode: {
          userId,
          currencyCode
        }
      }
    });

    if (!bonusBalance || !bonusBalance.isActive) {
      throw new BadRequestException('Бонусный счет не активен');
    }

    if (bonusBalance.amount.lessThan(amount)) {
      throw new BadRequestException('Недостаточно средств на бонусном счете');
    }

    // Проверяем, отыграл ли пользователь требуемую сумму
    if (bonusBalance.totalWagered.lessThan(bonusBalance.requiredWager)) {
      const remainingWager = bonusBalance.requiredWager.minus(bonusBalance.totalWagered);
      throw new BadRequestException(`Необходимо отыграть еще ${remainingWager} ${currencyCode}`);
    }

    return true;
  }

  /**
   * Обрабатывает ставку с бонусного счета
   */
  async processBonusBet(userId: number, currencyCode: string, betAmount: number, odds: number) {
    await this.assertBonusUsable(userId, currencyCode);
    const bonusBalance = await this.prismaService.bonusBalance.findUnique({
      where: {
        userId_currencyCode: {
          userId,
          currencyCode
        }
      }
    });

    if (!bonusBalance || !bonusBalance.isActive) {
      throw new BadRequestException('Бонусный счет не активен');
    }

    if (bonusBalance.requiresDeposit && !bonusBalance.depositActivated) {
      throw new BadRequestException('Пополните счёт, чтобы играть с бонусом');
    }

    if (bonusBalance.isFreeBet) {
      const stake = Number(bonusBalance.freeBetStake ?? bonusBalance.amount);
      if (betAmount !== stake) {
        throw new BadRequestException(`Фрибет: ставка должна быть ровно ${stake} ${currencyCode}`);
      }
    } else if (bonusBalance.amount.lessThan(new Decimal(betAmount))) {
      throw new BadRequestException('Недостаточно средств на бонусном счете');
    }

    if (new Decimal(odds).lessThan(bonusBalance.minOdds)) {
      throw new BadRequestException(`Минимальный коэффициент для бонусных ставок: ${bonusBalance.minOdds}`);
    }

    const updateData = bonusBalance.isFreeBet
      ? { totalWagered: { increment: betAmount }, isActive: false }
      : { amount: { decrement: betAmount }, totalWagered: { increment: betAmount } };

    await this.prismaService.bonusBalance.update({
      where: {
        userId_currencyCode: {
          userId,
          currencyCode
        }
      },
      data: updateData,
    });

    return {
      success: true,
      remainingAmount: bonusBalance.isFreeBet
        ? new Decimal(0)
        : bonusBalance.amount.minus(new Decimal(betAmount)),
    };
  }

  /**
   * Обрабатывает выигрыш по бонусной ставке
   */
  async processBonusWin(userId: number, currencyCode: string, winAmount: number, originalBetAmount: number) {
    const bonusBalance = await this.prismaService.bonusBalance.findUnique({
      where: {
        userId_currencyCode: {
          userId,
          currencyCode
        }
      }
    });

    if (!bonusBalance) {
      throw new NotFoundException('Бонусный счет не найден');
    }

    await this.prismaService.$transaction(async (prisma) => {
      // Обновляем статистику отыгрыша
      const newTotalWagered = bonusBalance.totalWagered.plus(originalBetAmount);
      
      // Проверяем, достигнут ли лимит отыгрыша
      const requiredWager = bonusBalance.requiredWager;
      const isWageringComplete = newTotalWagered.greaterThanOrEqualTo(requiredWager);

      if (isWageringComplete) {
        await prisma.bonusBalance.update({
          where: {
            userId_currencyCode: {
              userId,
              currencyCode,
            },
          },
          data: {
            totalWagered: newTotalWagered,
          },
        });
        await completeBonusWageringIfNeeded(prisma, userId, currencyCode);
      } else {
        // Отыгрыш еще не завершен - только обновляем статистику
        await prisma.bonusBalance.update({
          where: {
            userId_currencyCode: {
              userId,
              currencyCode
            }
          },
          data: {
            totalWagered: newTotalWagered
          }
        });

      }
    });

    const newTotalWagered = bonusBalance.totalWagered.plus(originalBetAmount);
    const requiredWager = bonusBalance.requiredWager;
    const isWageringComplete = newTotalWagered.greaterThanOrEqualTo(requiredWager);

    return { 
      success: true, 
      winAmount,
      bonusRemaining: bonusBalance.amount.toNumber(),
      totalWagered: newTotalWagered.toNumber(),
      requiredWager: requiredWager.toNumber(),
      isComplete: isWageringComplete,
      message: isWageringComplete ? 
        'Бонус полностью отыгран! Весь бонус переведен на основной счет.' : 
        'Отыгрыш продолжается. Бонус остается на бонусном счете.'
    };
  }

  /**
   * Получает статистику бонусных счетов партнера
   */
  async getPartnerBonusStats(partnerId: string) {
    // Получаем статистику из операций партнера
    const partnerOperations = await this.prismaService.operation.findMany({
      where: {
        userId: parseInt(partnerId),
        source: 'AFFILIATE',
        type: 'INCOME'
      }
    });

    // Получаем пользователей партнера
    const partnerUsers = await this.prismaService.user.findMany({
      where: { affiliatedById: parseInt(partnerId) },
      include: {
        bonusBalances: {
          where: { isActive: true },
          include: { currency: true }
        }
      }
    });

    // Группируем операции по валютам
    const statsByCurrency = new Map();
    
    partnerOperations.forEach(op => {
      const currency = op.currencyCode;
      if (!statsByCurrency.has(currency)) {
        statsByCurrency.set(currency, {
          currencyCode: currency,
          totalBonusGiven: 0,
          totalBonusWagered: 0,
          totalBonusWithdrawn: 0,
          commissionEarned: 0
        });
      }
      
      const stats = statsByCurrency.get(currency);
      stats.commissionEarned += parseFloat(op.amount.toString());
    });

    // Добавляем статистику бонусных счетов пользователей
    partnerUsers.forEach(user => {
      user.bonusBalances.forEach(balance => {
        const currency = balance.currencyCode;
        if (!statsByCurrency.has(currency)) {
          statsByCurrency.set(currency, {
            currencyCode: currency,
            totalBonusGiven: 0,
            totalBonusWagered: 0,
            totalBonusWithdrawn: 0,
            commissionEarned: 0
          });
        }
        
        const stats = statsByCurrency.get(currency);
        stats.totalBonusGiven += parseFloat(balance.totalBonusReceived.toString());
        stats.totalBonusWagered += parseFloat(balance.totalWagered.toString());
      });
    });

    return Array.from(statsByCurrency.values());
  }

  /**
   * Получает статистику бонусных счетов пользователей партнера
   */
  async getPartnerUsersBonusStats(partnerId: string) {
    
    // Получаем всех пользователей партнера
    const partnerUsers = await this.prismaService.user.findMany({
      where: { affiliatedById: parseInt(partnerId) },
      include: {
        bonusBalances: {
          include: {
            currency: true,
            promo: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedUsers = partnerUsers.map(user => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      bonusBalances: user.bonusBalances.map(balance => ({
        ...balance,
        amount: parseFloat(balance.amount?.toString() || '0'),
        totalBonusReceived: parseFloat(balance.totalBonusReceived?.toString() || '0'),
        totalWagered: parseFloat(balance.totalWagered?.toString() || '0'),
        requiredWager: parseFloat(balance.requiredWager?.toString() || '0'),
        minOdds: parseFloat(balance.minOdds?.toString() || '1.8')
      }))
    }));

    return formattedUsers;
  }

  /**
   * Начисляет партнеру процент от суммы бонуса при создании бонусного счета
   */
  private async awardPartnerBonusOnBonusCreation(
    userId: number,
    bonusAmount: number,
    currencyCode: string,
    promoId?: number
  ) {
    try {
      // Получаем информацию о пользователе и его партнере
      const user = await this.prismaService.user.findUnique({
        where: { id: userId },
        include: {
          affiliatedBy: true
        }
      });

      // Если у пользователя нет партнера, ничего не делаем
      if (!user?.affiliatedById || !user.affiliatedBy) {
        return;
      }

      const affiliator = user.affiliatedBy;
      
      // Получаем информацию о пользователе-партнере
      const partner = await this.prismaService.user.findUnique({
        where: { id: affiliator.userId }
      });
      
      if (!partner) {
        return;
      }

      // Проверяем, что процент не превышает разумные пределы (максимум 25%)
      const maxPercent = 25;
      const actualPercent = Math.min(affiliator.percent.toNumber(), maxPercent);
      const partnerBonusAmount = Math.floor((bonusAmount * actualPercent) / 100);

      // Проверяем, что у партнера есть баланс в нужной валюте
      const partnerBalance = await this.prismaService.balance.findFirst({
        where: {
          userId: partner.id,
          currencyCode: currencyCode,
        },
      });

      // Если у партнера нет баланса в этой валюте, создаем его с нулевым значением
      if (!partnerBalance) {
        await this.prismaService.balance.create({
          data: {
            userId: partner.id,
            currencyCode: currencyCode,
            amount: 0,
          },
        });
      }

      // Начисляем бонус партнеру
      await this.prismaService.operation.create({
        data: {
          userId: partner.id,
          amount: partnerBonusAmount,
          currencyCode: currencyCode,
          meta: {
            type: 'partner_bonus_creation',
            promoId: promoId,
            affiliatorId: partner.id,
            originalUserId: userId,
            bonusAmount: bonusAmount,
            partnerPercent: actualPercent,
            description: `Партнерский бонус за создание бонусного счета`
          },
          source: 'AFFILIATE',
          status: 'SUCCESS',
          type: 'INCOME',
        }
      });

      // Увеличиваем баланс партнера
      await this.prismaService.balance.update({
        where: {
          userId_currencyCode: {
            userId: partner.id,
            currencyCode: currencyCode
          }
        },
        data: {
          amount: { increment: partnerBonusAmount }
        }
      });


    } catch (error) {
      console.error(`❌ Ошибка при начислении партнерского бонуса за создание бонусного счета:`, error);
      // Не выбрасываем ошибку, чтобы не нарушить создание бонусного счета для клиента
    }
  }

  /**
   * Получает информацию о бонусном счете пользователя
   */
  async getUserBonusBalance(userId: number, currencyCode: string) {
    const bonusBalance = await this.prismaService.bonusBalance.findUnique({
      where: {
        userId_currencyCode: {
          userId,
          currencyCode
        }
      }
    });

    return bonusBalance;
  }

  /**
   * Получает все бонусные балансы пользователя
   */
  async getUserBonusBalances(userId: number) {
    const balances = await this.prismaService.bonusBalance.findMany({
      where: {
        userId,
        OR: [
          { isActive: true },
          { requiresDeposit: true, depositActivated: false },
        ],
      },
      include: {
        currency: true,
        promo: true,
      },
    });

    for (const balance of balances) {
      await this.expireBonusIfNeeded(userId, balance.currencyCode);
    }

    return this.prismaService.bonusBalance.findMany({
      where: {
        userId,
        OR: [
          { isActive: true },
          { requiresDeposit: true, depositActivated: false },
        ],
      },
      include: {
        currency: true,
        promo: true,
      },
    });
  }

  /**
   * Получает всех пользователей с бонусными счетами (для админа)
   */
  async getAllUsersWithBonusBalances() {
    return this.prismaService.bonusBalance.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true
          }
        },
        currency: true,
        promo: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getExpiringBonuses(withinHours = 24) {
    const now = new Date();
    const until = new Date(now.getTime() + withinHours * 60 * 60 * 1000);

    return this.prismaService.bonusBalance.findMany({
      where: {
        expiresAt: { gte: now, lte: until },
        OR: [
          { isActive: true },
          { requiresDeposit: true, depositActivated: false },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            registrationIp: true,
            telegramUserId: true,
          },
        },
        currency: true,
        promo: true,
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  private async assertWelcomeBonusAllowed(
    userId: number,
    registrationIp?: string | null,
    deviceId?: string | null,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const existingClaim = await this.prismaService.welcomeBonusClaim.findUnique({
      where: { userId },
    });
    if (existingClaim) {
      return { ok: false, reason: 'already_claimed' };
    }

    if (registrationIp) {
      const ipUsed = await this.prismaService.welcomeBonusClaim.findFirst({
        where: { registrationIp, userId: { not: userId } },
      });
      if (ipUsed) {
        return { ok: false, reason: 'ip_already_used' };
      }
    }

    if (deviceId) {
      const deviceUsed = await this.prismaService.welcomeBonusClaim.findFirst({
        where: { deviceId, userId: { not: userId } },
      });
      if (deviceUsed) {
        return { ok: false, reason: 'device_already_used' };
      }
    }

    return { ok: true };
  }

  private async recordWelcomeClaim(
    userId: number,
    registrationIp?: string | null,
    deviceId?: string | null,
    paymentFingerprint?: string | null,
    tx?: any,
  ) {
    const prisma = tx ?? this.prismaService;
    await prisma.welcomeBonusClaim.upsert({
      where: { userId },
      create: {
        userId,
        registrationIp: registrationIp ?? null,
        deviceId: deviceId ?? null,
        paymentFingerprint: paymentFingerprint ?? null,
      },
      update: {
        paymentFingerprint: paymentFingerprint ?? undefined,
      },
    });
  }

  async afterDepositCredited(input: {
    userId: number;
    currencyCode: string;
    depositAmount: number;
    paymentSystem: string;
    externalId?: string;
    meta?: unknown;
    depositOrdinal: number;
    tx?: any;
  }) {
    const prisma = input.tx ?? this.prismaService;
    const fingerprint = buildPaymentFingerprint({
      paymentSystem: input.paymentSystem,
      externalId: input.externalId,
      meta: input.meta,
    });

    if (fingerprint) {
      const paymentUsed = await prisma.welcomeBonusClaim.findFirst({
        where: { paymentFingerprint: fingerprint, userId: { not: input.userId } },
      });
      if (paymentUsed) {
        return { welcome: { activated: false, reason: 'payment_already_used' } };
      }
    }

    const welcome = await this.handleApprovedDeposit(
      input.userId,
      input.currencyCode,
      input.depositAmount,
      prisma,
      fingerprint,
    );

    if (!welcome.activated) {
      const reload = await this.handleReloadDeposit(
        input.userId,
        input.currencyCode,
        input.depositAmount,
        input.depositOrdinal,
        prisma,
      );
      return { welcome, reload };
    }

    return { welcome, reload: { applied: false } };
  }

  async handleReloadDeposit(
    userId: number,
    currencyCode: string,
    depositAmount: number,
    depositOrdinal: number,
    tx?: any,
  ) {
    const prisma = tx ?? this.prismaService;
    const tier = getReloadBonusTier(currencyCode, depositOrdinal);
    if (!tier) {
      return { applied: false, reason: 'no_tier' };
    }

    const activeBonus = await prisma.bonusBalance.findUnique({
      where: { userId_currencyCode: { userId, currencyCode } },
    });
    if (
      activeBonus?.isActive
      && activeBonus.totalWagered.lessThan(activeBonus.requiredWager)
    ) {
      return { applied: false, reason: 'active_wagering' };
    }

    const bonusAmount = Math.min(
      depositAmount * (tier.bonusPercentage / 100),
      tier.maxBonus,
    );
    if (bonusAmount <= 0) {
      return { applied: false, reason: 'zero_bonus' };
    }

    const policy: PromoBonusPolicy = {
      wagerMultiplier: tier.wagerMultiplier,
      wagerOnDepositPlusBonus: true,
      minDeposit: 0,
      maxBonusAmount: tier.maxBonus,
      maxCashoutMultiplier: 2,
      requiresDeposit: false,
      bonusPercentage: tier.bonusPercentage,
      fixedAmount: 0,
    };
    const requiredWager = calcRequiredWager(depositAmount, bonusAmount, policy);
    const maxCashout = calcMaxCashout(depositAmount, policy);
    const expiresAt = buildBonusExpiresAt(tier.expiryHours);

    await prisma.bonusBalance.upsert({
      where: { userId_currencyCode: { userId, currencyCode } },
      create: {
        userId,
        currencyCode,
        amount: new Decimal(bonusAmount),
        totalBonusReceived: new Decimal(bonusAmount),
        totalWagered: new Decimal(0),
        requiredWager: new Decimal(requiredWager),
        minOdds: new Decimal(BONUS_WAGERING_RULES.minOdds),
        consecutiveWins: 0,
        requiredConsecutiveWins: 0,
        currentBetAmount: new Decimal(0),
        isActive: true,
        requiresDeposit: false,
        depositActivated: true,
        activationDepositAmount: new Decimal(depositAmount),
        maxCashout: maxCashout ? new Decimal(maxCashout) : null,
        wagerMultiplier: tier.wagerMultiplier,
        expiresAt,
        totalTokens: 0,
        remainingTokens: 0,
        tokensPerBet: 1,
        isTokenBased: false,
        isFreeBet: false,
      },
      update: {
        amount: new Decimal(bonusAmount),
        totalBonusReceived: new Decimal(bonusAmount),
        totalWagered: new Decimal(0),
        requiredWager: new Decimal(requiredWager),
        isActive: true,
        requiresDeposit: false,
        depositActivated: true,
        activationDepositAmount: new Decimal(depositAmount),
        maxCashout: maxCashout ? new Decimal(maxCashout) : null,
        wagerMultiplier: tier.wagerMultiplier,
        expiresAt,
        isFreeBet: false,
        freeBetStake: null,
      },
    });

    await prisma.bonusHistory.create({
      data: {
        userId,
        promoId: null,
        promoCode: `RELOAD_${depositOrdinal}`,
        promoType: 'DEPOSIT_BONUS' as any,
        promoValue: { depositOrdinal, tier } as any,
        status: 'PENDING' as any,
        totalBonusReceived: new Decimal(bonusAmount),
        totalWagered: new Decimal(0),
        requiredWager: new Decimal(requiredWager),
        totalTokens: 0,
        remainingTokens: 0,
        tokensPerBet: 1,
        isTokenBased: false,
        currencyCode,
        expiredAt: expiresAt,
        notes: `reload bonus deposit #${depositOrdinal}`,
      },
    });

    await prisma.operation.create({
      data: {
        userId,
        source: OperationSource.PROMO,
        status: OperationStatus.SUCCESS,
        type: OperationType.INCOME,
        amount: new Decimal(bonusAmount),
        currencyCode,
        meta: {
          type: 'RELOAD_BONUS',
          depositOrdinal,
          target: 'BonusBalance',
        },
      },
    });

    return { applied: true, bonusAmount, requiredWager, depositOrdinal };
  }

  /**
   * Welcome-бонус при регистрации: виден, но заблокирован до депозита.
   */
  async grantWelcomeOffer(userId: number, currencyCode: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { registrationIp: true, registrationDeviceId: true },
    });

    const abuseCheck = await this.assertWelcomeBonusAllowed(
      userId,
      user?.registrationIp,
      user?.registrationDeviceId,
    );
    if (abuseCheck.ok === false) {
      return { ok: false, reason: abuseCheck.reason };
    }

    const config = getWelcomeBonusConfig(currencyCode);
    const existing = await this.prismaService.bonusBalance.findUnique({
      where: { userId_currencyCode: { userId, currencyCode } },
    });
    if (existing) {
      return { ok: false, reason: 'already_exists' };
    }

    const expiresAt = buildBonusExpiresAt(config.expiryHours);

    await this.prismaService.bonusBalance.create({
      data: {
        userId,
        currencyCode,
        amount: new Decimal(config.maxBonus),
        totalBonusReceived: new Decimal(0),
        totalWagered: new Decimal(0),
        requiredWager: new Decimal(0),
        minOdds: new Decimal(BONUS_WAGERING_RULES.minOdds),
        consecutiveWins: 0,
        requiredConsecutiveWins: 0,
        currentBetAmount: new Decimal(0),
        isActive: false,
        requiresDeposit: true,
        depositActivated: false,
        activationDepositAmount: new Decimal(0),
        maxCashout: null,
        wagerMultiplier: config.wagerMultiplier,
        expiresAt,
        totalTokens: 0,
        remainingTokens: 0,
        tokensPerBet: 1,
        isTokenBased: false,
        isFreeBet: false,
      },
    });

    await this.recordWelcomeClaim(
      userId,
      user?.registrationIp,
      user?.registrationDeviceId,
    );

    void this.notifyWelcomeLocked(userId, currencyCode, config).catch(() => undefined);

    return {
      ok: true,
      minDeposit: config.minDeposit,
      maxBonus: config.maxBonus,
      currencyCode,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Активирует welcome / locked-бонус после успешного депозита.
   */
  async handleApprovedDeposit(
    userId: number,
    currencyCode: string,
    depositAmount: number,
    tx?: any,
    paymentFingerprint?: string | null,
  ) {
    const prisma = tx ?? this.prismaService;
    const depositNum = Number(depositAmount);
    if (!Number.isFinite(depositNum) || depositNum <= 0) {
      return { activated: false };
    }

    const bonusBalance = await prisma.bonusBalance.findUnique({
      where: { userId_currencyCode: { userId, currencyCode } },
    });
    if (
      !bonusBalance
      || bonusBalance.depositActivated
      || !bonusBalance.requiresDeposit
    ) {
      return { activated: false };
    }

    const config = getWelcomeBonusConfig(currencyCode);
    if (depositNum < config.minDeposit) {
      return { activated: false, reason: 'min_deposit_not_met' };
    }

    if (isBonusExpired(bonusBalance.expiresAt)) {
      await this.expireBonusIfNeeded(userId, currencyCode, prisma);
      return { activated: false, reason: 'bonus_expired' };
    }

    if (paymentFingerprint) {
      const paymentUsed = await prisma.welcomeBonusClaim.findFirst({
        where: { paymentFingerprint, userId: { not: userId } },
      });
      if (paymentUsed) {
        return { activated: false, reason: 'payment_already_used' };
      }
    }

    const policy: PromoBonusPolicy = {
      wagerMultiplier: bonusBalance.wagerMultiplier || config.wagerMultiplier,
      wagerOnDepositPlusBonus: true,
      minDeposit: config.minDeposit,
      maxBonusAmount: config.maxBonus,
      maxCashoutMultiplier: config.maxCashoutMultiplier,
      requiresDeposit: true,
      bonusPercentage: config.bonusPercentage,
      fixedAmount: 0,
    };

    const bonusAmount = calcDepositBonusAmount(depositNum, policy);
    const requiredWager = calcRequiredWager(depositNum, bonusAmount, policy);
    const maxCashout = calcMaxCashout(depositNum, policy);
    const wageringExpiresAt = buildBonusExpiresAt(config.expiryHours);

    await prisma.bonusBalance.update({
      where: { userId_currencyCode: { userId, currencyCode } },
      data: {
        amount: new Decimal(bonusAmount),
        totalBonusReceived: new Decimal(bonusAmount),
        totalWagered: new Decimal(0),
        requiredWager: new Decimal(requiredWager),
        isActive: true,
        depositActivated: true,
        activationDepositAmount: new Decimal(depositNum),
        maxCashout: maxCashout ? new Decimal(maxCashout) : null,
        wagerMultiplier: policy.wagerMultiplier,
        expiresAt: wageringExpiresAt,
      },
    });

    await prisma.bonusHistory.create({
      data: {
        userId,
        promoId: bonusBalance.promoId ?? null,
        promoCode: 'WELCOME',
        promoType: 'DIRECT_BONUS' as any,
        promoValue: { source: 'welcome-offer' } as any,
        status: 'PENDING' as any,
        totalBonusReceived: new Decimal(bonusAmount),
        totalWagered: new Decimal(0),
        requiredWager: new Decimal(requiredWager),
        totalTokens: 0,
        remainingTokens: 0,
        tokensPerBet: 1,
        isTokenBased: false,
        currencyCode,
        expiredAt: wageringExpiresAt,
        notes: 'welcome activated on deposit',
      },
    });

    if (bonusAmount > 0) {
      await prisma.operation.create({
        data: {
          userId,
          source: OperationSource.PROMO,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          amount: new Decimal(bonusAmount),
          currencyCode,
          meta: {
            type: 'WELCOME_BONUS',
            target: 'BonusBalance',
            depositAmount: depositNum,
            grant: 'deposit-activation',
          },
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { registrationIp: true, registrationDeviceId: true },
    });
    await this.recordWelcomeClaim(
      userId,
      user?.registrationIp,
      user?.registrationDeviceId,
      paymentFingerprint ?? null,
      prisma,
    );

    void this.notifyWelcomeActivated(
      userId,
      currencyCode,
      bonusAmount,
      requiredWager,
      config.expiryHours,
    ).catch(() => undefined);

    return {
      activated: true,
      bonusAmount,
      requiredWager,
      maxCashout,
    };
  }

  async assertWithdrawalAllowed(userId: number, currencyCode: string) {
    await this.expireBonusIfNeeded(userId, currencyCode);

    const activeBonus = await this.prismaService.bonusBalance.findFirst({
      where: {
        userId,
        currencyCode,
        isActive: true,
        isTokenBased: false,
      },
    });

    if (
      activeBonus
      && activeBonus.requiredWager.greaterThan(0)
      && activeBonus.totalWagered.lessThan(activeBonus.requiredWager)
    ) {
      if (isBonusExpired(activeBonus.expiresAt)) {
        throw new BadRequestException('Срок отыгрыша бонуса истёк');
      }
      const remaining = activeBonus.requiredWager.minus(activeBonus.totalWagered);
      throw new BadRequestException({
        statusCode: 400,
        code: 'BONUS_WAGER_REQUIRED',
        message: `Сначала отыграйте бонус: осталось ${remaining} ${currencyCode}`,
        remaining: Number(remaining),
        currencyCode,
      });
    }

    const lockedWelcome = await this.prismaService.bonusBalance.findFirst({
      where: {
        userId,
        currencyCode,
        requiresDeposit: true,
        depositActivated: false,
        isActive: false,
      },
    });
    if (lockedWelcome && !isBonusExpired(lockedWelcome.expiresAt)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'BONUS_LOCK_REQUIRED',
        message: 'Активируйте welcome-бонус пополнением или откажитесь от бонуса',
        currencyCode,
      });
    }
  }

  /**
   * Пользователь отказывается от активного / заблокированного бонуса,
   * чтобы снять блок на вывод. Бонусный баланс сгорает, основной не трогаем.
   */
  async forfeitBonus(userId: number, currencyCode: string) {
    await this.expireBonusIfNeeded(userId, currencyCode);

    const bonus = await this.prismaService.bonusBalance.findUnique({
      where: { userId_currencyCode: { userId, currencyCode } },
    });

    if (!bonus) {
      throw new NotFoundException('Бонус не найден');
    }

    const hasActiveWager =
      bonus.isActive
      && !bonus.isTokenBased
      && bonus.requiredWager.greaterThan(0)
      && bonus.totalWagered.lessThan(bonus.requiredWager);

    const hasLockedWelcome =
      bonus.requiresDeposit
      && !bonus.depositActivated
      && !isBonusExpired(bonus.expiresAt);

    const hasActiveTokens = bonus.isActive && bonus.isTokenBased && bonus.remainingTokens > 0;

    if (!hasActiveWager && !hasLockedWelcome && !hasActiveTokens && !bonus.isActive) {
      throw new BadRequestException('Нет активного бонуса для отказа');
    }

    const forfeitedAmount = Number(bonus.amount) || 0;

    await this.prismaService.$transaction(async (tx) => {
      await tx.bonusBalance.update({
        where: { userId_currencyCode: { userId, currencyCode } },
        data: {
          isActive: false,
          amount: 0,
          remainingTokens: 0,
          requiredWager: 0,
          totalWagered: 0,
          requiresDeposit: false,
          depositActivated: false,
          isFreeBet: false,
          freeBetStake: null,
          maxCashout: null,
          expiresAt: null,
        },
      });

      await tx.bonusHistory.updateMany({
        where: {
          userId,
          currencyCode,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          notes: 'Отказ от бонуса пользователем (вывод)',
        },
      });

      if (forfeitedAmount > 0) {
        await tx.operation.create({
          data: {
            userId,
            source: OperationSource.PROMO,
            status: OperationStatus.SUCCESS,
            type: OperationType.OUTCOME,
            amount: new Decimal(forfeitedAmount),
            currencyCode,
            meta: {
              type: 'BONUS_FORFEIT',
              target: 'BonusBalance',
              note: 'Отказ от бонуса — списание с бонусного счёта',
            },
          },
        });
      }
    });

    return {
      ok: true,
      forfeitedAmount,
      currencyCode,
      message: 'Бонус отменён. Можно выводить средства с основного счёта.',
    };
  }

  private async applyFreeBetPromo(
    userId: number,
    promo: { id: number; code: string; currencyCode: string | null; value: unknown },
    value: Record<string, unknown>,
    policy: PromoBonusPolicy,
    minOdds: number,
  ) {
    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const alreadyUsed = await this.prismaService.promoOnUsers.findUnique({
      where: { promoId_userId: { promoId: promo.id, userId } },
    });
    if (alreadyUsed) {
      throw new BadRequestException('Промокод уже использован');
    }

    const freeBetStake = Number(value?.amount ?? 0);
    if (freeBetStake <= 0) {
      throw new BadRequestException('Фрибет не содержит суммы');
    }

    const bonusCurrency = promo.currencyCode || user.defaultCurrencyCode || 'KZT';
    const welcomeConfig = getWelcomeBonusConfig(bonusCurrency);
    const expiresAt = buildBonusExpiresAt(welcomeConfig.expiryHours);
    const requiredWager = calcRequiredWager(0, freeBetStake, policy);

    return this.prismaService.$transaction(async (tx) => {
      await tx.promoOnUsers.create({
        data: { promoId: promo.id, userId, status: 'APPLIED' as any },
      });

      await tx.bonusBalance.upsert({
        where: { userId_currencyCode: { userId, currencyCode: bonusCurrency } },
        create: {
          userId,
          currencyCode: bonusCurrency,
          amount: new Decimal(freeBetStake),
          freeBetStake: new Decimal(freeBetStake),
          totalBonusReceived: new Decimal(freeBetStake),
          totalWagered: new Decimal(0),
          requiredWager: new Decimal(requiredWager),
          minOdds: new Decimal(minOdds),
          consecutiveWins: 0,
          requiredConsecutiveWins: 0,
          currentBetAmount: new Decimal(0),
          isActive: true,
          isFreeBet: true,
          requiresDeposit: false,
          depositActivated: true,
          promoId: promo.id,
          wagerMultiplier: policy.wagerMultiplier,
          expiresAt,
          totalTokens: 0,
          remainingTokens: 0,
          tokensPerBet: 1,
          isTokenBased: false,
        },
        update: {
          amount: new Decimal(freeBetStake),
          freeBetStake: new Decimal(freeBetStake),
          totalBonusReceived: new Decimal(freeBetStake),
          totalWagered: new Decimal(0),
          requiredWager: new Decimal(requiredWager),
          minOdds: new Decimal(minOdds),
          isActive: true,
          isFreeBet: true,
          requiresDeposit: false,
          depositActivated: true,
          promoId: promo.id,
          wagerMultiplier: policy.wagerMultiplier,
          expiresAt,
        },
      });

      await tx.bonusHistory.create({
        data: {
          userId,
          promoId: promo.id,
          promoCode: promo.code,
          promoType: 'FREE_BET' as any,
          promoValue: promo.value as any,
          status: 'PENDING' as any,
          totalBonusReceived: new Decimal(freeBetStake),
          totalWagered: new Decimal(0),
          requiredWager: new Decimal(requiredWager),
          totalTokens: 0,
          remainingTokens: 0,
          tokensPerBet: 1,
          isTokenBased: false,
          currencyCode: bonusCurrency,
          expiredAt: expiresAt,
          notes: 'free bet promo',
        },
      });

      return {
        ok: true,
        locked: false,
        bonusAmount: freeBetStake,
        bonusCurrency,
        isFreeBet: true,
        message: `Фрибет ${freeBetStake} ${bonusCurrency} — сделайте одну ставку с бонусного счёта`,
        expiresAt: expiresAt.toISOString(),
      };
    });
  }

  /**
   * Активация промокода / ваучера пользователем (без депозита).
   */
  async applyPromoCode(userId: number, code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new BadRequestException('Введите код промо');
    }

    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const promo = await this.prismaService.promo.findFirst({
      where: { code: { equals: trimmed, mode: 'insensitive' } as any },
      include: { _count: { select: { promoOnUsers: true } } } as any,
    } as any);
    if (!promo) {
      throw new BadRequestException('Промокод не найден');
    }

    await this.partnersService.assertPartnerPromoRedeemable(promo);

    if (promo.type === 'DEPOSIT_BONUS') {
      throw new BadRequestException('Этот промокод активируется при пополнении счёта');
    }

    const value: any = promo.value as any;
    const policy = parsePromoBonusPolicy(value, promo.type);
    const totalTokens = Number(value?.totalTokens ?? 0);
    const tokensPerBetVal = Number(value?.tokensPerBet ?? 1);
    const tokenMinOddsVal = Number(value?.tokenMinOdds ?? value?.minOdds ?? 1.8);

    if (promo.type === 'FREE_BET') {
      return this.applyFreeBetPromo(userId, promo, value, policy, tokenMinOddsVal);
    }

    const alreadyUsed = await this.prismaService.promoOnUsers.findUnique({
      where: { promoId_userId: { promoId: promo.id, userId } },
    });
    if (alreadyUsed) {
      throw new BadRequestException('Промокод уже использован');
    }

    const usedCount = (promo as any)._count?.promoOnUsers || 0;
    const remaining = (promo.available || 0) - Number(usedCount);
    if (promo.available > 0 && remaining <= 0) {
      throw new BadRequestException('Промокод больше недоступен');
    }

    let bonusAmount = 0;
    if (promo.type === 'DIRECT_BONUS' || promo.type === 'VOUCHER') {
      bonusAmount = Number(value?.amount || 0);
    }

    const bonusCurrency = promo.currencyCode || user.defaultCurrencyCode || 'KZT';
    if (bonusAmount <= 0 && totalTokens <= 0) {
      throw new BadRequestException('Промокод не содержит бонуса');
    }

    const requiresDeposit = policy.requiresDeposit || policy.minDeposit > 0;

    return this.prismaService.$transaction(async (tx) => {
      if (!requiresDeposit) {
        await tx.promoOnUsers.create({
          data: { promoId: promo.id, userId, status: 'APPLIED' as any },
        });
      }

      const requiredWagerAmount = !requiresDeposit && bonusAmount > 0
        ? new Decimal(calcRequiredWager(0, bonusAmount, policy))
        : new Decimal(0);

      const existingBB = await tx.bonusBalance.findUnique({
        where: { userId_currencyCode: { userId, currencyCode: bonusCurrency } },
      });

      const lockedDisplayAmount = requiresDeposit
        ? getWelcomeBonusDisplayAmount(policy, value) || bonusAmount
        : bonusAmount;

      const welcomeConfig = getWelcomeBonusConfig(bonusCurrency);
      const expiresAt = buildBonusExpiresAt(welcomeConfig.expiryHours);

      const commonData = {
        minOdds: new Decimal(tokenMinOddsVal),
        isTokenBased: totalTokens > 0,
        promoId: promo.id,
        requiresDeposit,
        depositActivated: !requiresDeposit,
        wagerMultiplier: policy.wagerMultiplier,
        activationDepositAmount: new Decimal(0),
        maxCashout: null as Decimal | null,
        expiresAt,
      };

      if (existingBB) {
        await tx.bonusBalance.update({
          where: { userId_currencyCode: { userId, currencyCode: bonusCurrency } },
          data: {
            amount: requiresDeposit
              ? new Decimal(lockedDisplayAmount)
              : { increment: new Decimal(bonusAmount) },
            totalBonusReceived: requiresDeposit
              ? existingBB.totalBonusReceived
              : { increment: new Decimal(bonusAmount) },
            requiredWager: requiresDeposit
              ? new Decimal(0)
              : { increment: requiredWagerAmount },
            totalTokens: totalTokens > 0 ? { increment: totalTokens } : existingBB.totalTokens,
            remainingTokens: totalTokens > 0 ? { increment: totalTokens } : existingBB.remainingTokens,
            tokensPerBet: totalTokens > 0 ? tokensPerBetVal : existingBB.tokensPerBet,
            isActive: !requiresDeposit,
            ...commonData,
          } as any,
        });
      } else {
        await tx.bonusBalance.create({
          data: {
            userId,
            currencyCode: bonusCurrency,
            amount: new Decimal(requiresDeposit ? lockedDisplayAmount : bonusAmount),
            totalBonusReceived: new Decimal(requiresDeposit ? 0 : bonusAmount),
            totalWagered: new Decimal(0),
            requiredWager: requiredWagerAmount,
            consecutiveWins: 0,
            requiredConsecutiveWins: 0,
            currentBetAmount: new Decimal(0),
            isActive: !requiresDeposit,
            totalTokens,
            remainingTokens: totalTokens,
            tokensPerBet: tokensPerBetVal,
            ...commonData,
          },
        });
      }

      if (!requiresDeposit && bonusAmount > 0) {
        await tx.operation.create({
          data: {
            userId,
            source: OperationSource.PROMO,
            status: OperationStatus.SUCCESS,
            type: OperationType.INCOME,
            amount: new Decimal(bonusAmount),
            currencyCode: bonusCurrency,
            meta: {
              promoId: promo.id,
              promoCode: promo.code,
              type: promo.type,
              target: 'BonusBalance',
              grant: 'self-service',
            },
          },
        });
      }

      if (!requiresDeposit) {
        await tx.bonusHistory.create({
          data: {
            userId,
            promoId: promo.id,
            promoCode: promo.code,
            promoType: promo.type as any,
            promoValue: promo.value as any,
            status: 'PENDING' as any,
            totalBonusReceived: new Decimal(bonusAmount),
            totalWagered: new Decimal(0),
            requiredWager: requiredWagerAmount,
            totalTokens,
            remainingTokens: totalTokens,
            tokensPerBet: tokensPerBetVal,
            isTokenBased: totalTokens > 0,
            currencyCode: bonusCurrency,
            expiredAt: expiresAt,
            notes: 'self-service apply',
          },
        });
      }

      const result = {
        ok: true,
        locked: requiresDeposit,
        bonusAmount: requiresDeposit ? lockedDisplayAmount : bonusAmount,
        bonusCurrency,
        totalTokens,
        minDeposit: policy.minDeposit,
        message: requiresDeposit
          ? `Бонус до ${lockedDisplayAmount} ${bonusCurrency} ждёт — пополните от ${policy.minDeposit} ${bonusCurrency} в течение 24 ч`
          : totalTokens > 0
            ? `Начислено ${totalTokens} жетон(ов) на бонусный счёт`
            : `Начислено ${bonusAmount} ${bonusCurrency} на бонусный счёт`,
        expiresAt: expiresAt.toISOString(),
      };

      if (!requiresDeposit) {
        await this.partnersService.handlePromoRedemption(
          userId,
          {
            id: promo.id,
            code: promo.code,
            partnerId: promo.partnerId,
            value: promo.value,
          },
          bonusAmount,
          bonusCurrency,
        );
      }

      return result;
    });
  }

  private async notifyWelcomeLocked(
    userId: number,
    currencyCode: string,
    config: ReturnType<typeof getWelcomeBonusConfig>,
  ): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { telegramUserId: true },
    });
    if (!user?.telegramUserId || !this.telegramUserNotify) return;

    const siteUrl = getPublicSiteBaseUrl();
    await this.telegramUserNotify.notifyBonusExpiry({
      userId,
      telegramUserId: user.telegramUserId,
      type: 'welcome_locked',
      message: [
        '🎁 Welcome-бонус Imba.bet активирован!',
        `Пополни от ${config.minDeposit} ${currencyCode} в течение 24 ч — получи до ${config.maxBonus} ${currencyCode} бонусом (40%).`,
        `Вейджер ×${config.wagerMultiplier}, мин. кэф ${BONUS_WAGERING_RULES.minOdds}.`,
        `\n${siteUrl}/profile`,
      ].join('\n'),
    });
  }

  private async notifyWelcomeActivated(
    userId: number,
    currencyCode: string,
    bonusAmount: number,
    requiredWager: number,
    expiryHours: number,
  ): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { telegramUserId: true },
    });
    if (!user?.telegramUserId || !this.telegramUserNotify) return;

    const siteUrl = getPublicSiteBaseUrl();
    await this.telegramUserNotify.notifyBonusExpiry({
      userId,
      telegramUserId: user.telegramUserId,
      type: 'welcome_activated',
      message: [
        '✅ Welcome-бонус начислен!',
        `Бонус: ${bonusAmount} ${currencyCode}`,
        `Отыграй ${requiredWager} ${currencyCode} оборота за ${expiryHours} ч.`,
        'Ставки: исход или тотал, live и линия, ординар.',
        `\n${siteUrl}/profile`,
      ].join('\n'),
    });
  }
}
