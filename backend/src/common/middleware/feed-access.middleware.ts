import type { NextFunction, Request, Response } from 'express';

import { extractClientIp } from '../utils/client-ip.util';
import {
  FEED_COOKIE_NAME,
  isNativeAppUserAgent,
  isPrivateOrLoopbackIp,
  parseCookieHeader,
  verifyFeedToken,
} from '../security/feed-access.util';
import {
  feedHttpRateLimiter,
  feedSessionRateLimiter,
} from '../security/feed-rate-limit';
import { AI_ACCESS_DENIED_NOTICE } from '../security/ai-bot-detection.util';

function readFeedToken(req: Request): string | null {
  const header = req.headers['x-imba-feed-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();

  const fromCookie =
    (req as Request & { cookies?: Record<string, string> }).cookies?.[FEED_COOKIE_NAME]
    || parseCookieHeader(req.headers.cookie, FEED_COOKIE_NAME);
  return fromCookie || null;
}

function hasAccessTokenCookie(req: Request): boolean {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (cookies?.accessToken) return true;
  return Boolean(parseCookieHeader(req.headers.cookie, 'accessToken'));
}

/** Auth-protected feed routes — AuthenticationGuard / SuperuserGuard own them. */
function isAuthOwnedFeedPath(path: string): boolean {
  if (path.includes('/admin/')) return true;
  if (/\/bets(\/|$)/.test(path)) return true;
  if (path.endsWith('/play') || path.endsWith('/view')) return true;
  if (/\/events\/[^/]+\/(v|s|subscription)$/.test(path)) return true;
  if (path.endsWith('/my-tournament')) return true;
  if (path.endsWith('/subscribe')) return true;
  return false;
}

function deny(res: Response, status: number, code: string) {
  res.setHeader('X-Robots-Tag', 'noai, noimageai, noindex');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json({
    error: code,
    message: AI_ACCESS_DENIED_NOTICE.en,
    messageRu: AI_ACCESS_DENIED_NOTICE.ru,
  });
}

/**
 * Protects anonymous odds catalog GETs + session minting.
 * Does not touch authenticated bet/cashout/broadcast routes.
 * Allows: feed cookie/token, logged-in cookie, native app UA, docker/private IP.
 */
export function feedAccessGuard(req: Request, res: Response, next: NextFunction) {
  const path = req.path || '';
  if (!path.startsWith('/api/feed')) {
    next();
    return;
  }

  const ip = extractClientIp(req) || req.ip || 'unknown';
  const ua = Array.isArray(req.headers['user-agent'])
    ? req.headers['user-agent'][0]
    : req.headers['user-agent'];

  if (path === '/api/feed/session' && req.method === 'POST') {
    if (!feedSessionRateLimiter.try(`session:${ip}`)) {
      deny(res, 429, 'FEED_SESSION_RATE_LIMIT');
      return;
    }
    next();
    return;
  }

  // Mutations (place bet, cashout, subscribe) stay under AuthenticationGuard.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  if (isAuthOwnedFeedPath(path)) {
    next();
    return;
  }

  if (!feedHttpRateLimiter.try(`http:${ip}`)) {
    deny(res, 429, 'FEED_RATE_LIMIT');
    return;
  }

  if (isNativeAppUserAgent(ua) || isPrivateOrLoopbackIp(ip)) {
    next();
    return;
  }

  if (verifyFeedToken(readFeedToken(req)) || hasAccessTokenCookie(req)) {
    next();
    return;
  }

  deny(res, 403, 'FEED_SESSION_REQUIRED');
}
