import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import {
  DepositStatus,
  OperationSource,
  OperationStatus,
  OperationType,
} from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';

import { parseAffiliateSubsJson } from '~/main/partners/affiliate-subs.util';

import {
  buildKickShortClickUrl,
  normalizeKickShortClickDomain,
} from './kick-short-url.util';
import {
  KICK_CONNECT_BONUS_TYPE,
  KICK_PARTNER_CURRENCY,
  KICK_VIEWER_OFFER_HEADLINE,
  KICK_WEEKLY_CHALLENGE_BONUS_USD,
  KICK_WEEKLY_CHALLENGE_GOAL,
} from './kick-affiliate.constants';
import { KickConnectBonusService } from './kick-connect-bonus.service';
import { KickGuessContestService } from './kick-guess-contest.service';
import { KickMonthSprintService } from './kick-month-sprint.service';
import { KickStreakService } from './kick-streak.service';
import { KickStreamRaceService } from './kick-stream-race.service';

import {
  buildKickAuthorizeUrl,
  createPkcePair,
  KICK_OAUTH_SCOPES,
} from './kick-dev.oauth.util';
import { KickDevService } from './kick-dev.service';
import type {
  KickLivePartnerDto,
  KickPartnerAdminItem,
  KickPartnerAdminSessionItem,
  KickPartnerAnalyticsDto,
  KickPartnerMeta,
  KickPublicScoreboardDto,
  KickPartnerPublicStatus,
  KickPartnerWidgetDto,
  KickSessionLiveStatsDto,
  KickTabloStreamItem,
} from './kick-partner.types';
import { KickCredentialService } from './kick-credential.service';
import { KickTokenService } from './kick-token.service';
import { buildKickTokenMetaPatch } from './kick-token.util';
import { KickChannelLiveService } from '~/integrations/kick-live/kick-channel-live.service';

type KickTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type KickApiEnvelope<T> = {
  data?: T;
  message?: string;
};

type KickChannel = {
  slug?: string;
  stream_title?: string | null;
  broadcaster_user_id?: number;
  stream?: {
    is_live?: boolean;
    viewer_count?: number;
    title?: string | null;
  } | null;
};

type KickOAuthStatePayload = {
  purpose: 'kick_connect';
  partnerUserId: number;
  codeVerifier: string;
};

@Injectable()
export class KickPartnerService {
  private readonly logger = new Logger(KickPartnerService.name);

  constructor(
    private readonly kickDev: KickDevService,
    private readonly kickToken: KickTokenService,
    private readonly kickCredential: KickCredentialService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly kickConnectBonus: KickConnectBonusService,
    private readonly kickStreamRace: KickStreamRaceService,
    private readonly kickStreak: KickStreakService,
    private readonly kickMonthSprint: KickMonthSprintService,
    private readonly guessContest: KickGuessContestService,
    private readonly kickChannelLive: KickChannelLiveService,
  ) {}

  private getPartnersBaseUrl() {
    return (
      this.config.get<string>('KICK_PARTNERS_BASE_URL')?.trim()
      || 'https://partners.imba.bet'
    ).replace(/\/$/, '');
  }

