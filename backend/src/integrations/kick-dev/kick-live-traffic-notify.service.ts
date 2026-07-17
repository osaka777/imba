import { Inject, Injectable } from '@nestjs/common';
import { Affilator, User } from '@prisma/client';
import { Logger } from 'winston';

import { TelegramNotifyService } from '~/main/telegram/telegram-notify.service';
import { parseAffiliateSubsJson } from '~/main/partners/affiliate-subs.util';
import { PrismaService } from '~/prisma/prisma.service';

import { KickConnectBonusService } from './kick-connect-bonus.service';
import type { KickPartnerMeta } from './kick-partner.types';
import { KickWidgetAlertService } from './kick-widget-alert.service';
import { KickChatAnnounceService } from './kick-chat-announce.service';
import { KickStreamRaceService } from './kick-stream-race.service';

@Injectable()
export class KickLiveTrafficNotifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramNotifyService,
    private readonly kickConnectBonus: KickConnectBonusService,
    private readonly widgetAlerts: KickWidgetAlertService,
    private readonly chatAnnounce: KickChatAnnounceService,
    private readonly streamRace: KickStreamRaceService,
    @Inject('winston')
    private readonly logger: Logger,
  ) {}

  private isKickTraffic(player: User): boolean {
    const subs = parseAffiliateSubsJson(player.affiliateSubs);
    return subs.sub1?.toLowerCase() === 'kick';
  }

  private async getActiveSession(partnerUserId: number) {
    return this.prisma.kickPartnerSession.findFirst({
      where: { partnerUserId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  private async countSessionKickRegs(partnerUserId: number, sessionStartedAt: Date): Promise<number> {
    const referred = await this.prisma.user.findMany({
      where: {
        affiliatedById: partnerUserId,
        createdAt: { gte: sessionStartedAt },
      },
      select: { affiliateSubs: true, createdAt: true },
    });

    return referred.filter((row) => {
      const subs = parseAffiliateSubsJson(row.affiliateSubs);
      return subs.sub1?.toLowerCase() === 'kick';
    }).length;
  }

  private readPartnerTelegram(meta: unknown): string | null {
    if (meta == null || typeof meta !== 'object') return null;
    const telegram = (meta as Record<string, unknown>).telegram;
    if (typeof telegram !== 'string' || !telegram.trim()) return null;
    return telegram.trim();
  }

  private async deliverToPartner(
    partnerUserId: number,
    affiliator: Affilator,
    message: string,
    buttonUrl?: string,
  ) {
    const partnerUser = await this.prisma.user.findUnique({
      where: { id: partnerUserId },
      select: { telegramUserId: true, email: true },
    });

    if (partnerUser?.telegramUserId) {
      const result = await this.telegram.sendUserMessage(
        partnerUser.telegramUserId,
        message,
        buttonUrl
          ? { buttonUrl, buttonText: 'Открыть кабинет' }
          : undefined,
      );
      if (result.ok) return;
    }

    const handle = this.readPartnerTelegram(affiliator.meta);
    const fallback = [
      `Kick live-уведомление (партнёр #${partnerUserId})`,
      partnerUser?.email ? `Email: ${partnerUser.email}` : null,
      handle ? `Telegram: ${handle}` : null,
      '',
      message,
    ]
      .filter(Boolean)
      .join('\n');

    await this.telegram.sendSupportMessage(fallback);
  }

  async notifyRegistration(player: User, affiliator: Affilator): Promise<void> {
    if (!this.isKickTraffic(player)) return;

    const session = await this.getActiveSession(affiliator.userId);
    if (!session) return;

    const totalInStream = await this.countSessionKickRegs(
      affiliator.userId,
      session.startedAt,
    );
    const channel = session.kickChannel;
    const partnersUrl =
      process.env.PARTNERS_PUBLIC_URL?.trim() || 'https://partners.imba.bet';

    const message = [
      `🎮 Новая регистрация с Kick-эфира`,
      `Канал: @${channel}`,
      `За текущий эфир: ${totalInStream} рег.`,
      '',
      'Продолжай пушить ссылку в чат — трафик идёт.',
    ].join('\n');

    try {
      await this.deliverToPartner(
        affiliator.userId,
        affiliator,
        message,
        `${partnersUrl}/profile/stream`,
      );
      void this.widgetAlerts.pushAlert(
        affiliator.userId,
        'registration',
        `+1 регистрация с эфира (всего ${totalInStream})`,
      );
      void this.chatAnnounce.announceSessionRegistration(
        affiliator.userId,
        totalInStream,
      );
      void this.streamRace.maybeGrantStreamRace(affiliator.userId, session.id);
    } catch (error) {
      this.logger.warn('Kick live registration notify failed', {
        partnerUserId: affiliator.userId,
        error: String(error),
      });
    }
  }

  async notifyFirstDeposit(
    player: User,
    affiliator: Affilator,
    amount: string,
    currency: string,
  ): Promise<void> {
    if (!this.isKickTraffic(player)) return;

    const session = await this.getActiveSession(affiliator.userId);
    if (!session) return;

    const registeredDuringLive =
      player.createdAt.getTime() >= session.startedAt.getTime();

    const message = [
      `💰 FTD с Kick-трафика${registeredDuringLive ? ' (во время эфира)' : ''}`,
      `Канал: @${session.kickChannel}`,
      `Сумма депозита: ${amount} ${currency}`,
      '',
      'Отличная конверсия — закрепи ссылку в описании канала.',
    ].join('\n');

    const partnersUrl =
      process.env.PARTNERS_PUBLIC_URL?.trim() || 'https://partners.imba.bet';

    try {
      await this.deliverToPartner(
        affiliator.userId,
        affiliator,
        message,
        `${partnersUrl}/profile/dashboard?sub=sub1`,
      );
      void this.widgetAlerts.pushAlert(
        affiliator.userId,
        'ftd',
        `FTD ${amount} ${currency}`,
      );
    } catch (error) {
      this.logger.warn('Kick live FTD notify failed', {
        partnerUserId: affiliator.userId,
        error: String(error),
      });
    }
  }

  private readKickMeta(meta: unknown): KickPartnerMeta {
    if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  private async writeRetentionFlag(
    partnerUserId: number,
    patch: NonNullable<KickPartnerMeta['retention']>,
  ) {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    if (!affiliator) return;

    const root =
      affiliator.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
        ? { ...(affiliator.meta as Record<string, unknown>) }
        : {};
    const kick = this.readKickMeta(affiliator.meta);
    const retention = { ...(kick.retention ?? {}), ...patch };

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: {
          ...root,
          kick: { ...kick, retention },
        },
      },
    });
  }

  /** Telegram при первой регистрации реферала — разблокировка welcome $10. */
  async notifyFirstReferralUnlock(affiliator: Affilator): Promise<void> {
    if (!affiliator.kickChannelSlug) return;

    const referralsCount = await this.kickConnectBonus.countPartnerReferrals(
      affiliator.userId,
    );
    if (referralsCount !== 1) return;

    const hasBonus = await this.kickConnectBonus.hasConnectBonus(affiliator.userId);
    if (!hasBonus) return;

    const kick = this.readKickMeta(affiliator.meta);
    if (kick.retention?.referralUnlockNotifiedAt) return;

    const snapshot = await this.kickConnectBonus.getWelcomeBalanceSnapshot(
      affiliator.userId,
    );
    const partnersUrl =
      process.env.PARTNERS_PUBLIC_URL?.trim() || 'https://partners.imba.bet';

    const message = [
      '🎉 Первая регистрация по вашей ссылке!',
      '',
      `Welcome-бонус $10 разблокирован — доступно к выводу: $${snapshot.availableUsd.toFixed(2)}`,
      `До минимального вывода ($${snapshot.minWithdrawUsd}) осталось: $${Math.max(0, snapshot.minWithdrawUsd - snapshot.availableUsd).toFixed(2)}`,
      '',
      'Продолжайте стримить и делитесь ссылкой в чате Kick.',
    ].join('\n');

    try {
      await this.deliverToPartner(
        affiliator.userId,
        affiliator,
        message,
        `${partnersUrl}/profile/payment`,
      );
      await this.writeRetentionFlag(affiliator.userId, {
        referralUnlockNotifiedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn('Kick first referral unlock notify failed', {
        partnerUserId: affiliator.userId,
        error: String(error),
      });
    }
  }
}
