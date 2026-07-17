import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { KickDevService } from './kick-dev.service';
import { KickPartnerService } from './kick-partner.service';
import { KickWebhookService } from './kick-webhook.service';

@Injectable()
export class KickPartnerPollService {
  private readonly logger = new Logger(KickPartnerPollService.name);
  private polling = false;

  constructor(
    private readonly kickDev: KickDevService,
    private readonly kickPartner: KickPartnerService,
    private readonly kickWebhook: KickWebhookService,
    private readonly config: ConfigService,
  ) {}

  private isEnabled() {
    const raw = this.config.get<string>('KICK_DEV_POLL_ENABLED')?.trim().toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'no';
  }

  /** Poll connected partners every 4 minutes (webhook fallback). */
  @Cron('*/4 * * * *')
  async scheduledPoll() {
    if (!this.isEnabled() || !this.kickDev.isConfigured()) return;
    await this.pollConnectedPartners();
  }

  async pollConnectedPartners() {
    if (this.polling) return;
    this.polling = true;

    try {
      const partnerIds = await this.kickPartner.listConnectedKickPartnerIds();
      if (partnerIds.length === 0) return;

      let started = 0;
      let ended = 0;
      let refreshed = 0;
      let failed = 0;

      for (const partnerUserId of partnerIds) {
        try {
          const channel = await this.kickPartner.fetchPartnerChannel(partnerUserId);
          if (!channel) {
            failed += 1;
            continue;
          }

          const result = await this.kickWebhook.syncLiveFromApi(partnerUserId, {
            is_live: Boolean(channel.stream?.is_live),
            title: channel.stream?.title ?? channel.stream_title ?? null,
            viewer_count: channel.stream?.viewer_count ?? null,
          });

          switch (result.action) {
            case 'live_started':
              started += 1;
              break;
            case 'live_ended':
              ended += 1;
              break;
            case 'live_refresh':
              refreshed += 1;
              break;
            default:
              break;
          }
        } catch (error) {
          failed += 1;
          this.logger.warn(
            `Kick poll failed for partner ${partnerUserId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      if (started > 0 || ended > 0 || refreshed > 0 || failed > 0) {
        this.logger.log(
          `Kick partner poll: partners=${partnerIds.length} started=${started} ended=${ended} refreshed=${refreshed} failed=${failed}`,
        );
      }
    } finally {
      this.polling = false;
    }
  }
}