  private readKickMeta(meta: Prisma.JsonValue | null | undefined): KickPartnerMeta {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  private async resolveChannelAvatarUrl(
    partnerUserId: number,
    kick: KickPartnerMeta,
    broadcasterUserId?: number | null,
  ): Promise<string | null> {
    const cached = kick.channelAvatarUrl?.trim();
    if (cached) return cached;

    const userId = broadcasterUserId ?? kick.broadcasterUserId ?? null;
    const avatarUrl = await this.kickChannelLive.fetchUserProfilePicture(userId);
    if (!avatarUrl) return null;

    void this.writeKickMeta(partnerUserId, {
      ...kick,
      channelAvatarUrl: avatarUrl,
    }).catch((error) => {
      this.logger.warn(
        `Kick avatar cache failed for partner ${partnerUserId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return avatarUrl;
  }

  private async assertKickChannelAvailable(
    partnerUserId: number,
    channelSlug?: string | null,
  ) {
    const slug = channelSlug?.trim();
    if (!slug) return;

    const taken = await this.prisma.affilator.findFirst({
      where: {
        kickChannelSlug: { equals: slug, mode: 'insensitive' },
        NOT: { userId: partnerUserId },
        kickCredential: { isNot: null },
      },
      select: { userId: true },
    });

    if (taken) {
      throw new BadRequestException('channel_taken');
    }
  }

  private async syncKickChannelIndex(
    partnerUserId: number,
    channelSlug?: string | null,
    broadcasterUserId?: number | null,
  ) {
    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        kickChannelSlug: channelSlug?.trim() || null,
        kickBroadcasterUserId: broadcasterUserId ?? null,
      },
    });
  }

  private async writeKickMeta(partnerUserId: number, kick: KickPartnerMeta) {
    const current = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });

    const currentMeta =
      current?.meta && typeof current.meta === 'object' && !Array.isArray(current.meta)
        ? (current.meta as Record<string, unknown>)
        : {};

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: {
          ...currentMeta,
          kick,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async exchangeAuthorizationCode(code: string, codeVerifier: string) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.kickDev.getClientId(),
      client_secret: this.config.get<string>('KICK_DEV_CLIENT_SECRET')?.trim() || '',
      redirect_uri: this.kickDev.getRedirectUri(),
      code_verifier: codeVerifier,
      code,
    });

    const res = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Kick code exchange failed: ${res.status} ${text.slice(0, 300)}`);
      throw new BadRequestException('Не удалось обменять OAuth-код Kick');
    }

    return (await res.json()) as KickTokenResponse;
  }

  private async fetchOwnChannel(accessToken: string) {
    const res = await fetch('https://api.kick.com/public/v1/channels', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Kick channel fetch failed: ${res.status} ${text.slice(0, 300)}`);
      throw new BadRequestException('Не удалось получить канал Kick');
    }

    const payload = (await res.json()) as KickApiEnvelope<KickChannel[]>;
    const channel = Array.isArray(payload.data) ? payload.data[0] : null;
    if (!channel?.slug) {
      throw new BadRequestException('Kick не вернул slug канала');
    }

    return channel;
  }

  private async subscribePartnerWebhooks(accessToken: string) {
    const res = await fetch('https://api.kick.com/public/v1/events/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'webhook',
        events: [
          { name: 'livestream.status.updated', version: 1 },
          { name: 'livestream.metadata.updated', version: 1 },
          { name: 'chat.message.sent', version: 1 },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`subscribe failed: ${res.status} ${text.slice(0, 200)}`);
    }

    this.logger.log(
      `Kick webhooks subscribed (callback configured in Kick Dev portal: ${this.kickDev.getWebhookUrl()})`,
    );
  }

  async resubscribeWebhooks(partnerUserId: number) {
    const accessToken = await this.kickToken.getValidAccessToken(partnerUserId);
    if (!accessToken) {
      throw new BadRequestException('Kick не подключён или токен недействителен');
    }

    await this.subscribePartnerWebhooks(accessToken);
    return { ok: true };
  }

  async listConnectedKickPartnerIds(): Promise<number[]> {
    const partners = await this.prisma.affilator.findMany({
      where: {
        status: 'ACTIVE',
        kickChannelSlug: { not: null },
      },
      select: { userId: true, meta: true, kickChannelSlug: true, kickBroadcasterUserId: true },
    });

    const connected: number[] = [];

    for (const partner of partners) {
      const kick = this.readKickMeta(partner.meta);

      if (!partner.kickChannelSlug && kick.channelSlug) {
        await this.syncKickChannelIndex(
          partner.userId,
          kick.channelSlug,
          kick.broadcasterUserId ?? null,
        );
      }

      connected.push(partner.userId);
    }

    return connected;
  }

  async fetchPartnerChannel(partnerUserId: number) {
    const accessToken = await this.kickToken.getValidAccessToken(partnerUserId);
    if (!accessToken) return null;

    try {
      return await this.fetchOwnChannel(accessToken);
    } catch (error) {
      this.logger.warn(
        `Kick channel poll failed for partner ${partnerUserId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async countCompliantHours(partnerUserId: number) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const sessions = await this.prisma.kickPartnerSession.findMany({
      where: {
        partnerUserId,
        hadBranding: true,
        startedAt: { gte: since },
      },
      select: {
        startedAt: true,
        endedAt: true,
      },
    });

    const totalMs = sessions.reduce((acc, session) => {
      const end = session.endedAt ?? new Date();
      return acc + Math.max(0, end.getTime() - session.startedAt.getTime());
    }, 0);

    return Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
  }

  async countCompliantHoursForPartner(partnerUserId: number) {
    return this.countCompliantHours(partnerUserId);
  }

  private buildPartnerBetUrl(partnerUid: string, channelSlug?: string | null) {
    const affiliateBase = (
      this.config.get<string>('AFFILIATE_BASE_URL')?.trim() || 'https://imba.bet/'
    ).replace(/\/?$/, '/');

    const betUrl = new URL(affiliateBase);
    betUrl.searchParams.set('tag', partnerUid);
    betUrl.searchParams.set('sub1', 'kick');
    if (channelSlug) {
      betUrl.searchParams.set('sub2', channelSlug);
    }
    return betUrl.toString();
  }

  private getShortClickDomain() {
    return normalizeKickShortClickDomain(
      this.config.get<string>('KICK_SHORT_CLICK_DOMAIN'),
    );
  }

  private buildShortUrls(channelSlug?: string | null) {
    const slug = channelSlug?.trim().toLowerCase();
    if (!slug) {
      return { shortUrlKick: null, shortUrlImba: null };
    }
    const encoded = encodeURIComponent(slug);
    const clickDomain = this.getShortClickDomain();
    const shortClick = buildKickShortClickUrl(slug, clickDomain);
    return {
      shortUrlKick: `https://kick.imba.bet/go/${encoded}`,
      shortUrlImba: shortClick,
    };
  }

  private todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  private async countSessionKickRegistrations(
    partnerUserId: number,
    sessionStartedAt: Date,
  ): Promise<number> {
    const referred = await this.prisma.user.findMany({
      where: {
        affiliatedById: partnerUserId,
        createdAt: { gte: sessionStartedAt },
      },
      select: { affiliateSubs: true },
    });

    return referred.filter((row) => {
      const subs = parseAffiliateSubsJson(row.affiliateSubs);
      return subs.sub1?.toLowerCase() === 'kick';
    }).length;
  }

  private async getPartnerLiveStats(
    partnerUserId: number,
    kick: KickPartnerMeta,
  ) {
    const stats = kick.streamStats ?? {};
    const today = this.todayKey();
    const todayClicks =
      stats.todayDay === today ? (stats.todayClicks ?? 0) : 0;

    let sessionRegistrations = 0;
    if (kick.activeSessionId) {
      const session = await this.prisma.kickPartnerSession.findFirst({
        where: { id: kick.activeSessionId, partnerUserId },
        select: { startedAt: true },
      });
      if (session) {
        sessionRegistrations = await this.countSessionKickRegistrations(
          partnerUserId,
          session.startedAt,
        );
      }
    }

    return {
      sessionClicks:
        kick.activeSessionId && stats.sessionId === kick.activeSessionId
          ? (stats.sessionClicks ?? 0)
          : 0,
      sessionRegistrations,
      todayClicks,
    };
  }

  async recordShortLinkClick(partnerUserId: number) {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    if (!affiliator) return;

    const kick = this.readKickMeta(affiliator.meta);
    const today = this.todayKey();
    const streamStats = { ...(kick.streamStats ?? {}) };
    streamStats.todayClicks =
      streamStats.todayDay === today ? (streamStats.todayClicks ?? 0) + 1 : 1;
    streamStats.todayDay = today;

    if (kick.activeSessionId) {
      if (streamStats.sessionId !== kick.activeSessionId) {
        streamStats.sessionId = kick.activeSessionId;
        streamStats.sessionClicks = 1;
      } else {
        streamStats.sessionClicks = (streamStats.sessionClicks ?? 0) + 1;
      }
    }

    await this.writeKickMeta(partnerUserId, {
      ...kick,
      streamStats,
    });
  }

  async resolvePartnerByChannelSlug(slug: string) {
    const normalized = slug?.trim();
    if (!normalized) return null;

    const select = {
      uid: true,
      userId: true,
      meta: true,
      kickChannelSlug: true,
      kickBroadcasterUserId: true,
    } as const;

    const eligibleStatuses = ['ACTIVE', 'PENDING'] as const;

    const byColumn = await this.prisma.affilator.findFirst({
      where: {
        kickChannelSlug: { equals: normalized, mode: 'insensitive' },
        status: { in: [...eligibleStatuses] },
        kickCredential: { isNot: null },
      },
      select,
    });
    if (byColumn) return byColumn;

    const needle = normalized.toLowerCase();
    const candidates = await this.prisma.affilator.findMany({
      where: {
        status: { in: [...eligibleStatuses] },
        kickCredential: { isNot: null },
      },
      select,
      take: 500,
    });

    const matched =
      candidates.find((partner) => {
        const kick = this.readKickMeta(partner.meta);
        const channel = (kick.channelSlug ?? partner.kickChannelSlug ?? '').toLowerCase();
        return channel === needle;
      }) ?? null;

    if (matched && !matched.kickChannelSlug) {
      const kick = this.readKickMeta(matched.meta);
      const channelSlug = kick.channelSlug ?? normalized;
      if (channelSlug) {
        void this.syncKickChannelIndex(
          matched.userId,
          channelSlug,
          kick.broadcasterUserId ?? null,
        ).catch((error) => {
          this.logger.warn(
            `Kick channel index sync failed for partner ${matched.userId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      }
    }

    if (matched) {
      void this.ensurePartnerActive(matched.userId);
    }

    return matched;
  }

  private async ensurePartnerActive(partnerUserId: number) {
    await this.prisma.affilator.updateMany({
      where: { userId: partnerUserId, status: 'PENDING' },
      data: { status: 'ACTIVE' },
    });
  }

  async getClickLandingData(slug: string) {
    const normalized = slug?.trim();
    if (!normalized) {
      return { found: false as const, channelSlug: '' };
    }

    const partner = await this.resolvePartnerByChannelSlug(normalized);
    if (!partner) {
      return { found: false as const, channelSlug: normalized.toLowerCase() };
    }

    void this.ensurePartnerActive(partner.userId);

    const kick = this.readKickMeta(partner.meta);
    const channelSlug = kick.channelSlug ?? partner.kickChannelSlug ?? normalized;
    const promo = await this.prisma.promo.findFirst({
      where: { partnerId: String(partner.userId) },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    const snapshot = await this.kickChannelLive
      .fetchPublicChannelSnapshot(channelSlug)
      .catch(() => null);

    let channelAvatarUrl = snapshot?.avatarUrl ?? null;
    if (!channelAvatarUrl) {
      channelAvatarUrl = await this.resolveChannelAvatarUrl(
        partner.userId,
        kick,
        kick.broadcasterUserId ?? partner.kickBroadcasterUserId,
      );
    } else if (channelAvatarUrl !== kick.channelAvatarUrl) {
      void this.writeKickMeta(partner.userId, {
        ...kick,
        channelAvatarUrl,
      }).catch(() => undefined);
    }

    const isLive = snapshot?.isLive ?? Boolean(kick.isLive);
    const streamTitle =
      (isLive ? snapshot?.streamTitle : null) ?? kick.streamTitle ?? null;

    return {
      found: true as const,
      channelSlug,
      channelTitle: kick.channelTitle ?? null,
      channelAvatarUrl,
      channelDisplayName: snapshot?.displayName ?? null,
      channelBannerUrl: snapshot?.bannerUrl ?? null,
      channelDescription: snapshot?.description ?? null,
      categoryName: isLive ? snapshot?.categoryName ?? null : null,
      streamThumbnail: isLive ? snapshot?.streamThumbnail ?? null : null,
      viewerCount: isLive ? snapshot?.viewerCount ?? null : null,
      isLive,
      streamTitle,
      promoCode: promo?.code ?? null,
      redirectUrl: this.buildPartnerBetUrl(partner.uid, channelSlug),
    };
  }

  async handleShortRedirect(slug: string): Promise<string | null> {
    const partner = await this.resolvePartnerByChannelSlug(slug);
    if (!partner) return null;

    const kick = this.readKickMeta(partner.meta);
    const channelSlug = kick.channelSlug ?? partner.kickChannelSlug ?? slug;

    void this.recordShortLinkClick(partner.userId).catch((error) => {
      this.logger.warn(
        `Kick short link click record failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return this.buildPartnerBetUrl(partner.uid, channelSlug);
  }

  private emptyWidget(tag: string): KickPartnerWidgetDto {
    return {
      found: false,
      partnerTag: tag,
      channelSlug: null,
      isLive: false,
      viewerCount: null,
      streamTitle: null,
      betUrl: 'https://imba.bet/',
      promoCode: null,
      widgetUrl: '',
      shortUrlKick: null,
      shortUrlImba: null,
      liveStats: null,
      viewerOffer: null,
      streamRace: null,
      guessContest: null,
    };
  }

  private async buildWidgetDto(
    partner: { uid: string; userId: number; meta: Prisma.JsonValue | null },
  ): Promise<KickPartnerWidgetDto> {
    const kick = this.readKickMeta(partner.meta);
    const slug = kick.channelSlug ?? null;
    const promo = await this.prisma.promo.findFirst({
      where: { partnerId: String(partner.userId) },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    const partnersBase = this.getPartnersBaseUrl();
    const widgetUrl = `${partnersBase}/widget/${partner.uid}`;
    const shortUrls = this.buildShortUrls(slug);
    const liveStats = slug
      ? await this.getPartnerLiveStats(partner.userId, kick)
      : null;
    const promoCode = promo?.code ?? null;
    const streamRace = slug
      ? await this.kickStreamRace.getSessionRaceProgress(partner.userId, kick)
      : null;
    const guessContest = slug
      ? await this.guessContest.getContestState(partner.userId)
      : null;

    return {
      found: true,
      partnerTag: partner.uid,
      channelSlug: slug,
      isLive: Boolean(kick.isLive && slug),
      viewerCount: kick.viewerCount ?? null,
      streamTitle: kick.streamTitle ?? kick.channelTitle ?? null,
      betUrl: this.buildPartnerBetUrl(partner.uid, slug),
      promoCode,
      widgetUrl,
      shortUrlKick: shortUrls.shortUrlKick,
      shortUrlImba: shortUrls.shortUrlImba,
      liveStats,
      viewerOffer: slug
        ? {
            streamerLabel: `@${slug}`,
            promoCode,
            headline: promoCode
              ? `${KICK_VIEWER_OFFER_HEADLINE}: ${promoCode}`
              : KICK_VIEWER_OFFER_HEADLINE,
          }
        : null,
      streamRace,
      guessContest: guessContest?.active ? guessContest : null,
    };
  }

  async getPartnerByTag(tag: string): Promise<KickPartnerWidgetDto> {
    const normalizedTag = tag?.trim();
    if (!normalizedTag || !/^[0-9a-f-]{36}$/i.test(normalizedTag)) {
      return this.emptyWidget(normalizedTag || '');
    }

    const partner = await this.prisma.affilator.findFirst({
      where: { uid: normalizedTag, status: 'ACTIVE' },
      select: { uid: true, userId: true, meta: true },
    });

    if (!partner) {
      return this.emptyWidget(normalizedTag);
    }

    const dto = await this.buildWidgetDto(partner);
    if (!dto.found || !dto.channelSlug) {
      return dto;
    }

    const kick = this.readKickMeta(partner.meta);
    const snapshot = await this.kickChannelLive
      .fetchPublicChannelSnapshot(dto.channelSlug)
      .catch(() => null);

    if (!snapshot) {
      return {
        ...dto,
        channelAvatarUrl: kick.channelAvatarUrl ?? null,
        channelDisplayName: null,
      };
    }

    return {
      ...dto,
      channelAvatarUrl: snapshot.avatarUrl ?? kick.channelAvatarUrl ?? null,
      channelDisplayName: snapshot.displayName ?? null,
      isLive: snapshot.isLive,
      viewerCount: snapshot.isLive ? snapshot.viewerCount : dto.viewerCount,
      streamTitle: snapshot.streamTitle ?? dto.streamTitle,
      viewerOffer: dto.viewerOffer
        ? {
            ...dto.viewerOffer,
            streamerLabel: snapshot.displayName
              ? `@${snapshot.displayName}`
              : dto.viewerOffer.streamerLabel,
          }
        : null,
    };
  }

  async getLivePartners(): Promise<KickLivePartnerDto[]> {
    const partners = await this.prisma.affilator.findMany({
      where: { status: 'ACTIVE' },
      select: { uid: true, meta: true },
    });

    const live: KickLivePartnerDto[] = [];
    for (const partner of partners) {
      const kick = this.readKickMeta(partner.meta);
      if (!kick.isLive || !kick.channelSlug) continue;

      const slug = kick.channelSlug;

      live.push({
        partnerTag: partner.uid,
        channelSlug: slug,
        streamTitle: kick.streamTitle ?? kick.channelTitle ?? null,
        viewerCount: kick.viewerCount ?? null,
        hasBranding: Boolean(kick.hasBranding),
        kickUrl: `https://kick.com/${encodeURIComponent(slug)}`,
        betUrl: this.buildPartnerBetUrl(partner.uid, slug),
      });
    }

    return live.sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0));
  }

  async getTabloStreams(limit = 12): Promise<KickTabloStreamItem[]> {
    const partners = await this.prisma.affilator.findMany({
      where: {
        status: 'ACTIVE',
        kickChannelSlug: { not: null },
      },
      select: { uid: true, meta: true, kickChannelSlug: true },
    });

    const items: KickTabloStreamItem[] = [];

    for (const partner of partners) {
      const kick = this.readKickMeta(partner.meta);
      const slug = kick.channelSlug ?? partner.kickChannelSlug;
      if (!slug) continue;

      const shortUrls = this.buildShortUrls(slug);
      const isLive = Boolean(kick.isLive && slug);

      items.push({
        partnerTag: partner.uid,
        channelSlug: slug,
        streamTitle: kick.streamTitle ?? kick.channelTitle ?? null,
        viewerCount: kick.viewerCount ?? null,
        isLive,
        hasBranding: Boolean(kick.hasBranding),
        kickUrl: `https://kick.com/${encodeURIComponent(slug)}`,
        betUrl: this.buildPartnerBetUrl(partner.uid, slug),
        shortUrl: shortUrls.shortUrlImba,
      });
    }

    return items
      .sort((a, b) => {
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        return (b.viewerCount ?? 0) - (a.viewerCount ?? 0);
      })
      .slice(0, Math.min(Math.max(limit, 1), 24));
  }

  async getPublicKickStats() {
    const board = await this.getPublicScoreboard();
    return {
      connectedCount: board.connectedCount,
      liveCount: board.liveCount,
      liveChannels: board.livePartners.map((item) => item.channelSlug),
      weekKickRegistrations: board.weekKickRegistrations,
      monthPayoutsUsd: board.monthPayoutsUsd,
      channelOfWeek: board.channelOfWeek?.channelSlug ?? null,
      monthSprint: board.monthSprint,
    };
  }

  private async sumKickPartnerPayoutsSince(since: Date): Promise<number> {
    const partners = await this.prisma.affilator.findMany({
      where: { kickChannelSlug: { not: null } },
      select: { userId: true },
    });
    if (partners.length === 0) return 0;

    const result = await this.prisma.operation.aggregate({
      where: {
        userId: { in: partners.map((p) => p.userId) },
        source: OperationSource.AFFILIATE,
        status: OperationStatus.SUCCESS,
        currencyCode: KICK_PARTNER_CURRENCY,
        type: OperationType.INCOME,
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });

    return Math.round((result._sum.amount?.toNumber() ?? 0) * 100) / 100;
  }

  private async countKickRegistrationsSince(since: Date) {
    const referred = await this.prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { affiliatedById: true, affiliateSubs: true },
    });

    return referred.filter((row) => {
      if (!row.affiliatedById) return false;
      const subs = parseAffiliateSubsJson(row.affiliateSubs);
      return subs.sub1?.toLowerCase() === 'kick';
    }).length;
  }

  private async sumTodayClicksAllPartners() {
    const today = this.todayKey();
    const partners = await this.prisma.affilator.findMany({
      where: { kickChannelSlug: { not: null } },
      select: { meta: true },
    });

    let total = 0;
    for (const partner of partners) {
      const kick = this.readKickMeta(partner.meta);
      const stats = kick.streamStats;
      if (stats?.todayDay === today) {
        total += stats.todayClicks ?? 0;
      }
    }
    return total;
  }

  async getKickLeaderboard(periodDays = 7) {
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    const partners = await this.prisma.affilator.findMany({
      where: { kickChannelSlug: { not: null }, status: 'ACTIVE' },
      select: { userId: true, uid: true, meta: true, kickChannelSlug: true },
    });

    const referred = await this.prisma.user.findMany({
      where: { createdAt: { gte: since }, affiliatedById: { not: null } },
      select: { affiliatedById: true, affiliateSubs: true, id: true },
    });

    const deposits =
      referred.length > 0
        ? await this.prisma.deposit.findMany({
            where: {
              userId: { in: referred.map((row) => row.id) },
              status: DepositStatus.SUCCESS,
            },
            select: { userId: true },
            orderBy: { createdAt: 'asc' },
          })
        : [];

    const ftdUsers = new Set<number>();
    for (const deposit of deposits) {
      if (!ftdUsers.has(deposit.userId)) ftdUsers.add(deposit.userId);
    }

    const stats = new Map<
      number,
      { kickRegistrations: number; kickFtd: number; kickPlayerIds: number[] }
    >();

    for (const row of referred) {
      if (!row.affiliatedById) continue;
      const subs = parseAffiliateSubsJson(row.affiliateSubs);
      if (subs.sub1?.toLowerCase() !== 'kick') continue;

      const current = stats.get(row.affiliatedById) ?? {
        kickRegistrations: 0,
        kickFtd: 0,
        kickPlayerIds: [],
      };
      current.kickRegistrations += 1;
      current.kickPlayerIds.push(row.id);
      if (ftdUsers.has(row.id)) current.kickFtd += 1;
      stats.set(row.affiliatedById, current);
    }

    const partnerIds = partners.map((p) => p.userId);
    const earningsOps =
      partnerIds.length > 0
        ? await this.prisma.operation.findMany({
            where: {
              userId: { in: partnerIds },
              source: OperationSource.AFFILIATE,
              status: OperationStatus.SUCCESS,
              currencyCode: KICK_PARTNER_CURRENCY,
              type: OperationType.INCOME,
              createdAt: { gte: since },
            },
            select: { userId: true, amount: true, meta: true },
          })
        : [];

    const earningsByPartner = new Map<number, number>();
    for (const op of earningsOps) {
      const meta = (op.meta ?? {}) as Record<string, unknown>;
      if (meta.bonusType === KICK_CONNECT_BONUS_TYPE) continue;
      const playerId =
        typeof meta.originalUserId === 'number' ? meta.originalUserId : null;
      const partnerStats = stats.get(op.userId);
      if (playerId != null && partnerStats && !partnerStats.kickPlayerIds.includes(playerId)) {
        continue;
      }
      earningsByPartner.set(
        op.userId,
        (earningsByPartner.get(op.userId) ?? 0) + op.amount.toNumber(),
      );
    }

    const items = partners
      .map((partner) => {
        const kick = this.readKickMeta(partner.meta);
        const channelSlug = kick.channelSlug ?? partner.kickChannelSlug ?? '';
        const row = stats.get(partner.userId) ?? {
          kickRegistrations: 0,
          kickFtd: 0,
          kickPlayerIds: [],
        };
        const earningsUsd =
          Math.round((earningsByPartner.get(partner.userId) ?? 0) * 100) / 100;
        return {
          channelSlug,
          partnerTag: partner.uid,
          kickRegistrations: row.kickRegistrations,
          kickFtd: row.kickFtd,
          earningsUsd,
          isLive: Boolean(kick.isLive && channelSlug),
          viewerCount: kick.viewerCount ?? null,
        };
      })
      .filter((item) => item.channelSlug)
      .sort((a, b) => {
        if (b.earningsUsd !== a.earningsUsd) return b.earningsUsd - a.earningsUsd;
        if (b.kickRegistrations !== a.kickRegistrations) {
          return b.kickRegistrations - a.kickRegistrations;
        }
        return b.kickFtd - a.kickFtd;
      })
      .slice(0, 10)
      .map((item, index) => ({ rank: index + 1, ...item }));

    return items;
  }

  async getPublicScoreboard(): Promise<KickPublicScoreboardDto> {
    const sinceDay = new Date();
    sinceDay.setHours(0, 0, 0, 0);
    const sinceWeek = new Date();
    sinceWeek.setDate(sinceWeek.getDate() - 7);

    const [connectedCount, live, streams, todayKickRegistrations, weekKickRegistrations, todayClicks, leaderboard] =
      await Promise.all([
        this.prisma.affilator.count({
          where: { kickChannelSlug: { not: null } },
        }),
        this.getLivePartners(),
        this.getTabloStreams(12),
        this.countKickRegistrationsSince(sinceDay),
        this.countKickRegistrationsSince(sinceWeek),
        this.sumTodayClicksAllPartners(),
        this.getKickLeaderboard(7),
      ]);

    const weekEndsAt = new Date();
    const day = weekEndsAt.getDay();
    weekEndsAt.setDate(weekEndsAt.getDate() + (day === 0 ? 0 : 7 - day));
    weekEndsAt.setHours(23, 59, 59, 999);

    const sinceMonth = new Date();
    sinceMonth.setDate(sinceMonth.getDate() - 30);

    const channelOfWeek =
      leaderboard.find((item) => item.kickRegistrations > 0 || item.earningsUsd > 0) ?? null;

    const [monthPayoutsUsd, monthSprint] = await Promise.all([
      this.sumKickPartnerPayoutsSince(sinceMonth),
      this.kickMonthSprint.getCurrentStanding(),
    ]);

    return {
      connectedCount,
      liveCount: live.length,
      todayKickRegistrations,
      weekKickRegistrations,
      todayClicks,
      streams,
      topWeek: leaderboard.slice(0, 5),
      livePartners: live.slice(0, 8).map((item) => ({
        channelSlug: item.channelSlug,
        partnerTag: item.partnerTag,
        streamTitle: item.streamTitle,
        viewerCount: item.viewerCount,
        kickUrl: item.kickUrl,
      })),
      liveCollab:
        live.length >= 2
          ? {
              active: true,
              count: live.length,
              hint: 'Несколько партнёров в эфире — стримьте один матч вместе и перегоняйте аудиторию',
              partners: live.slice(0, 4).map((item) => ({
                channelSlug: item.channelSlug,
                partnerTag: item.partnerTag,
                kickUrl: item.kickUrl,
              })),
            }
          : null,
      leaderboard,
      weeklyChallenge: {
        goal: KICK_WEEKLY_CHALLENGE_GOAL,
        bonusUsd: KICK_WEEKLY_CHALLENGE_BONUS_USD,
        weekEndsAt: weekEndsAt.toISOString(),
        topProgress: leaderboard[0]?.kickRegistrations ?? 0,
      },
      channelOfWeek,
      monthPayoutsUsd,
      monthSprint,
    };
  }

  async getSessionLiveStats(partnerUserId: number): Promise<KickSessionLiveStatsDto> {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    const kick = this.readKickMeta(affiliator?.meta ?? null);

    const session = kick.activeSessionId
      ? await this.prisma.kickPartnerSession.findFirst({
          where: { id: kick.activeSessionId, partnerUserId },
        })
      : await this.prisma.kickPartnerSession.findFirst({
          where: { partnerUserId, endedAt: null },
          orderBy: { startedAt: 'desc' },
        });

    if (!session) {
      const streak = await this.kickStreak.getStreakProgress(partnerUserId);
      return {
        active: false,
        sessionId: null,
        startedAt: null,
        clicks: 0,
        registrations: 0,
        ftd: 0,
        commissionUsd: 0,
        streamTitle: null,
        peakViewers: 0,
        streamRace: null,
        streak,
        guessContest: null,
      };
    }

    const [liveStats, streamRace, streak, guessContest] = await Promise.all([
      this.getPartnerLiveStats(partnerUserId, {
        ...kick,
        activeSessionId: session.id,
      }),
      this.kickStreamRace.getSessionRaceProgress(partnerUserId, {
        ...kick,
        activeSessionId: session.id,
      }),
      this.kickStreak.getStreakProgress(partnerUserId),
      this.guessContest.getContestState(partnerUserId),
    ]);

    const referred = await this.prisma.user.findMany({
      where: {
        affiliatedById: partnerUserId,
        createdAt: { gte: session.startedAt },
      },
      select: { id: true, affiliateSubs: true },
    });

    const kickPlayers = referred.filter((row) => {
      const subs = parseAffiliateSubsJson(row.affiliateSubs);
      return subs.sub1?.toLowerCase() === 'kick';
    });
    const kickPlayerIds = kickPlayers.map((p) => p.id);

    let ftd = 0;
    if (kickPlayerIds.length > 0) {
      const deposits = await this.prisma.deposit.findMany({
        where: {
          userId: { in: kickPlayerIds },
          status: DepositStatus.SUCCESS,
          createdAt: { gte: session.startedAt },
        },
        select: { userId: true },
        orderBy: { createdAt: 'asc' },
      });
      const seen = new Set<number>();
      for (const dep of deposits) {
        if (!seen.has(dep.userId)) {
          seen.add(dep.userId);
          ftd += 1;
        }
      }
    }

    let commissionUsd = 0;
    if (kickPlayerIds.length > 0) {
      const ops = await this.prisma.operation.findMany({
        where: {
          userId: partnerUserId,
          source: OperationSource.AFFILIATE,
          status: OperationStatus.SUCCESS,
          currencyCode: KICK_PARTNER_CURRENCY,
          type: OperationType.INCOME,
          createdAt: { gte: session.startedAt },
        },
        select: { amount: true, meta: true },
      });
      for (const op of ops) {
        const meta = (op.meta ?? {}) as Record<string, unknown>;
        if (meta.bonusType === KICK_CONNECT_BONUS_TYPE) continue;
        const playerId =
          typeof meta.originalUserId === 'number' ? meta.originalUserId : null;
        if (playerId != null && !kickPlayerIds.includes(playerId)) continue;
        commissionUsd += op.amount.toNumber();
      }
    }

    return {
      active: !session.endedAt,
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
      clicks: liveStats.sessionClicks,
      registrations: liveStats.sessionRegistrations,
      ftd,
      commissionUsd: Math.round(commissionUsd * 100) / 100,
      streamTitle: session.lastStreamTitle ?? kick.streamTitle ?? null,
      peakViewers: session.peakViewers,
      streamRace,
      streak,
      guessContest: guessContest.active ? guessContest : null,
    };
  }

  async getPartnerSessions(partnerUserId: number, limit = 20) {
    const sessions = await this.prisma.kickPartnerSession.findMany({
      where: { partnerUserId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return sessions.map((session) => ({
      id: session.id,
      kickChannel: session.kickChannel,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      peakViewers: session.peakViewers,
      hadBranding: session.hadBranding,
      lastStreamTitle: session.lastStreamTitle,
      durationMinutes: session.endedAt
        ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000)
        : null,
    }));
  }

  async listKickPartnersForAdmin(limit = 200): Promise<{
    total: number;
    liveCount: number;
    connectedCount: number;
    items: KickPartnerAdminItem[];
  }> {
    const partners = await this.prisma.affilator.findMany({
      select: {
        userId: true,
        uid: true,
        status: true,
        meta: true,
        kickChannelSlug: true,
        user: { select: { email: true } },
        _count: { select: { kickSessions: true } },
      },
      orderBy: { userId: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });

    const items: KickPartnerAdminItem[] = [];

    for (const partner of partners) {
      const kick = this.readKickMeta(partner.meta);
      const connected = Boolean(partner.kickChannelSlug && kick.channelSlug);
      if (!connected && !kick.channelSlug && partner._count.kickSessions === 0) {
        continue;
      }

      const compliantHours30d = connected
        ? await this.countCompliantHours(partner.userId)
        : 0;
      const connectBonusPaid = connected
        ? await this.kickConnectBonus.getConnectBonusTotal(partner.userId)
        : 0;
      const lastSession = await this.prisma.kickPartnerSession.findFirst({
        where: { partnerUserId: partner.userId },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });

      items.push({
        userId: partner.userId,
        email: partner.user.email,
        uid: partner.uid,
        affilatorStatus: partner.status,
        connected,
        channelSlug: kick.channelSlug ?? null,
        channelTitle: kick.channelTitle ?? null,
        connectedAt: kick.connectedAt ?? null,
        isLive: Boolean(kick.isLive && kick.channelSlug),
        viewerCount: kick.viewerCount ?? null,
        streamTitle: kick.streamTitle ?? kick.channelTitle ?? null,
        hasBranding: Boolean(kick.hasBranding),
        compliantHours30d,
        tokenExpiresAt: kick.tokenExpiresAt ?? null,
        tokenRefreshFailedAt: kick.tokenRefreshFailedAt ?? null,
        sessionsCount: partner._count.kickSessions,
        registrationBonusPaid: connectBonusPaid,
        activationCount: connectBonusPaid > 0 ? 1 : 0,
        onboardingComplete: Boolean(
          kick.onboarding?.linkDone && kick.onboarding?.obsDone,
        ),
        lastSessionAt: lastSession?.startedAt.toISOString() ?? null,
      });
    }

    items.sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      return b.compliantHours30d - a.compliantHours30d;
    });

    return {
      total: items.length,
      liveCount: items.filter((item) => item.isLive).length,
      connectedCount: items.filter((item) => item.connected).length,
      items,
    };
  }

  async listRecentKickSessionsForAdmin(limit = 50): Promise<KickPartnerAdminSessionItem[]> {
    const sessions = await this.prisma.kickPartnerSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        partner: {
          select: {
            uid: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      partnerUserId: session.partnerUserId,
      partnerEmail: session.partner.user.email,
      partnerTag: session.partner.uid,
      kickChannel: session.kickChannel,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      peakViewers: session.peakViewers,
      hadBranding: session.hadBranding,
      lastStreamTitle: session.lastStreamTitle,
      durationMinutes: session.endedAt
        ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000)
        : null,
    }));
  }

  async startConnect(partnerUserId: number) {
    if (!this.kickDev.isConfigured()) {
      throw new ServiceUnavailableException('Kick Dev не настроен на сервере');
    }

    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = await this.jwtService.signAsync(
      {
        purpose: 'kick_connect',
        partnerUserId,
        codeVerifier,
      } satisfies KickOAuthStatePayload,
      { expiresIn: '15m' },
    );

    return {
      authorizeUrl: buildKickAuthorizeUrl({
        clientId: this.kickDev.getClientId(),
        redirectUri: this.kickDev.getRedirectUri(),
        state,
        codeChallenge,
        scopes: KICK_OAUTH_SCOPES,
      }),
    };
  }

  async completeOAuth(params: {
    code?: string;
    state?: string;
    error?: string;
  }) {
    const partnersBase = this.getPartnersBaseUrl();
    const successUrl = `${partnersBase}/profile/stream?kick=connected`;
    const errorUrl = `${partnersBase}/profile/stream?kick=error`;

    if (params.error) {
      return { redirectTo: `${errorUrl}&reason=${encodeURIComponent(params.error)}` };
    }

    if (!params.code || !params.state) {
      return { redirectTo: `${errorUrl}&reason=missing_code` };
    }

    let payload: KickOAuthStatePayload;
    try {
      payload = await this.jwtService.verifyAsync<KickOAuthStatePayload>(params.state);
    } catch {
      return { redirectTo: `${errorUrl}&reason=invalid_state` };
    }

    if (payload.purpose !== 'kick_connect' || !payload.partnerUserId || !payload.codeVerifier) {
      return { redirectTo: `${errorUrl}&reason=invalid_state` };
    }

    try {
      const tokens = await this.exchangeAuthorizationCode(params.code, payload.codeVerifier);
      if (!tokens.access_token) {
        return { redirectTo: `${errorUrl}&reason=no_access_token` };
      }

      const channel = await this.fetchOwnChannel(tokens.access_token);

      await this.assertKickChannelAvailable(
        payload.partnerUserId,
        channel.slug ?? null,
      );

      await this.kickCredential.saveFromOAuthResponse(payload.partnerUserId, tokens);

      const channelAvatarUrl = await this.kickChannelLive.fetchUserProfilePicture(
        channel.broadcaster_user_id ?? null,
      );

      await this.writeKickMeta(payload.partnerUserId, {
        channelSlug: channel.slug ?? null,
        channelTitle: channel.stream_title ?? channel.stream?.title ?? null,
        channelAvatarUrl,
        broadcasterUserId: channel.broadcaster_user_id ?? null,
        connectedAt: new Date().toISOString(),
        tokenExpiresAt: buildKickTokenMetaPatch(tokens).tokenExpiresAt ?? null,
        isLive: Boolean(channel.stream?.is_live),
        viewerCount: channel.stream?.viewer_count ?? null,
        streamTitle: channel.stream?.title ?? channel.stream_title ?? null,
        hasBranding: false,
        activeSessionId: null,
        tokenRefreshFailedAt: null,
      });

      await this.syncKickChannelIndex(
        payload.partnerUserId,
        channel.slug ?? null,
        channel.broadcaster_user_id ?? null,
      );

      await this.ensurePartnerActive(payload.partnerUserId);

      void this.subscribePartnerWebhooks(tokens.access_token).catch((error) => {
        this.logger.warn(
          `Kick webhook subscribe failed for partner ${payload.partnerUserId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });

      void this.kickConnectBonus.grantOnFirstConnect(payload.partnerUserId).catch((error) => {
        this.logger.warn(
          `Kick connect bonus failed for partner ${payload.partnerUserId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });

      return { redirectTo: successUrl };
    } catch (error) {
      if (error instanceof BadRequestException && error.message === 'channel_taken') {
        return { redirectTo: `${errorUrl}&reason=channel_taken` };
      }
      this.logger.warn(
        `Kick OAuth completion failed for partner ${payload.partnerUserId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { redirectTo: `${errorUrl}&reason=exchange_failed` };
    }
  }

  async getStatus(partnerUserId: number): Promise<KickPartnerPublicStatus> {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true, kickChannelSlug: true },
    });

    const kick = this.readKickMeta(affiliator?.meta ?? null);
    if (kick.channelSlug && !affiliator?.kickChannelSlug) {
      void this.syncKickChannelIndex(
        partnerUserId,
        kick.channelSlug,
        kick.broadcasterUserId ?? null,
      ).catch(() => undefined);
    }

    const connected = Boolean(
      kick.channelSlug && (await this.kickCredential.hasCredentials(partnerUserId)),
    );
    if (connected) {
      void this.ensurePartnerActive(partnerUserId);
    }

    const tokenRefreshFailedAt = connected
      ? await this.kickCredential.getTokenRefreshFailedAt(partnerUserId)
      : null;
    const compliantHours30d = connected
      ? await this.countCompliantHours(partnerUserId)
      : 0;
    const [connectBonusGranted, referralsCount] = await Promise.all([
      connected ? this.kickConnectBonus.hasConnectBonus(partnerUserId) : Promise.resolve(false),
      this.kickConnectBonus.countPartnerReferrals(partnerUserId),
    ]);
    const connectBonusLocked = connectBonusGranted && referralsCount === 0;
    const welcomeProgress = await this.kickConnectBonus.buildWelcomeProgress(
      partnerUserId,
      connected,
      connectBonusGranted,
      referralsCount,
    );

    if (!connected) {
      return {
        connected: false,
        configured: this.kickDev.isConfigured(),
        channelSlug: null,
        channelTitle: null,
        connectedAt: null,
        isLive: null,
        viewerCount: null,
        streamTitle: null,
        hasBranding: null,
        compliantHours30d: 0,
        tokenRefreshFailedAt: null,
        activeSessionId: null,
        connectBonusGranted: false,
        connectBonusLocked: false,
        referralsCount,
        welcomeProgress,
        onboarding: { linkDone: false, obsDone: false },
      };
    }

    try {
      const accessToken = await this.kickToken.getValidAccessToken(partnerUserId);
      if (!accessToken) {
        throw new Error('no valid access token');
      }

      const channel = await this.fetchOwnChannel(accessToken);
      return {
        connected: true,
        configured: this.kickDev.isConfigured(),
        channelSlug: channel.slug ?? kick.channelSlug ?? null,
        channelTitle: channel.stream_title ?? kick.channelTitle ?? null,
        connectedAt: kick.connectedAt ?? null,
        isLive: kick.isLive ?? Boolean(channel.stream?.is_live),
        viewerCount: kick.viewerCount ?? channel.stream?.viewer_count ?? null,
        streamTitle: kick.streamTitle ?? channel.stream?.title ?? channel.stream_title ?? null,
        hasBranding: kick.hasBranding ?? null,
        compliantHours30d,
        tokenRefreshFailedAt,
        activeSessionId: kick.activeSessionId ?? null,
        connectBonusGranted,
        connectBonusLocked,
        referralsCount,
        welcomeProgress,
        onboarding: {
          linkDone: Boolean(kick.onboarding?.linkDone),
          obsDone: Boolean(kick.onboarding?.obsDone),
        },
      };
    } catch {
      return {
        connected: true,
        configured: this.kickDev.isConfigured(),
        channelSlug: kick.channelSlug ?? null,
        channelTitle: kick.channelTitle ?? null,
        connectedAt: kick.connectedAt ?? null,
        isLive: kick.isLive ?? null,
        viewerCount: kick.viewerCount ?? null,
        streamTitle: kick.streamTitle ?? null,
        hasBranding: kick.hasBranding ?? null,
        compliantHours30d,
        tokenRefreshFailedAt,
        activeSessionId: kick.activeSessionId ?? null,
        connectBonusGranted,
        connectBonusLocked,
        referralsCount,
        welcomeProgress,
        onboarding: {
          linkDone: Boolean(kick.onboarding?.linkDone),
          obsDone: Boolean(kick.onboarding?.obsDone),
        },
      };
    }
  }

  async updateOnboardingChecklist(
    partnerUserId: number,
    patch: { linkDone?: boolean; obsDone?: boolean },
  ) {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    if (!affiliator) throw new BadRequestException('Партнёр не найден');

    const kick = this.readKickMeta(affiliator.meta);
    const onboarding = { ...(kick.onboarding ?? {}) };
    const now = new Date().toISOString();

    if (typeof patch.linkDone === 'boolean') {
      onboarding.linkDone = patch.linkDone;
      onboarding.linkDoneAt = patch.linkDone ? now : null;
    }
    if (typeof patch.obsDone === 'boolean') {
      onboarding.obsDone = patch.obsDone;
      onboarding.obsDoneAt = patch.obsDone ? now : null;
    }

    await this.writeKickMeta(partnerUserId, { ...kick, onboarding });

    return {
      ok: true,
      onboarding: {
        linkDone: Boolean(onboarding.linkDone),
        obsDone: Boolean(onboarding.obsDone),
      },
    };
  }

  async getKickAnalytics(
    partnerUserId: number,
    currencyCode = KICK_PARTNER_CURRENCY,
  ): Promise<KickPartnerAnalyticsDto> {
    const periodDays = 30;
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    const [sessions, referred] = await Promise.all([
      this.prisma.kickPartnerSession.findMany({
        where: { partnerUserId, startedAt: { gte: since } },
        select: {
          startedAt: true,
          endedAt: true,
          peakViewers: true,
          hadBranding: true,
        },
      }),
      this.prisma.user.findMany({
        where: { affiliatedById: partnerUserId },
        select: { id: true, createdAt: true, affiliateSubs: true },
      }),
    ]);

    const userIds = referred.map((user) => user.id);
    const deposits =
      userIds.length > 0
        ? await this.prisma.deposit.findMany({
            where: { userId: { in: userIds }, status: DepositStatus.SUCCESS },
            select: { userId: true },
            orderBy: { createdAt: 'asc' },
          })
        : [];

    const ftdUsers = new Set<number>();
    for (const deposit of deposits) {
      if (!ftdUsers.has(deposit.userId)) ftdUsers.add(deposit.userId);
    }

    const commissionOps = await this.prisma.operation.findMany({
      where: {
        userId: partnerUserId,
        source: OperationSource.AFFILIATE,
        status: OperationStatus.SUCCESS,
        currencyCode,
      },
      select: { amount: true, type: true, meta: true },
    });

    const commissionByPlayer = new Map<number, number>();
    let connectBonus = 0;
    for (const op of commissionOps) {
      const meta = (op.meta ?? {}) as Record<string, unknown>;
      const signed =
        op.type === OperationType.INCOME
          ? op.amount.toNumber()
          : -op.amount.toNumber();

      if (meta.bonusType === KICK_CONNECT_BONUS_TYPE) {
        connectBonus += signed;
        continue;
      }

      const playerId =
        typeof meta.originalUserId === 'number' ? meta.originalUserId : null;
      if (playerId == null) continue;
      commissionByPlayer.set(
        playerId,
        (commissionByPlayer.get(playerId) ?? 0) + signed,
      );
    }

    let kickRegistrations = 0;
    let kickFtd = 0;
    let kickCommission = 0;
    let duringLiveRegistrations = 0;
    let duringLiveFtd = 0;
    const byChannel = new Map<string, { registrations: number; ftd: number }>();

    for (const user of referred) {
      const subs = parseAffiliateSubsJson(user.affiliateSubs);
      if (subs.sub1?.toLowerCase() !== 'kick') continue;

      kickRegistrations += 1;
      if (ftdUsers.has(user.id)) kickFtd += 1;
      kickCommission += commissionByPlayer.get(user.id) ?? 0;

      const channelLabel = subs.sub2?.trim() || '(без канала)';
      const channelRow = byChannel.get(channelLabel) ?? { registrations: 0, ftd: 0 };
      channelRow.registrations += 1;
      if (ftdUsers.has(user.id)) channelRow.ftd += 1;
      byChannel.set(channelLabel, channelRow);

      const registeredAt = user.createdAt.getTime();
      const duringLive = sessions.some((session) => {
        const start = session.startedAt.getTime();
        const end = session.endedAt?.getTime() ?? Date.now();
        return registeredAt >= start && registeredAt <= end;
      });
      if (duringLive) {
        duringLiveRegistrations += 1;
        if (ftdUsers.has(user.id)) duringLiveFtd += 1;
      }
    }

    const compliantHours30d = await this.countCompliantHours(partnerUserId);

    return {
      periodDays,
      currencyCode,
      kickTraffic: {
        registrations: kickRegistrations,
        ftd: kickFtd,
        commission: Math.round(kickCommission * 100) / 100,
        connectBonus: Math.round(connectBonus * 100) / 100,
        connectBonusGranted: connectBonus > 0,
        conversionPct:
          kickRegistrations > 0
            ? Math.round((kickFtd / kickRegistrations) * 10000) / 100
            : 0,
      },
      duringLive: {
        registrations: duringLiveRegistrations,
        ftd: duringLiveFtd,
      },
      sessions30d: {
        count: sessions.length,
        compliantHours: compliantHours30d,
        totalPeakViewers: sessions.reduce((acc, session) => acc + session.peakViewers, 0),
        brandedSessions: sessions.filter((session) => session.hadBranding).length,
      },
      byChannel: [...byChannel.entries()]
        .map(([channel, stats]) => ({
          channel,
          registrations: stats.registrations,
          ftd: stats.ftd,
        }))
        .sort((a, b) => b.registrations - a.registrations),
    };
  }

  async disconnect(partnerUserId: number) {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });

    const currentMeta =
      affiliator?.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
        ? (affiliator.meta as Record<string, unknown>)
        : {};

    const { kick: _removed, ...rest } = currentMeta;

    await this.prisma.kickPartnerSession.updateMany({
      where: { partnerUserId, endedAt: null },
      data: { endedAt: new Date() },
    });

    await this.kickCredential.deleteCredentials(partnerUserId);

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: rest as Prisma.InputJsonValue,
        kickChannelSlug: null,
        kickBroadcasterUserId: null,
      },
    });

    return { ok: true };
  }
}
