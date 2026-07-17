import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { KickCredentialService } from './kick-credential.service';
import { KickDevService } from './kick-dev.service';
import type { KickPartnerMeta } from './kick-partner.types';
import { isKickTokenExpired, type KickOAuthTokenResponse } from './kick-token.util';

@Injectable()
export class KickTokenService {
  private readonly logger = new Logger(KickTokenService.name);
  private readonly refreshLocks = new Map<number, Promise<string | null>>();

  constructor(
    private readonly kickDev: KickDevService,
    private readonly kickCredential: KickCredentialService,
    private readonly config: ConfigService,
  ) {}

  private async requestRefreshToken(refreshToken: string): Promise<KickOAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.kickDev.getClientId(),
      client_secret: this.config.get<string>('KICK_DEV_CLIENT_SECRET')?.trim() || '',
      refresh_token: refreshToken,
    });

    const res = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Kick refresh failed: ${res.status} ${text.slice(0, 300)}`);
    }

    return (await res.json()) as KickOAuthTokenResponse;
  }

  private async refreshPartnerToken(partnerUserId: number): Promise<string | null> {
    const payload = await this.kickCredential.getPayload(partnerUserId);
    if (!payload?.refreshToken) {
      this.logger.warn(`Kick refresh skipped for partner ${partnerUserId}: no refresh token`);
      return payload?.accessToken ?? null;
    }

    try {
      const tokens = await this.requestRefreshToken(payload.refreshToken);
      if (!tokens.access_token) {
        throw new Error('Kick refresh response missing access_token');
      }

      await this.kickCredential.saveFromOAuthResponse(partnerUserId, tokens, {
        scopes: payload.scopes ?? null,
      } as KickPartnerMeta);
      await this.kickCredential.clearRefreshFailed(partnerUserId);

      this.logger.log(`Kick token refreshed for partner ${partnerUserId}`);
      return tokens.access_token;
    } catch (error) {
      this.logger.warn(
        `Kick token refresh failed for partner ${partnerUserId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.kickCredential.markRefreshFailed(partnerUserId);
      return payload.accessToken ?? null;
    }
  }

  async getValidAccessToken(partnerUserId: number): Promise<string | null> {
    const payload = await this.kickCredential.getPayload(partnerUserId);
    if (!payload?.accessToken) return null;

    const tokenExpiresAt = await this.kickCredential.getTokenExpiresAt(partnerUserId);
    if (!isKickTokenExpired(tokenExpiresAt)) {
      return payload.accessToken;
    }

    if (!payload.refreshToken) {
      return payload.accessToken;
    }

    const inflight = this.refreshLocks.get(partnerUserId);
    if (inflight) {
      return inflight;
    }

    const refreshPromise = this.refreshPartnerToken(partnerUserId);
    this.refreshLocks.set(partnerUserId, refreshPromise);
    try {
      return await refreshPromise;
    } finally {
      this.refreshLocks.delete(partnerUserId);
    }
  }
}
