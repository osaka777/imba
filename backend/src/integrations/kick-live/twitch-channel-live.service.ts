import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  isBlockedTwitchChannel,
  isVerifiedTwitchEnChannel,
  normalizeTwitchLogin,
} from '../wc-odds/twitch-en-broadcast.util';

type TwitchTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type TwitchStreamRow = {
  user_login?: string;
  type?: string;
  language?: string;
};

const STATUS_TTL_MS = 30_000;
const BLOCKED_LANGS = new Set(['ru', 'uk', 'be', 'kk']);

@Injectable()
export class TwitchChannelLiveService {
  private readonly logger = new Logger(TwitchChannelLiveService.name);
  private tokenCache: { token: string; expiresAt: number } | null = null;
  private readonly liveCache = new Map<string, { isLive: boolean; at: number }>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('TWITCH_CLIENT_ID')?.trim()
      && this.config.get<string>('TWITCH_CLIENT_SECRET')?.trim(),
    );
  }

  private async getAppAccessToken(): Promise<string | null> {
    const clientId = this.config.get<string>('TWITCH_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('TWITCH_CLIENT_SECRET')?.trim();
    if (!clientId || !clientSecret) return null;

    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.token;
    }

    const query = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });

    const res = await fetch(`https://id.twitch.tv/oauth2/token?${query}`, { method: 'POST' });
    if (!res.ok) {
      this.logger.warn(`Twitch token failed: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as TwitchTokenResponse;
    if (!data.access_token) return null;

    const ttlSec = Number(data.expires_in || 3600);
    this.tokenCache = {
      token: data.access_token,
      expiresAt: now + Math.max(60, ttlSec - 30) * 1000,
    };
    return data.access_token;
  }

  private isAllowedLiveStream(row: TwitchStreamRow): boolean {
    const login = normalizeTwitchLogin(row.user_login ?? '');
    if (!login || !isVerifiedTwitchEnChannel(login)) return false;
    if (row.type !== 'live') return false;
    const lang = (row.language ?? '').trim().toLowerCase();
    if (lang && BLOCKED_LANGS.has(lang)) return false;
    return true;
  }

  /** Returns the first whitelisted EN Twitch channel that is live. */
  async findFirstLiveChannel(logins: string[]): Promise<string | null> {
    const normalized = [...new Set(
      logins
        .map(normalizeTwitchLogin)
        .filter((login) => login && isVerifiedTwitchEnChannel(login)),
    )];
    if (!normalized.length || !this.isConfigured()) return null;

    const now = Date.now();
    const stale: string[] = [];

    for (const login of normalized) {
      const cached = this.liveCache.get(login);
      if (cached && now - cached.at < STATUS_TTL_MS) {
        if (cached.isLive) return login;
        continue;
      }
      stale.push(login);
    }

    if (!stale.length) return null;

    const token = await this.getAppAccessToken();
    const clientId = this.config.get<string>('TWITCH_CLIENT_ID')?.trim();
    if (!token || !clientId) return null;

    try {
      const query = stale.map((login) => `user_login=${encodeURIComponent(login)}`).join('&');
      const res = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Client-Id': clientId,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        this.logger.warn(`Twitch streams lookup failed: ${res.status}`);
        return null;
      }

      const body = (await res.json()) as { data?: TwitchStreamRow[] };
      const liveNow = new Set<string>();

      for (const row of body.data ?? []) {
        const login = normalizeTwitchLogin(row.user_login ?? '');
        if (!login || !this.isAllowedLiveStream(row)) continue;
        liveNow.add(login);
        this.liveCache.set(login, { isLive: true, at: now });
      }

      for (const login of stale) {
        if (!liveNow.has(login)) {
          this.liveCache.set(login, { isLive: false, at: now });
        }
      }

      for (const login of normalized) {
        if (liveNow.has(login)) return login;
      }
    } catch (err) {
      this.logger.warn(`Twitch streams lookup error: ${(err as Error).message}`);
    }

    return null;
  }

  async isChannelLive(login: string): Promise<boolean> {
    if (isBlockedTwitchChannel(login)) return false;
    const found = await this.findFirstLiveChannel([login]);
    return found === normalizeTwitchLogin(login);
  }
}
