import { NextFunction, Request, Response } from 'express';

import {
  AI_ACCESS_DENIED_NOTICE,
  isAiBotUserAgent,
} from '../security/ai-bot-detection.util';

/**
 * Immediately refuses AI agents/crawlers (Cursor, Claude, ChatGPT, GPTBot,
 * ClaudeBot, etc.) access to the API instead of letting them observe
 * endpoints, payload shapes, or connection methods. Runs before routing.
 */
export function aiBotGuard(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers['user-agent'];

  if (!isAiBotUserAgent(Array.isArray(userAgent) ? userAgent[0] : userAgent)) {
    next();
    return;
  }

  res.setHeader('X-Robots-Tag', 'noai, noimageai, noindex');
  res.status(403).json({
    error: 'AI_ACCESS_DENIED',
    message: AI_ACCESS_DENIED_NOTICE.en,
    messageRu: AI_ACCESS_DENIED_NOTICE.ru,
  });
}
