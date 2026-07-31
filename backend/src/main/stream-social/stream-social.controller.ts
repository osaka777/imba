import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Observable } from 'rxjs';

import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { AuthenticationService } from '~/main/user/authentication/authentication.service';

import { StreamSocialHub } from './stream-social.hub';
import { StreamSocialService } from './stream-social.service';

class PostStreamCommentDto {
  @IsString()
  @MaxLength(120)
  body!: string;
}

class ReportStreamCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reason?: string;
}

@Controller('casino/streams')
export class StreamSocialController {
  constructor(
    private readonly social: StreamSocialService,
    private readonly hub: StreamSocialHub,
    private readonly auth: AuthenticationService,
  ) {}

  @Get(':key/social')
  async getSocial(
    @Param('key') key: string,
    @Req()
    req: {
      headers?: Record<string, string | undefined>;
      cookies?: Record<string, string | undefined>;
    },
  ) {
    const userId = await this.tryUserId(req);
    return this.social.getSocial(key, userId);
  }

  @Sse(':key/live')
  live(@Param('key') key: string): Observable<{ data: unknown }> {
    const streamKey = decodeURIComponent(String(key || '')).trim();
    return this.hub.subscribe(streamKey);
  }

  @UseGuards(AuthenticationGuard)
  @Post(':key/like')
  toggleLike(
    @Param('key') key: string,
    @Req() req: { user: { id: number } },
  ) {
    return this.social.toggleLike(key, req.user.id);
  }

  @UseGuards(AuthenticationGuard)
  @Post(':key/comments')
  addComment(
    @Param('key') key: string,
    @Req() req: { user: { id: number } },
    @Body() body: PostStreamCommentDto,
  ) {
    return this.social.addComment(key, req.user.id, body.body ?? '');
  }

  @UseGuards(AuthenticationGuard)
  @Post('comments/:id/report')
  reportComment(
    @Param('id') id: string,
    @Req() req: { user: { id: number } },
    @Body() body: ReportStreamCommentDto,
  ) {
    return this.social.reportComment({
      commentId: Number(id),
      userId: req.user.id,
      reason: body.reason,
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
      return Number.isFinite(id) && id > 0 ? id : undefined;
    } catch {
      return undefined;
    }
  }
}
