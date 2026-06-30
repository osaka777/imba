import { Injectable, Logger } from '@nestjs/common';
import { WcOddsBetStatus, WcOddsPick } from '@prisma/client';

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
};

@Injectable()
export class WcTelegramPulseService {
  private readonly logger = new Logger(WcTelegramPulseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramUserNotify: TelegramUserNotifyService,
  ) {}

  private eventUrl(event: Pick<EventSnapshot, 'slug' | 'id'>): string {
    const ref = event.slug || event.id;
    return publicGameUrl(ref);
  }

  private async sendMatchNotify(input: {
    userId: number;
    telegramUserId: string;
    type: string;
    message: string;
    event: Pick<EventSnapshot, 'slug' | 'id'>;
    buttonText?: string;
  }): Promise<void> {
    await this.telegramUserNotify.notifyRaw({
      userId: input.userId,
      telegramUserId: input.telegramUserId,
      type: input.type,
      message: input.message,
      buttonUrl: this.eventUrl(input.event),
      buttonText: input.buttonText ?? 'Открыть матч',
    });
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

  async onScoreChange(
    event: EventSnapshot,
    prevHome: number | null,
    prevAway: number | null,
    nextHome: number,
    nextAway: number,
  ): Promise<void> {
    if (prevHome === nextHome && prevAway === nextAway) return;
    if (event.completed) return;

    const scoreKey = `score:${nextHome}-${nextAway}`;
    const matchLabel = `${event.homeTeam} — ${event.awayTeam}`;
    const scoreLine = `⚽ ${matchLabel}\nСчёт: ${nextHome}:${nextAway}`;

    const [betUsers, subs] = await Promise.all([
      this.prisma.wcOddsBet.findMany({
        where: {
          eventId: event.id,
          status: WcOddsBetStatus.PENDING,
          isProbe: false,
          user: {
            telegramUserId: { not: null },
            telegramNotifyLiveMatch: true,
          },
        },
        select: {
          userId: true,
          pick: true,
          outcomeName: true,
          marketKey: true,
          stake: true,
          currencyCode: true,
          user: { select: { telegramUserId: true } },
        },
        distinct: ['userId'],
      }),
      this.prisma.wcEventSubscription.findMany({
        where: {
          eventId: event.id,
          notifyGoals: true,
          user: {
            telegramUserId: { not: null },
            telegramNotifyLiveMatch: true,
          },
        },
        include: { user: { select: { id: true, telegramUserId: true } } },
      }),
    ]);

    const notified = new Set<number>();

    for (const row of betUsers) {
      if (notified.has(row.userId)) continue;
      if (!(await this.shouldNotify(row.userId, event.id, scoreKey))) continue;

      let message = scoreLine;
      if (row.marketKey === 'h2h' || row.pick) {
        const status = this.describeH2hStatus(row.pick, nextHome, nextAway);
        if (status) {
          const label = row.outcomeName || 'Ставка';
          message += `\n${label}: ${status}`;
        }
      } else {
        message += `\nВаша ставка: ${row.outcomeName || 'активна'}`;
      }
      await this.sendMatchNotify({
        userId: row.userId,
        telegramUserId: row.user!.telegramUserId!,
        type: 'wc_live_score',
        message,
        event,
      });
      await this.markNotified(row.userId, event.id, scoreKey);
      notified.add(row.userId);
    }

    for (const sub of subs) {
      if (notified.has(sub.userId)) continue;
      if (!(await this.shouldNotify(sub.userId, event.id, scoreKey))) continue;

      await this.sendMatchNotify({
        userId: sub.userId,
        telegramUserId: sub.user.telegramUserId!,
        type: 'wc_live_score_sub',
        message: scoreLine,
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
        event,
      });
      await this.markNotified(row.userId, event.id, cursorKey);
    }
  }

  private async collectPreMatchRecipients(
    eventId: string,
    mode: 'start' | 'prematch',
  ): Promise<Array<{ userId: number; telegramUserId: string }>> {
    const [bets, subs] = await Promise.all([
      this.prisma.wcOddsBet.findMany({
        where: {
          eventId,
          status: WcOddsBetStatus.PENDING,
          isProbe: false,
          user: {
            telegramUserId: { not: null },
            ...(mode === 'start'
              ? { telegramNotifyLiveMatch: true }
              : { telegramNotifyPreMatch: true }),
          },
        },
        select: {
          userId: true,
          user: { select: { telegramUserId: true } },
        },
        distinct: ['userId'],
      }),
      this.prisma.wcEventSubscription.findMany({
        where: {
          eventId,
          ...(mode === 'start' ? { notifyStart: true } : {}),
          user: {
            telegramUserId: { not: null },
            ...(mode === 'start'
              ? { telegramNotifyLiveMatch: true }
              : { telegramNotifyPreMatch: true }),
          },
        },
        select: {
          userId: true,
          user: { select: { telegramUserId: true } },
        },
      }),
    ]);

    const map = new Map<number, string>();
    for (const b of bets) {
      if (b.user.telegramUserId) map.set(b.userId, b.user.telegramUserId);
    }
    for (const s of subs) {
      if (s.user.telegramUserId) map.set(s.userId, s.user.telegramUserId);
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
