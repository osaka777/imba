import { createHmac, timingSafeEqual } from 'crypto';

export const FEED_COOKIE_NAME = 'imba_feed';
export const FEED_TOKEN_TTL_SEC = 15 * 60;
export const FEED_TOKEN_TYP = 'feed';

/** Native wrappers that load imba.bet in a WebView / Electron shell. */
export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent;
  return ua.includes('ImbaBetApp/') || ua.includes('ImbaBetWindows/');
}

export function isPrivateOrLoopbackIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const cleaned = ip.replace(/^::ffff:/i, '').trim();
  if (!cleaned) return false;
  if (cleaned === '127.0.0.1' || cleaned === '::1' || cleaned === 'localhost') {
    return true;
  }
  if (cleaned.startsWith('10.')) return true;
  if (cleaned.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(cleaned)) return true;
  return false;
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlJson(value: unknown): string {
  return b64url(JSON.stringify(value));
}

function getFeedSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET is required for feed session tokens');
  }
  return secret;
}

export type FeedTokenPayload = {
  typ: typeof FEED_TOKEN_TYP;
  iat: number;
  exp: number;
};

export function signFeedToken(nowSec = Math.floor(Date.now() / 1000)): string {
  const payload: FeedTokenPayload = {
    typ: FEED_TOKEN_TYP,
    iat: nowSec,
    exp: nowSec + FEED_TOKEN_TTL_SEC,
  };
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', getFeedSecret()).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

export function verifyFeedToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [header, body, sig] = parts;
  if (!header || !body || !sig) return false;

  let expected: Buffer;
  try {
    expected = createHmac('sha256', getFeedSecret())
      .update(`${header}.${body}`)
      .digest();
  } catch {
    return false;
  }

  let actual: Buffer;
  try {
    actual = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch {
    return false;
  }

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return false;
  }

  try {
    const json = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    );
    const payload = JSON.parse(json) as FeedTokenPayload;
    if (payload.typ !== FEED_TOKEN_TYP) return false;
    if (typeof payload.exp !== 'number') return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

export function parseCookieHeader(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}
