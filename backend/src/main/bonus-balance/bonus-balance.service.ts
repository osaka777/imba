import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { OperationSource, OperationStatus, OperationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

import { PartnersService } from '../partners/partners.service';

@Injectable()
export class BonusBalanceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly partnersService: PartnersService,
  ) {}

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

    if (bonusBalance.amount.lessThan(new Decimal(betAmount))) {
      throw new BadRequestException('Недостаточно средств на бонусном счете');
    }

    if (new Decimal(odds).lessThan(bonusBalance.minOdds)) {
      throw new BadRequestException(`Минимальный коэффициент для бонусных ставок: ${bonusBalance.minOdds}`);
    }

    // Списываем средства с бонусного счета
    await this.prismaService.bonusBalance.update({
      where: {
        userId_currencyCode: {
          userId,
          currencyCode
        }
      },
      data: {
        amount: { decrement: betAmount },
        totalWagered: { increment: betAmount }
      }
    });

    return { success: true, remainingAmount: bonusBalance.amount.minus(new Decimal(betAmount)) };
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
        // Отыгрыш завершен - переводим весь бонус на основной счет
        await prisma.balance.upsert({
          where: {
            userId_currencyCode: {
              userId,
              currencyCode
            }
          },
          update: {
            amount: { increment: bonusBalance.amount }
          },
          create: {
            userId,
            currencyCode,
            amount: bonusBalance.amount
          }
        });

        // Деактивируем бонусный счет
        await prisma.bonusBalance.update({
          where: {
            userId_currencyCode: {
              userId,
              currencyCode
            }
          },
          data: {
            totalWagered: newTotalWagered,
            isActive: false
          }
        });

        // Создаем запись об операции
        await prisma.operation.create({
          data: {
            userId,
            type: 'INCOME',
            status: 'SUCCESS',
            source: 'BONUS_COMPLETE',
            amount: bonusBalance.amount,
            currencyCode,
            meta: {
              source: 'bonus_complete',
              bonusBalanceId: bonusBalance.id,
              totalWagered: newTotalWagered.toString(),
              note: 'Бонус полностью отыгран - весь бонус переведен на основной счет'
            }
          }
        });

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
    return this.prismaService.bonusBalance.findMany({
      where: { userId, isActive: true },
      include: {
        currency: true,
        promo: true
      }
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

    const value: any = promo.value as any;
    const totalTokens = Number(value?.totalTokens ?? 0);
    const tokensPerBetVal = Number(value?.tokensPerBet ?? 1);
    const tokenMinOddsVal = Number(value?.tokenMinOdds ?? 1.8);

    let bonusAmount = 0;
    if (promo.type === 'DIRECT_BONUS' || promo.type === 'VOUCHER') {
      bonusAmount = Number(value?.amount || 0);
    }

    const bonusCurrency = promo.currencyCode || user.defaultCurrencyCode || 'KZT';
    if (bonusAmount <= 0 && totalTokens <= 0) {
      throw new BadRequestException('Промокод не содержит бонуса');
    }

    return this.prismaService.$transaction(async (tx) => {
      await tx.promoOnUsers.create({
        data: { promoId: promo.id, userId, status: 'APPLIED' as any },
      });

      const requiredWagerAmount = bonusAmount > 0
        ? new Decimal(bonusAmount).mul(3)
        : new Decimal(0);

      const existingBB = await tx.bonusBalance.findUnique({
        where: { userId_currencyCode: { userId, currencyCode: bonusCurrency } },
      });

      if (existingBB) {
        await tx.bonusBalance.update({
          where: { userId_currencyCode: { userId, currencyCode: bonusCurrency } },
          data: {
            amount: bonusAmount > 0 ? { increment: new Decimal(bonusAmount) } : existingBB.amount,
            totalBonusReceived: bonusAmount > 0
              ? { increment: new Decimal(bonusAmount) }
              : existingBB.totalBonusReceived,
            requiredWager: bonusAmount > 0
              ? { increment: requiredWagerAmount }
              : existingBB.requiredWager,
            totalTokens: totalTokens > 0 ? { increment: totalTokens } : existingBB.totalTokens,
            remainingTokens: totalTokens > 0 ? { increment: totalTokens } : existingBB.remainingTokens,
            tokensPerBet: totalTokens > 0 ? tokensPerBetVal : existingBB.tokensPerBet,
            minOdds: new Decimal(tokenMinOddsVal),
            isTokenBased: totalTokens > 0 || existingBB.isTokenBased,
            isActive: true,
            promoId: promo.id,
          } as any,
        });
      } else {
        await tx.bonusBalance.create({
          data: {
            userId,
            currencyCode: bonusCurrency,
            amount: new Decimal(bonusAmount),
            totalBonusReceived: new Decimal(bonusAmount),
            totalWagered: new Decimal(0),
            requiredWager: requiredWagerAmount,
            minOdds: new Decimal(tokenMinOddsVal),
            consecutiveWins: 0,
            requiredConsecutiveWins: 0,
            currentBetAmount: new Decimal(0),
            isActive: true,
            totalTokens,
            remainingTokens: totalTokens,
            tokensPerBet: tokensPerBetVal,
            isTokenBased: totalTokens > 0,
            promoId: promo.id,
          },
        });
      }

      if (bonusAmount > 0) {
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
          notes: 'self-service apply',
        },
      });

      const result = {
        ok: true,
        bonusAmount,
        bonusCurrency,
        totalTokens,
        message: totalTokens > 0
          ? `Начислено ${totalTokens} жетон(ов) на бонусный счёт`
          : `Начислено ${bonusAmount} ${bonusCurrency} на бонусный счёт`,
      };

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

      return result;
    });
  }
} 