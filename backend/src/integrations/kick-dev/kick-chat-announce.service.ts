import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';

import type { KickPartnerMeta } from './kick-partner.types';
import { KickTokenService } from './kick-token.service';

const REG_CHAT_COOLDOWN_MS = 5 * 60_000;

@Injectable()
export class KickChatAnnounceService {
  private readonly logger = new Logger(KickChatAnnounceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kickToken: KickTokenService,
  ) {}

  private readKickMeta(meta: unknown): KickPartnerMeta {
    if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  private async sendBotMessage(accessToken: string, content: string) {
    const res = await fetch('https://api.kick.com/public/v1/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bot',
        content: content.slice(0, 500),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Kick chat post failed: ${res.status} ${text.slice(0, 200)}`);
    }
  }

  async announceSessionRegistration(
    partnerUserId: number,
    totalInStream: number,
  ): Promise<void> {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true, kickChannelSlug: true },
    });
    if (!affiliator?.kickChannelSlug) return;

    const kick = this.readKickMeta(affiliator.meta);
    if (!kick.isLive && !kick.activeSessionId) return;

    const lastAt = kick.lastRegChatAt ? Date.parse(kick.lastRegChatAt) : 0;
    if (lastAt && Date.now() - lastAt < REG_CHAT_COOLDOWN_MS) return;

    const accessToken = await this.kickToken.getValidAccessToken(partnerUserId);
    if (!accessToken) return;

    const message = `+1 рег с эфира imba.bet! Всего за стрим: ${totalInStream}`;

    try {
      await this.sendBotMessage(accessToken, message);

      const root =
        affiliator.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
          ? { ...(affiliator.meta as Record<string, unknown>) }
          : {};

      await this.prisma.affilator.update({
        where: { userId: partnerUserId },
        data: {
          meta: {
            ...root,
            kick: { ...kick, lastRegChatAt: new Date().toISOString() },
          },
        },
      });
    } catch (error) {
      this.logger.warn('Kick reg chat announce failed', {
        partnerUserId,
        error: String(error),
      });
    }
  }
}
