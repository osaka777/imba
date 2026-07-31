import { Injectable, Logger } from '@nestjs/common';
import { WcOddsBetStatus, WcOddsPick } from '@prisma/client';

import { parseMarketScopeFromText } from '../olimpbet-wc/olimpbet-score-scope.util';
import { parseDisplayOutcomeParameters } from '../olimpbet-wc/olimpbet-probability-settlement.util';
import { PushUserNotifyService } from '~/main/push/push-user-notify.service';
import { TelegramUserNotifyService } from '~/main/telegram/telegram-user-notify.service';
import { publicGameUrl } from '~/main/telegram/public-site-url.util';
import { PrismaService } from '~/prisma/prisma.service';

type EventSnapshot = {
  id: string;
  slug: string | null;
  homeTeam: string;
  awayTeam: string;
  commenceTime: Date;
  homeScore: number | null;
  awayScore: number | null;
  completed: boolean;
  /** e.g. olimp_100 soccer, olimp_101 tennis */
  sportKey?: string | null;
};

const SET_SPORT_IDS = new Set([101, 104, 110]); // tennis, volleyball, table-tennis

function isSetSport(sportKey?: string | null): boolean {
  if (!sportKey) return false;
  const m = /^olimp_(\d+)$/.exec(sportKey);
  if (!m) return false;
  return SET_SPORT_IDS.has(Number(m[1]));
}

type PendingBetRow = {
  userId: number;
  pick: WcOddsPick | null;
  outcomeName: string | null;
  outcomeKey: string | null;
  marketKey: string;
  stake: unknown;
  currencyCode: string;
  user: {
    telegramUserId: string | null;
    telegramNotifyLiveMatch: boolean;
  } | null;
};

@Injectable()
export class WcTelegramPulseService {
  private readonly logger = new Logger(WcTelegramPulseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramUserNotify: TelegramUserNotifyService,
    private readonly pushUserNotify: PushUserNotifyService,
  ) {}

  private eventUrl(event: Pick<EventSnapshot, 'slug' | 'id'>): string {
    const ref = event.slug || event.id;
    return publicGameUrl(ref);
  }

  private eventPath(event: Pick<EventSnapshot, 'slug' | 'id'>): string {
    const ref = event.slug || event.id;
    return `/game/${ref}`;
  }

  /** Set / period index encoded on the bet (1-based). */
  private betScopeIndex(bet: {
    outcomeKey?: string | null;
    outcomeName?: string | null;
    marketKey?: string | null;
  }): { kind: 'set' | 'half' | 'quarter'; index: number } | null {
    const fromKey = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
    const setFromKey = Number(fromKey.PARAMETER_SET_NUMBER);
    if (Number.isFinite(setFromKey) && setFromKey >= 1) {
      return { kind: 'set', index: setFromKey };
    }

    const scope = parseMarketScopeFromText(
      [bet.outcomeName, bet.marketKey].filter(Boolean).join(' '),
    );
    if (!scope) return null;
    if (scope.kind === 'set') return { kind: 'set', index: scope.index };
    if (scope.kind === 'half') return { kind: 'half', index: scope.index };
    if (scope.kind === 'quarter') return { kind: 'quarter', index: scope.index };
    if (scope.kind === 'game' || scope.kind === 'point') {
      return { kind: 'set', index: scope.setIndex };
    }
    return null;
  }

  private describeH2hStatus(
    pick: WcOddsPick | null,
    homeScore: number,
    awayScore: number,
  ): string | null {
    if (!pick) return null;
    const homeWins = homeScore > awayScore;
    const awayWins = awayScore > homeScore;
    const draw = homeScore === awayScore;

    if (pick === WcOddsPick.HOME) {
      if (homeWins) return 'ставка выигрывает';
      if (draw) return 'ставка на возврат (ничья)';
      return 'ставка проигрывает';
    }
    if (pick === WcOddsPick.AWAY) {
      if (awayWins) return 'ставка выигрывает';
      if (draw) return 'ставка на возврат (ничья)';
      return 'ставка проигрывает';
    }
    if (pick === WcOddsPick.DRAW) {
      if (draw) return 'ставка выигрывает';
      return 'ставка проигрывает';
    }
    return null;
  }

  private describeSetBetStatus(
    pick: WcOddsPick | null,
    setWinner: 'home' | 'away',
  ): string | null {
    if (!pick) return null;
    if (pick === WcOddsPick.HOME) {
      return setWinner === 'home' ? 'сет сыграл' : 'сет не сыграл';
    }
    if (pick === WcOddsPick.AWAY) {
      return setWinner === 'away' ? 'сет сыграл' : 'сет не сыграл';
    }
    return null;
  }

