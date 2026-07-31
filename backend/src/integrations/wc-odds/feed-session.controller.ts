import type { Request, Response } from 'express';
import { Controller, Post, Req, Res } from '@nestjs/common';

import {
  FEED_COOKIE_NAME,
  FEED_TOKEN_TTL_SEC,
  signFeedToken,
} from '~/common/security/feed-access.util';

@Controller('feed')
export class FeedSessionController {
  @Post('session')
  createSession(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    const token = signFeedToken();
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie(FEED_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: FEED_TOKEN_TTL_SEC * 1000,
      path: '/',
    });

    res.status(200).json({
      ok: true,
      expiresIn: FEED_TOKEN_TTL_SEC,
      // Non-httpOnly fallback for environments where cookie is stripped (rare).
      token,
    });
  }
}
