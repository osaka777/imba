import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { PrismaService } from '~/prisma/prisma.service';

import { BonusBalanceService } from '../bonus-balance/bonus-balance.service';
import {
  loadPromoModalSettings,
  PromoModalSettingsFile,
  savePromoModalSettings,
  toPublicPromoModalSettings,
} from './promo-modal.store';

@Injectable()
export class PromoModalService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bonusBalanceService: BonusBalanceService,
  ) {}

  async onModuleInit() {
    const settings = loadPromoModalSettings();
    if (!settings.autoSyncPromo || !settings.promoCode.trim()) return;
    const existing = await this.findConfiguredPromo(settings);
    if (!existing) {
      await this.syncPromoRecord(settings);
    }
  }

  getPublicSettings() {
    const settings = loadPromoModalSettings();
    return toPublicPromoModalSettings(settings);
  }

  getAdminSettings() {
    return loadPromoModalSettings();
  }

  async updateSettings(patch: Partial<PromoModalSettingsFile>) {
    const current = loadPromoModalSettings();
    const next: PromoModalSettingsFile = {
      ...current,
      ...patch,
      presetAmounts: patch.presetAmounts?.length
        ? patch.presetAmounts.map(Number).filter((n) => n > 0)
        : current.presetAmounts,
    };
    savePromoModalSettings(next);
    if (next.autoSyncPromo && next.promoCode.trim()) {
      await this.syncPromoRecord(next);
    }
    return next;
  }

  async syncPromoRecord(settings: PromoModalSettingsFile) {
    const code = settings.promoCode.trim();
    const validUntil = new Date(Date.now() + settings.validUntilDays * 86400000);
    const value =
      settings.promoType === 'DEPOSIT_BONUS'
        ? {
            percentage: settings.bonusPercentage,
            minDeposit: settings.minDepositAmount,
            totalTokens: 0,
            tokensPerBet: 1,
            tokenMinOdds: 1.8,
          }
        : {
            amount: settings.bonusAmount,
            totalTokens: 0,
            tokensPerBet: 1,
            tokenMinOdds: 1.8,
          };

    const currencyCode =
      settings.promoType === 'DEPOSIT_BONUS'
        ? settings.minDepositCurrency
        : settings.bonusCurrency;

    const existing = await this.prisma.promo.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } as any },
    });

    if (existing) {
      await this.prisma.promo.update({
        where: { id: existing.id },
        data: {
          validUntil,
          available: settings.promoAvailable,
          type: settings.promoType as any,
          value: value as any,
          currencyCode,
        },
      });
      return existing.id;
    }

    const created = await this.prisma.promo.create({
      data: {
        code,
        validUntil,
        available: settings.promoAvailable,
        type: settings.promoType as any,
        value: value as any,
        currencyCode,
      },
    });
    return created.id;
  }

  private async findConfiguredPromo(settings: PromoModalSettingsFile) {
    const code = settings.promoCode.trim();
    if (!code) return null;
    return this.prisma.promo.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } as any },
      include: { _count: { select: { promoOnUsers: true } } } as any,
    });
  }

  async getUserStatus(userId: number) {
    const settings = loadPromoModalSettings();
    if (!settings.enabled) {
      return { enabled: false };
    }

    const promo = await this.findConfiguredPromo(settings);
    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currencyCode: {
          userId,
          currencyCode: settings.minDepositCurrency,
        },
      },
    });
    const balanceAmount = balance ? Number(balance.amount) : 0;

    let promoUsed = false;
    if (promo) {
      const usage = await this.prisma.promoOnUsers.findUnique({
        where: { promoId_userId: { promoId: promo.id, userId } },
      });
      promoUsed = Boolean(usage);
    }

    const pendingDeposits = await this.prisma.deposit.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'PROCESSING'] as any },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const promoCodeUpper = settings.promoCode.trim().toUpperCase();
    const pendingDeposit = pendingDeposits.find((row) => {
      const voucher = String((row.meta as any)?.voucher ?? '').trim().toUpperCase();
      return voucher && voucher === promoCodeUpper;
    });

    const approvedDeposits = await this.prisma.deposit.findMany({
      where: {
        userId,
        status: 'SUCCESS' as any,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const approvedWithPromo = approvedDeposits.find((row) => {
      const voucher = String((row.meta as any)?.voucher ?? '').trim().toUpperCase();
      return voucher && voucher === promoCodeUpper;
    });

    const minDepositMet =
      balanceAmount >= settings.minDepositAmount || Boolean(approvedWithPromo);

    const canClaimDirect =
      settings.promoType === 'DIRECT_BONUS' &&
      minDepositMet &&
      !promoUsed &&
      Boolean(promo);

    const bonusPending =
      Boolean(pendingDeposit) && !promoUsed;

    const bonusReceived = promoUsed;

    return {
      enabled: true,
      promoType: settings.promoType,
      minDepositMet,
      promoUsed,
      bonusReceived,
      bonusPending,
      canClaimDirect,
      pendingDeposit: pendingDeposit
        ? {
            id: pendingDeposit.id,
            amount: Number(pendingDeposit.amount),
            currency: pendingDeposit.currencyCode,
            status: pendingDeposit.status,
          }
        : null,
      balance: balanceAmount,
      currency: settings.minDepositCurrency,
      wcRedirectPath: settings.wcRedirectPath,
    };
  }

  async claimDirectBonus(userId: number) {
    const settings = loadPromoModalSettings();
    if (!settings.enabled) {
      throw new BadRequestException('Акция отключена');
    }
    if (settings.promoType !== 'DIRECT_BONUS') {
      throw new BadRequestException('Бонус начисляется автоматически после пополнения');
    }

    const status = await this.getUserStatus(userId);
    if ((status as any).canClaimDirect !== true) {
      throw new BadRequestException('Условия акции ещё не выполнены');
    }

    return this.bonusBalanceService.applyPromoCode(userId, settings.promoCode);
  }

  validateVoucherForModal(voucher: string, currency: string): void {
    const settings = loadPromoModalSettings();
    const normalized = voucher.trim();
    if (!normalized) return;
    if (normalized.toUpperCase() !== settings.promoCode.trim().toUpperCase()) {
      throw new BadRequestException('Неверный промокод акции');
    }
    if (
      settings.minDepositCurrency &&
      currency.toUpperCase() !== settings.minDepositCurrency.toUpperCase()
    ) {
      throw new BadRequestException(
        `Акция доступна для валюты ${settings.minDepositCurrency}`,
      );
    }
  }

  async assertPromoAvailable(userId: number, voucher: string) {
    const settings = loadPromoModalSettings();
    const promo = await this.prisma.promo.findFirst({
      where: { code: { equals: settings.promoCode.trim(), mode: 'insensitive' } as any },
      include: { _count: { select: { promoOnUsers: true } } } as any,
    });
    if (!promo) {
      throw new BadRequestException('Промокод акции не настроен');
    }
    if (voucher.toUpperCase() !== promo.code.toUpperCase()) {
      return;
    }
    const alreadyUsed = await this.prisma.promoOnUsers.findUnique({
      where: { promoId_userId: { promoId: promo.id, userId } },
    });
    if (alreadyUsed) {
      throw new BadRequestException('Вы уже использовали этот промокод');
    }
    const usedCount = (promo as any)._count?.promoOnUsers || 0;
    if (promo.available > 0 && usedCount >= promo.available) {
      throw new BadRequestException('Промокод больше недоступен');
    }
    if (promo.validUntil && new Date(promo.validUntil) < new Date()) {
      throw new BadRequestException('Срок действия промокода истёк');
    }
  }
}