  private async sendMatchNotify(input: {
    userId: number;
    telegramUserId?: string | null;
    type: string;
    message: string;
    title: string;
    body: string;
    event: Pick<EventSnapshot, 'slug' | 'id'>;
    buttonText?: string;
  }): Promise<void> {
    if (input.telegramUserId) {
      await this.telegramUserNotify.notifyRaw({
        userId: input.userId,
        telegramUserId: input.telegramUserId,
        type: input.type,
        message: input.message,
        buttonUrl: this.eventUrl(input.event),
        buttonText: input.buttonText ?? 'Открыть матч',
      });
    }

    try {
      await this.pushUserNotify.notifyLiveMatch({
        userId: input.userId,
        title: input.title,
        body: input.body,
        url: this.eventPath(input.event),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`live push failed user=${input.userId}: ${message.slice(0, 120)}`);
    }
  }

  private async markNotified(userId: number, eventId: string, cursorKey: string): Promise<boolean> {
    try {
      await this.prisma.wcTelegramNotifyCursor.create({
        data: { userId, eventId, cursorKey },
      });
      return true;
    } catch {
      return false;
    }
  }

  private async shouldNotify(userId: number, eventId: string, cursorKey: string): Promise<boolean> {
    const existing = await this.prisma.wcTelegramNotifyCursor.findUnique({
      where: {
        userId_eventId_cursorKey: { userId, eventId, cursorKey },
      },
    });
    return !existing;
  }

  private pickBestBetForUser(
    bets: PendingBetRow[],
    opts: { setIndex?: number; setWinner?: 'home' | 'away' },
  ): PendingBetRow {
    if (opts.setIndex != null) {
      const scoped = bets.find((b) => {
        const scope = this.betScopeIndex(b);
        return scope?.kind === 'set' && scope.index === opts.setIndex;
      });
      if (scoped) return scoped;
    }
    const h2h = bets.find((b) => b.marketKey === 'h2h' || b.pick);
    return h2h ?? bets[0]!;
  }

  async onScoreChange(
    event: EventSnapshot,
    prevHome: number | null,
    prevAway: number | null,
    nextHome: number,
    nextAway: number,
  ): Promise<void> {
    if (prevHome === nextHome && prevAway === nextAway) return;
    if (event.completed) return;

    const prevH = prevHome ?? 0;
    const prevA = prevAway ?? 0;
    const setCompleted =
      (nextHome === prevH + 1 && nextAway === prevA)
      || (nextAway === prevA + 1 && nextHome === prevH);
    const setWinner: 'home' | 'away' | null = setCompleted
      ? nextHome > prevH
        ? 'home'
        : 'away'
      : null;
    const setIndex = setCompleted ? nextHome + nextAway : null;

    const scoreKey = `score:${nextHome}-${nextAway}`;
    const matchLabel = `${event.homeTeam} — ${event.awayTeam}`;
    const scoreLine = `${matchLabel}\nСчёт: ${nextHome}:${nextAway}`;
    const pushScoreBody = `${matchLabel} · ${nextHome}:${nextAway}`;

    const [betRows, subs] = await Promise.all([
      this.prisma.wcOddsBet.findMany({
        where: {
          eventId: event.id,
          status: WcOddsBetStatus.PENDING,
          isProbe: false,
        },
        select: {
          userId: true,
          pick: true,
          outcomeName: true,
          outcomeKey: true,
          marketKey: true,
          stake: true,
          currencyCode: true,
          user: { select: { telegramUserId: true, telegramNotifyLiveMatch: true } },
        },
      }),
      this.prisma.wcEventSubscription.findMany({
        where: {
          eventId: event.id,
          notifyGoals: true,
        },
        include: {
          user: { select: { id: true, telegramUserId: true, telegramNotifyLiveMatch: true } },
        },
      }),
    ]);

    const betsByUser = new Map<number, PendingBetRow[]>();
    for (const row of betRows) {
      const list = betsByUser.get(row.userId) ?? [];
      list.push({
        userId: row.userId,
        pick: row.pick,
        outcomeName: row.outcomeName,
        outcomeKey: row.outcomeKey,
        marketKey: row.marketKey,
        stake: row.stake,
        currencyCode: row.currencyCode,
        user: row.user,
      });
      betsByUser.set(row.userId, list);
    }

    const notified = new Set<number>();

    for (const [userId, userBets] of betsByUser) {
      if (notified.has(userId)) continue;
      if (!(await this.shouldNotify(userId, event.id, scoreKey))) continue;

      const tgOk = Boolean(userBets[0]?.user?.telegramNotifyLiveMatch);
      const telegramUserId = tgOk ? userBets[0]?.user?.telegramUserId : null;

      const best = this.pickBestBetForUser(userBets, {
        setIndex: setIndex ?? undefined,
        setWinner: setWinner ?? undefined,
      });
      const scope = this.betScopeIndex(best);
      const isSetScoped =
        setIndex != null
        && setWinner != null
        && scope?.kind === 'set'
        && scope.index === setIndex;

      let message: string;
      let title: string;
      let body: string;

      if (isSetScoped && setWinner && setIndex != null) {
        const winnerName = setWinner === 'home' ? event.homeTeam : event.awayTeam;
        const setStatus = this.describeSetBetStatus(best.pick, setWinner);
        const label = best.outcomeName || `Сет ${setIndex}`;
        title = `🎾 Сет ${setIndex} · IMBA BET`;
        body = `${winnerName} выиграл сет · ${nextHome}:${nextAway}`;
        if (setStatus) body += ` · ${label}: ${setStatus}`;
        message = [
          `🎾 Сет ${setIndex}: ${winnerName}`,
          matchLabel,
          `Счёт по сетам: ${nextHome}:${nextAway}`,
          setStatus ? `${label}: ${setStatus}` : `Ваша ставка: ${label}`,
        ].join('\n');
      } else if (isSetSport(event.sportKey) && setCompleted && setWinner && setIndex != null) {
        const winnerName = setWinner === 'home' ? event.homeTeam : event.awayTeam;
        title = `🎾 Сет ${setIndex} · IMBA BET`;
        body = `${winnerName} · счёт ${nextHome}:${nextAway}`;
        message = [
          `🎾 Сет ${setIndex}: ${winnerName}`,
          matchLabel,
          `Счёт по сетам: ${nextHome}:${nextAway}`,
        ].join('\n');
        if (best.marketKey === 'h2h' || best.pick) {
          const status = this.describeH2hStatus(best.pick, nextHome, nextAway);
          if (status) {
            const label = best.outcomeName || 'Ставка';
            message += `\n${label}: ${status}`;
            body += ` · ${label}: ${status}`;
          }
        }
      } else {
        const goalish = !isSetSport(event.sportKey);
        title = goalish ? '⚽ Гол · IMBA BET' : '📊 Счёт · IMBA BET';
        body = pushScoreBody;
        message = `${goalish ? '⚽' : '📊'} ${scoreLine}`;
        if (best.marketKey === 'h2h' || best.pick) {
          const status = this.describeH2hStatus(best.pick, nextHome, nextAway);
          if (status) {
            const label = best.outcomeName || 'Ставка';
            message += `\n${label}: ${status}`;
            body += ` · ${label}: ${status}`;
          }
        } else if (best.outcomeName) {
          message += `\nВаша ставка: ${best.outcomeName}`;
          body += ` · ${best.outcomeName}`;
        }
      }

      await this.sendMatchNotify({
        userId,
        telegramUserId,
        type: isSetScoped ? 'wc_live_set' : 'wc_live_score',
        message,
        title,
        body,
        event,
      });
      await this.markNotified(userId, event.id, scoreKey);
      notified.add(userId);
    }

    for (const sub of subs) {
      if (notified.has(sub.userId)) continue;
      if (!(await this.shouldNotify(sub.userId, event.id, scoreKey))) continue;

      const telegramUserId = sub.user.telegramNotifyLiveMatch
        ? sub.user.telegramUserId
        : null;

      await this.sendMatchNotify({
        userId: sub.userId,
        telegramUserId,
        type: 'wc_live_score_sub',
        message: `⚽ ${scoreLine}`,
        title: '⚽ Гол · IMBA BET',
        body: pushScoreBody,
        event,
      });
      await this.markNotified(sub.userId, event.id, scoreKey);
      notified.add(sub.userId);
    }
  }

  async onMatchLive(event: EventSnapshot): Promise<void> {
    if (event.completed) return;
    const cursorKey = 'match_started';

    const recipients = await this.collectPreMatchRecipients(event.id, 'start');
    for (const row of recipients) {
      if (!(await this.shouldNotify(row.userId, event.id, cursorKey))) continue;

      const time = event.commenceTime.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const message = [
        `🏟 Матч начался`,
        `${event.homeTeam} — ${event.awayTeam}`,
        `Старт: ${time}`,
      ].join('\n');

      await this.sendMatchNotify({
        userId: row.userId,
        telegramUserId: row.telegramUserId,
        type: 'wc_match_started',
        message,
        title: '🏟 Матч начался · IMBA BET',
        body: `${event.homeTeam} — ${event.awayTeam}`,
        event,
      });
      await this.markNotified(row.userId, event.id, cursorKey);
    }
  }

  private async collectPreMatchRecipients(
    eventId: string,
    mode: 'start' | 'prematch',
  ): Promise<Array<{ userId: number; telegramUserId: string | null }>> {
    const [bets, subs] = await Promise.all([
      this.prisma.wcOddsBet.findMany({
        where: {
          eventId,
          status: WcOddsBetStatus.PENDING,
          isProbe: false,
        },
        select: {
          userId: true,
          user: {
            select: {
              telegramUserId: true,
              telegramNotifyLiveMatch: true,
              telegramNotifyPreMatch: true,
            },
          },
        },
        distinct: ['userId'],
      }),
      this.prisma.wcEventSubscription.findMany({
        where: {
          eventId,
          ...(mode === 'start' ? { notifyStart: true } : {}),
        },
        select: {
          userId: true,
          user: {
            select: {
              telegramUserId: true,
              telegramNotifyLiveMatch: true,
              telegramNotifyPreMatch: true,
            },
          },
        },
      }),
    ]);

    const map = new Map<number, string | null>();
    for (const b of bets) {
      const allowTg =
        mode === 'start'
          ? b.user.telegramNotifyLiveMatch
          : b.user.telegramNotifyPreMatch;
      map.set(b.userId, allowTg ? b.user.telegramUserId : null);
    }
    for (const s of subs) {
      if (map.has(s.userId)) continue;
      const allowTg =
        mode === 'start'
          ? s.user.telegramNotifyLiveMatch
          : s.user.telegramNotifyPreMatch;
      map.set(s.userId, allowTg ? s.user.telegramUserId : null);
    }
    return [...map.entries()].map(([userId, telegramUserId]) => ({ userId, telegramUserId }));
  }

  async sendPreMatchReminders(): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() + 45 * 60 * 1000);
    const to = new Date(now.getTime() + 60 * 60 * 1000);

