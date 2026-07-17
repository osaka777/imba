import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type KickTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type KickChannelRow = {
  slug?: string;
  channel_description?: string | null;
  banner_picture?: string | null;
  broadcaster_user_id?: number;
  stream_title?: string | null;
  stream?: {
    is_live?: boolean;
    viewer_count?: number;
    title?: string | null;
    thumbnail?: string | null;
    language?: string | null;
  } | null;
  category?: { id?: number; name?: string | null; thumbnail?: string | null } | null;
};

const STATUS_TTL_MS = 30_000;
const AVATAR_TTL_MS = 60 * 60 * 1000;
const SNAPSHOT_TTL_MS = 30_000;

type KickUserRow = {
  user_id?: number;
  name?: string | null;
  profile_picture?: string | null;
};

export type KickPublicSnapshot = {
  slug: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  isLive: boolean;
  viewerCount: number | null;
  streamTitle: string | null;
  streamThumbnail: string | null;
  categoryName: string | null;
  broadcasterUserId: number | null;
};

@Injectable()
export class KickChannelLiveService {
  private readonly logger = new Logger(KickChannelLiveService.name);
  private tokenCache: { token: string; expiresAt: number } | null = null;
  private readonly liveCache = new Map<string, { isLive: boolean; at: number }>();
  private readonly avatarCache = new Map<number, { url: string | null; at: number }>();
  private readonly snapshotCache = new Map<
    string,
    { snapshot: KickPublicSnapshot | null; at: number }
  >();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('KICK_DEV_CLIENT_ID')?.trim()
      && this.config.get<string>('KICK_DEV_CLIENT_SECRET')?.trim(),
    );
  }

  private async getAppAccessToken(): Promise<string | null> {
    const clientId = this.config.get<string>('KICK_DEV_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('KICK_DEV_CLIENT_SECRET')?.trim();
    if (!clientId || !clientSecret) return null;

    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      this.logger.warn(`Kick token failed: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as KickTokenResponse;
    if (!data.access_token) return null;

    const ttlSec = Number(data.expires_in || 3600);
    this.tokenCache = {
      token: data.access_token,
      expiresAt: now + Math.max(60, ttlSec - 30) * 1000,
    };
    return data.access_token;
  }

  /** Returns the first slug that Kick Dev API reports as live. */
  async findFirstLiveChannel(slugs: string[]): Promise<string | null> {
    const normalized = [...new Set(
      slugs
        .map((slug) => slug.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean),
    )];
    if (!normalized.length || !this.isConfigured()) return null;

    const now = Date.now();
    const stale: string[] = [];

    for (const slug of normalized) {
      const cached = this.liveCache.get(slug);
      if (cached && now - cached.at < STATUS_TTL_MS) {
        if (cached.isLive) return slug;
        continue;
      }
      stale.push(slug);
    }

    if (!stale.length) return null;

    const token = await this.getAppAccessToken();
    if (!token) return null;

    try {
      const query = stale.map((slug) => `slug=${encodeURIComponent(slug)}`).join('&');
      const res = await fetch(`https://api.kick.com/public/v1/channels?${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        this.logger.warn(`Kick channels lookup failed: ${res.status}`);
        return null;
      }

      const body = (await res.json()) as { data?: KickChannelRow[] };
      const seen = new Set<string>();

      for (const row of body.data ?? []) {
        const slug = row.slug?.trim().toLowerCase();
        if (!slug) continue;
        seen.add(slug);
        const isLive = Boolean(row.stream?.is_live);
        this.liveCache.set(slug, { isLive, at: now });
        if (isLive) return slug;
      }

      for (const slug of stale) {
        if (!seen.has(slug)) {
          this.liveCache.set(slug, { isLive: false, at: now });
        }
      }
    } catch (err) {
      this.logger.warn(`Kick channels lookup error: ${(err as Error).message}`);
    }

    return null;
  }

  /** Kick profile picture URL for a broadcaster user id (app credentials). */
  async fetchUserProfilePicture(broadcasterUserId?: number | null): Promise<string | null> {
    const userId = Number(broadcasterUserId);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    if (!this.isConfigured()) return null;

    const now = Date.now();
    const cached = this.avatarCache.get(userId);
    if (cached && now - cached.at < AVATAR_TTL_MS) {
      return cached.url;
    }

    const token = await this.getAppAccessToken();
    if (!token) return null;

    try {
      const res = await fetch(
        `https://api.kick.com/public/v1/users?id=${encodeURIComponent(String(userId))}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );

      if (!res.ok) {
        this.logger.warn(`Kick user profile fetch failed: ${res.status}`);
        this.avatarCache.set(userId, { url: null, at: now });
        return null;
      }

      const body = (await res.json()) as { data?: KickUserRow[] };
      const row = body.data?.find((item) => item.user_id === userId) ?? body.data?.[0];
      const url = row?.profile_picture?.trim() || null;
      this.avatarCache.set(userId, { url, at: now });
      return url;
    } catch (err) {
      this.logger.warn(`Kick user profile fetch error: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Full public snapshot for a channel (channel + user display name), cached
   * for a short TTL. Used by the click landing to show fresh live status,
   * viewers, category, stream thumbnail and the streamer display name.
   */
  async fetchPublicChannelSnapshot(
    slug?: string | null,
  ): Promise<KickPublicSnapshot | null> {
    const normalized = slug?.trim().toLowerCase().replace(/^@/, '');
    if (!normalized || !this.isConfigured()) return null;

    const now = Date.now();
    const cached = this.snapshotCache.get(normalized);
    if (cached && now - cached.at < SNAPSHOT_TTL_MS) {
      return cached.snapshot;
    }

    const token = await this.getAppAccessToken();
    if (!token) return null;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };

    try {
      const chRes = await fetch(
        `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(normalized)}`,
        { headers },
      );
      if (!chRes.ok) {
        this.logger.warn(`Kick channel snapshot failed: ${chRes.status}`);
        this.snapshotCache.set(normalized, { snapshot: null, at: now });
        return null;
      }

      const chBody = (await chRes.json()) as { data?: KickChannelRow[] };
      const row = chBody.data?.[0];
      if (!row?.slug) {
        this.snapshotCache.set(normalized, { snapshot: null, at: now });
        return null;
      }

      const broadcasterUserId = row.broadcaster_user_id ?? null;

      let displayName: string | null = null;
      let avatarUrl: string | null = null;
      if (broadcasterUserId) {
        try {
          const uRes = await fetch(
            `https://api.kick.com/public/v1/users?id=${encodeURIComponent(String(broadcasterUserId))}`,
            { headers },
          );
          if (uRes.ok) {
            const uBody = (await uRes.json()) as { data?: KickUserRow[] };
            const user =
              uBody.data?.find((item) => item.user_id === broadcasterUserId)
              ?? uBody.data?.[0];
            displayName = user?.name?.trim() || null;
            avatarUrl = user?.profile_picture?.trim() || null;
            if (avatarUrl) {
              this.avatarCache.set(broadcasterUserId, { url: avatarUrl, at: now });
            }
          }
        } catch {
          /* user lookup is best-effort */
        }
      }

      const isLive = Boolean(row.stream?.is_live);
      const snapshot: KickPublicSnapshot = {
        slug: row.slug,
        displayName,
        avatarUrl,
        bannerUrl: row.banner_picture?.trim() || null,
        description: row.channel_description?.trim() || null,
        isLive,
        viewerCount: isLive ? row.stream?.viewer_count ?? null : null,
        streamTitle: (row.stream?.title ?? row.stream_title)?.trim() || null,
        streamThumbnail: isLive ? row.stream?.thumbnail?.trim() || null : null,
        categoryName: row.category?.name?.trim() || null,
        broadcasterUserId,
      };

      this.snapshotCache.set(normalized, { snapshot, at: now });
      this.liveCache.set(normalized, { isLive, at: now });
      return snapshot;
    } catch (err) {
      this.logger.warn(`Kick channel snapshot error: ${(err as Error).message}`);
      return null;
    }
  }
}
