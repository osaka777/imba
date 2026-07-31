import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OperationSource,
  OperationStatus,
  OperationType,
  PredictionBetStatus,
  PredictionCommentStatus,
  PredictionEventStatus,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import { EventGateway } from '~/main/event/event.gateway';
import { TelegramNotifyService } from '~/main/telegram/telegram-notify.service';
import { displayPublicName } from '~/main/user/nickname';
import { PrismaService } from '~/prisma/prisma.service';
import { computeMainAccountBetDebit } from '~/shared/utils/balance-fractional-reserve.util';

import {
  predictionMaxStake,
  predictionMinStake,
  predictionStakeToUsd,
  PREDICTION_MAX_OUTCOME_EXPOSURE,
  PREDICTION_MAX_USER_BETS_PER_EVENT,
  PREDICTION_MAX_USER_STAKE_PER_EVENT,
  slugifyTitle,
} from './prediction.constants';
import {
  commentModerationMessage,
  isAllowedPredictionGifUrl,
  moderatePredictionComment,
} from './prediction-comment.moderation';
import { CURATED_PREDICTION_GIFS } from './prediction-gifs.curated';

type OutcomeInput = {
  key: string;
  label: string;
  labelEn?: string;
  odds: number;
  sortOrder?: number;
};

type CreateEventInput = {
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  category?: string;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  videoUrl?: string | null;
  resolveRule?: string;
  resolveRuleEn?: string;
  closesAt?: string | Date | null;
  resolvesAt?: string | Date | null;
  slug?: string;
  outcomes: OutcomeInput[];
  publish?: boolean;
};

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  private readonly commentHits = new Map<
    number,
    { count: number; resetAt: number }
  >();
  private readonly likeHits = new Map<
    number,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationService: OperationService,
    private readonly telegramNotify: TelegramNotifyService,
    private readonly eventGateway: EventGateway,
  ) {}

  getConfig() {
    return {
      minStakeByCurrency: {
        KZT: predictionMinStake('KZT'),
        USD: predictionMinStake('USD'),
        USDT: predictionMinStake('USDT'),
        RUB: predictionMinStake('RUB'),
      },
      maxStakeByCurrency: {
        KZT: predictionMaxStake('KZT'),
        USD: predictionMaxStake('USD'),
        USDT: predictionMaxStake('USDT'),
        RUB: predictionMaxStake('RUB'),
      },
      maxOutcomeExposure: PREDICTION_MAX_OUTCOME_EXPOSURE,
      maxUserStakePerEvent: PREDICTION_MAX_USER_STAKE_PER_EVENT,
      maxUserBetsPerEvent: PREDICTION_MAX_USER_BETS_PER_EVENT,
      currencyDefault: 'KZT',
      note: 'House event markets with fixed odds. Admin settles the winning outcome.',
    };
  }

  async listPublic(status?: string) {
    const now = new Date();
    await this.autoLockExpired();

    const where: Prisma.PredictionEventWhereInput = {
      archivedAt: null,
      ...(status
        ? { status: status as PredictionEventStatus }
        : {
            status: {
              in: [
                PredictionEventStatus.OPEN,
                PredictionEventStatus.LOCKED,
                PredictionEventStatus.SETTLED,
                PredictionEventStatus.VOID,
              ],
            },
          }),
    };

    const rows = await this.prisma.predictionEvent.findMany({
      where,
      include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ status: 'asc' }, { closesAt: 'asc' }, { id: 'desc' }],
      take: 100,
    });

    return Promise.all(rows.map((row) => this.toEventDto(row, now)));
  }

  async getPublicBySlug(slug: string, userId?: number) {
    await this.autoLockExpired();
    let decoded = slug;
    try {
      decoded = decodeURIComponent(slug);
    } catch {
      decoded = slug;
    }
    let event = await this.prisma.predictionEvent.findUnique({
      where: { slug: decoded },
      include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
    });
    /* Old Cyrillic / messy slugs → resolve via latinized form or title match. */
    if (!event) {
      const latin = slugifyTitle(decoded);
      event = await this.prisma.predictionEvent.findUnique({
        where: { slug: latin },
        include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
      });
    }
    if (!event) {
      const latin = slugifyTitle(decoded);
      const candidates = await this.prisma.predictionEvent.findMany({
        where: {
          status: { not: PredictionEventStatus.DRAFT },
          archivedAt: null,
        },
        include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
        take: 200,
        orderBy: { id: 'desc' },
      });
      event =
        candidates.find(
          (row) =>
            slugifyTitle(row.title) === latin ||
            (row.titleEn ? slugifyTitle(row.titleEn) === latin : false) ||
            slugifyTitle(row.slug) === latin,
        ) || null;
    }
    if (
      !event ||
      event.status === PredictionEventStatus.DRAFT ||
      event.archivedAt
    ) {
      throw new NotFoundException('Event not found');
    }

    let myBets: ReturnType<PredictionService['toBetDto']>[] = [];
    let bookmarked = false;
    if (userId) {
      const [bets, bookmark] = await Promise.all([
        this.prisma.predictionBet.findMany({
          where: { userId, eventId: event.id },
          include: { outcome: true },
          orderBy: { id: 'desc' },
        }),
        this.prisma.predictionBookmark.findUnique({
          where: {
            eventId_userId: { eventId: event.id, userId },
          },
          select: { id: true },
        }),
      ]);
      myBets = bets.map((b) => this.toBetDto(b));
      bookmarked = Boolean(bookmark);
    }

    const [dto, series, activity, comments, related] = await Promise.all([
      this.toEventDto(event),
      this.buildChanceSeries(event),
      this.getEventActivity(event.id, 24),
      this.listComments(event.id, 100, userId),
      this.getRelatedEvents(event, 4),
    ]);

    return {
      event: dto,
      series,
      activity,
      comments,
      related,
      myBets,
      bookmarked,
      config: this.getConfig(),
    };
  }

  async listComments(eventId: number, limit = 50, viewerUserId?: number) {
    const rows = await this.prisma.predictionComment.findMany({
      where: {
        eventId,
        status: PredictionCommentStatus.VISIBLE,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            telegramUsername: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
        _count: { select: { likes: true } },
      },
      orderBy: { id: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    const ids = rows.map((r) => r.id);
    const likedIds = new Set<number>();
    if (viewerUserId && ids.length) {
      const mine = await this.prisma.predictionCommentLike.findMany({
        where: { userId: viewerUserId, commentId: { in: ids } },
        select: { commentId: true },
      });
      for (const row of mine) likedIds.add(row.commentId);
    }

    const positions = await this.getCommentPositions(
      eventId,
      rows.map((r) => r.user.id),
    );

    return rows.map((row) =>
      this.toCommentDto(row, {
        likeCount: row._count.likes,
        likedByMe: likedIds.has(row.id),
        position: positions.get(row.user.id) ?? null,
      }),
    );
  }

  /** Dominant market position per user on an event (for Polymarket-style comment badges). */
  private async getCommentPositions(
    eventId: number,
    userIds: number[],
  ): Promise<
    Map<
      number,
      {
        stake: number;
        outcomeKey: string;
        outcomeLabel: string;
        outcomeLabelEn: string | null;
      }
    >
  > {
    const unique = Array.from(new Set(userIds.filter((id) => id > 0)));
    const out = new Map<
      number,
      {
        stake: number;
        outcomeKey: string;
        outcomeLabel: string;
        outcomeLabelEn: string | null;
      }
    >();
    if (!unique.length) return out;

    const bets = await this.prisma.predictionBet.findMany({
      where: {
        eventId,
        userId: { in: unique },
        status: {
          in: [
            PredictionBetStatus.PENDING,
            PredictionBetStatus.WIN,
            PredictionBetStatus.LOSE,
          ],
        },
      },
      select: {
        userId: true,
        stake: true,
        status: true,
        outcome: {
          select: {
            key: true,
            label: true,
            labelEn: true,
          },
        },
      },
    });

    type Agg = {
      stake: number;
      pending: number;
      outcomeKey: string;
      outcomeLabel: string;
      outcomeLabelEn: string | null;
    };
    const byUser = new Map<number, Map<string, Agg>>();

    for (const bet of bets) {
      const key = bet.outcome.key;
      let outcomes = byUser.get(bet.userId);
      if (!outcomes) {
        outcomes = new Map();
        byUser.set(bet.userId, outcomes);
      }
      const stake = Number(bet.stake);
      const cur = outcomes.get(key);
      const pendingAdd =
        bet.status === PredictionBetStatus.PENDING ? stake : 0;
      if (cur) {
        cur.stake += stake;
        cur.pending += pendingAdd;
      } else {
        outcomes.set(key, {
          stake,
          pending: pendingAdd,
          outcomeKey: bet.outcome.key,
          outcomeLabel: bet.outcome.label,
          outcomeLabelEn: bet.outcome.labelEn ?? null,
        });
      }
    }

    for (const [userId, outcomes] of byUser) {
      const list = Array.from(outcomes.values());
      list.sort((a, b) => {
        if (b.pending !== a.pending) return b.pending - a.pending;
        return b.stake - a.stake;
      });
      const top = list[0];
      if (!top) continue;
      const showStake = top.pending > 0 ? top.pending : top.stake;
      out.set(userId, {
        stake: Math.round(showStake * 100) / 100,
        outcomeKey: top.outcomeKey,
        outcomeLabel: top.outcomeLabel,
        outcomeLabelEn: top.outcomeLabelEn,
      });
    }

    return out;
  }

  async addComment(input: {
    eventId: number;
    userId: number;
    body: string;
    gifUrl?: string | null;
    parentId?: number | null;
  }) {
    this.assertCommentRateLimit(input.userId);

    const moderated = moderatePredictionComment(input.body, input.gifUrl);
    if (moderated.ok === false) {
      throw new BadRequestException(commentModerationMessage(moderated.code));
    }
    const cleanBody = moderated.body;
    const gifUrl = moderated.gifUrl;

    const event = await this.prisma.predictionEvent.findUnique({
      where: { id: input.eventId },
      select: { id: true, status: true, slug: true, title: true },
    });
    if (!event || event.status === PredictionEventStatus.DRAFT) {
      throw new NotFoundException('Event not found');
    }

    let parentId: number | null = null;
    let notifyUserId: number | null = null;
    if (input.parentId != null) {
      const parentIdNum = Number(input.parentId);
      if (!Number.isFinite(parentIdNum) || parentIdNum <= 0) {
        throw new BadRequestException('Invalid parent comment');
      }
      const parent = await this.prisma.predictionComment.findUnique({
        where: { id: parentIdNum },
        select: {
          id: true,
          eventId: true,
          userId: true,
          parentId: true,
          status: true,
        },
      });
      if (
        !parent ||
        parent.eventId !== event.id ||
        parent.status !== PredictionCommentStatus.VISIBLE
      ) {
        throw new BadRequestException('Parent comment not found');
      }
      /* One-level threads: reply to a reply attaches under the root. */
      if (parent.parentId == null) {
        parentId = parent.id;
        notifyUserId = parent.userId;
      } else {
        parentId = parent.parentId;
        notifyUserId = parent.userId;
      }
    }

    const created = await this.prisma.predictionComment.create({
      data: {
        eventId: event.id,
        userId: input.userId,
        parentId,
        body: cleanBody || '',
        gifUrl: gifUrl,
        status: PredictionCommentStatus.VISIBLE,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            telegramUsername: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
      },
    });

    if (
      notifyUserId != null &&
      notifyUserId !== input.userId &&
      parentId != null
    ) {
      const replyName = displayPublicName({
        id: created.user.id,
        email: created.user.email,
        telegramUsername: created.user.telegramUsername,
        nickname: created.user.nickname,
      });
      try {
        const notification = {
          eventId: `user_${notifyUserId}`,
          type: 'prediction_comment_reply',
          payload: {
            commentId: created.id,
            parentId,
            eventId: event.id,
            eventSlug: event.slug,
            eventTitle: event.title,
            fromUserId: created.user.id,
            fromName: replyName,
            preview: (cleanBody || '').slice(0, 120),
            timestamp: new Date().toISOString(),
          },
        };
        this.eventGateway.sendUserNotification(String(notifyUserId), notification);
      } catch (err) {
        this.logger.warn(
          `Failed to notify comment reply to user ${notifyUserId}: ${String(err)}`,
        );
      }
    }

    return this.toCommentDto(created, {
      likeCount: 0,
      likedByMe: false,
      position:
        (
          await this.getCommentPositions(event.id, [input.userId])
        ).get(input.userId) ?? null,
    });
  }

  async toggleCommentLike(input: { commentId: number; userId: number }) {
    this.assertLikeRateLimit(input.userId);

    const comment = await this.prisma.predictionComment.findUnique({
      where: { id: input.commentId },
      select: { id: true, status: true },
    });
    if (!comment || comment.status !== PredictionCommentStatus.VISIBLE) {
      throw new NotFoundException('Comment not found');
    }

    const existing = await this.prisma.predictionCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId: comment.id,
          userId: input.userId,
        },
      },
    });

    if (existing) {
      await this.prisma.predictionCommentLike.delete({
        where: { id: existing.id },
      });
    } else {
      await this.prisma.predictionCommentLike.create({
        data: { commentId: comment.id, userId: input.userId },
      });
    }

    const likeCount = await this.prisma.predictionCommentLike.count({
      where: { commentId: comment.id },
    });

    return {
      commentId: comment.id,
      liked: !existing,
      likeCount,
    };
  }

  async toggleBookmark(input: { eventId: number; userId: number }) {
    const event = await this.prisma.predictionEvent.findUnique({
      where: { id: input.eventId },
      select: { id: true, status: true, slug: true },
    });
    if (!event || event.status === PredictionEventStatus.DRAFT) {
      throw new NotFoundException('Event not found');
    }

    const existing = await this.prisma.predictionBookmark.findUnique({
      where: {
        eventId_userId: { eventId: event.id, userId: input.userId },
      },
    });

    if (existing) {
      await this.prisma.predictionBookmark.delete({ where: { id: existing.id } });
      return { eventId: event.id, slug: event.slug, bookmarked: false };
    }

    await this.prisma.predictionBookmark.create({
      data: { eventId: event.id, userId: input.userId },
    });
    return { eventId: event.id, slug: event.slug, bookmarked: true };
  }

  async listBookmarks(userId: number) {
    const rows = await this.prisma.predictionBookmark.findMany({
      where: { userId },
      include: {
        event: {
          include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
        },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });
    const events = await Promise.all(
      rows
        .filter((r) => r.event && !r.event.archivedAt && r.event.status !== PredictionEventStatus.DRAFT)
        .map((r) => this.toEventDto(r.event)),
    );
    return events;
  }

  /** Recent trades across all markets (hub tape). */
  async getGlobalActivity(limit = 30) {
    const take = Math.min(Math.max(limit, 1), 50);
    const rows = await this.prisma.predictionBet.findMany({
      where: { status: { not: PredictionBetStatus.VOID } },
      include: {
        outcome: { select: { key: true, label: true, labelEn: true } },
        user: { select: { id: true, nickname: true } },
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            titleEn: true,
            archivedAt: true,
            status: true,
          },
        },
      },
      orderBy: { id: 'desc' },
      take: take * 2,
    });

    return rows
      .filter(
        (b) =>
          b.event &&
          !b.event.archivedAt &&
          b.event.status !== PredictionEventStatus.DRAFT,
      )
      .slice(0, take)
      .map((b) => ({
        id: b.id,
        stake: Number(b.stake),
        currencyCode: b.currencyCode,
        odds: Number(b.odds),
        createdAt: b.createdAt.toISOString(),
        outcomeKey: b.outcome.key,
        outcomeLabel: b.outcome.label,
        outcomeLabelEn: b.outcome.labelEn ?? null,
        trader: b.user.nickname?.trim() || `u${b.user.id}`,
        event: {
          id: b.event!.id,
          slug: b.event!.slug,
          title: b.event!.title,
          titleEn: b.event!.titleEn ?? null,
        },
      }));
  }

  /** Top traders by settled PnL (USD-normalized approx). */
  async getLeaderboard(limit = 10) {
    const take = Math.min(Math.max(limit, 1), 25);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.predictionBet.findMany({
      where: {
        status: {
          in: [PredictionBetStatus.WIN, PredictionBetStatus.LOSE],
        },
        settledAt: { gte: since },
      },
      select: {
        userId: true,
        stake: true,
        potentialPayout: true,
        currencyCode: true,
        status: true,
        user: { select: { id: true, nickname: true, avatarUrl: true, avatarPreset: true } },
      },
      take: 5_000,
    });

    const byUser = new Map<
      number,
      {
        userId: number;
        trader: string;
        avatarUrl: string | null;
        avatarPreset: string | null;
        pnlUsd: number;
        bets: number;
        wins: number;
      }
    >();

    for (const b of rows) {
      const stakeUsd = predictionStakeToUsd(Number(b.stake), b.currencyCode);
      const payoutUsd = predictionStakeToUsd(
        Number(b.potentialPayout),
        b.currencyCode,
      );
      const delta =
        b.status === PredictionBetStatus.WIN ? payoutUsd - stakeUsd : -stakeUsd;
      const cur = byUser.get(b.userId) || {
        userId: b.userId,
        trader: b.user.nickname?.trim() || `u${b.user.id}`,
        avatarUrl: b.user.avatarUrl ?? null,
        avatarPreset: b.user.avatarPreset ?? null,
        pnlUsd: 0,
        bets: 0,
        wins: 0,
      };
      cur.pnlUsd += delta;
      cur.bets += 1;
      if (b.status === PredictionBetStatus.WIN) cur.wins += 1;
      byUser.set(b.userId, cur);
    }

    return [...byUser.values()]
      .sort((a, b) => b.pnlUsd - a.pnlUsd)
      .slice(0, take)
      .map((r) => ({
        ...r,
        pnlUsd: Number(r.pnlUsd.toFixed(2)),
        winRate: r.bets > 0 ? Number(((r.wins / r.bets) * 100).toFixed(1)) : null,
      }));
  }

  private assertCommentRateLimit(userId: number) {
    const now = Date.now();
    const windowMs = 60_000;
    const max = 6;
    const bucket = this.commentHits.get(userId);
    if (!bucket || now >= bucket.resetAt) {
      this.commentHits.set(userId, { count: 1, resetAt: now + windowMs });
      return;
    }
    bucket.count += 1;
    if (bucket.count > max) {
      throw new HttpException(
        'Слишком много комментариев. Подождите минуту.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private assertLikeRateLimit(userId: number) {
    const now = Date.now();
    const windowMs = 60_000;
    const max = 40;
    const bucket = this.likeHits.get(userId);
    if (!bucket || now >= bucket.resetAt) {
      this.likeHits.set(userId, { count: 1, resetAt: now + windowMs });
      return;
    }
    bucket.count += 1;
    if (bucket.count > max) {
      throw new HttpException(
        'Слишком много действий. Подождите минуту.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private toCommentDto(
    row: {
      id: number;
      body: string;
      gifUrl?: string | null;
      parentId?: number | null;
      createdAt: Date;
      user: {
        id: number;
        email: string;
        nickname: string | null;
        telegramUsername: string | null;
        avatarUrl: string | null;
        avatarPreset: string | null;
      };
    },
    extras?: {
      likeCount?: number;
      likedByMe?: boolean;
      position?: {
        stake: number;
        outcomeKey: string;
        outcomeLabel: string;
        outcomeLabelEn: string | null;
      } | null;
    },
  ) {
    const nickname = row.user.nickname?.trim() || null;
    return {
      id: row.id,
      parentId: row.parentId ?? null,
      body: row.body,
      gifUrl: row.gifUrl ?? null,
      likeCount: extras?.likeCount ?? 0,
      likedByMe: Boolean(extras?.likedByMe),
      createdAt: row.createdAt.toISOString(),
      position: extras?.position ?? null,
      user: {
        id: row.user.id,
        nickname,
        name: displayPublicName({
          id: row.user.id,
          email: row.user.email,
          telegramUsername: row.user.telegramUsername,
          nickname,
        }),
        avatarUrl: row.user.avatarUrl ?? null,
        avatarPreset: row.user.avatarPreset ?? null,
      },
    };
  }

  /**
   * GIF search priority:
   * 1) Giphy when GIPHY_API_KEY is set
   * 2) OtakuGIFs open API (no key) + curated pack
   * 3) curated pack alone as last resort
   */
  async searchGifs(query: string, pos?: string) {
    const q = String(query || '').trim().slice(0, 64);
    const giphyKey = process.env.GIPHY_API_KEY?.trim();
    let result: { items: Array<{ id: string; url: string; preview: string; title: string }>; next: string | null };
    if (giphyKey) {
      result = await this.searchGiphy(q || 'funny', giphyKey, pos);
    } else {
      try {
        result = await this.searchOtakuGifs(q || 'funny', pos);
      } catch (err) {
        this.logger.warn(
          `OtakuGIFs search error: ${err instanceof Error ? err.message : String(err)}`,
        );
        result = this.searchCuratedGifs(q || 'funny', pos);
      }
    }
    return {
      items: result.items.map((item) => ({
        ...item,
        /* Tiny thumbs via same-origin proxy — huge CDN GIFs blank out grid cells. */
        preview: this.toGifProxyPath(
          this.toGifThumbUrl(item.preview || item.url),
        ),
      })),
      next: result.next,
    };
  }

  async proxyGifMedia(rawUrl: string): Promise<
    | { ok: true; body: Buffer; contentType: string }
    | { ok: false; status: number; message: string }
  > {
    let url = String(rawUrl || '').trim();
    if (!url) return { ok: false, status: 400, message: 'Missing url' };
    try {
      url = decodeURIComponent(url);
    } catch {
      /* keep raw */
    }
    if (!isAllowedPredictionGifUrl(url)) {
      return { ok: false, status: 400, message: 'URL not allowed' };
    }
    try {
      const upstream = await fetch(url, {
        headers: {
          Accept: 'image/*,*/*',
          'User-Agent': 'imba-bet-prediction/1.0',
        },
        signal: AbortSignal.timeout(12_000),
        redirect: 'follow',
      });
      if (!upstream.ok) {
        return {
          ok: false,
          status: upstream.status === 404 ? 404 : 502,
          message: `Upstream ${upstream.status}`,
        };
      }
      const contentType = (
        upstream.headers.get('content-type') || 'image/gif'
      ).split(';')[0]!;
      if (!contentType.startsWith('image/')) {
        return { ok: false, status: 502, message: 'Not an image' };
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.byteLength < 24 || buf.byteLength > 8_000_000) {
        return { ok: false, status: 502, message: 'Invalid image size' };
      }
      return { ok: true, body: buf, contentType };
    } catch (err) {
      this.logger.warn(
        `GIF proxy failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ok: false, status: 502, message: 'Fetch failed' };
    }
  }

  private toGifProxyPath(url: string): string {
    return `/api/casino/prediction/gifs/media?u=${encodeURIComponent(url)}`;
  }

  /** Prefer lightweight Giphy preview assets for picker thumbs. */
  private toGifThumbUrl(url: string): string {
    const raw = String(url || '').trim();
    const m = raw.match(
      /^(https:\/\/(?:media\d*\.|i\.)giphy\.com\/media\/[^/?#]+\/)/i,
    );
    if (m) return `${m[1]}giphy-preview.gif`;
    return raw;
  }

  /** Open reaction GIF API — https://otakugifs.xyz (no API key). */
  private static readonly OTAKU_REACTIONS = [
    'happy',
    'sad',
    'smile',
    'dance',
    'clap',
    'thumbsup',
    'yes',
    'no',
    'laugh',
    'cry',
    'wink',
    'shrug',
    'confused',
    'smug',
    'wave',
    'kiss',
    'hug',
    'punch',
    'slap',
    'bite',
    'blush',
    'handhold',
    'nom',
    'poke',
    'stare',
    'tired',
    'sleep',
    'nervous',
    'scared',
    'surprised',
    'pout',
    'cuddle',
    'facepalm',
    'cool',
  ] as const;

  private matchOtakuReactions(query: string): string[] {
    const q = query.toLowerCase().trim();
    const aliases: Record<string, string[]> = {
      funny: [
        'laugh',
        'happy',
        'smile',
        'dance',
        'clap',
        'cool',
        'smug',
        'facepalm',
        'shrug',
        'wink',
      ],
      lol: ['laugh', 'happy', 'smile', 'dance'],
      haha: ['laugh', 'happy'],
      да: ['yes', 'thumbsup', 'happy', 'clap'],
      нет: ['no', 'shrug', 'facepalm', 'sad'],
      yes: ['yes', 'thumbsup', 'happy', 'clap'],
      no: ['no', 'shrug', 'facepalm'],
      win: ['clap', 'happy', 'dance', 'thumbsup', 'cool'],
      lose: ['sad', 'cry', 'facepalm', 'tired'],
      money: ['cool', 'smug', 'thumbsup', 'happy'],
      wow: ['surprised', 'confused', 'nervous'],
      omg: ['surprised', 'scared', 'confused'],
      think: ['stare', 'confused', 'shrug', 'nervous'],
      думаю: ['stare', 'confused', 'shrug'],
      радость: ['happy', 'smile', 'dance', 'laugh'],
      грусть: ['sad', 'cry', 'tired'],
      смех: ['laugh', 'happy', 'smile'],
      кот: ['poke', 'smug', 'wink', 'happy'],
      cat: ['poke', 'smug', 'wink', 'happy'],
    };
    if (aliases[q]) return aliases[q];
    const direct = PredictionService.OTAKU_REACTIONS.filter(
      (r) => r === q || r.includes(q) || q.includes(r),
    );
    if (direct.length) return [...direct];
    for (const [key, list] of Object.entries(aliases)) {
      if (key.includes(q) || q.includes(key)) return list;
    }
    return [...PredictionService.OTAKU_REACTIONS];
  }

  private async searchOtakuGifs(q: string, pos?: string) {
    const page = Math.max(0, Number(pos) || 0);
    const pageSize = 24;
    const reactions = this.matchOtakuReactions(q);
    const curated = this.searchCuratedGifs(q, '0');
    const curatedItems =
      page === 0
        ? curated.items.filter((item) => isAllowedPredictionGifUrl(item.url))
        : [];

    const need = Math.max(pageSize - curatedItems.length, 12);
    const fetches = Array.from({ length: need }, (_, i) => {
      const reaction = reactions[(page * pageSize + i) % reactions.length]!;
      return fetch(
        `https://api.otakugifs.xyz/gif?reaction=${encodeURIComponent(reaction)}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'imba-bet-prediction/1.0',
          },
          signal: AbortSignal.timeout(6_000),
        },
      )
        .then(async (res) => {
          if (!res.ok) return null;
          const data = (await res.json()) as { url?: string };
          const url = String(data.url || '').trim();
          if (!isAllowedPredictionGifUrl(url)) return null;
          return {
            id: `otaku-${reaction}-${Buffer.from(url).toString('base64url')}`,
            url,
            preview: url,
            title: reaction,
          };
        })
        .catch(() => null);
    });

    const remote = (await Promise.all(fetches)).filter(
      (x): x is NonNullable<typeof x> => Boolean(x),
    );
    const seen = new Set<string>();
    const items = [...curatedItems, ...remote].filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    return {
      items: items.slice(0, pageSize + curatedItems.length),
      /* Always allow another random page — otakugifs returns fresh picks. */
      next: String(page + 1),
    };
  }

  private async searchGiphy(q: string, apiKey: string, pos?: string) {
    const offset = Math.max(0, Number(pos) || 0);
    const params = new URLSearchParams({
      api_key: apiKey,
      q,
      limit: '24',
      offset: String(offset),
      rating: 'pg-13',
      lang: 'en',
    });
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?${params.toString()}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!res.ok) {
        this.logger.warn(`Giphy search failed: ${res.status}`);
        return this.searchCuratedGifs(q, pos);
      }
      const data = (await res.json()) as {
        data?: Array<{
          id?: string;
          title?: string;
          images?: {
            fixed_height_small?: { url?: string };
            preview_gif?: { url?: string };
            downsized?: { url?: string };
            original?: { url?: string };
          };
        }>;
        pagination?: { total_count?: number; count?: number; offset?: number };
      };
      const items = (data.data ?? [])
        .map((row) => {
          const images = row.images ?? {};
          const url =
            images.downsized?.url ||
            images.fixed_height_small?.url ||
            images.original?.url ||
            null;
          const preview =
            images.fixed_height_small?.url ||
            images.preview_gif?.url ||
            url;
          if (!url || !preview) return null;
          if (!isAllowedPredictionGifUrl(url)) return null;
          return {
            id: String(row.id ?? url),
            url,
            preview,
            title: String(row.title || q).slice(0, 80),
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
      const nextOffset =
        offset + (data.pagination?.count ?? items.length);
      const total = data.pagination?.total_count ?? nextOffset;
      return {
        items,
        next: nextOffset < total ? String(nextOffset) : null,
      };
    } catch (err) {
      this.logger.warn(
        `Giphy search error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.searchCuratedGifs(q, pos);
    }
  }

  private searchCuratedGifs(query: string, pos?: string) {
    const q = query.toLowerCase().trim();
    const showAll =
      !q ||
      q === 'funny' ||
      q === 'lol' ||
      q === 'all' ||
      q === 'все';
    const pack = showAll
      ? CURATED_PREDICTION_GIFS
      : CURATED_PREDICTION_GIFS.filter((g) =>
          g.tags.some(
            (tag) =>
              tag.includes(q) ||
              q.includes(tag) ||
              g.title.toLowerCase().includes(q),
          ),
        );
    const pool = pack.length > 0 ? pack : CURATED_PREDICTION_GIFS;
    const offset = Math.max(0, Number(pos) || 0);
    const slice = pool.slice(offset, offset + 24);
    const next =
      offset + slice.length < pool.length ? String(offset + slice.length) : null;
    return {
      items: slice.map((g) => ({
        id: g.id,
        url: g.url,
        preview: g.preview,
        title: g.title,
      })),
      next,
    };
  }

  private async getEventActivity(eventId: number, limit = 24) {
    const rows = await this.prisma.predictionBet.findMany({
      where: {
        eventId,
        status: { not: PredictionBetStatus.VOID },
      },
      include: {
        outcome: {
          select: { key: true, label: true, labelEn: true },
        },
        user: { select: { id: true, nickname: true } },
      },
      orderBy: { id: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
    });

    return rows.map((b) => ({
      id: b.id,
      stake: Number(b.stake),
      currencyCode: b.currencyCode,
      odds: Number(b.odds),
      createdAt: b.createdAt.toISOString(),
      outcomeKey: b.outcome.key,
      outcomeLabel: b.outcome.label,
      outcomeLabelEn: b.outcome.labelEn ?? null,
      trader: b.user.nickname?.trim() || `u${b.user.id}`,
    }));
  }

  private async getRelatedEvents(
    event: {
      id: number;
      category: string;
    },
    limit = 4,
  ) {
    const take = Math.min(Math.max(limit, 1), 8);
    const same = await this.prisma.predictionEvent.findMany({
      where: {
        id: { not: event.id },
        category: event.category,
        archivedAt: null,
        status: {
          in: [PredictionEventStatus.OPEN, PredictionEventStatus.LOCKED],
        },
      },
      include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ closesAt: 'asc' }, { id: 'desc' }],
      take,
    });
    if (same.length >= take) {
      return Promise.all(same.map((row) => this.toEventDto(row)));
    }
    const exclude = new Set([event.id, ...same.map((r) => r.id)]);
    const more = await this.prisma.predictionEvent.findMany({
      where: {
        id: { notIn: [...exclude] },
        archivedAt: null,
        status: {
          in: [PredictionEventStatus.OPEN, PredictionEventStatus.LOCKED],
        },
      },
      include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ closesAt: 'asc' }, { id: 'desc' }],
      take: take - same.length,
    });
    return Promise.all(
      [...same, ...more].map((row) => this.toEventDto(row)),
    );
  }

  async getMyBets(userId: number, limit = 30) {
    const rows = await this.prisma.predictionBet.findMany({
      where: { userId },
      include: {
        outcome: true,
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            titleEn: true,
            status: true,
          },
        },
      },
      orderBy: { id: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map((b) => ({
      ...this.toBetDto(b),
      event: b.event
        ? {
            id: b.event.id,
            slug: b.event.slug,
            title: b.event.title,
            titleEn: b.event.titleEn ?? null,
            status: b.event.status,
          }
        : undefined,
    }));
  }

  /** Public Polymarket-style trader stats for prediction markets. */
  async getPublicTraderProfile(params: {
    idOrNick?: string;
    range?: string;
    currencyCode?: string;
  }) {
    const raw = (params.idOrNick ?? '').trim();
    const asId = Number(raw);
    const looksLikeId =
      Number.isFinite(asId) && asId > 0 && String(asId) === raw;

    let user: {
      id: number;
      email: string;
      telegramUsername: string | null;
      nickname: string | null;
      avatarPreset: string | null;
      avatarUrl: string | null;
      createdAt: Date;
    } | null = null;

    if (raw && !looksLikeId) {
      user = await this.prisma.user.findFirst({
        where: { nickname: { equals: raw, mode: 'insensitive' } },
        select: {
          id: true,
          email: true,
          telegramUsername: true,
          nickname: true,
          avatarPreset: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
      if (!user) {
        const tg = raw.replace(/^@+/, '');
        user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { telegramUsername: { equals: tg, mode: 'insensitive' } },
              { telegramUsername: { equals: `@${tg}`, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            email: true,
            telegramUsername: true,
            nickname: true,
            avatarPreset: true,
            avatarUrl: true,
            createdAt: true,
          },
        });
      }
    }

    if (!user) {
      const userId = looksLikeId ? asId : NaN;
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new NotFoundException('Trader not found');
      }
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          telegramUsername: true,
          nickname: true,
          avatarPreset: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
    }
    if (!user) throw new NotFoundException('Trader not found');

    const currency = (params.currencyCode || 'KZT').toUpperCase();
    const rangeRaw = (params.range || 'all').toLowerCase();
    const range =
      rangeRaw === '1d' ||
      rangeRaw === '1w' ||
      rangeRaw === '1m' ||
      rangeRaw === '1y' ||
      rangeRaw === 'ytd' ||
      rangeRaw === 'all'
        ? rangeRaw
        : 'all';
    const now = Date.now();
    const since =
      range === 'all'
        ? undefined
        : range === 'ytd'
          ? new Date(new Date(now).getFullYear(), 0, 1)
          : new Date(
              now -
                (range === '1d'
                  ? 86_400_000
                  : range === '1w'
                    ? 7 * 86_400_000
                    : range === '1m'
                      ? 30 * 86_400_000
                      : 365 * 86_400_000),
            );

    const bets = await this.prisma.predictionBet.findMany({
      where: {
        userId: user.id,
        currencyCode: currency,
      },
      include: {
        outcome: {
          select: {
            id: true,
            key: true,
            label: true,
            labelEn: true,
            odds: true,
          },
        },
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            titleEn: true,
            imageUrl: true,
            status: true,
            closesAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 2_000,
    });

    let stakeTotal = 0;
    let positionsValue = 0;
    let wins = 0;
    let losses = 0;
    let voids = 0;
    let pnl = 0;
    let biggestWin = 0;
    const eventIds = new Set<number>();
    const seriesEvents: Array<{ t: number; d: number }> = [];
    const activeMap = new Map<
      string,
      {
        eventId: number;
        outcomeId: number;
        slug: string;
        title: string;
        titleEn: string | null;
        imageUrl: string | null;
        eventStatus: string;
        outcomeKey: string;
        outcomeLabel: string;
        outcomeLabelEn: string | null;
        stake: number;
        potentialPayout: number;
        oddsSum: number;
        bets: number;
        currentOdds: number;
      }
    >();
    const closed: Array<{
      id: number;
      eventId: number;
      slug: string;
      title: string;
      titleEn: string | null;
      imageUrl: string | null;
      outcomeKey: string;
      outcomeLabel: string;
      outcomeLabelEn: string | null;
      stake: number;
      odds: number;
      potentialPayout: number;
      pnl: number;
      status: string;
      settledAt: string | null;
      createdAt: string;
    }> = [];
    const recent: Array<{
      id: number;
      eventId: number;
      slug: string;
      title: string;
      titleEn: string | null;
      imageUrl: string | null;
      outcomeKey: string;
      outcomeLabel: string;
      outcomeLabelEn: string | null;
      stake: number;
      odds: number;
      potentialPayout: number;
      pnl: number | null;
      status: string;
      settledAt: string | null;
      createdAt: string;
    }> = [];

    for (const bet of bets) {
      const stake = Number(bet.stake);
      const payout = Number(bet.potentialPayout);
      const odds = Number(bet.odds);
      eventIds.add(bet.eventId);
      stakeTotal += stake;

      if (bet.status === PredictionBetStatus.PENDING) {
        positionsValue += stake;
        const key = `${bet.eventId}:${bet.outcomeId}`;
        const cur = activeMap.get(key);
        if (cur) {
          cur.stake += stake;
          cur.potentialPayout += payout;
          cur.oddsSum += odds * stake;
          cur.bets += 1;
        } else {
          activeMap.set(key, {
            eventId: bet.eventId,
            outcomeId: bet.outcomeId,
            slug: bet.event.slug,
            title: bet.event.title,
            titleEn: bet.event.titleEn ?? null,
            imageUrl: bet.event.imageUrl ?? null,
            eventStatus: bet.event.status,
            outcomeKey: bet.outcome.key,
            outcomeLabel: bet.outcome.label,
            outcomeLabelEn: bet.outcome.labelEn ?? null,
            stake,
            potentialPayout: payout,
            oddsSum: odds * stake,
            bets: 1,
            currentOdds: Number(bet.outcome.odds),
          });
        }
      } else if (
        bet.status === PredictionBetStatus.WIN ||
        bet.status === PredictionBetStatus.LOSE
      ) {
        const delta =
          bet.status === PredictionBetStatus.WIN ? payout - stake : -stake;
        const t = (bet.settledAt ?? bet.createdAt).getTime();
        if (!since || t >= since.getTime()) {
          seriesEvents.push({ t, d: delta });
          pnl += delta;
        }
        if (delta > biggestWin) biggestWin = delta;
        if (bet.status === PredictionBetStatus.WIN) wins += 1;
        else losses += 1;
        closed.push({
          id: bet.id,
          eventId: bet.eventId,
          slug: bet.event.slug,
          title: bet.event.title,
          titleEn: bet.event.titleEn ?? null,
          imageUrl: bet.event.imageUrl ?? null,
          outcomeKey: bet.outcome.key,
          outcomeLabel: bet.outcome.label,
          outcomeLabelEn: bet.outcome.labelEn ?? null,
          stake,
          odds,
          potentialPayout: payout,
          pnl: delta,
          status: bet.status,
          settledAt: bet.settledAt?.toISOString() ?? null,
          createdAt: bet.createdAt.toISOString(),
        });
      } else if (bet.status === PredictionBetStatus.VOID) {
        voids += 1;
        closed.push({
          id: bet.id,
          eventId: bet.eventId,
          slug: bet.event.slug,
          title: bet.event.title,
          titleEn: bet.event.titleEn ?? null,
          imageUrl: bet.event.imageUrl ?? null,
          outcomeKey: bet.outcome.key,
          outcomeLabel: bet.outcome.label,
          outcomeLabelEn: bet.outcome.labelEn ?? null,
          stake,
          odds,
          potentialPayout: payout,
          pnl: 0,
          status: bet.status,
          settledAt: bet.settledAt?.toISOString() ?? null,
          createdAt: bet.createdAt.toISOString(),
        });
      }

      const settledPnl =
        bet.status === PredictionBetStatus.WIN
          ? payout - stake
          : bet.status === PredictionBetStatus.LOSE
            ? -stake
            : bet.status === PredictionBetStatus.VOID
              ? 0
              : null;
      recent.push({
        id: bet.id,
        eventId: bet.eventId,
        slug: bet.event.slug,
        title: bet.event.title,
        titleEn: bet.event.titleEn ?? null,
        imageUrl: bet.event.imageUrl ?? null,
        outcomeKey: bet.outcome.key,
        outcomeLabel: bet.outcome.label,
        outcomeLabelEn: bet.outcome.labelEn ?? null,
        stake,
        odds,
        potentialPayout: payout,
        pnl: settledPnl,
        status: bet.status,
        settledAt: bet.settledAt?.toISOString() ?? null,
        createdAt: bet.createdAt.toISOString(),
      });
    }

    seriesEvents.sort((a, b) => a.t - b.t);
    let running = 0;
    const series =
      seriesEvents.length === 0
        ? [{ t: now, v: 0 }]
        : seriesEvents.map((e) => {
            running += e.d;
            return { t: e.t, v: running };
          });

    const positions = Array.from(activeMap.values())
      .map((p) => ({
        eventId: p.eventId,
        outcomeId: p.outcomeId,
        slug: p.slug,
        title: p.title,
        titleEn: p.titleEn,
        imageUrl: p.imageUrl,
        eventStatus: p.eventStatus,
        outcomeKey: p.outcomeKey,
        outcomeLabel: p.outcomeLabel,
        outcomeLabelEn: p.outcomeLabelEn,
        stake: Math.round(p.stake * 100) / 100,
        potentialPayout: Math.round(p.potentialPayout * 100) / 100,
        avgOdds: p.stake > 0 ? Math.round((p.oddsSum / p.stake) * 100) / 100 : 0,
        currentOdds: p.currentOdds,
        bets: p.bets,
      }))
      .sort((a, b) => b.stake - a.stake);

    closed.sort((a, b) => {
      const ta = Date.parse(a.settledAt ?? a.createdAt);
      const tb = Date.parse(b.settledAt ?? b.createdAt);
      return tb - ta;
    });
    recent.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const decided = wins + losses;
    return {
      user: {
        id: user.id,
        name: displayPublicName(user),
        nickname: user.nickname,
        avatarPreset: user.avatarPreset,
        avatarUrl: user.avatarUrl,
        joinedAt: user.createdAt.toISOString(),
      },
      range,
      currencyCode: currency,
      summary: {
        bets: bets.length,
        wins,
        losses,
        voids,
        markets: eventIds.size,
        stakeTotal: Math.round(stakeTotal * 100) / 100,
        positionsValue: Math.round(positionsValue * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        biggestWin: Math.round(biggestWin * 100) / 100,
        winRate: decided > 0 ? Math.round((wins / decided) * 1000) / 10 : null,
      },
      series,
      positions,
      closed: closed.slice(0, 50),
      recent: recent.slice(0, 40),
    };
  }

  async placeBet(params: {
    userId: number;
    eventId: number;
    outcomeId: number;
    stake: number;
    currencyCode?: string;
  }) {
    await this.autoLockExpired();

    const currencyCode = (params.currencyCode || 'KZT').toUpperCase();
    const stake = Number(params.stake);
    if (!Number.isFinite(stake) || stake <= 0) {
      throw new BadRequestException('Invalid stake');
    }

    const minStake = predictionMinStake(currencyCode);
    const maxStake = predictionMaxStake(currencyCode);
    if (stake < minStake) {
      throw new BadRequestException(`Минимальная ставка: ${minStake} ${currencyCode}`);
    }
    if (stake > maxStake) {
      throw new BadRequestException(`Максимальная ставка: ${maxStake} ${currencyCode}`);
    }

    const event = await this.prisma.predictionEvent.findUnique({
      where: { id: params.eventId },
      include: { outcomes: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.archivedAt) {
      throw new BadRequestException('Событие в архиве');
    }
    if (event.status !== PredictionEventStatus.OPEN) {
      throw new BadRequestException('Ставки на это событие закрыты');
    }
    if (event.closesAt && event.closesAt.getTime() <= Date.now()) {
      await this.prisma.predictionEvent.update({
        where: { id: event.id },
        data: { status: PredictionEventStatus.LOCKED },
      });
      throw new BadRequestException('Ставки на это событие закрыты');
    }

    const outcome = event.outcomes.find((o) => o.id === params.outcomeId);
    if (!outcome) throw new BadRequestException('Неверный исход');

    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currencyCode: { userId: params.userId, currencyCode },
      },
    });
    if (!balance) throw new BadRequestException('Balance not found');

    const effectiveStake = computeMainAccountBetDebit(
      balance.amount,
      new Decimal(stake),
    );
    if (effectiveStake.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Insufficient funds');
    }

    const odds = new Decimal(outcome.odds);
    const potentialPayout = effectiveStake.mul(odds).toDecimalPlaces(2);

    const pending = await this.prisma.predictionBet.findMany({
      where: { eventId: event.id, status: PredictionBetStatus.PENDING },
      select: {
        userId: true,
        outcomeId: true,
        stake: true,
        potentialPayout: true,
      },
    });

    const userPending = pending.filter((b) => b.userId === params.userId);
    if (userPending.length >= PREDICTION_MAX_USER_BETS_PER_EVENT) {
      throw new BadRequestException(
        `Лимит ставок на событие: максимум ${PREDICTION_MAX_USER_BETS_PER_EVENT}`,
      );
    }
    const userStakeSum = userPending.reduce((acc, b) => acc + Number(b.stake), 0);
    if (userStakeSum + Number(effectiveStake) > PREDICTION_MAX_USER_STAKE_PER_EVENT) {
      throw new BadRequestException(
        `Лимит суммы на событие: максимум ${PREDICTION_MAX_USER_STAKE_PER_EVENT}`,
      );
    }

    const outcomeExposure = pending
      .filter((b) => b.outcomeId === outcome.id)
      .reduce((acc, b) => acc + Number(b.potentialPayout), 0);
    if (outcomeExposure + Number(potentialPayout) > PREDICTION_MAX_OUTCOME_EXPOSURE) {
      throw new BadRequestException(
        'Исход переполнен по лимиту. Выберите другой исход или меньшую сумму.',
      );
    }

    const bet = await this.prisma.$transaction(async (tx) => {
      const live = await tx.predictionEvent.findUnique({ where: { id: event.id } });
      if (!live || live.archivedAt || live.status !== PredictionEventStatus.OPEN) {
        throw new BadRequestException('Ставки на это событие закрыты');
      }
      if (live.closesAt && live.closesAt.getTime() <= Date.now()) {
        await tx.predictionEvent.update({
          where: { id: live.id },
          data: { status: PredictionEventStatus.LOCKED },
        });
        throw new BadRequestException('Ставки на это событие закрыты');
      }

      await this.operationService.create(tx, params.userId, {
        amount: effectiveStake,
        currencyCode,
        source: OperationSource.PREDICTION,
        status: OperationStatus.SUCCESS,
        type: OperationType.OUTCOME,
        meta: {
          game: 'prediction',
          action: 'place',
          eventId: event.id,
          outcomeId: outcome.id,
          outcomeKey: outcome.key,
          slug: event.slug,
        },
      });

      return tx.predictionBet.create({
        data: {
          userId: params.userId,
          eventId: event.id,
          outcomeId: outcome.id,
          stake: effectiveStake,
          currencyCode,
          odds,
          potentialPayout,
          status: PredictionBetStatus.PENDING,
        },
        include: { outcome: true },
      });
    });

    return this.toBetDto(bet);
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  async adminList(status?: string, archived?: '1' | '0' | 'all') {
    await this.autoLockExpired();
    const where: Prisma.PredictionEventWhereInput = {};
    if (status) {
      where.status = status as PredictionEventStatus;
    }
    if (archived === '1') {
      where.archivedAt = { not: null };
    } else if (archived !== 'all') {
      // default: active (not archived)
      where.archivedAt = null;
    }
    const rows = await this.prisma.predictionEvent.findMany({
      where,
      include: {
        outcomes: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { bets: true } },
      },
      orderBy: { id: 'desc' },
      take: 200,
    });
    return Promise.all(
      rows.map(async (row) => {
        const dto = await this.toEventDto(row);
        return { ...dto, betsCount: row._count.bets };
      }),
    );
  }

  async adminCreate(input: CreateEventInput) {
    const outcomes = this.normalizeOutcomes(input.outcomes);
    const slug = await this.ensureUniqueSlug(
      input.slug ||
        slugifyTitle(input.titleEn?.trim() || input.title),
    );
    const resolveRule = input.resolveRule?.trim() || null;
    if (input.publish && !resolveRule) {
      throw new BadRequestException(
        'Для публикации укажите правило резолва (источник + время)',
      );
    }

    const event = await this.prisma.predictionEvent.create({
      data: {
        slug,
        title: input.title.trim(),
        titleEn: input.titleEn?.trim() || null,
        description: input.description?.trim() || null,
        descriptionEn: input.descriptionEn?.trim() || null,
        category: (input.category || 'other').trim().toLowerCase(),
        imageUrl: this.normalizeMediaUrl(input.imageUrl),
        bannerUrl: this.normalizeMediaUrl(input.bannerUrl),
        videoUrl: this.normalizeMediaUrl(input.videoUrl),
        resolveRule,
        resolveRuleEn: input.resolveRuleEn?.trim() || null,
        status: input.publish
          ? PredictionEventStatus.OPEN
          : PredictionEventStatus.DRAFT,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        resolvesAt: input.resolvesAt ? new Date(input.resolvesAt) : null,
        outcomes: {
          create: outcomes.map((o, i) => ({
            key: o.key,
            label: o.label,
            labelEn: o.labelEn?.trim() || null,
            odds: new Decimal(o.odds),
            sortOrder: o.sortOrder ?? i,
          })),
        },
      },
      include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
    });

    return this.toEventDto(event);
  }

  async adminUpdate(
    eventId: number,
    input: Partial<CreateEventInput> & {
      status?: PredictionEventStatus;
    },
  ) {
    const existing = await this.prisma.predictionEvent.findUnique({
      where: { id: eventId },
      include: { outcomes: true },
    });
    if (!existing) throw new NotFoundException('Event not found');
    if (
      existing.status === PredictionEventStatus.SETTLED ||
      existing.status === PredictionEventStatus.VOID
    ) {
      throw new BadRequestException('Нельзя менять рассчитанное событие');
    }

    const data: Prisma.PredictionEventUpdateInput = {};
    if (input.title != null) data.title = input.title.trim();
    if (input.titleEn !== undefined) {
      data.titleEn = input.titleEn?.trim() || null;
    }
    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }
    if (input.descriptionEn !== undefined) {
      data.descriptionEn = input.descriptionEn?.trim() || null;
    }
    if (input.category != null) data.category = input.category.trim().toLowerCase();
    if (input.imageUrl !== undefined) {
      data.imageUrl = this.normalizeMediaUrl(input.imageUrl);
    }
    if (input.bannerUrl !== undefined) {
      data.bannerUrl = this.normalizeMediaUrl(input.bannerUrl);
    }
    if (input.videoUrl !== undefined) {
      data.videoUrl = this.normalizeMediaUrl(input.videoUrl);
    }
    if (input.resolveRule !== undefined) {
      data.resolveRule = input.resolveRule?.trim() || null;
    }
    if (input.resolveRuleEn !== undefined) {
      data.resolveRuleEn = input.resolveRuleEn?.trim() || null;
    }
    if (input.closesAt !== undefined) {
      data.closesAt = input.closesAt ? new Date(input.closesAt) : null;
    }
    if (input.resolvesAt !== undefined) {
      data.resolvesAt = input.resolvesAt ? new Date(input.resolvesAt) : null;
    }
    if (input.status) {
      const allowed: PredictionEventStatus[] = [
        PredictionEventStatus.DRAFT,
        PredictionEventStatus.OPEN,
        PredictionEventStatus.LOCKED,
      ];
      if (!allowed.includes(input.status)) {
        throw new BadRequestException('Недопустимый статус');
      }
      data.status = input.status;
    }

    if (input.outcomes?.length) {
      const outcomes = this.normalizeOutcomes(input.outcomes);
      if (existing.status === PredictionEventStatus.DRAFT) {
        await this.prisma.$transaction(async (tx) => {
          await tx.predictionOutcome.deleteMany({ where: { eventId } });
          await tx.predictionOutcome.createMany({
            data: outcomes.map((o, i) => ({
              eventId,
              key: o.key,
              label: o.label,
              labelEn: o.labelEn?.trim() || null,
              odds: new Decimal(o.odds),
              sortOrder: o.sortOrder ?? i,
            })),
          });
          await tx.predictionEvent.update({ where: { id: eventId }, data });
        });
      } else {
        // Non-draft: only refresh labels / EN labels (no restructure).
        await this.prisma.$transaction(async (tx) => {
          for (const o of outcomes) {
            await tx.predictionOutcome.updateMany({
              where: { eventId, key: o.key },
              data: {
                label: o.label,
                labelEn: o.labelEn?.trim() || null,
              },
            });
          }
          await tx.predictionEvent.update({ where: { id: eventId }, data });
        });
      }
    } else {
      await this.prisma.predictionEvent.update({ where: { id: eventId }, data });
    }

    const updated = await this.prisma.predictionEvent.findUnique({
      where: { id: eventId },
      include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toEventDto(updated!);
  }

  async adminPublish(eventId: number) {
    const existing = await this.prisma.predictionEvent.findUnique({
      where: { id: eventId },
    });
    if (!existing) throw new NotFoundException('Event not found');
    if (!existing.resolveRule?.trim()) {
      throw new BadRequestException(
        'Сначала укажите правило резолва (источник + время)',
      );
    }
    return this.adminUpdate(eventId, { status: PredictionEventStatus.OPEN });
  }

  async adminLock(eventId: number) {
    return this.adminUpdate(eventId, { status: PredictionEventStatus.LOCKED });
  }

  async adminArchive(eventId: number) {
    const existing = await this.prisma.predictionEvent.findUnique({
      where: { id: eventId },
    });
    if (!existing) throw new NotFoundException('Event not found');
    if (existing.archivedAt) {
      throw new BadRequestException('Событие уже в архиве');
    }

    const data: Prisma.PredictionEventUpdateInput = {
      archivedAt: new Date(),
    };
    // Close betting if still open so archived markets cannot take new stakes.
    if (existing.status === PredictionEventStatus.OPEN) {
      data.status = PredictionEventStatus.LOCKED;
    }

    const updated = await this.prisma.predictionEvent.update({
      where: { id: eventId },
      data,
      include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toEventDto(updated);
  }

  async adminUnarchive(eventId: number) {
    const existing = await this.prisma.predictionEvent.findUnique({
      where: { id: eventId },
    });
    if (!existing) throw new NotFoundException('Event not found');
    if (!existing.archivedAt) {
      throw new BadRequestException('Событие не в архиве');
    }

    const updated = await this.prisma.predictionEvent.update({
      where: { id: eventId },
      data: { archivedAt: null },
      include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toEventDto(updated);
  }

  async adminSettle(eventId: number, winningOutcomeId: number) {
    const event = await this.prisma.predictionEvent.findUnique({
      where: { id: eventId },
      include: { outcomes: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (
      event.status === PredictionEventStatus.SETTLED ||
      event.status === PredictionEventStatus.VOID
    ) {
      throw new BadRequestException('Событие уже рассчитано');
    }
    if (event.status === PredictionEventStatus.DRAFT) {
      throw new BadRequestException('Сначала опубликуйте событие');
    }

    const winner = event.outcomes.find((o) => o.id === winningOutcomeId);
    if (!winner) throw new BadRequestException('Неверный победный исход');

    const pending = await this.prisma.predictionBet.findMany({
      where: { eventId, status: PredictionBetStatus.PENDING },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.predictionEvent.update({
        where: { id: eventId },
        data: {
          status: PredictionEventStatus.SETTLED,
          winningOutcomeId,
          settledAt: new Date(),
        },
      });

      for (const bet of pending) {
        const won = bet.outcomeId === winningOutcomeId;
        if (won) {
          await this.operationService.create(tx, bet.userId, {
            amount: bet.potentialPayout,
            currencyCode: bet.currencyCode,
            source: OperationSource.PREDICTION,
            status: OperationStatus.SUCCESS,
            type: OperationType.INCOME,
            meta: {
              game: 'prediction',
              action: 'win',
              betId: bet.id,
              eventId,
              winningOutcomeId,
              slug: event.slug,
            },
          });
          await tx.predictionBet.update({
            where: { id: bet.id },
            data: {
              status: PredictionBetStatus.WIN,
              settledAt: new Date(),
            },
          });
        } else {
          await tx.predictionBet.update({
            where: { id: bet.id },
            data: {
              status: PredictionBetStatus.LOSE,
              settledAt: new Date(),
            },
          });
        }
      }
    });

    const winners = pending.filter((b) => b.outcomeId === winningOutcomeId);
    const payoutSum = winners.reduce((acc, b) => acc + Number(b.potentialPayout), 0);

    this.logger.log(
      `Settled prediction #${eventId} winner=${winner.key} bets=${pending.length}`,
    );

    void this.telegramNotify.sendSystemAlert(
      'Событие рассчитано',
      [
        `✅ Settle: ${event.title}`,
        `Победитель: ${winner.label} (${winner.key})`,
        `Ставок: ${pending.length} · выигрышей: ${winners.length}`,
        `Выплаты ≈ ${payoutSum.toFixed(0)}`,
        `Admin: https://cdn.imba.bet/prediction`,
      ].join('\n'),
    );

    const updated = await this.prisma.predictionEvent.findUnique({
      where: { id: eventId },
      include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
    });
    return {
      event: await this.toEventDto(updated!),
      settledBets: pending.length,
      winners: winners.length,
    };
  }

  async adminVoid(eventId: number) {
    const event = await this.prisma.predictionEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (
      event.status === PredictionEventStatus.SETTLED ||
      event.status === PredictionEventStatus.VOID
    ) {
      throw new BadRequestException('Событие уже рассчитано');
    }

    const pending = await this.prisma.predictionBet.findMany({
      where: { eventId, status: PredictionBetStatus.PENDING },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.predictionEvent.update({
        where: { id: eventId },
        data: {
          status: PredictionEventStatus.VOID,
          settledAt: new Date(),
        },
      });

      for (const bet of pending) {
        await this.operationService.create(tx, bet.userId, {
          amount: bet.stake,
          currencyCode: bet.currencyCode,
          source: OperationSource.PREDICTION,
          status: OperationStatus.SUCCESS,
          type: OperationType.INCOME,
          meta: {
            game: 'prediction',
            action: 'void',
            betId: bet.id,
            eventId,
            slug: event.slug,
          },
        });
        await tx.predictionBet.update({
          where: { id: bet.id },
          data: {
            status: PredictionBetStatus.VOID,
            settledAt: new Date(),
          },
        });
      }
    });

    void this.telegramNotify.sendSystemAlert(
      'Событие аннулировано',
      [
        `↩️ Void: ${event.title}`,
        `Возврат ставок: ${pending.length}`,
        `Admin: https://cdn.imba.bet/prediction`,
      ].join('\n'),
    );

    const updated = await this.prisma.predictionEvent.findUnique({
      where: { id: eventId },
      include: { outcomes: { orderBy: { sortOrder: 'asc' } } },
    });
    return {
      event: await this.toEventDto(updated!),
      voidedBets: pending.length,
    };
  }

  async countPendingSettlements() {
    const now = new Date();
    return this.prisma.predictionEvent.count({
      where: {
        OR: [
          { status: PredictionEventStatus.LOCKED },
          {
            status: PredictionEventStatus.OPEN,
            closesAt: { lte: now },
          },
        ],
      },
    });
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  /**
   * Chance % over time for the first outcome (Polymarket-style chart).
   * Built from cumulative stake after each bet; densified when history is thin.
   */
  private async buildChanceSeries(event: {
    id: number;
    createdAt: Date;
    outcomes: Array<{ id: number; sortOrder: number }>;
  }): Promise<Array<{ t: number; v: number }>> {
    const primaryId = [...event.outcomes].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )[0]?.id;
    if (!primaryId) {
      const now = Date.now();
      return [
        { t: event.createdAt.getTime(), v: 50 },
        { t: now, v: 50 },
      ];
    }

    const bets = await this.prisma.predictionBet.findMany({
      where: {
        eventId: event.id,
        status: { not: PredictionBetStatus.VOID },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        outcomeId: true,
        stake: true,
        createdAt: true,
      },
      take: 2000,
    });

    const stakeByOutcome = new Map<number, number>();
    for (const o of event.outcomes) stakeByOutcome.set(o.id, 0);

    const shareOf = () => {
      let total = 0;
      let primary = 0;
      for (const [id, stake] of stakeByOutcome) {
        total += stake;
        if (id === primaryId) primary = stake;
      }
      if (total <= 0) return 50;
      return Number(((primary / total) * 100).toFixed(2));
    };

    const points: Array<{ t: number; v: number }> = [
      { t: event.createdAt.getTime(), v: 50 },
    ];

    for (const bet of bets) {
      const prev = stakeByOutcome.get(bet.outcomeId) || 0;
      stakeByOutcome.set(bet.outcomeId, prev + Number(bet.stake));
      const t = bet.createdAt.getTime();
      const v = shareOf();
      const last = points[points.length - 1];
      if (last && last.t === t) {
        last.v = v;
      } else {
        points.push({ t, v });
      }
    }

    const now = Date.now();
    const current = shareOf();
    const last = points[points.length - 1]!;
    if (now - last.t > 60_000 || Math.abs(last.v - current) > 0.05) {
      points.push({ t: now, v: current });
    } else {
      last.v = current;
      last.t = Math.max(last.t, now);
    }

    if (points.length >= 8) {
      return this.downsampleSeries(points, 96);
    }

    // Thin history: densify with a gentle seeded path ending at current share.
    return this.densifyChanceSeries(points, event.id, 48);
  }

  private densifyChanceSeries(
    anchors: Array<{ t: number; v: number }>,
    seed: number,
    count: number,
  ): Array<{ t: number; v: number }> {
    if (anchors.length === 0) return [{ t: Date.now(), v: 50 }];
    const start = anchors[0]!.t;
    const end = anchors[anchors.length - 1]!.t;
    const span = Math.max(1, end - start);
    const out: Array<{ t: number; v: number }> = [];
    let rnd = (seed * 1103515245 + 12345) >>> 0;
    const next = () => {
      rnd = (rnd * 1664525 + 1013904223) >>> 0;
      return (rnd % 10000) / 10000;
    };

    for (let i = 0; i < count; i++) {
      const u = i / Math.max(1, count - 1);
      const t = start + span * u;
      // piecewise linear through anchors
      let v = anchors[anchors.length - 1]!.v;
      for (let j = 0; j < anchors.length - 1; j++) {
        const a = anchors[j]!;
        const b = anchors[j + 1]!;
        if (t >= a.t && t <= b.t) {
          const f = (t - a.t) / Math.max(1, b.t - a.t);
          v = a.v + (b.v - a.v) * f;
          break;
        }
        if (t < a.t) {
          v = a.v;
          break;
        }
      }
      // soft noise that fades toward the end so current value stays accurate
      const fade = (1 - u) * 0.55;
      const wobble = (next() - 0.5) * 6 * fade;
      out.push({
        t: Math.round(t),
        v: Number(Math.max(2, Math.min(98, v + wobble)).toFixed(2)),
      });
    }
    out[out.length - 1]!.v = anchors[anchors.length - 1]!.v;
    return out;
  }

  private downsampleSeries(
    points: Array<{ t: number; v: number }>,
    maxPoints: number,
  ): Array<{ t: number; v: number }> {
    if (points.length <= maxPoints) return points;
    const out: Array<{ t: number; v: number }> = [];
    const step = (points.length - 1) / (maxPoints - 1);
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.round(i * step);
      out.push(points[Math.min(points.length - 1, idx)]!);
    }
    return out;
  }

  private normalizeMediaUrl(value?: string | null): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  private async autoLockExpired() {
    await this.prisma.predictionEvent.updateMany({
      where: {
        status: PredictionEventStatus.OPEN,
        closesAt: { lte: new Date() },
      },
      data: { status: PredictionEventStatus.LOCKED },
    });
  }

  private normalizeOutcomes(outcomes: OutcomeInput[]): OutcomeInput[] {
    if (!outcomes?.length || outcomes.length < 2) {
      throw new BadRequestException('Нужно минимум 2 исхода');
    }
    const keys = new Set<string>();
    return outcomes.map((o, i) => {
      const key = String(o.key || '').trim().toLowerCase();
      const label = String(o.label || '').trim();
      const odds = Number(o.odds);
      if (!key || !label) {
        throw new BadRequestException('У исхода нужны key и label');
      }
      if (keys.has(key)) {
        throw new BadRequestException(`Дублирующий исход: ${key}`);
      }
      keys.add(key);
      if (!Number.isFinite(odds) || odds < 1.01 || odds > 100) {
        throw new BadRequestException(`Некорректный кэф для ${key}`);
      }
      return {
        key,
        label,
        labelEn: o.labelEn?.trim() || undefined,
        odds,
        sortOrder: o.sortOrder ?? i,
      };
    });
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
    let slug = slugifyTitle(base);
    let n = 0;
    while (true) {
      const candidate = n === 0 ? slug : `${slug}-${n}`;
      const exists = await this.prisma.predictionEvent.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      n += 1;
    }
  }

  private async toEventDto(
    event: {
      id: number;
      slug: string;
      title: string;
      titleEn?: string | null;
      description: string | null;
      descriptionEn?: string | null;
      category: string;
      imageUrl?: string | null;
      bannerUrl?: string | null;
      videoUrl?: string | null;
      resolveRule: string | null;
      resolveRuleEn?: string | null;
      status: PredictionEventStatus;
      closesAt: Date | null;
      resolvesAt: Date | null;
      winningOutcomeId: number | null;
      settledAt: Date | null;
      archivedAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
      outcomes: Array<{
        id: number;
        key: string;
        label: string;
        labelEn?: string | null;
        odds: Decimal;
        sortOrder: number;
      }>;
    },
    now = new Date(),
  ) {
    const bets = await this.prisma.predictionBet.findMany({
      where: {
        eventId: event.id,
        status: { not: PredictionBetStatus.VOID },
      },
      select: {
        outcomeId: true,
        stake: true,
        potentialPayout: true,
        currencyCode: true,
        status: true,
      },
    });

    // Volume + share weights are always USD (mixed KZT/RUB/USDT → $).
    let totalStakeUsd = 0;
    let totalBets = 0;
    const exposureByOutcome: Record<
      number,
      { bets: number; stake: number; liability: number }
    > = {};

    for (const bet of bets) {
      const stakeUsd = predictionStakeToUsd(Number(bet.stake), bet.currencyCode);
      const liabilityUsd = predictionStakeToUsd(
        Number(bet.potentialPayout),
        bet.currencyCode,
      );
      totalStakeUsd += stakeUsd;
      totalBets += 1;

      if (bet.status !== PredictionBetStatus.PENDING) continue;
      const row = exposureByOutcome[bet.outcomeId] || {
        bets: 0,
        stake: 0,
        liability: 0,
      };
      row.bets += 1;
      row.stake += stakeUsd;
      row.liability += liabilityUsd;
      exposureByOutcome[bet.outcomeId] = row;
    }

    const pendingStakeUsd = Object.values(exposureByOutcome).reduce(
      (acc, row) => acc + row.stake,
      0,
    );
    const outcomeCount = Math.max(event.outcomes.length, 1);
    const evenShare = 100 / outcomeCount;

    const bettingOpen =
      !event.archivedAt &&
      event.status === PredictionEventStatus.OPEN &&
      (!event.closesAt || event.closesAt.getTime() > now.getTime());

    const needsSettle =
      !event.archivedAt &&
      (event.status === PredictionEventStatus.LOCKED ||
        (event.status === PredictionEventStatus.OPEN &&
          !!event.closesAt &&
          event.closesAt.getTime() <= now.getTime()));

    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      titleEn: event.titleEn ?? null,
      description: event.description,
      descriptionEn: event.descriptionEn ?? null,
      category: event.category,
      imageUrl: event.imageUrl ?? null,
      bannerUrl: event.bannerUrl ?? null,
      videoUrl: event.videoUrl ?? null,
      resolveRule: event.resolveRule,
      resolveRuleEn: event.resolveRuleEn ?? null,
      status: event.status,
      closesAt: event.closesAt?.toISOString() ?? null,
      resolvesAt: event.resolvesAt?.toISOString() ?? null,
      winningOutcomeId: event.winningOutcomeId,
      settledAt: event.settledAt?.toISOString() ?? null,
      archivedAt: event.archivedAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      bettingOpen,
      needsSettle,
      pool: {
        // Always USD for UI volume everywhere.
        totalStake: Number(totalStakeUsd.toFixed(2)),
        totalBets,
      },
      outcomes: event.outcomes.map((o) => {
        const exposure = exposureByOutcome[o.id] || {
          bets: 0,
          stake: 0,
          liability: 0,
        };
        const sharePct =
          pendingStakeUsd > 0
            ? Number(((exposure.stake / pendingStakeUsd) * 100).toFixed(1))
            : Number(evenShare.toFixed(1));
        return {
          id: o.id,
          key: o.key,
          label: o.label,
          labelEn: o.labelEn ?? null,
          odds: Number(o.odds),
          sortOrder: o.sortOrder,
          sharePct,
          exposure: {
            bets: exposure.bets,
            stake: Number(exposure.stake.toFixed(2)),
            liability: Number(exposure.liability.toFixed(2)),
          },
        };
      }),
    };
  }

  private toBetDto(bet: {
    id: number;
    eventId: number;
    outcomeId: number;
    stake: Decimal;
    currencyCode: string;
    odds: Decimal;
    potentialPayout: Decimal;
    status: PredictionBetStatus;
    settledAt: Date | null;
    createdAt: Date;
    outcome?: { key: string; label: string; labelEn?: string | null };
  }) {
    return {
      id: bet.id,
      eventId: bet.eventId,
      outcomeId: bet.outcomeId,
      outcomeKey: bet.outcome?.key,
      outcomeLabel: bet.outcome?.label,
      outcomeLabelEn: bet.outcome?.labelEn ?? null,
      stake: Number(bet.stake),
      currencyCode: bet.currencyCode,
      odds: Number(bet.odds),
      potentialPayout: Number(bet.potentialPayout),
      status: bet.status,
      settledAt: bet.settledAt?.toISOString() ?? null,
      createdAt: bet.createdAt.toISOString(),
    };
  }
}
