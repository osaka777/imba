import { NextFunction, Request, Response } from 'express';

import { isAllowedWebOrigin } from '../security/allowed-origins';

/**
 * Hard-block API docs / OpenAPI JSON in every environment (belt + suspenders:
 * setupDocs already skips production). Does NOT touch betting, feed, or WS.
 */
export function apiDocsBlockGuard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const path = (req.path || req.url.split('?')[0] || '').toLowerCase();
  if (
    path === '/api/docs' ||
    path.startsWith('/api/docs/') ||
    path === '/api/docs-json' ||
    path.startsWith('/api/docs-json')
  ) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  next();
}

/**
 * Paths that MUST stay open for third-party servers (payments, Kick, OAuth).
 * Never apply Origin checks here — they have no browser Origin or a foreign one.
 */
const SERVER_TO_SERVER_PATH_RE =
  /(?:^|\/)(?:webhook|callback|oauth\/callback)(?:\/|$)/i;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Soft Origin guard for browser mutations only.
 *
 * Safe for bets because:
 * - Legitimate SPA always sends Origin: https://imba.bet (allowlisted).
 * - Missing Origin is allowed (native/WebView quirks, same-site edge cases,
 *   and any non-browser client that already authenticates via cookie/JWT).
 * - Payment / Kick / OAuth webhooks are explicitly exempt.
 * - GET/HEAD/OPTIONS (odds polls, preflight) are never checked.
 * - WebSocket upgrades are not HTTP mutations here.
 */
export function softOriginGuard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!MUTATING.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const path = req.path || req.url.split('?')[0] || '';
  if (SERVER_TO_SERVER_PATH_RE.test(path)) {
    next();
    return;
  }

  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

  // No Origin → allow (do not break native apps / server clients / bets).
  if (!origin) {
    next();
    return;
  }

  if (isAllowedWebOrigin(origin)) {
    next();
    return;
  }

  res.status(403).json({
    error: 'ORIGIN_DENIED',
    message: 'Requests from this origin are not allowed.',
  });
}
