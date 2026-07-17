import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';

import type { KickPartnerMeta } from './kick-partner.types';
import { KickChatService } from './kick-chat.service';
import { KickGuessContestService } from './kick-guess-contest.service';
import { KickStreakService } from './kick-streak.service';
import { KickTokenService } from './kick-token.service';
import { hasImbaBranding, parseKickWebhookHeaders, verifyKickWebhookSignature } from './kick-webhook.util';

type KickWebhookBroadcaster = {
  user_id?: number;
  channel_slug?: string;
  username?: string;
};

type LivestreamStatusPayload = {
  broadcaster?: KickWebhookBroadcaster;
  is_live?: boolean;
  title?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  viewer_count?: number | null;
};

type LivestreamMetadataPayload = {
  broadcaster?: KickWebhookBroadcaster;
  metadata?: {
    title?: string | null;
    custom_tags?: string[] | null;
  } | null;
};

type ChatMessagePayload = {
  message_id?: string;
  content?: string;
  broadcaster?: KickWebhookBroadcaster;
  sender?: {
    user_id?: number;
    username?: string;
  };
};

@Injectable()
export class KickWebhookService {
  private readonly logger = new Logger(KickWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly kickChat: KickChatService,
    private readonly kickToken: KickTokenService,
    private readonly kickStreak: KickStreakService,
    private readonly guessContest: KickGuessContestService,
  ) {}

  private shouldVerifySignatures() {
    const raw = this.config.get<string>('KICK_DEV_WEBHOOK_SKIP_VERIFY')?.trim().toLowerCase();
    return raw !== '1' && raw !== 'true' && raw !== 'yes';
  }

  private readKickMeta(meta: Prisma.JsonValue | null | undefined): KickPartnerMeta {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  private async mergeKickMeta(partnerUserId: number, patch: Partial<KickPartnerMeta>) {
    const current = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });

