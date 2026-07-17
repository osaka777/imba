import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '~/prisma/prisma.service';
import { WcOddsBetService } from '~/integrations/wc-odds/wc-odds-bet.service';

import { findFeaturedLiveMatch } from './kick-live-match.util';
import type { KickPartnerMeta } from './kick-partner.types';

export type KickScoreGuess = {
  username: string;
  senderUserId: number;
  home: number;
  away: number;
  createdAt: string;
};

export type KickGuessContestState = {
  active: boolean;
  sessionId: string | null;
  matchId: string | null;
  matchLabel: string | null;
  currentScore: string | null;
  guessCount: number;
  recentGuesses: KickScoreGuess[];
};

const MAX_GUESSES = 150;

@Injectable()
export class KickGuessContestService {
  private readonly logger = new Logger(KickGuessContestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wcOddsBet: WcOddsBetService,
  ) {}

  private readKickMeta(meta: unknown): KickPartnerMeta {
    if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return {};
    const root = meta as Record<string, unknown>;
    const kick = root.kick;
    if (!kick || typeof kick !== 'object' || Array.isArray(kick)) return {};
    return kick as KickPartnerMeta;
  }

  private formatScore(home: number | null, away: number | null) {
    if (home == null || away == null) return null;
    return `${home}:${away}`;
  }

  async ensureContestForSession(partnerUserId: number, sessionId: string) {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    if (!affiliator) return;

    const kick = this.readKickMeta(affiliator.meta);
    if (kick.guessContest?.sessionId === sessionId) return;

    const match = await findFeaturedLiveMatch(this.wcOddsBet);
    if (!match) return;

    const root =
      affiliator.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
        ? { ...(affiliator.meta as Record<string, unknown>) }
        : {};

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: {
          ...root,
          kick: {
            ...kick,
            guessContest: {
              sessionId,
              matchId: match.id,
              matchLabel: `${match.homeTeam} vs ${match.awayTeam}`,
              guesses: [],
            },
          },
        },
      },
    });
  }

  clearContest(partnerUserId: number) {
    return this.prisma.affilator
      .findUnique({ where: { userId: partnerUserId }, select: { meta: true } })
      .then(async (affiliator) => {
        if (!affiliator) return;
        const kick = this.readKickMeta(affiliator.meta);
        if (!kick.guessContest) return;

        const root =
          affiliator.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
            ? { ...(affiliator.meta as Record<string, unknown>) }
            : {};

        const { guessContest: _removed, ...restKick } = kick;
        await this.prisma.affilator.update({
          where: { userId: partnerUserId },
          data: { meta: { ...root, kick: restKick } },
        });
      });
  }

  async recordGuess(
    partnerUserId: number,
    senderUserId: number,
    username: string,
    home: number,
    away: number,
  ): Promise<{ ok: boolean; reply: string }> {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    if (!affiliator) {
      return { ok: false, reply: 'Конкурс недоступен' };
    }

    const kick = this.readKickMeta(affiliator.meta);
    const contest = kick.guessContest;
    if (!contest?.sessionId || !kick.isLive) {
      return {
        ok: false,
        reply: 'Угадай счёт доступен только во время эфира. Следи за анонсом стримера!',
      };
    }

    const guesses = Array.isArray(contest.guesses) ? [...contest.guesses] : [];
    const existingIdx = guesses.findIndex((g) => g.senderUserId === senderUserId);
    const entry: KickScoreGuess = {
      username: username.slice(0, 32) || 'viewer',
      senderUserId,
      home,
      away,
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      guesses[existingIdx] = entry;
    } else {
      guesses.push(entry);
    }

    const trimmed = guesses.slice(-MAX_GUESSES);

    const root =
      affiliator.meta && typeof affiliator.meta === 'object' && !Array.isArray(affiliator.meta)
        ? { ...(affiliator.meta as Record<string, unknown>) }
        : {};

    await this.prisma.affilator.update({
      where: { userId: partnerUserId },
      data: {
        meta: {
          ...root,
          kick: {
            ...kick,
            guessContest: { ...contest, guesses: trimmed },
          },
        },
      },
    });

    let currentScore: string | null = null;
    if (contest.matchId) {
      try {
        const match = await findFeaturedLiveMatch(this.wcOddsBet);
        if (match?.id === contest.matchId) {
          currentScore = this.formatScore(match.homeScore, match.awayScore);
        }
      } catch {
        /* ignore */
      }
    }

    const scoreHint = currentScore ? ` Сейчас ${currentScore}.` : '';
    return {
      ok: true,
      reply: `@${entry.username} записал ${home}:${away}.${scoreHint} Регистрируйся на imba.bet — стример разыграет промо среди угадавших!`,
    };
  }

  async getContestState(partnerUserId: number): Promise<KickGuessContestState> {
    const affiliator = await this.prisma.affilator.findUnique({
      where: { userId: partnerUserId },
      select: { meta: true },
    });
    const kick = this.readKickMeta(affiliator?.meta ?? null);
    const contest = kick.guessContest;

    if (!contest?.sessionId || !kick.isLive) {
      return {
        active: false,
        sessionId: null,
        matchId: null,
        matchLabel: null,
        currentScore: null,
        guessCount: 0,
        recentGuesses: [],
      };
    }

    let currentScore: string | null = null;
    if (contest.matchId) {
      try {
        const match = await findFeaturedLiveMatch(this.wcOddsBet);
        if (match) {
          currentScore = this.formatScore(match.homeScore, match.awayScore);
        }
      } catch {
        /* ignore */
      }
    }

    const guesses = Array.isArray(contest.guesses) ? contest.guesses : [];
    return {
      active: true,
      sessionId: contest.sessionId,
      matchId: contest.matchId ?? null,
      matchLabel: contest.matchLabel ?? null,
      currentScore,
      guessCount: guesses.length,
      recentGuesses: guesses.slice(-8).reverse(),
    };
  }
}