    const events = await this.prisma.wcOddsEvent.findMany({
      where: {
        completed: false,
        commenceTime: { gte: from, lte: to },
      },
      select: {
        id: true,
        slug: true,
        homeTeam: true,
        awayTeam: true,
        commenceTime: true,
        homeScore: true,
        awayScore: true,
        completed: true,
      },
    });

    for (const event of events) {
      const cursorKey = `prematch:${event.commenceTime.toISOString().slice(0, 16)}`;
      const recipients = await this.collectPreMatchRecipients(event.id, 'prematch');
      if (!recipients.length) continue;

      const minutes = Math.max(
        1,
        Math.round((event.commenceTime.getTime() - now.getTime()) / 60_000),
      );

      for (const row of recipients) {
        if (!(await this.shouldNotify(row.userId, event.id, cursorKey))) continue;

        const openBets = await this.prisma.wcOddsBet.findMany({
          where: {
            userId: row.userId,
            eventId: event.id,
            status: WcOddsBetStatus.PENDING,
            isProbe: false,
          },
          select: { outcomeName: true, stake: true, currencyCode: true },
          take: 3,
        });

        const lines = [
          `⏰ Через ~${minutes} мин`,
          `${event.homeTeam} — ${event.awayTeam}`,
        ];

        if (openBets.length) {
          const betLines = openBets.map(
            (b) => `• ${b.outcomeName || 'Ставка'} — ${Number(b.stake)} ${b.currencyCode}`,
          );
          lines.push('', 'Ваши ставки:', ...betLines);
        }

        const balance = await this.prisma.balance.findFirst({
          where: { userId: row.userId },
          orderBy: { amount: 'desc' },
        });
        if (balance) {
          lines.push('', `Баланс: ${Number(balance.amount)} ${balance.currencyCode}`);
        }

        await this.sendMatchNotify({
          userId: row.userId,
          telegramUserId: row.telegramUserId,
          type: 'wc_prematch',
          message: lines.join('\n'),
          title: `⏰ Через ~${minutes} мин · IMBA BET`,
          body: `${event.homeTeam} — ${event.awayTeam}`,
          event,
          buttonText: 'Ставки на матч',
        });
        await this.markNotified(row.userId, event.id, cursorKey);
      }
    }
  }

  async detectLiveTransition(
    event: EventSnapshot,
    wasLive: boolean,
    isLive: boolean,
  ): Promise<void> {
    if (!wasLive && isLive) {
      await this.onMatchLive(event);
    }
  }
}
