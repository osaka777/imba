import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  Affilator,
  AffilatorStatus,
  AffilatorType,
  BetStatus,
  DepositStatus,
  OperationSource,
  OperationStatus,
  OperationType,
  User,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { hash } from 'bcrypt';

import { OperationService } from '~/main/operation/operation.service';
import {
  PrismaService,
  PrismaTransactionClient,
} from '~/prisma/prisma.service';

import {
  AFFILIATE_HOLD_DAYS,
  getAffiliateMinWithdraw,
  getDefaultCpaPayout,
  PARTNER_SELF_PROMO_MAX_ACTIVE,
  PARTNER_SELF_PROMO_MAX_USES,
  PARTNER_SELF_PROMO_VALID_DAYS,
} from './affiliate.constants';
import {
  AffiliateSubs,
  hasAffiliateSubs,
  parseAffiliateSubsJson,
} from './affiliate-subs.util';
import { AffiliatePostbackService } from './affiliate-postback.service';
import type { PostbackPayload } from './affiliate-postback.service';
import { KickLiveTrafficNotifyService } from '~/integrations/kick-dev/kick-live-traffic-notify.service';
import { KickConnectBonusService } from '~/integrations/kick-dev/kick-connect-bonus.service';
import { KickChallengeService } from '~/integrations/kick-dev/kick-challenge.service';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly operationService: OperationService,
    private readonly affiliatePostbackService: AffiliatePostbackService,
    private readonly kickLiveTrafficNotify: KickLiveTrafficNotifyService,
    private readonly kickConnectBonus: KickConnectBonusService,
    private readonly kickChallenge: KickChallengeService,
  ) { }

  private getBetMetaId(meta: unknown): number | null {
    if (meta == null || typeof meta !== 'object') return null;
    const record = meta as Record<string, unknown>;
    const wcBetId = record.wcBetId ?? record.betId;
    return typeof wcBetId === 'number' ? wcBetId : null;
  }

  private isReversedCommission(meta: unknown): boolean {
    if (meta == null || typeof meta !== 'object') return false;
    return (meta as Record<string, unknown>).reversed === true;
  }

  async findAffiliateCommissionForBet(
    prisma: PrismaTransactionClient,
    partnerUserId: number,
    betId: number,
  ) {
    const operations = await prisma.operation.findMany({
      where: {
        userId: partnerUserId,
        source: OperationSource.AFFILIATE,
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
      },
    });

    return operations.find((operation) => {
      if (this.isReversedCommission(operation.meta)) return false;
      return this.getBetMetaId(operation.meta) === betId;
    });
  }

  async reverseAffiliateBonusForWcBet(
    prisma: PrismaTransactionClient,
    wcBetId: number,
  ) {
    const bet = await prisma.wcOddsBet.findUnique({
      where: { id: wcBetId },
      include: { user: true },
    });

    if (!bet?.user?.affiliatedById) return;

    const existing = await this.findAffiliateCommissionForBet(
      prisma,
      bet.user.affiliatedById,
      wcBetId,
    );

    if (!existing) return;

    const meta = (existing.meta ?? {}) as Record<string, unknown>;

    await prisma.operation.update({
      where: { id: existing.id },
      data: {
        meta: {
          ...meta,
          reversed: true,
          reversedAt: new Date().toISOString(),
        },
      },
    });

    await this.operationService.create(prisma, bet.user.affiliatedById, {
      amount: existing.amount,
      currencyCode: existing.currencyCode,
      meta: {
        wcBetId,
        betId: wcBetId,
        reversalOf: existing.id,
        bonusType: 'affiliate_reversal',
        reason: 'bet_reopened',
      },
      source: OperationSource.AFFILIATE,
      status: OperationStatus.SUCCESS,
      type: OperationType.OUTCOME,
    });
  }

  async addBonusToPlayer(
    prisma: PrismaTransactionClient,
    user: User,
    betId: number,
    betCurrency: string,
    betAmount: Decimal,
    status: BetStatus,
  ) {
    if (user.affiliatedById == null) return;
    if (user.affiliatedById === user.id) return;
    // Начисляем бонусы только для проигрышных ставок (стандартная практика)
    if (status !== BetStatus.LOSE) return;

    const isUserAffilator = await prisma.affilator.findFirst({
      where: {
        userId: user.id,
      },
    });

    if (isUserAffilator) return;

    const affiliator = await prisma.affilator.findFirst({
      where: {
        userId: user.affiliatedById,
      },
    });
    if (!affiliator) return;

    // CPA-партнёры получают фикс за FTD, не RevShare со ставок
    if (affiliator.type === AffilatorType.CPA) return;

    const existing = await this.findAffiliateCommissionForBet(
      prisma,
      affiliator.userId,
      betId,
    );
    if (existing) return;

    // Используем процент партнера (по умолчанию 50%)
    const actualPercent = affiliator.percent;

    const bonusAmount = betAmount.times(actualPercent.dividedBy(100));

    // Проверяем, что у партнера есть баланс в нужной валюте
    const partnerBalance = await prisma.balance.findFirst({
      where: {
        userId: affiliator.userId,
        currencyCode: betCurrency,
      },
    });

    // Если у партнера нет баланса в этой валюте, создаем его с нулевым значением
    if (!partnerBalance) {
      await prisma.balance.create({
        data: {
          userId: affiliator.userId,
          currencyCode: betCurrency,
          amount: new Decimal(0),
        },
      });
    }

    // Начисляем бонус партнеру
    await this.operationService.create(prisma, affiliator.userId, {
      amount: bonusAmount,
      currencyCode: betCurrency,
      meta: {
        betId,
        wcBetId: betId,
        affiliatorId: affiliator.userId,
        bonusType: 'affiliate_bonus',
        originalUserId: user.id,
        originalBetAmount: betAmount.toString(),
        betStatus: status,
        commissionPercent: actualPercent.toString(),
      },
      source: OperationSource.AFFILIATE,
      status: OperationStatus.SUCCESS,
      type: OperationType.INCOME,
    });

  }

  // Переименовываем метод для большей ясности
  async processAffiliateBonus(
    prisma: PrismaTransactionClient,
    user: User,
    betId: number,
    betCurrency: string,
    betAmount: Decimal,
    status: BetStatus,
  ) {
    await this.addBonusToPlayer(
      prisma,
      user,
      betId,
      betCurrency,
      betAmount,
      status
    );
  }

  async connectAffiliator(
    user: User,
    tag: string | undefined,
    registrationIp?: string,
    subs?: AffiliateSubs,
  ) {
    if (tag == null) return;

    const affiliator = await this.prismaService.affilator.findFirst({
      where: { uid: tag },
      include: { user: true },
    });

    if (!affiliator || affiliator.userId === user.id) return;

    const partnerMeta = (affiliator.meta ?? {}) as Record<string, unknown>;
    const partnerIp =
      affiliator.user.registrationIp
      ?? (typeof partnerMeta.registrationIp === 'string' ? partnerMeta.registrationIp : undefined);

    if (registrationIp && partnerIp && registrationIp === partnerIp) {
      this.logger.warn(
        `Affiliate link blocked (same IP): player=${user.id} partner=${affiliator.userId}`,
      );
      return;
    }

    const partnerPhone = typeof partnerMeta.phone === 'string' ? partnerMeta.phone : undefined;
    if (user.phone && partnerPhone && user.phone === partnerPhone) {
      this.logger.warn(
        `Affiliate link blocked (same phone): player=${user.id} partner=${affiliator.userId}`,
      );
      return;
    }

    const linked = await this.prismaService.$transaction(async (prisma) => {
      const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { affiliatedById: true },
      });

      if (existing?.affiliatedById != null) return false;

      await prisma.user.update({
        data: {
          affiliatedById: affiliator.userId,
          ...(registrationIp ? { registrationIp } : {}),
          ...(subs && hasAffiliateSubs(subs) ? { affiliateSubs: subs as object } : {}),
        },
        where: { id: user.id },
      });

      return true;
    });

    if (linked) {
      const updatedPlayer = await this.prismaService.user.findUnique({
        where: { id: user.id },
      });
      await this.notifyRegistrationPostback(
        affiliator,
        updatedPlayer ?? user,
      );
    }
  }

  private getPlayerSubs(player: User): AffiliateSubs {
    return parseAffiliateSubsJson(player.affiliateSubs);
  }

  private withPlayerSubs(player: User, payload: Omit<PostbackPayload, 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'sub5'>): PostbackPayload {
    const subs = this.getPlayerSubs(player);
    return {
      ...payload,
      sub1: subs.sub1,
      sub2: subs.sub2,
      sub3: subs.sub3,
      sub4: subs.sub4,
      sub5: subs.sub5,
    };
  }

  private getPostbackUrl(affiliator: Affilator): string | undefined {
    const meta = (affiliator.meta ?? {}) as Record<string, unknown>;
    return typeof meta.postbackUrl === 'string' ? meta.postbackUrl : undefined;
  }

  getPartnerPostbackUrl(affiliator: Affilator): string | undefined {
    return this.getPostbackUrl(affiliator);
  }

  private async notifyRegistrationPostback(affiliator: Affilator, player: User) {
    await this.affiliatePostbackService.send(
      this.getPostbackUrl(affiliator),
      this.withPlayerSubs(player, {
        event: 'registration',
        partnerUid: affiliator.uid,
        partnerId: affiliator.userId,
        playerId: player.id,
        playerEmail: player.email,
      }),
    );
    void this.kickLiveTrafficNotify.notifyRegistration(player, affiliator);
    void this.kickLiveTrafficNotify.notifyFirstReferralUnlock(affiliator);
    void this.kickChallenge.maybeGrantWeeklyChallenge(affiliator.userId);
  }

  async notifyFirstDeposit(
    playerId: number,
    amount: Decimal,
    currencyCode: string,
  ) {
    const player = await this.prismaService.user.findUnique({
      where: { id: playerId },
    });

    if (!player?.affiliatedById) return;

    const previousDeposits = await this.prismaService.deposit.count({
      where: {
        userId: playerId,
        status: DepositStatus.SUCCESS,
      },
    });

    if (previousDeposits !== 1) return;

    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId: player.affiliatedById },
    });

    if (!affiliator) return;

    if (affiliator.type === AffilatorType.CPA) {
      await this.payCpaOnFirstDeposit(affiliator, player, amount, currencyCode);
    }

    await this.affiliatePostbackService.send(
      this.getPostbackUrl(affiliator),
      this.withPlayerSubs(player, {
        event: 'ftd',
        partnerUid: affiliator.uid,
        partnerId: affiliator.userId,
        playerId: player.id,
        playerEmail: player.email,
        amount: amount.toString(),
        currency: currencyCode,
      }),
    );

    void this.kickLiveTrafficNotify.notifyFirstDeposit(
      player,
      affiliator,
      amount.toString(),
      currencyCode,
    );
  }

  private async payCpaOnFirstDeposit(
    affiliator: Affilator,
    player: User,
    depositAmount: Decimal,
    depositCurrency: string,
  ): Promise<void> {
    const currencyCode =
      affiliator.cpaCurrencyCode?.toUpperCase()
      || depositCurrency.toUpperCase();

    const payoutAmount = affiliator.cpaPayoutAmount
      ? new Decimal(affiliator.cpaPayoutAmount)
      : new Decimal(getDefaultCpaPayout(currencyCode));

    if (payoutAmount.lte(0)) return;

    const existingOps = await this.prismaService.operation.findMany({
      where: {
        userId: affiliator.userId,
        source: OperationSource.AFFILIATE,
        type: OperationType.INCOME,
        status: OperationStatus.SUCCESS,
      },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });
    const alreadyPaid = existingOps.some((op) => {
      const meta = (op.meta ?? {}) as Record<string, unknown>;
      return meta.bonusType === 'cpa_ftd' && meta.playerId === player.id;
    });
    if (alreadyPaid) return;

    await this.prismaService.$transaction(async (prisma) => {
      await this.operationService.create(prisma, affiliator.userId, {
        amount: payoutAmount,
        currencyCode,
        meta: {
          bonusType: 'cpa_ftd',
          playerId: player.id,
          depositAmount: depositAmount.toString(),
          depositCurrency,
        },
        source: OperationSource.AFFILIATE,
        status: OperationStatus.SUCCESS,
        type: OperationType.INCOME,
      });
    });
  }

  async getPartnerWithdrawalSummary(partnerUserId: number) {
    const holdCutoff = new Date();
    holdCutoff.setDate(holdCutoff.getDate() - AFFILIATE_HOLD_DAYS);

    const balances = await this.prismaService.balance.findMany({
      where: { userId: partnerUserId },
    });

    const referralsCount =
      await this.kickConnectBonus.countPartnerReferrals(partnerUserId);

    const summaries = [];

    for (const balance of balances) {
      const operations = await this.prismaService.operation.findMany({
        where: {
          userId: partnerUserId,
          source: OperationSource.AFFILIATE,
          status: OperationStatus.SUCCESS,
          currencyCode: balance.currencyCode,
        },
        select: {
          amount: true,
          type: true,
          createdAt: true,
        },
      });

      let heldNet = 0;
      for (const operation of operations) {
        const signed =
          operation.type === OperationType.INCOME
            ? operation.amount.toNumber()
            : -operation.amount.toNumber();

        if (operation.createdAt > holdCutoff) {
          heldNet += signed;
        }
      }

      const total = balance.amount.toNumber();
      const lockedConnectBonus =
        await this.kickConnectBonus.getLockedConnectBonusAmount(
          partnerUserId,
          balance.currencyCode,
        );
      const available = Math.max(
        0,
        total - Math.max(0, heldNet) - lockedConnectBonus,
      );

      summaries.push({
        currencyCode: balance.currencyCode,
        total,
        available,
        held: Math.max(0, heldNet),
        lockedConnectBonus,
        referralsCount,
        minWithdraw: getAffiliateMinWithdraw(balance.currencyCode),
        holdDays: AFFILIATE_HOLD_DAYS,
      });
    }

    return summaries;
  }

  async validatePartnerWithdraw(
    partnerUserId: number,
    amount: number,
    currencyCode: string,
  ) {
    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { status: true },
    });

    if (!affiliator) {
      return 'Партнёрский аккаунт не найден';
    }

    if (affiliator.status === AffilatorStatus.BLOCKED) {
      return 'Аккаунт заблокирован. Обратитесь в поддержку.';
    }

    if (affiliator.status === AffilatorStatus.PENDING) {
      return 'Аккаунт на модерации. Вывод будет доступен после активации менеджером.';
    }

    const minWithdraw = getAffiliateMinWithdraw(currencyCode);
    const minLabel =
      currencyCode.toUpperCase() === 'USD'
        ? `$${minWithdraw}`
        : `${minWithdraw} ${currencyCode}`;
    if (amount < minWithdraw) {
      return `Минимальная сумма вывода: ${minLabel}`;
    }

    const summary = await this.getPartnerWithdrawalSummary(partnerUserId);
    const currencySummary = summary.find(
      (item) => item.currencyCode === currencyCode,
    );

    if (!currencySummary) {
      return `Нет баланса в валюте ${currencyCode}`;
    }

    if (amount > currencySummary.available) {
      const locked = currencySummary.lockedConnectBonus ?? 0;
      if (locked > 0 && (currencySummary.referralsCount ?? 0) === 0) {
        const availLabel =
          currencyCode.toUpperCase() === 'USD'
            ? `$${currencySummary.available.toFixed(2)}`
            : `${currencySummary.available.toFixed(2)} ${currencyCode}`;
        return `Доступно к выводу: ${availLabel}. Бонус $${locked.toFixed(0)} за подключение Kick разблокируется после первой приведённой регистрации. Минимальный вывод — $50.`;
      }

      const availLabel =
        currencyCode.toUpperCase() === 'USD'
          ? `$${currencySummary.available.toFixed(2)}`
          : `${currencySummary.available.toFixed(2)} ${currencyCode}`;
      return `Доступно к выводу: ${availLabel}. Остальное на hold ${AFFILIATE_HOLD_DAYS} дней после начисления.`;
    }

    return null;
  }

  async isFirstAffiliateWithdrawal(partnerUserId: number): Promise<boolean> {
    const prior = await this.prismaService.withdrawRequest.count({
      where: {
        userId: partnerUserId,
        type: 'affiliate',
        status: OperationStatus.SUCCESS,
      },
    });
    return prior === 0;
  }

  async notifyCommissionForBet(wcBetId: number): Promise<void> {
    const bet = await this.prismaService.wcOddsBet.findUnique({
      where: { id: wcBetId },
      include: { user: true },
    });

    if (!bet?.user?.affiliatedById) return;

    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId: bet.user.affiliatedById },
    });

    if (!affiliator) return;

    const commission = await this.findAffiliateCommissionForBet(
      this.prismaService,
      affiliator.userId,
      wcBetId,
    );

    if (!commission) return;

    await this.affiliatePostbackService.send(
      this.getPostbackUrl(affiliator),
      this.withPlayerSubs(bet.user, {
        event: 'commission',
        partnerUid: affiliator.uid,
        partnerId: affiliator.userId,
        playerId: bet.userId,
        playerEmail: bet.user.email,
        amount: commission.amount.toString(),
        currency: commission.currencyCode,
        betId: wcBetId,
      }),
    );
  }

  async getPartnerCommissions(partnerUserId: number, limit = 50) {
    const holdCutoff = new Date();
    holdCutoff.setDate(holdCutoff.getDate() - AFFILIATE_HOLD_DAYS);

    const operations = await this.prismaService.operation.findMany({
      where: {
        userId: partnerUserId,
        source: OperationSource.AFFILIATE,
        status: OperationStatus.SUCCESS,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return operations.map((operation) => {
      const meta = (operation.meta ?? {}) as Record<string, unknown>;
      const isReversal = meta.reversalOf != null || meta.reversed === true;
      const holdUntil = new Date(operation.createdAt);
      holdUntil.setDate(holdUntil.getDate() + AFFILIATE_HOLD_DAYS);
      const onHold =
        operation.type === OperationType.INCOME
        && !isReversal
        && operation.createdAt > holdCutoff;

      return {
        id: operation.id,
        type: operation.type,
        amount: operation.amount.toNumber(),
        currencyCode: operation.currencyCode,
        createdAt: operation.createdAt.toISOString(),
        onHold,
        holdUntil: onHold ? holdUntil.toISOString() : null,
        playerId:
          typeof meta.originalUserId === 'number' ? meta.originalUserId : null,
        betId:
          typeof meta.wcBetId === 'number'
            ? meta.wcBetId
            : typeof meta.betId === 'number'
              ? meta.betId
              : null,
        bonusType:
          typeof meta.bonusType === 'string' ? meta.bonusType : 'affiliate_bonus',
      };
    });
  }

  async getPostbackLogs(partnerUserId: number, limit = 20) {
    return this.prismaService.affiliatePostbackLog.findMany({
      where: { partnerUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        event: true,
        url: true,
        httpStatus: true,
        status: true,
        attempt: true,
        playerId: true,
        createdAt: true,
      },
    });
  }

  async getAffiliatePartnersOverview(limit = 200) {
    const partners = await this.prismaService.affilator.findMany({
      include: {
        user: { select: { id: true, email: true, createdAt: true } },
        _count: { select: { users: true } },
      },
      orderBy: { user: { createdAt: 'desc' } },
      take: limit,
    });

    return Promise.all(
      partners.map(async (partner) => {
        const earned = await this.prismaService.operation.aggregate({
          where: {
            userId: partner.userId,
            source: OperationSource.AFFILIATE,
            type: OperationType.INCOME,
            status: OperationStatus.SUCCESS,
          },
          _sum: { amount: true },
        });

        const meta = (partner.meta ?? {}) as Record<string, unknown>;

        return {
          userId: partner.userId,
          email: partner.user.email,
          uid: partner.uid,
          status: partner.status,
          type: partner.type,
          percent: partner.percent.toString(),
          referralsCount: partner._count.users,
          totalEarned: Number(earned._sum.amount ?? 0),
          registeredAt: partner.user.createdAt.toISOString(),
          wallet: typeof meta.wallet === 'string' ? meta.wallet : null,
          telegram: typeof meta.telegram === 'string' ? meta.telegram : null,
          cpaPayoutAmount: partner.cpaPayoutAmount
            ? Number(partner.cpaPayoutAmount)
            : null,
          cpaCurrencyCode: partner.cpaCurrencyCode ?? null,
        };
      }),
    );
  }

  async updatePartnerStatus(userId: number, status: AffilatorStatus) {
    return this.prismaService.affilator.update({
      where: { userId },
      data: { status },
    });
  }

  async getAffiliatorIdByTag(tag: string) {
    const affiliator = await this.prismaService.affilator.findFirst({
      where: {
        uid: tag,
      },
    });
    return affiliator ? affiliator.userId : undefined;
  }

  /** Партнёр по промокоду (Promo.partnerId = userId партнёра). */
  async resolvePartnerUserIdFromPromoCode(code: string): Promise<number | null> {
    const trimmed = code?.trim();
    if (!trimmed) return null;

    const promo = await this.prismaService.promo.findFirst({
      where: { code: { equals: trimmed, mode: 'insensitive' } as any },
      select: { partnerId: true },
    });
    if (!promo?.partnerId) return null;

    const partnerUserId = parseInt(promo.partnerId, 10);
    if (!Number.isFinite(partnerUserId)) return null;

    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId: partnerUserId },
    });
    if (!affiliator || affiliator.status === AffilatorStatus.BLOCKED) return null;

    return partnerUserId;
  }

  /**
   * Привязка игрока к партнёру по userId (аналог ?tag=, для промокодов).
   * First-click: не перезаписывает существующую привязку.
   */
  async connectAffiliatorByPartnerUserId(
    user: User,
    partnerUserId: number,
    registrationIp?: string,
    subs?: AffiliateSubs,
  ): Promise<boolean> {
    if (partnerUserId === user.id) return false;

    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId: partnerUserId },
      include: { user: true },
    });
    if (!affiliator || affiliator.status === AffilatorStatus.BLOCKED) return false;

    const partnerMeta = (affiliator.meta ?? {}) as Record<string, unknown>;
    const partnerIp =
      affiliator.user.registrationIp
      ?? (typeof partnerMeta.registrationIp === 'string' ? partnerMeta.registrationIp : undefined);

    if (registrationIp && partnerIp && registrationIp === partnerIp) {
      this.logger.warn(
        `Affiliate promo link blocked (same IP): player=${user.id} partner=${partnerUserId}`,
      );
      return false;
    }

    const partnerPhone = typeof partnerMeta.phone === 'string' ? partnerMeta.phone : undefined;
    if (user.phone && partnerPhone && user.phone === partnerPhone) {
      this.logger.warn(
        `Affiliate promo link blocked (same phone): player=${user.id} partner=${partnerUserId}`,
      );
      return false;
    }

    const linked = await this.prismaService.$transaction(async (prisma) => {
      const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { affiliatedById: true },
      });
      if (existing?.affiliatedById != null) return false;

      await prisma.user.update({
        data: {
          affiliatedById: partnerUserId,
          ...(registrationIp ? { registrationIp } : {}),
          ...(subs && hasAffiliateSubs(subs) ? { affiliateSubs: subs as object } : {}),
        },
        where: { id: user.id },
      });
      return true;
    });

    if (linked) {
      const updatedPlayer = await this.prismaService.user.findUnique({
        where: { id: user.id },
      });
      await this.notifyRegistrationPostback(
        affiliator,
        updatedPlayer ?? user,
      );
    }
    return linked;
  }

  /** Учёт стоимости промо на стороне партнёра + атрибуция при redemption. */
  async handlePromoRedemption(
    playerUserId: number,
    promo: { id: number; code: string; partnerId: string | null; value: unknown },
    bonusAmount: number,
    currencyCode: string,
  ): Promise<void> {
    if (!promo.partnerId) return;

    const player = await this.prismaService.user.findUnique({ where: { id: playerUserId } });
    if (!player) return;

    const partnerUserId = parseInt(promo.partnerId, 10);
    if (!Number.isFinite(partnerUserId)) return;

    await this.connectAffiliatorByPartnerUserId(player, partnerUserId);

    await this.recordPromoPartnerEconomics(
      promo.partnerId,
      currencyCode,
      bonusAmount,
      promo.value,
    );

    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId: partnerUserId },
    });
    if (affiliator) {
      const freshPlayer = await this.prismaService.user.findUnique({
        where: { id: playerUserId },
      });
      if (freshPlayer) {
        await this.affiliatePostbackService.send(
          this.getPostbackUrl(affiliator),
          this.withPlayerSubs(freshPlayer, {
            event: 'promo_redeemed',
            partnerUid: affiliator.uid,
            partnerId: affiliator.userId,
            playerId: freshPlayer.id,
            playerEmail: freshPlayer.email,
            amount: String(bonusAmount),
            currency: currencyCode,
            promoCode: promo.code,
          }),
        );
      }
    }
  }

  private async recordPromoPartnerEconomics(
    partnerId: string,
    currencyCode: string,
    bonusAmount: number,
    promoValue: unknown,
  ): Promise<void> {
    const value = (promoValue ?? {}) as Record<string, unknown>;
    const partnerPct = Number(value.partnerPercentage ?? 0);
    const commissionEarned =
      bonusAmount > 0 && partnerPct > 0 ? bonusAmount * (partnerPct / 100) : 0;

    await this.prismaService.partnerBonusAccount.upsert({
      where: {
        partnerId_currencyCode: { partnerId, currencyCode },
      },
      update: {
        totalBonusGiven: { increment: bonusAmount },
        commissionEarned: { increment: commissionEarned },
        updatedAt: new Date(),
      },
      create: {
        partnerId,
        currencyCode,
        totalBonusGiven: bonusAmount,
        commissionEarned,
      },
    });
  }

  async getPartnerPromoCodes(partnerUserId: number) {
    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { status: true },
    });
    const partnerActive = affiliator?.status === AffilatorStatus.ACTIVE;

    const promos = await this.prismaService.promo.findMany({
      where: { partnerId: String(partnerUserId) },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { promoOnUsers: true } } },
    });

    return promos.map((p) => {
      const used = p._count.promoOnUsers;
      const remaining = Math.max(0, (p.available || 0) - used);
      const value = (p.value ?? {}) as Record<string, unknown>;
      return {
        id: p.id,
        code: p.code,
        type: p.type,
        validUntil: p.validUntil.toISOString(),
        available: p.available,
        used,
        remaining,
        partnerPercentage: Number(value.partnerPercentage ?? 0),
        partnerCreated: value.partnerCreated === true,
        redeemable: partnerActive,
        currencyCode: p.currencyCode,
      };
    });
  }

  async updatePartnerPercent(userId: number, percent: number) {
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new Error('Percent must be between 0 and 100');
    }
    return this.prismaService.affilator.update({
      where: { userId },
      data: { percent: new Decimal(percent) },
    });
  }

  async updatePartnerCpa(
    userId: number,
    cpaPayoutAmount: number,
    cpaCurrencyCode: string,
  ) {
    if (!Number.isFinite(cpaPayoutAmount) || cpaPayoutAmount < 0) {
      throw new Error('Invalid CPA amount');
    }
    return this.prismaService.affilator.update({
      where: { userId },
      data: {
        cpaPayoutAmount: new Decimal(cpaPayoutAmount),
        cpaCurrencyCode: cpaCurrencyCode.toUpperCase(),
        type: AffilatorType.CPA,
      },
    });
  }

  async createPartnerSelfPromo(
    partnerUserId: number,
    input: {
      code: string;
      bonusType: 'DIRECT_BONUS' | 'DEPOSIT_BONUS';
      amount?: number;
      percentage?: number;
      minDeposit?: number;
      available?: number;
      currencyCode?: string;
    },
  ) {
    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId: partnerUserId },
    });
    if (!affiliator) {
      throw new BadRequestException('Партнёр не найден');
    }
    if (affiliator.status === AffilatorStatus.BLOCKED) {
      throw new BadRequestException('Аккаунт заблокирован');
    }

    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(code)) {
      throw new BadRequestException('Код: 4–20 символов, латиница и цифры');
    }

    const activeCount = await this.prismaService.promo.count({
      where: {
        partnerId: String(partnerUserId),
        validUntil: { gte: new Date() },
      },
    });
    if (activeCount >= PARTNER_SELF_PROMO_MAX_ACTIVE) {
      throw new BadRequestException(`Лимит активных промокодов: ${PARTNER_SELF_PROMO_MAX_ACTIVE}`);
    }

    const duplicate = await this.prismaService.promo.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } as any },
    });
    if (duplicate) {
      throw new BadRequestException('Промокод уже занят');
    }

    const available = Math.min(
      Math.max(1, input.available ?? 100),
      PARTNER_SELF_PROMO_MAX_USES,
    );
    const currencyCode = (input.currencyCode || 'KZT').toUpperCase();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + PARTNER_SELF_PROMO_VALID_DAYS);

    let value: Record<string, unknown> = { partnerCreated: true };
    if (input.bonusType === 'DEPOSIT_BONUS') {
      const pct = input.percentage ?? 50;
      const minDep = input.minDeposit ?? 1000;
      value = {
        ...value,
        percentage: pct,
        minDeposit: minDep,
        totalTokens: 0,
        tokensPerBet: 1,
        tokenMinOdds: 1.8,
        partnerPercentage: 0,
      };
    } else {
      const amount = input.amount ?? 500;
      value = {
        ...value,
        amount,
        totalTokens: 0,
        tokensPerBet: 1,
        tokenMinOdds: 1.8,
        partnerPercentage: 0,
      };
    }

    const promo = await this.prismaService.promo.create({
      data: {
        code,
        validUntil,
        available,
        type: input.bonusType,
        value: value as object,
        currencyCode,
        partnerId: String(partnerUserId),
      },
    });

    return {
      id: promo.id,
      code: promo.code,
      type: promo.type,
      validUntil: promo.validUntil.toISOString(),
      available: promo.available,
      currencyCode: promo.currencyCode,
      partnerStatus: affiliator.status,
      redeemable: affiliator.status === AffilatorStatus.ACTIVE,
      message:
        affiliator.status === AffilatorStatus.ACTIVE
          ? 'Промокод активен сразу'
          : 'Промокод создан. Активация для игроков — после одобрения вашего аккаунта менеджером',
    };
  }

  /** Проверка: self-service промо партнёра можно применить только при ACTIVE. */
  async assertPartnerPromoRedeemable(promo: {
    partnerId: string | null;
    value: unknown;
  }): Promise<void> {
    const value = (promo.value ?? {}) as Record<string, unknown>;
    if (!value.partnerCreated || !promo.partnerId) return;

    const partnerUserId = parseInt(promo.partnerId, 10);
    if (!Number.isFinite(partnerUserId)) {
      throw new BadRequestException('Промокод недоступен');
    }

    const affiliator = await this.prismaService.affilator.findUnique({
      where: { userId: partnerUserId },
    });
    if (!affiliator || affiliator.status === AffilatorStatus.BLOCKED) {
      throw new BadRequestException('Промокод недоступен');
    }
    if (affiliator.status === AffilatorStatus.PENDING) {
      throw new BadRequestException(
        'Промокод станет активен после одобрения партнёрского аккаунта',
      );
    }
  }

  async getSubIdStatsForPartner(
    partnerUserId: number,
    dimension: 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'sub5',
    currencyCode?: string,
  ) {
    const referred = await this.prismaService.user.findMany({
      where: { affiliatedById: partnerUserId },
      select: { id: true, affiliateSubs: true },
    });

    if (referred.length === 0) {
      return { dimension, currencyCode: currencyCode ?? null, rows: [] };
    }

    const userIds = referred.map((u) => u.id);

    const deposits = await this.prismaService.deposit.findMany({
      where: { userId: { in: userIds }, status: DepositStatus.SUCCESS },
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    });
    const ftdUsers = new Set<number>();
    for (const d of deposits) {
      if (!ftdUsers.has(d.userId)) ftdUsers.add(d.userId);
    }

    const commissionOps = await this.prismaService.operation.findMany({
      where: {
        userId: partnerUserId,
        source: OperationSource.AFFILIATE,
        status: OperationStatus.SUCCESS,
        ...(currencyCode ? { currencyCode } : {}),
      },
      select: { amount: true, type: true, meta: true },
    });

    const commissionByPlayer = new Map<number, number>();
    for (const op of commissionOps) {
      const meta = (op.meta ?? {}) as Record<string, unknown>;
      const playerId =
        typeof meta.originalUserId === 'number' ? meta.originalUserId : null;
      if (playerId == null) continue;
      const signed =
        op.type === OperationType.INCOME
          ? op.amount.toNumber()
          : -op.amount.toNumber();
      commissionByPlayer.set(
        playerId,
        (commissionByPlayer.get(playerId) ?? 0) + signed,
      );
    }

    const buckets = new Map<
      string,
      { registrations: number; ftd: number; commission: number }
    >();

    for (const user of referred) {
      const subs = parseAffiliateSubsJson(user.affiliateSubs);
      const label = subs[dimension]?.trim() || '(без метки)';
      const row = buckets.get(label) ?? {
        registrations: 0,
        ftd: 0,
        commission: 0,
      };
      row.registrations += 1;
      if (ftdUsers.has(user.id)) row.ftd += 1;
      row.commission += commissionByPlayer.get(user.id) ?? 0;
      buckets.set(label, row);
    }

    const rows = [...buckets.entries()]
      .map(([value, stats]) => ({
        value,
        registrations: stats.registrations,
        ftd: stats.ftd,
        commission: Math.round(stats.commission * 100) / 100,
        conversionPct:
          stats.registrations > 0
            ? Math.round((stats.ftd / stats.registrations) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.registrations - a.registrations);

    return {
      dimension,
      currencyCode: currencyCode ?? null,
      rows,
    };
  }

  async getAllPartners() {
    return this.prismaService.affilator.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          email: 'asc',
        },
      },
    });
  }

  async createPartner(data: {
    email: string;
    password: string;
    trafficSource: string;
    percent: number;
    affilatorsPercent?: number;
    type?: AffilatorType;
  }) {
    return this.prismaService.$transaction(async (prisma) => {
      const passwordHash = await hash(data.password, 10);

      // Создаем пользователя
      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: passwordHash,
        },
      });

      // Создаем партнера
      const affiliator = await prisma.affilator.create({
        data: {
          userId: user.id,
          trafficSource: data.trafficSource,
          percent: data.percent,
          affilatorsPercent: data.affilatorsPercent || 10,
          type: (data.type as AffilatorType) || AffilatorType.REVSHARE,
          meta: {},
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return affiliator;
    });
  }

  // Тестовый метод для проверки начисления бонусов
  async testPlayerBonus() {
    return this.prismaService.$transaction(async (prisma) => {
      // 1. Создаем партнера
      const affiliator = await prisma.user.create({
        data: {
          email: 'test.affiliator@test.com',
          affilator: {
            create: {
              type: 'REVSHARE',
              trafficSource: 'test_source',
              percent: new Decimal(30), // 30% бонус
            }
          }
        }
      });

      // 2. Создаем игрока и привязываем к партнеру
      const player = await prisma.user.create({
        data: {
          email: 'test.player@test.com',
          affiliatedById: affiliator.id
        }
      });

      // 3. Симулируем ставку и начисление бонуса
      const betAmount = new Decimal(100); // Ставка 100
      await this.addBonusToPlayer(
        prisma,
        player,
        1, // тестовый ID ставки
        'USD', // валюта
        betAmount,
        BetStatus.WIN
      );

      // 4. Проверяем начисление бонуса
      const operation = await prisma.operation.findFirst({
        where: {
          userId: player.id,
          source: OperationSource.AFFILIATE,
          type: OperationType.INCOME
        }
      });

      return {
        player,
        affiliator,
        bonusOperation: operation,
        expectedBonus: betAmount.times(new Decimal(30).dividedBy(100)) // Должно быть 30
      };
    });
  }

  // Тестовый метод для проверки конкретного сценария: партнер 22463, клиент 1, 4 токена с коэф 1.50, выигрыш 1000 USD
  async testSpecificScenario() {
    return this.prismaService.$transaction(async (prisma) => {

      // 1. Проверяем существование партнера (userId: 22463)
      const partner = await prisma.user.findUnique({
        where: { id: 22463 },
        include: {
          affilator: true
        }
      });

      if (!partner) {
        throw new Error('Партнер с userId 22463 не найден');
      }

      if (!partner.affilator) {
        throw new Error('Пользователь 22463 не является партнером');
      }


      // 2. Проверяем существование клиента (userId: 1)
      const client = await prisma.user.findUnique({
        where: { id: 1 }
      });

      if (!client) {
        throw new Error('Клиент с userId 1 не найден');
      }


      // 3. Проверяем, что клиент привязан к партнеру
      if (client.affiliatedById !== 22463) {
        // Привязываем клиента к партнеру
        await prisma.user.update({
          where: { id: 1 },
          data: { affiliatedById: 22463 }
        });
      }

      // 4. Создаем тестовую игру
      const testGame = await prisma.game.create({
        data: {
          eventId: `test_game_${Date.now()}`,
          eventName: 'Test Team 1 vs Test Team 2',
          leagueName: 'Test League',
          sport: 'football',
          team1: 'Test Team 1',
          team2: 'Test Team 2',
          score: '0-0',
          status: 'PREMATCH'
        }
      });


      // 5. Создаем 4 ставки (токена) с коэф 1.50, каждая на 250 USD (итого 1000 USD)
      const betAmount = new Decimal(250); // 250 USD за ставку
      const odds = new Decimal(1.50);
      const totalBetAmount = betAmount.times(4); // 1000 USD всего
      const winAmount = totalBetAmount.times(odds); // 1500 USD выигрыш

      const bets = [];
      for (let i = 1; i <= 4; i++) {
        const bet = await prisma.bet.create({
          data: {
            userId: 1, // клиент
            gameId: testGame.eventId,
            betType: `P1_${i}`, // тип ставки
            betVariant: 'ORDINAR',
            amount: betAmount,
            cf: odds,
            currencyCode: 'USD',
            status: 'PENDING'
          }
        });
        bets.push(bet);
      }

      // 6. Симулируем выигрыш всех ставок
      for (const bet of bets) {
        await prisma.bet.update({
          where: { id: bet.id },
          data: { status: 'WIN' }
        });
      }


      // 7. Проверяем баланс клиента до начисления выигрыша
      let clientBalance = await prisma.balance.findFirst({
        where: {
          userId: 1,
          currencyCode: 'USD'
        }
      });

      if (!clientBalance) {
        clientBalance = await prisma.balance.create({
          data: {
            userId: 1,
            currencyCode: 'USD',
            amount: new Decimal(0)
          }
        });
      }

      const clientBalanceBefore = clientBalance.amount;

      // 8. Начисляем выигрыш клиенту
      await this.operationService.create(prisma, 1, {
        amount: winAmount,
        currencyCode: 'USD',
        meta: {
          title: 'Выигрыш по ставкам',
          betIds: bets.map(b => b.id),
          gameId: testGame.eventId
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'INCOME'
      });


      // 9. Проверяем баланс партнера до начисления бонуса
      let partnerBalance = await prisma.balance.findFirst({
        where: {
          userId: 22463,
          currencyCode: 'USD'
        }
      });

      if (!partnerBalance) {
        partnerBalance = await prisma.balance.create({
          data: {
            userId: 22463,
            currencyCode: 'USD',
            amount: new Decimal(0)
          }
        });
      }

      const partnerBalanceBefore = partnerBalance.amount;

      // 10. Симулируем проигрышные ставки для начисления партнерского бонуса
      // Создаем 4 проигрышные ставки по 250 USD каждая
      const losingBets = [];
      for (let i = 1; i <= 4; i++) {
        const losingBet = await prisma.bet.create({
          data: {
            userId: 1, // клиент
            gameId: testGame.eventId,
            betType: `P2_${i}`, // другой тип ставки
            betVariant: 'ORDINAR',
            amount: betAmount,
            cf: new Decimal(2.0),
            currencyCode: 'USD',
            status: 'LOSE'
          }
        });
        losingBets.push(losingBet);
      }

      // 11. Начисляем партнерские бонусы за проигрышные ставки
      for (const losingBet of losingBets) {
        await this.addBonusToPlayer(
          prisma,
          client,
          losingBet.id,
          'USD',
          betAmount,
          'LOSE'
        );
      }


      // 12. Получаем финальные балансы
      const finalClientBalance = await prisma.balance.findFirst({
        where: {
          userId: 1,
          currencyCode: 'USD'
        }
      });

      const finalPartnerBalance = await prisma.balance.findFirst({
        where: {
          userId: 22463,
          currencyCode: 'USD'
        }
      });

      // 13. Получаем операции партнера
      const partnerOperations = await prisma.operation.findMany({
        where: {
          userId: 22463,
          source: 'AFFILIATE',
          type: 'INCOME'
        },
        orderBy: { createdAt: 'desc' },
        take: 4
      });

      const totalPartnerBonus = partnerOperations.reduce((sum, op) => sum + op.amount.toNumber(), 0);

      return {
        testGame,
        bets,
        losingBets,
        clientBalanceBefore,
        clientBalanceAfter: finalClientBalance?.amount || 0,
        partnerBalanceBefore,
        partnerBalanceAfter: finalPartnerBalance?.amount || 0,
        totalBetAmount: totalBetAmount.toString(),
        winAmount: winAmount.toString(),
        totalPartnerBonus,
        partnerOperations,
        expectedPartnerBonus: totalBetAmount.times(partner.affilator.percent).dividedBy(100).toString()
      };
    });
  }
}
