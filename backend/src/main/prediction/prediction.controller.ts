import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { Response } from 'express';

import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { AuthenticationService } from '~/main/user/authentication/authentication.service';

import {
  COMMENT_MAX_LEN,
} from './prediction-comment.moderation';
import { PredictionService } from './prediction.service';

class PlacePredictionBetDto {
  @IsNumber()
  eventId!: number;

  @IsNumber()
  outcomeId!: number;

  @IsNumber()
  @Min(1)
  stake!: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;
}

class PostPredictionCommentDto {
  @IsNumber()
  eventId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_MAX_LEN)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  gifUrl?: string;

  @IsOptional()
  @IsNumber()
  parentId?: number;
}

class TogglePredictionBookmarkDto {
  @IsNumber()
  eventId!: number;
}

@Controller('casino/prediction')
export class PredictionController {
  constructor(
    private readonly prediction: PredictionService,
    private readonly auth: AuthenticationService,
  ) {}

  @Get('traders/:idOrNick')
  publicTrader(
    @Param('idOrNick') idOrNick: string,
    @Query('range') range?: string,
    @Query('currencyCode') currencyCode?: string,
  ) {
    return this.prediction.getPublicTraderProfile({
      idOrNick,
      range,
      currencyCode,
    });
  }

  @Get('config')
  getConfig() {
    return this.prediction.getConfig();
  }

  @Get('events')
  list(@Query('status') status?: string) {
    return this.prediction.listPublic(status);
  }

  @Get('events/:slug')
  async getOne(
    @Param('slug') slug: string,
    @Req()
    req: { headers?: Record<string, string>; cookies?: Record<string, string> },
  ) {
    const userId = await this.tryUserId(req);
    let decoded = slug;
    try {
      decoded = decodeURIComponent(slug);
    } catch {
      decoded = slug;
    }
    return this.prediction.getPublicBySlug(decoded, userId);
  }

  @Get('gifs')
  searchGifs(@Query('q') q?: string, @Query('pos') pos?: string) {
    return this.prediction.searchGifs(q ?? '', pos);
  }

  /** Same-origin proxy for allowlisted GIF CDNs (fixes blank thumbs in some networks). */
  @Get('gifs/media')
  async gifMedia(@Query('u') u: string | undefined, @Res() res: Response) {
    const result = await this.prediction.proxyGifMedia(u ?? '');
    if (result.ok === false) {
      res.status(result.status).type('text/plain').send(result.message);
      return;
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(200).send(result.body);
  }

  @UseGuards(AuthenticationGuard)
  @Post('comments')
  postComment(
    @Req() req: { user: { id: number } },
    @Body() body: PostPredictionCommentDto,
  ) {
    return this.prediction.addComment({
      userId: req.user.id,
      eventId: body.eventId,
      body: body.body ?? '',
      gifUrl: body.gifUrl ?? null,
      parentId: body.parentId ?? null,
    });
  }

  @UseGuards(AuthenticationGuard)
  @Post('comments/:id/like')
  toggleCommentLike(
    @Req() req: { user: { id: number } },
    @Param('id') id: string,
  ) {
    return this.prediction.toggleCommentLike({
      userId: req.user.id,
      commentId: Number(id),
    });
  }

  @UseGuards(AuthenticationGuard)
  @Get('bookmarks')
  myBookmarks(@Req() req: { user: { id: number } }) {
    return this.prediction.listBookmarks(req.user.id);
  }

  @UseGuards(AuthenticationGuard)
  @Post('bookmarks')
  toggleBookmark(
    @Req() req: { user: { id: number } },
    @Body() body: TogglePredictionBookmarkDto,
  ) {
    return this.prediction.toggleBookmark({
      userId: req.user.id,
      eventId: body.eventId,
    });
  }

  @Get('activity')
  globalActivity(@Query('limit') limit?: string) {
    return this.prediction.getGlobalActivity(Number(limit) || 30);
  }

  @Get('leaderboard')
  leaderboard(@Query('limit') limit?: string) {
    return this.prediction.getLeaderboard(Number(limit) || 10);
  }

  @UseGuards(AuthenticationGuard)
  @Get('bets')
  myBets(
    @Req() req: { user: { id: number } },
    @Query('limit') limit?: string,
  ) {
    return this.prediction.getMyBets(req.user.id, Number(limit) || 30);
  }

  @UseGuards(AuthenticationGuard)
  @Post('bets')
  place(
    @Req() req: { user: { id: number } },
    @Body() body: PlacePredictionBetDto,
  ) {
    return this.prediction.placeBet({
      userId: req.user.id,
      eventId: body.eventId,
      outcomeId: body.outcomeId,
      stake: body.stake,
      currencyCode: body.currencyCode ?? 'KZT',
    });
  }

  private async tryUserId(req: {
    headers?: Record<string, string | undefined>;
    cookies?: Record<string, string | undefined>;
  }): Promise<number | undefined> {
    try {
      const cookieToken =
        req.cookies?.['accessToken'] || req.cookies?.['access_token'];
      const auth = req.headers?.['authorization'];
      const bearer =
        typeof auth === 'string' && auth.startsWith('Bearer ')
          ? auth.slice(7)
          : undefined;
      const token = cookieToken || bearer;
      if (!token) return undefined;
      const user = await this.auth.verify(token);
      const id = Number(user?.id);
      return Number.isFinite(id) ? id : undefined;
    } catch {
      return undefined;
    }
  }
}
