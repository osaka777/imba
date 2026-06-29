import type { GameDtoWithGroupedMarkets } from '~/main/game/dto/available-games.dto';

import { compareOlimpbetPriority } from '../olimpbet-wc/olimpbet-priority.util';

import type { WcOddsEventDto } from './wc-odds.types';

export const HOMEPAGE_WIDGETS_TOTAL = 4;

export type HomepageWidgetItem =
  | { kind: 'wc'; event: WcOddsEventDto }
  | { kind: 'cyber'; event: GameDtoWithGroupedMarkets; isLive: boolean };

export type HomepageWidgetSlots = {
  soccer: number;
  tennis: number;
  cs2: number;
};

export const DEFAULT_HOMEPAGE_WIDGET_SLOTS: HomepageWidgetSlots = {
  soccer: 2,
  tennis: 1,
  cs2: 1,
};

function wcPriorityLevel(event: Pick<WcOddsEventDto, 'priorityLevel' | 'isPriority'>): number {
  if (event.priorityLevel != null) return event.priorityLevel;
  return event.isPriority ? 1 : 0;
}

function isWcPriority(event: Pick<WcOddsEventDto, 'priorityLevel' | 'isPriority'>): boolean {
  return wcPriorityLevel(event) > 0;
}

function compareWcEvents(a: WcOddsEventDto, b: WcOddsEventDto): number {
  const priorityDelta = compareOlimpbetPriority(
    wcPriorityLevel(a) as 0 | 1 | 2,
    wcPriorityLevel(b) as 0 | 1 | 2,
  );
  if (priorityDelta !== 0) return priorityDelta;
  return Date.parse(a.commenceTime) - Date.parse(b.commenceTime);
}

function mergeWcPool(...lists: WcOddsEventDto[][]): WcOddsEventDto[] {
  const byId = new Map<string, WcOddsEventDto>();
  for (const list of lists) {
    for (const event of list) byId.set(event.id, event);
  }
  return [...byId.values()];
}

function pickWcBySport(pool: WcOddsEventDto[], sport: string, limit: number): WcOddsEventDto[] {
  const filtered = pool.filter((event) => event.sport === sport);
  const priority = filtered.filter(isWcPriority).sort(compareWcEvents);
  if (priority.length >= limit) return priority.slice(0, limit);

  const rest = filtered
    .filter((event) => !isWcPriority(event))
    .sort((a, b) => {
      if (a.phase === 'live' && b.phase !== 'live') return -1;
      if (b.phase === 'live' && a.phase !== 'live') return 1;
      return compareWcEvents(a, b);
    });

  const merged: WcOddsEventDto[] = [];
  const seen = new Set<string>();
  for (const event of [...priority, ...rest]) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    merged.push(event);
    if (merged.length >= limit) break;
  }

  return merged;
}

export function buildHomepageWidgets(
  wcPool: WcOddsEventDto[],
  cs2: { game: GameDtoWithGroupedMarkets; isLive: boolean } | null,
  slots: HomepageWidgetSlots = DEFAULT_HOMEPAGE_WIDGET_SLOTS,
): HomepageWidgetItem[] {
  const used = new Set<string>();
  const items: HomepageWidgetItem[] = [];

  for (const event of pickWcBySport(wcPool, 'soccer', slots.soccer)) {
    used.add(event.id);
    items.push({ kind: 'wc', event });
  }

  for (const event of pickWcBySport(
    wcPool.filter((row) => !used.has(row.id)),
    'tennis',
    slots.tennis,
  )) {
    used.add(event.id);
    items.push({ kind: 'wc', event });
  }

  if (slots.cs2 > 0 && cs2) {
    items.push({ kind: 'cyber', event: cs2.game, isLive: cs2.isLive });
  }

  return items.slice(0, HOMEPAGE_WIDGETS_TOTAL);
}
