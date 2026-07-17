import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type KickTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

@Injectable()
export class KickDevService {
  private readonly logger = new Logger(KickDevService.name);
  private appTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  getClientId() {
    return this.config.get<string>('KICK_DEV_CLIENT_ID')?.trim() || '';
  }

  private getClientSecret() {
    return this.config.get<string>('KICK_DEV_CLIENT_SECRET')?.trim() || '';
  }

  getRedirectUri() {
    return (
      this.config.get<string>('KICK_DEV_REDIRECT_URI')?.trim()
      || 'https://partners.imba.bet/api/kick/oauth/callback'
    );
  }

  getWebhookUrl() {
    return (
      this.config.get<string>('KICK_DEV_WEBHOOK_URL')?.trim()
      || 'https://imba.bet/api/kick/webhook'
    );
  }

  isConfigured() {
    return Boolean(this.getClientId() && this.getClientSecret());
  }

  getPublicStatus() {
    return {
      configured: this.isConfigured(),
      clientId: this.getClientId() || null,
      redirectUri: this.getRedirectUri(),
      webhookUrl: this.getWebhookUrl(),
      oauthHost: 'https://id.kick.com',
      apiHost: 'https://api.kick.com/public/v1',
      recommendedScopes: [
        'user:read',
        'channel:read',
        'chat:write',
        'events:subscribe',
      ],
    };
  }

  async getAppAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Kick Dev credentials are not configured');
    }

    const now = Date.now();
    if (this.appTokenCache && this.appTokenCache.expiresAt > now + 30_000) {
      return this.appTokenCache.token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
    });

    const res = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Kick app token request failed: ${res.status} ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException('Kick Dev token request failed');
    }

    const data = (await res.json()) as KickTokenResponse;
    if (!data.access_token) {
      throw new ServiceUnavailableException('Kick Dev token response did not include access_token');
    }

    const ttlSec = Number(data.expires_in || 3600);
    this.appTokenCache = {
      token: data.access_token,
      expiresAt: now + Math.max(60, ttlSec - 30) * 1000,
    };

    return data.access_token;
  }

  async checkAppToken() {
    const token = await this.getAppAccessToken();
    return {
      ok: true,
      tokenPreview: `${token.slice(0, 8)}...`,
      configured: true,
    };
  }
}
