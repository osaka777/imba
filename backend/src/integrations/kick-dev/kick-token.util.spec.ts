import {
  buildKickTokenMetaPatch,
  isKickTokenExpired,
  KICK_TOKEN_REFRESH_SKEW_MS,
} from './kick-token.util';

describe('kick-token.util', () => {
  it('detects expiry with refresh skew', () => {
    const now = Date.parse('2026-07-05T12:00:00.000Z');
    const expiresAt = new Date(now + KICK_TOKEN_REFRESH_SKEW_MS - 1000).toISOString();
    expect(isKickTokenExpired(expiresAt, now)).toBe(true);
    expect(isKickTokenExpired(null, now)).toBe(true);
  });

  it('keeps valid tokens', () => {
    const now = Date.parse('2026-07-05T12:00:00.000Z');
    const expiresAt = new Date(now + KICK_TOKEN_REFRESH_SKEW_MS + 60_000).toISOString();
    expect(isKickTokenExpired(expiresAt, now)).toBe(false);
  });

  it('builds token meta patch', () => {
    const patch = buildKickTokenMetaPatch(
      {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        scope: 'chat:write',
      },
      { refreshToken: 'old-refresh' },
    );
    expect(patch.accessToken).toBe('new-access');
    expect(patch.refreshToken).toBe('new-refresh');
    expect(patch.scopes).toBe('chat:write');
    expect(patch.tokenExpiresAt).toBeTruthy();
    expect(patch.tokenRefreshFailedAt).toBeNull();
  });
});