    const currentMeta =
      current?.meta && typeof current.meta === 'object' && !Array.isArray(current.meta)
        ? (current.meta as Record<string, unknown>)
        : {};
    const kick = this.readKickMeta(current?.meta ?? null);

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: {
          ...currentMeta,
          kick: {
            ...kick,
            ...patch,
          },
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async findPartnerByKickIdentity(slug?: string | null, broadcasterUserId?: number | null) {
    const select = {
      userId: true,
      uid: true,
      meta: true,
    } as const;

    if (slug) {
      const bySlug = await this.prisma.affilator.findFirst({
        where: {
          status: 'ACTIVE',
          kickChannelSlug: { equals: slug, mode: 'insensitive' },
        },
        select,
      });
      if (bySlug) return bySlug;
    }

    if (broadcasterUserId != null) {
      const byBroadcaster = await this.prisma.affilator.findFirst({
        where: {
          status: 'ACTIVE',
          kickBroadcasterUserId: broadcasterUserId,
        },
        select,
      });
      if (byBroadcaster) return byBroadcaster;
    }

    const partners = await this.prisma.affilator.findMany({
      where: { status: 'ACTIVE' },
      select,
    });

    return partners.find((partner) => {
      const kick = this.readKickMeta(partner.meta);
      if (!kick.channelSlug && !kick.broadcasterUserId) return false;
      if (slug && kick.channelSlug?.toLowerCase() === slug.toLowerCase()) return true;
      if (
        broadcasterUserId != null
        && kick.broadcasterUserId != null
        && kick.broadcasterUserId === broadcasterUserId
      ) {
        return true;
      }
      return false;
    }) ?? null;
  }

  private normalizeViewerCount(count?: number | null) {
    if (count == null || !Number.isFinite(count) || count < 0) return null;
    return Math.floor(count);
  }

  private async bumpSessionPeakViewers(
    partnerUserId: number,
    sessionId: string | null | undefined,
    viewerCount?: number | null,
  ) {
    const count = this.normalizeViewerCount(viewerCount);
    if (count == null) return;

    const where = sessionId
      ? { id: sessionId, partnerUserId, endedAt: null }
      : { partnerUserId, endedAt: null };

    const sessions = await this.prisma.kickPartnerSession.findMany({
      where,
      select: { id: true, peakViewers: true },
    });

    await Promise.all(
      sessions
        .filter((session) => count > session.peakViewers)
        .map((session) =>
          this.prisma.kickPartnerSession.update({
            where: { id: session.id },
            data: { peakViewers: count },
          }),
        ),
    );
  }

  private async openSession(
    partnerUserId: number,
    kick: KickPartnerMeta,
    title?: string | null,
    viewerCount?: number | null,
  ) {
    const hadBranding = hasImbaBranding(title, kick.customTags ?? null);
    const session = await this.prisma.kickPartnerSession.create({
      data: {
        partnerUserId,
        kickChannel: kick.channelSlug || 'unknown',
        broadcasterUserId: kick.broadcasterUserId ?? null,
        hadBranding,
        lastStreamTitle: title ?? null,
        peakViewers: this.normalizeViewerCount(viewerCount) ?? 0,
      },
    });

    await this.mergeKickMeta(partnerUserId, {
      isLive: true,
      streamTitle: title ?? kick.streamTitle ?? null,
      hasBranding: hadBranding,
      activeSessionId: session.id,
      lastLiveAt: new Date().toISOString(),
    });

    void this.guessContest.ensureContestForSession(partnerUserId, session.id);

    return session;
  }

  private async closeActiveSession(partnerUserId: number, title?: string | null) {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    const kick = this.readKickMeta(affiliator?.meta ?? null);
    const sessionId = kick.activeSessionId;

    if (sessionId) {
      await this.prisma.kickPartnerSession.updateMany({
        where: { id: sessionId, partnerUserId, endedAt: null },
        data: {
          endedAt: new Date(),
          lastStreamTitle: title ?? undefined,
        },
      });
    } else {
      await this.prisma.kickPartnerSession.updateMany({
        where: { partnerUserId, endedAt: null },
        data: {
          endedAt: new Date(),
          lastStreamTitle: title ?? undefined,
        },
      });
    }

    await this.mergeKickMeta(partnerUserId, {
      isLive: false,
      viewerCount: 0,
      activeSessionId: null,
      streamTitle: title ?? kick.streamTitle ?? null,
    });

    void this.kickStreak.maybeGrantStreak(partnerUserId);
    void this.guessContest.clearContest(partnerUserId);
  }

  private async applyLivestreamStatus(
    partnerUserId: number,
    kick: KickPartnerMeta,
    payload: Pick<LivestreamStatusPayload, 'is_live' | 'title' | 'viewer_count'>,
  ) {
    const title = payload.title ?? kick.streamTitle ?? null;

    if (payload.is_live) {
      if (kick.isLive && kick.activeSessionId) {
        const viewerCount = payload.viewer_count ?? kick.viewerCount ?? null;
        await this.mergeKickMeta(partnerUserId, {
          isLive: true,
          streamTitle: title,
          viewerCount,
          hasBranding: hasImbaBranding(title, kick.customTags ?? null),
        });
        await this.bumpSessionPeakViewers(partnerUserId, kick.activeSessionId, viewerCount);
        return 'live_refresh' as const;
      }

      const session = await this.openSession(partnerUserId, kick, title, payload.viewer_count);
      void this.trySendLiveWelcome(partnerUserId, session.id);
      return 'live_started' as const;
    }

    if (!kick.isLive && !kick.activeSessionId) {
      return 'already_offline' as const;
    }

    await this.closeActiveSession(partnerUserId, title);
    return 'live_ended' as const;
  }

  /** Fallback when webhooks miss live start/stop (cron poll). */
  async syncLiveFromApi(
    partnerUserId: number,
    payload: {
      is_live: boolean;
      title?: string | null;
      viewer_count?: number | null;
    },
  ) {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    const kick = this.readKickMeta(affiliator?.meta ?? null);
    const action = await this.applyLivestreamStatus(partnerUserId, kick, payload);
    return { action };
  }

  private async handleLivestreamStatus(payload: LivestreamStatusPayload) {
    const slug = payload.broadcaster?.channel_slug;
    const broadcasterUserId = payload.broadcaster?.user_id;
    const partner = await this.findPartnerByKickIdentity(slug, broadcasterUserId);
    if (!partner) return { handled: false };

    const kick = this.readKickMeta(partner.meta);
    const action = await this.applyLivestreamStatus(partner.userId, kick, payload);
    return { handled: true, partnerUserId: partner.userId, action };
  }

  private async handleLivestreamMetadata(payload: LivestreamMetadataPayload) {
    const slug = payload.broadcaster?.channel_slug;
    const broadcasterUserId = payload.broadcaster?.user_id;
    const partner = await this.findPartnerByKickIdentity(slug, broadcasterUserId);
    if (!partner) return { handled: false };

    const title = payload.metadata?.title ?? null;
    const customTags = payload.metadata?.custom_tags ?? null;
    const branding = hasImbaBranding(title, customTags);

    await this.mergeKickMeta(partner.userId, {
      streamTitle: title,
      customTags,
      hasBranding: branding,
    });

    if (branding) {
      await this.prisma.kickPartnerSession.updateMany({
        where: { partnerUserId: partner.userId, endedAt: null },
        data: {
          hadBranding: true,
          lastStreamTitle: title ?? undefined,
        },
      });
    }

    return { handled: true, partnerUserId: partner.userId, action: 'metadata_updated' };
  }

  private async trySendLiveWelcome(partnerUserId: number, sessionId: string) {
    const session = await this.prisma.kickPartnerSession.findUnique({
      where: { id: sessionId },
      select: { welcomeSentAt: true },
    });
    if (session?.welcomeSentAt) return;

    const partner = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { uid: true, meta: true },
    });
    if (!partner) return;

