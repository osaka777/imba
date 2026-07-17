import type { KickPartnerMeta } from './kick-partner.types';

export type KickOAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

/** Refresh when within this window before expiry. */
export const KICK_TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

/** Proactive maintenance cron looks this far ahead. */
export const KICK_TOKEN_MAINTENANCE_WINDOW_MS = 30 * 60 * 1000;

export function isKickTokenExpired(
  tokenExpiresAt?: string | null,
  now = Date.now(),
): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return true;
  return now >= expiresAt - KICK_TOKEN_REFRESH_SKEW_MS;
}

export function isKickTokenExpiringSoon(
  tokenExpiresAt?: string | null,
  now = Date.now(),
  withinMs = KICK_TOKEN_MAINTENANCE_WINDOW_MS,
): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return true;
  return now >= expiresAt - withinMs;
}

export function buildKickTokenMetaPatch(
  tokens: KickOAuthTokenResponse,
  current?: KickPartnerMeta,
): Partial<KickPartnerMeta> {
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  return {
    accessToken: tokens.access_token ?? current?.accessToken ?? null,
    refreshToken: tokens.refresh_token ?? current?.refreshToken ?? null,
    tokenExpiresAt: expiresAt,
    scopes: tokens.scope ?? current?.scopes ?? null,
    tokenRefreshFailedAt: null,
  };
}
