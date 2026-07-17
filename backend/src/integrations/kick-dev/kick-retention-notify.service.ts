import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Affilator } from '@prisma/client';

import { TelegramNotifyService } from '~/main/telegram/telegram-notify.service';
import { PrismaService } from '~/prisma/prisma.service';

import { parseAffiliateSubsJson } from '~/main/partners/affiliate-subs.util';

import { KickConnectBonusService } from './kick-connect-bonus.service';
import type { KickPartnerMeta } from './kick-partner.types';

type RetentionNudgeType =
  | 'no_stream_3d'
  | 'connected_no_streams'
  | 'stream_zero_regs'
  | 'no_referrals_7d'
  | 'onboarding_incomplete'
  | 'token_broken';

@Injectable()
export class KickRetentionNotifyService {
  private readonly logger = new Logger(KickRetentionNotifyService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramNotifyService,
    private readonly kickConnectBonus: KickConnectBonusService,
    private readonly config: ConfigService,
  ) {}

  private isEnabled() {
    const raw = this.config
      .get<string>('KICK_RETENTION_NUDGES_ENABLED')
      ?.trim()
      .toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'no';
  }

  private readKickMeta(meta: unknown): KickPartnerMeta {
    if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  private daysSince(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return null;
    return (Date.now() - ts) / 86_400_000;
  }

  private shouldThrottle(
    retention: KickPartnerMeta['retention'] | undefined,
    type: RetentionNudgeType,
  ): boolean {
    if (!retention?.lastNudgeAt) return false;
    const days = this.daysSince(retention.lastNudgeAt);
    if (days == null) return false;
    return days < 3 && retention.lastNudgeType === type;
  }

  private async writeNudgeSent(partnerUserId: number, type: RetentionNudgeType) {
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

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: {
          ...root,
          kick: {
            ...kick,
            retention: {
              ...(kick.retention ?? {}),
              lastNudgeAt: new Date().toISOString(),
              lastNudgeType: type,
            },
          },
        },
      },
    });
  }

  private readPartnerTelegram(meta: unknown): string | null {
    if (meta == null || typeof meta !== 'object') return null;
    const telegram = (meta as Record<string, unknown>).telegram;
    if (typeof telegram !== 'string' || !telegram.trim()) return null;
    return telegram.trim();
  }

  private async deliverToPartner(
    affiliator: Affilator,
    message: string,
    buttonUrl?: string,
  ) {
    const partnerUser = await this.prisma.user.findUnique({
      where: { id: affiliator.userId },
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
      `Kick retention (партнёр #${affiliator.userId})`,
      partnerUser?.email ? `Email: ${partnerUser.email}` : null,
      handle ? `Telegram: ${handle}` : null,
      '',
      message,
    ]
      .filter(Boolean)
      .join('\n');

    await this.telegram.sendSupportMessage(fallback);
  }

  private async resolveLastStreamDays(partnerUserId: number, kick: KickPartnerMeta) {
    const fromMeta = this.daysSince(kick.lastLiveAt);
    if (fromMeta != null) return fromMeta;

    const lastSession = await this.prisma.kickPartnerSession.findFirst({
      where: { partnerUserId },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, endedAt: true },
    });
    if (!lastSession) return null;

    const anchor = lastSession.endedAt ?? lastSession.startedAt;
    return this.daysSince(anchor.toISOString());
  }

  private async countKickRegsDuringSession(
    partnerUserId: number,
    startedAt: Date,
    endedAt: Date,
  ) {
    const referred = await this.prisma.user.findMany({
      where: {
        affiliatedById: partnerUserId,
        createdAt: { gte: startedAt, lte: endedAt },
      },
      select: { affiliateSubs: true },
    });
    return referred.filter((row) => {
      const subs = parseAffiliateSubsJson(row.affiliateSubs);
      return subs.sub1?.toLowerCase() === 'kick';
    }).length;
  }

  private async pickNudge(
    affiliator: Affilator,
    kick: KickPartnerMeta,
  ): Promise<{ type: RetentionNudgeType; message: string } | null> {
    const retention = kick.retention;
    const partnersUrl =
      this.config.get<string>('PARTNERS_PUBLIC_URL')?.trim()
      || process.env.PARTNERS_PUBLIC_URL?.trim()
      || 'https://partners.imba.bet';
    const streamUrl = `${partnersUrl}/profile/stream`;

    if (kick.tokenRefreshFailedAt) {
      if (this.shouldThrottle(retention, 'token_broken')) return null;
      return {
        type: 'token_broken',
        message: [
          '⚠️ Kick-токен требует переподключения',
          '',
          'Интеграция с каналом временно не работает. Переподключите Kick в кабинете, чтобы не терять трафик с эфира.',
        ].join('\n'),
      };
    }

    const onboardingDone =
      Boolean(kick.onboarding?.linkDone) && Boolean(kick.onboarding?.obsDone);
    if (!onboardingDone && kick.channelSlug) {
      if (this.shouldThrottle(retention, 'onboarding_incomplete')) return null;
      const missing = [
        !kick.onboarding?.linkDone ? 'ссылка в описании' : null,
        !kick.onboarding?.obsDone ? 'брендинг в OBS' : null,
      ].filter(Boolean);
      return {
        type: 'onboarding_incomplete',
        message: [
          '📋 Завершите настройку Kick-стрима',
          '',
          `Осталось: ${missing.join(', ')}.`,
          'Это повышает конверсию с эфира.',
        ].join('\n'),
      };
    }

    const connectedDays = this.daysSince(kick.connectedAt);
    if (connectedDays != null && connectedDays >= 7) {
      const referrals = await this.kickConnectBonus.countPartnerReferrals(
        affiliator.userId,
      );
      if (referrals === 0 && !this.shouldThrottle(retention, 'no_referrals_7d')) {
        return {
          type: 'no_referrals_7d',
          message: [
            '👋 Пока нет регистраций с вашей ссылки',
            '',
            'Закрепите партнёрскую ссылку в чате и описании канала — welcome $10 откроется к выводу после первой регистрации.',
          ].join('\n'),
        };
      }
    }

    const activeSession = await this.prisma.kickPartnerSession.findFirst({
      where: { partnerUserId: affiliator.userId, endedAt: null },
      select: { id: true },
    });
    if (!activeSession) {
      const daysSinceStream = await this.resolveLastStreamDays(
        affiliator.userId,
        kick,
      );

      // Подключил OAuth, но ни одного эфира — отдельный nudge через 2+ дня.
      if (
        daysSinceStream == null
        && connectedDays != null
        && connectedDays >= 2
        && !this.shouldThrottle(retention, 'connected_no_streams')
      ) {
        return {
          type: 'connected_no_streams',
          message: [
            '🚀 Kick подключён — осталось выйти в эфир',
            '',
            'Первый эфир занимает 15 минут: гайд, скрипт и шаблон описания уже ждут в кабинете.',
            'Welcome $10 откроется к выводу после первой регистрации с эфира.',
          ].join('\n'),
        };
      }

      const lastEnded = await this.prisma.kickPartnerSession.findFirst({
        where: { partnerUserId: affiliator.userId, endedAt: { not: null } },
        orderBy: { endedAt: 'desc' },
        select: { startedAt: true, endedAt: true },
      });
      if (
        lastEnded?.endedAt
        && !this.shouldThrottle(retention, 'stream_zero_regs')
      ) {
        const daysSinceEnd = this.daysSince(lastEnded.endedAt.toISOString());
        if (daysSinceEnd != null && daysSinceEnd >= 1 && daysSinceEnd <= 4) {
          const regs = await this.countKickRegsDuringSession(
            affiliator.userId,
            lastEnded.startedAt,
            lastEnded.endedAt,
          );
          if (regs === 0) {
            return {
              type: 'stream_zero_regs',
              message: [
                '🎯 Эфир прошёл без регистраций',
                '',
                'Попробуйте в следующий раз: !score в чате, конкурс «угадай счёт» (!счёт 2-1), закрепите ссылку imbalance.click/ваш-канал.',
                'Гайд и скрипт эфира — в кабинете.',
              ].join('\n'),
            };
          }
        }
      }

      if (
        daysSinceStream != null
        && daysSinceStream >= 3
        && !this.shouldThrottle(retention, 'no_stream_3d')
      ) {
        return {
          type: 'no_stream_3d',
          message: [
            '🎬 Давно не было эфира на Kick',
            '',
            `Прошло ${Math.floor(daysSinceStream)} дн. с последнего стрима.`,
            'Запустите эфир — зрители увидят ссылку imba в чате.',
          ].join('\n'),
        };
      }
    }

    return null;
  }

  @Cron('0 11 * * *')
  async sendRetentionNudges() {
    if (!this.isEnabled() || this.running) return;
    this.running = true;

    const partnersUrl =
      this.config.get<string>('PARTNERS_PUBLIC_URL')?.trim()
      || process.env.PARTNERS_PUBLIC_URL?.trim()
      || 'https://partners.imba.bet';
    const streamUrl = `${partnersUrl}/profile/stream`;

    try {
      const partners = await this.prisma.affilator.findMany({
        where: {
          status: 'ACTIVE',
          kickCredential: { isNot: null },
        },
        select: {
          userId: true,
          uid: true,
          meta: true,
          kickChannelSlug: true,
        },
      });

      let sent = 0;
      for (const row of partners) {
        const kick = this.readKickMeta(row.meta);
        if (!kick.channelSlug) continue;

        const nudge = await this.pickNudge(row as Affilator, kick);
        if (!nudge) continue;

        try {
          await this.deliverToPartner(row as Affilator, nudge.message, streamUrl);
          await this.writeNudgeSent(row.userId, nudge.type);
          sent += 1;
        } catch (error) {
          this.logger.warn(
            `Kick retention nudge failed for partner ${row.userId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      if (sent > 0) {
        this.logger.log(`Kick retention nudges sent: ${sent}`);
      }
    } finally {
      this.running = false;
    }
  }
}
