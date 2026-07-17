import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { TelegramNotifyService } from '~/main/telegram/telegram-notify.service';
import { PrismaService } from '~/prisma/prisma.service';

import { KickDevService } from './kick-dev.service';

const ALERT_AFTER_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class KickTokenAlertService {
  private readonly logger = new Logger(KickTokenAlertService.name);
  private running = false;

  constructor(
    private readonly kickDev: KickDevService,
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramNotifyService,
    private readonly config: ConfigService,
  ) {}

  private isEnabled() {
    const raw = this.config.get<string>('KICK_DEV_TOKEN_ALERT_ENABLED')?.trim().toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'no';
  }

  /** Notify support when Kick OAuth has been broken for 24h+. */
  @Cron('0 */6 * * *')
  async scheduledAlerts() {
    if (!this.isEnabled() || !this.kickDev.isConfigured()) return;
    await this.sendDueAlerts();
  }

  async sendDueAlerts() {
    if (this.running) return;
    this.running = true;

    try {
      const cutoff = new Date(Date.now() - ALERT_AFTER_MS);
      const credentials = await this.prisma.kickPartnerCredential.findMany({
        where: {
          tokenRefreshFailedAt: { lte: cutoff },
        },
        include: {
          partner: {
            select: {
              uid: true,
              kickChannelSlug: true,
              user: { select: { email: true } },
            },
          },
        },
      });

      let sent = 0;

      for (const row of credentials) {
        if (
          row.tokenAlertSentAt
          && row.tokenRefreshFailedAt
          && row.tokenAlertSentAt >= row.tokenRefreshFailedAt
        ) {
          continue;
        }

        const email = row.partner.user.email;
        const slug = row.partner.kickChannelSlug ?? '—';
        const failedAt = row.tokenRefreshFailedAt?.toISOString() ?? 'unknown';

        const message = [
          '⚠️ Kick OAuth отвалился у партнёра',
          `Email: ${email}`,
          `Канал: @${slug}`,
          `Сбой с: ${failedAt}`,
          `Партнёрский tag: ${row.partner.uid}`,
          'Нужно: попросить переподключить Kick в /profile/stream',
        ].join('\n');

        const result = await this.telegram.sendSupportMessage(message);
        if (!result.ok) continue;

        await this.prisma.kickPartnerCredential.update({
          where: { partnerUserId: row.partnerUserId },
          data: { tokenAlertSentAt: new Date() },
        });
        sent += 1;
      }

      if (sent > 0) {
        this.logger.log(`Kick token alerts sent: ${sent}`);
      }
    } finally {
      this.running = false;
    }
  }
}
