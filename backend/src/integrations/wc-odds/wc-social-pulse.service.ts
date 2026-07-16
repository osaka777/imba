import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WcOddsBetStatus, WcOddsPick } from '@prisma/client';

import { PrismaService } from '~/prisma/prisma.service';

import { buildWcOddsEventDto } from './wc-event-dto.util';
import { sanitizePublicEventDto } from './wc-public.util';

const DEFAULT_WINDOW_HOURS = 24;
/** Minimum standalone tickets on an event before it appears in Pulse. */
const DEFAULT_MIN_BETS = 2;
const MAX_EVENTS = 6;
const CACHE_MS = 15_000;

type PulseAccumulator = {
  eventId: string;
  betCount: number;
  picks: Record<WcOddsPick, number>;
};

@Injectable()
export class WcSocialPulseService {
  private cache: {
    expiresAt: number;
    payload: {
      enabled: boolean;
      windowHours: number;
      updatedAt?: string;
      items: unknown[];
    };
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getPulse() {
    if (this.config.get<string>('SOCIAL_PULSE_ENABLED') !== 'true') {
      return { enabled: false, windowHours: DEFAULT_WINDOW_HOURS, items: [] };
    }

    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.payload;
    }

    const windowHours = this.readPositiveInt('SOCIAL_PULSE_WINDOW_HOURS', DEFAULT_WINDOW_HOURS);
    const minBets = this.readPositiveInt('SOCIAL_PULSE_MIN_BETS', DEFAULT_MIN_BETS);
    const since = new Date(now - windowHours * 60 * 60 * 1000);
    const baseWhere = {
      isProbe: false,
      // Express legs store stake=0 on WcOddsBet; count only standalone ordinar tickets.
      wcExpressBetId: null,
      status: { not: WcOddsBetStatus.VOID },
      marketKey: 'h2h',
      pick: { not: null },
      createdAt: { gte: since },
      event: { completed: false },
    } as const;

    const grouped = await this.prisma.wcOddsBet.groupBy({
      by: ['eventId', 'pick'],
      where: baseWhere,
      _count: { _all: true },
    });

    const byEvent = new Map<string, PulseAccumulator>();
    for (const row of grouped) {
      if (!row.pick) continue;
      const current = byEvent.get(row.eventId) ?? {
        eventId: row.eventId,
        betCount: 0,
        picks: { HOME: 0, DRAW: 0, AWAY: 0 },
      };
      current.picks[row.pick] += row._count._all;
      current.betCount += row._count._all;
      byEvent.set(row.eventId, current);
    }

    // Early bookmaker traffic: gate by ticket volume, not distinct bettors.
    // Identity is never exposed — only anonymous outcome percentages.
    const leaders = [...byEvent.values()]
      .filter((item) => item.betCount >= minBets)
      .sort((a, b) => b.betCount - a.betCount)
      .slice(0, MAX_EVENTS);

    if (leaders.length === 0) {
      const payload = { enabled: true, windowHours, items: [] };
      this.cache = { expiresAt: now + CACHE_MS, payload };
      return payload;
    }

    const bettorRows = await this.prisma.wcOddsBet.groupBy({
      by: ['eventId', 'userId'],
      where: {
        ...baseWhere,
        eventId: { in: leaders.map((item) => item.eventId) },
      },
    });
    const bettorsByEvent = new Map<string, number>();
    for (const row of bettorRows) {
      bettorsByEvent.set(row.eventId, (bettorsByEvent.get(row.eventId) ?? 0) + 1);
    }

    const events = await this.prisma.wcOddsEvent.findMany({
      where: { id: { in: leaders.map((item) => item.eventId) }, completed: false },
    });
    const eventById = new Map(events.map((event) => [event.id, event]));

    const items = leaders.flatMap((leader) => {
      const event = eventById.get(leader.eventId);
      if (!event) return [];

      const eventDto = sanitizePublicEventDto(buildWcOddsEventDto(event));
      const outcomes = (Object.values(WcOddsPick) as WcOddsPick[]).map((pick) => ({
        pick,
        betCount: leader.picks[pick],
        percent: Math.round((leader.picks[pick] / leader.betCount) * 100),
      }));

      return [{
        event: eventDto,
        betCount: leader.betCount,
        bettorCount: bettorsByEvent.get(leader.eventId) ?? 0,
        outcomes,
      }];
    });

    const payload = {
      enabled: true,
      windowHours,
      updatedAt: new Date().toISOString(),
      items,
    };
    this.cache = { expiresAt: now + CACHE_MS, payload };
    return payload;
  }

  private readPositiveInt(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