    const kick = this.readKickMeta(partner.meta);
    const accessToken = await this.kickToken.getValidAccessToken(partnerUserId);
    if (!accessToken) return;

    const promoCode = await this.getPartnerPromoCode(partnerUserId);
    const content = this.kickChat.buildLiveWelcomeMessage({
      userId: partnerUserId,
      uid: partner.uid,
      kick,
      promoCode,
    });

    try {
      await this.kickChat.sendBotMessage(accessToken, content);
      await this.prisma.kickPartnerSession.update({
        where: { id: sessionId },
        data: { welcomeSentAt: new Date() },
      });
      this.logger.log(`Kick live welcome sent for partner ${partnerUserId} session ${sessionId}`);
    } catch (error) {
      this.logger.warn(
        `Kick live welcome failed for partner ${partnerUserId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async getPartnerPromoCode(partnerUserId: number) {
    const promo = await this.prisma.promo.findFirst({
      where: { partnerId: String(partnerUserId) },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    return promo?.code ?? null;
  }

  private async handleChatMessage(payload: ChatMessagePayload) {
    const slug = payload.broadcaster?.channel_slug;
    const broadcasterUserId = payload.broadcaster?.user_id;
    const partner = await this.findPartnerByKickIdentity(slug, broadcasterUserId);
    if (!partner) return { handled: false };

    const kick = this.readKickMeta(partner.meta);
    const accessToken = await this.kickToken.getValidAccessToken(partner.userId);
    if (!accessToken) {
      return { handled: false, reason: 'no_token' };
    }

    const promoCode = await this.getPartnerPromoCode(partner.userId);
    return this.kickChat.handleChatMessage(
      {
        userId: partner.userId,
        uid: partner.uid,
        kick,
        promoCode,
      },
      payload,
    );
  }

  async handleWebhook(params: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: string;
    parsedBody: unknown;
  }) {
    const header = parseKickWebhookHeaders(params.headers);
    if (!header.messageId || !header.timestamp || !header.signature || !header.eventType) {
      throw new BadRequestException('Missing Kick webhook headers');
    }

    if (this.shouldVerifySignatures()) {
      const valid = verifyKickWebhookSignature({
        messageId: header.messageId,
        timestamp: header.timestamp,
        rawBody: params.rawBody,
        signatureB64: header.signature,
      });
      if (!valid) {
        throw new UnauthorizedException('Invalid Kick webhook signature');
      }
    }

    const existing = await this.prisma.kickWebhookDelivery.findUnique({
      where: { messageId: header.messageId },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    await this.prisma.kickWebhookDelivery.create({
      data: {
        messageId: header.messageId,
        eventType: header.eventType,
      },
    });

    let result: Record<string, unknown> = { handled: false };
    if (header.eventType === 'livestream.status.updated') {
      result = await this.handleLivestreamStatus(params.parsedBody as LivestreamStatusPayload);
    } else if (header.eventType === 'livestream.metadata.updated') {
      result = await this.handleLivestreamMetadata(params.parsedBody as LivestreamMetadataPayload);
    } else if (header.eventType === 'chat.message.sent') {
      result = await this.handleChatMessage(params.parsedBody as ChatMessagePayload);
    }

    this.logger.log(
      `Kick webhook ${header.eventType} ${header.messageId}: ${JSON.stringify(result)}`,
    );

    return { ok: true, event: header.eventType, ...result };
  }
}
