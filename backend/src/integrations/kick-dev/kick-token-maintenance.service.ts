import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { KickCredentialService } from './kick-credential.service';
import { KickDevService } from './kick-dev.service';
import { KickPartnerService } from './kick-partner.service';
import { KickTokenService } from './kick-token.service';
import { isKickTokenExpiringSoon } from './kick-token.util';

@Injectable()
export class KickTokenMaintenanceService {
  private readonly logger = new Logger(KickTokenMaintenanceService.name);
  private running = false;

  constructor(
    private readonly kickDev: KickDevService,
    private readonly kickToken: KickTokenService,
    private readonly kickPartner: KickPartnerService,
    private readonly kickCredential: KickCredentialService,
    private readonly config: ConfigService,
  ) {}

  private isEnabled() {
    const raw = this.config.get<string>('KICK_DEV_TOKEN_MAINTENANCE_ENABLED')?.trim().toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'no';
  }

  /** Refresh expiring tokens and re-subscribe webhooks once per day per partner. */
  @Cron('0 * * * *')
  async scheduledMaintenance() {
    if (!this.isEnabled() || !this.kickDev.isConfigured()) return;
    await this.maintainConnectedPartners();
  }

  /** Re-subscribe webhooks for all connected partners (daily health check). */
  @Cron('0 4 * * *')
  async scheduledWebhookRefresh() {
    if (!this.isEnabled() || !this.kickDev.isConfigured()) return;

    const partnerIds = await this.kickPartner.listConnectedKickPartnerIds();
    let ok = 0;
    let failed = 0;

    for (const partnerUserId of partnerIds) {
      try {
        await this.kickPartner.resubscribeWebhooks(partnerUserId);
        ok += 1;
      } catch {
        failed += 1;
      }
    }

    if (ok > 0 || failed > 0) {
      this.logger.log(`Kick webhook refresh: ok=${ok} failed=${failed}`);
    }
  }

  async maintainConnectedPartners() {
    if (this.running) return;
    this.running = true;

    try {
      const partnerIds = await this.kickPartner.listConnectedKickPartnerIds();
      if (partnerIds.length === 0) return;

      let refreshed = 0;
      let resubscribed = 0;
      let failed = 0;

      for (const partnerUserId of partnerIds) {
        try {
          const hasCredentials = await this.kickCredential.hasCredentials(partnerUserId);
          if (!hasCredentials) continue;

          const tokenRefreshFailedAt =
            await this.kickCredential.getTokenRefreshFailedAt(partnerUserId);
          const tokenExpiresAt = await this.kickCredential.getTokenExpiresAt(partnerUserId);

          const needsRefresh =
            Boolean(tokenRefreshFailedAt) || isKickTokenExpiringSoon(tokenExpiresAt);

          if (!needsRefresh) continue;

          const accessToken = await this.kickToken.getValidAccessToken(partnerUserId);
          if (!accessToken) {
            failed += 1;
            continue;
          }
          refreshed += 1;

          if (tokenRefreshFailedAt) {
            await this.kickPartner.resubscribeWebhooks(partnerUserId);
            resubscribed += 1;
          }
        } catch (error) {
          failed += 1;
          this.logger.warn(
            `Kick token maintenance failed for partner ${partnerUserId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      if (refreshed > 0 || resubscribed > 0 || failed > 0) {
        this.logger.log(
          `Kick token maintenance: partners=${partnerIds.length} refreshed=${refreshed} resubscribed=${resubscribed} failed=${failed}`,
        );
      }
    } finally {
      this.running = false;
    }
  }
}
