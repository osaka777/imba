import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  StreamCommentStatus,
  WcOddsBetStatus,
} from '@prisma/client';

import { displayPublicName } from '~/main/user/nickname';
import { PrismaService } from '~/prisma/prisma.service';
import { resolveEventRef } from '~/integrations/wc-odds/wc-public.util';

import { StreamSocialHub } from './stream-social.hub';

const STREAM_KEY_MAX = 128;
const COMMENT_MAX = 120;
const COMMENT_MIN = 1;
const AUTO_HIDE_REPORTS = 3;

function normalizeStreamKey(raw: string): string {
  const key = decodeURIComponent(String(raw || ''))
    .trim()
    .slice(0, STREAM_KEY_MAX);
  if (!key || key.length < 2) {
    throw new BadRequestException('Invalid stream');
  }
  return key;
}

function moderateStreamComment(raw: string): string {
  const body = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, COMMENT_MAX);
  if (body.length < COMMENT_MIN) {
    throw new BadRequestException('Пустой комментарий');
  }
  if (/https?:\/\/|www\.|t\.me\/|telegram\.me\//i.test(body)) {
    throw new BadRequestException('Ссылки в комментариях запрещены');
  }
  return body;
}

@Injectable()
export class StreamSocialService {
  private readonly commentHits = new Map<
    number,
    { count: number; resetAt: number }
  >();
  private readonly likeHits = new Map<
    number,
    { count: number; resetAt: number }
  >();
  private readonly reportHits = new Map<
    number,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: StreamSocialHub,
  ) {}

  async getSocial(streamKeyRaw: string, viewerUserId?: number) {
    const streamKey = normalizeStreamKey(streamKeyRaw);
    const canComment = viewerUserId
      ? await this.userHasBetOnStream(viewerUserId, streamKey)
      : false;

    const [likeCount, liked, comments] = await Promise.all([
      this.prisma.streamLike.count({ where: { streamKey } }),
      viewerUserId
        ? this.prisma.streamLike.findUnique({
            where: {
              streamKey_userId: { streamKey, userId: viewerUserId },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.streamComment.findMany({
        where: {
          streamKey,
          status: StreamCommentStatus.VISIBLE,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              nickname: true,
              telegramUsername: true,
            },
          },
        },
        orderBy: { id: 'desc' },
        take: 40,
      }),
    ]);

    const hiddenIds = new Set<number>();
    if (viewerUserId && comments.length) {
      const hides = await this.prisma.streamCommentHide.findMany({
        where: {
          userId: viewerUserId,
          commentId: { in: comments.map((c) => c.id) },
        },
        select: { commentId: true },
      });
      for (const h of hides) hiddenIds.add(h.commentId);
    }

    const visible = comments
      .filter((row) => !hiddenIds.has(row.id))
      .slice()
      .reverse()
      .map((row) => this.toCommentDto(row));

    return {
      streamKey,
      likeCount,
      likedByMe: Boolean(liked),
      canComment,
      canCommentReason: canComment
        ? null
        : viewerUserId
          ? 'need_bet'
          : 'need_login',
      comments: visible,
    };
  }

  async toggleLike(streamKeyRaw: string, userId: number) {
    this.assertRate(this.likeHits, userId, 40, 'Слишком много лайков');
    const streamKey = normalizeStreamKey(streamKeyRaw);
    const existing = await this.prisma.streamLike.findUnique({
      where: { streamKey_userId: { streamKey, userId } },
    });
    if (existing) {
      await this.prisma.streamLike.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.streamLike.create({ data: { streamKey, userId } });
    }
    const likeCount = await this.prisma.streamLike.count({
      where: { streamKey },
    });
    const liked = !existing;
    this.hub.publish(streamKey, { type: 'like', likeCount, liked });
    return { streamKey, liked, likeCount };
  }

  async addComment(streamKeyRaw: string, userId: number, bodyRaw: string) {
    this.assertRate(this.commentHits, userId, 12, 'Слишком много комментариев');
    const streamKey = normalizeStreamKey(streamKeyRaw);
    const allowed = await this.userHasBetOnStream(userId, streamKey);
    if (!allowed) {
      throw new ForbiddenException(
        'Комментировать могут только игроки со ставкой на этот матч',
      );
    }
    const body = moderateStreamComment(bodyRaw);
    const created = await this.prisma.streamComment.create({
      data: {
        streamKey,
        userId,
        body,
        status: StreamCommentStatus.VISIBLE,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            telegramUsername: true,
          },
        },
      },
    });
    const dto = this.toCommentDto(created);
    this.hub.publish(streamKey, { type: 'comment', comment: dto });
    return dto;
  }

  async reportComment(input: {
    commentId: number;
    userId: number;
    reason?: string;
  }) {
    this.assertRate(this.reportHits, input.userId, 20, 'Слишком много жалоб');
    const comment = await this.prisma.streamComment.findUnique({
      where: { id: input.commentId },
      select: { id: true, streamKey: true, userId: true, status: true },
    });
    if (!comment || comment.status !== StreamCommentStatus.VISIBLE) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId === input.userId) {
      throw new BadRequestException('Нельзя пожаловаться на свой комментарий');
    }

    await this.prisma.streamCommentReport.upsert({
      where: {
        commentId_userId: {
          commentId: comment.id,
          userId: input.userId,
        },
      },
      create: {
        commentId: comment.id,
        userId: input.userId,
        reason: input.reason?.slice(0, 64) || null,
      },
      update: {},
    });

    await this.prisma.streamCommentHide.upsert({
      where: {
        commentId_userId: {
          commentId: comment.id,
          userId: input.userId,
        },
      },
      create: { commentId: comment.id, userId: input.userId },
      update: {},
    });

    const reportCount = await this.prisma.streamCommentReport.count({
      where: { commentId: comment.id },
    });
    if (reportCount >= AUTO_HIDE_REPORTS) {
      await this.prisma.streamComment.update({
        where: { id: comment.id },
        data: { status: StreamCommentStatus.HIDDEN },
      });
    }

    this.hub.publish(comment.streamKey, {
      type: 'hide',
      commentId: comment.id,
    });

    return { ok: true, commentId: comment.id, hiddenForMe: true };
  }

  /** Resolve WC event id from broadcast streamKey (slug or public/internal ref). */
  async resolveWcEventId(streamKey: string): Promise<string | null> {
    const resolved = resolveEventRef(streamKey);
    const event = await this.prisma.wcOddsEvent.findFirst({
      where: {
        OR: [{ id: resolved }, { slug: streamKey }, { slug: resolved }],
      },
      select: { id: true },
    });
    return event?.id ?? null;
  }

  async userHasBetOnStream(userId: number, streamKey: string): Promise<boolean> {
    const eventId = await this.resolveWcEventId(streamKey);
    if (!eventId) return false;
    const bet = await this.prisma.wcOddsBet.findFirst({
      where: {
        userId,
        eventId,
        isProbe: false,
        status: { not: WcOddsBetStatus.VOID },
      },
      select: { id: true },
    });
    return Boolean(bet);
  }

  private toCommentDto(row: {
    id: number;
    body: string;
    createdAt: Date;
    user: {
      id: number;
      email: string;
      nickname: string | null;
      telegramUsername: string | null;
    };
  }) {
    const nickname = row.user.nickname?.trim() || null;
    return {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      user: {
        id: row.user.id,
        nickname,
        name: displayPublicName({
          id: row.user.id,
          email: row.user.email,
          telegramUsername: row.user.telegramUsername,
          nickname,
        }),
      },
    };
  }

  private assertRate(
    map: Map<number, { count: number; resetAt: number }>,
    userId: number,
    max: number,
    message: string,
  ) {
    const now = Date.now();
    const windowMs = 60_000;
    const bucket = map.get(userId);
    if (!bucket || now >= bucket.resetAt) {
      map.set(userId, { count: 1, resetAt: now + windowMs });
      return;
    }
    bucket.count += 1;
    if (bucket.count > max) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
