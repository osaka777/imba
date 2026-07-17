import { Injectable, Logger } from '@nestjs/common';
import {
  OperationSource,
  OperationStatus,
  OperationType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import { PrismaService } from '~/prisma/prisma.service';

import {
  KICK_CONNECT_BONUS_TYPE,
  KICK_CONNECT_BONUS_USD,
  KICK_PARTNER_CURRENCY,
} from './kick-affiliate.constants';
import { getAffiliateMinWithdraw } from '~/main/partners/affiliate.constants';

@Injectable()
export class KickConnectBonusService {
  private readonly logger = new Logger(KickConnectBonusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
  ) {}

  private async sumConnectBonus(partnerUserId: number): Promise<number> {
    const ops = await this.prisma.operation.findMany({
      where: {
        userId: partnerUserId,
        source: OperationSource.AFFILIATE,
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        currencyCode: KICK_PARTNER_CURRENCY,
      },
      select: { amount: true, meta: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });

    let total = 0;
    for (const op of ops) {
      const meta = (op.meta ?? {}) as Record<string, unknown>;
      if (meta.bonusType === KICK_CONNECT_BONUS_TYPE) {
        total += op.amount.toNumber();
      }
    }
    return Math.round(total * 100) / 100;
  }

  async hasConnectBonus(partnerUserId: number): Promise<boolean> {
    return (await this.sumConnectBonus(partnerUserId)) > 0;
  }

  async getConnectBonusTotal(partnerUserId: number): Promise<number> {
    return this.sumConnectBonus(partnerUserId);
  }

  /** $10 при первом успешном OAuth-подключении Kick (один раз на партнёра). */
  async grantOnFirstConnect(partnerUserId: number): Promise<boolean> {
    if (await this.hasConnectBonus(partnerUserId)) {
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.operationService.create(tx, partnerUserId, {
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
        source: OperationSource.AFFILIATE,
        amount: new Decimal(KICK_CONNECT_BONUS_USD),
        currencyCode: KICK_PARTNER_CURRENCY,
        meta: {
          bonusType: KICK_CONNECT_BONUS_TYPE,
          reason: 'kick_channel_connected',
          withdrawLockedUntilReferral: true,
        },
      });
    });

    this.logger.log(
      `Kick connect bonus $${KICK_CONNECT_BONUS_USD} → partner ${partnerUserId}`,
    );
    return true;
  }

  async countPartnerReferrals(partnerUserId: number): Promise<number> {
    return this.prisma.user.count({
      where: { affiliatedById: partnerUserId },
    });
  }

  /** Сумма welcome-бонуса, недоступная к выводу пока нет ни одной регистрации. */
  async getLockedConnectBonusAmount(
    partnerUserId: number,
    currencyCode: string,
  ): Promise<number> {
    if (currencyCode.toUpperCase() !== KICK_PARTNER_CURRENCY) return 0;

    const referrals = await this.countPartnerReferrals(partnerUserId);
    if (referrals > 0) return 0;

    return this.sumConnectBonus(partnerUserId);
  }

  /** Снимок баланса для прогресс-бара welcome / вывода. */
  async getWelcomeBalanceSnapshot(partnerUserId: number): Promise<{
    availableUsd: number;
    lockedUsd: number;
    minWithdrawUsd: number;
  }> {
    const minWithdrawUsd = getAffiliateMinWithdraw(KICK_PARTNER_CURRENCY);
    const balance = await this.prisma.balance.findFirst({
      where: {
        userId: partnerUserId,
        currencyCode: KICK_PARTNER_CURRENCY,
      },
    });
    const total = balance?.amount.toNumber() ?? 0;
    const lockedUsd = await this.getLockedConnectBonusAmount(
      partnerUserId,
      KICK_PARTNER_CURRENCY,
    );
    const availableUsd = Math.max(0, Math.round((total - lockedUsd) * 100) / 100);

    return { availableUsd, lockedUsd, minWithdrawUsd };
  }

  async buildWelcomeProgress(
    partnerUserId: number,
    connected: boolean,
    connectBonusGranted: boolean,
    referralsCount: number,
  ) {
    const { availableUsd, lockedUsd, minWithdrawUsd } =
      await this.getWelcomeBalanceSnapshot(partnerUserId);

    const stepConnect = connected;
    const stepBonus = connectBonusGranted;
    const stepReferral = referralsCount > 0;
    const stepWithdraw = stepReferral && availableUsd >= minWithdrawUsd;
    const progressToWithdrawPct = stepWithdraw
      ? 100
      : Math.min(100, Math.floor((availableUsd / minWithdrawUsd) * 100));

    return {
      stepConnect,
      stepBonus,
      stepReferral,
      stepWithdraw,
      availableUsd,
      lockedUsd,
      minWithdrawUsd,
      progressToWithdrawPct,
    };
  }
}
