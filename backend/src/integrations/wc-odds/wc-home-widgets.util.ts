import type { GameDtoWithGroupedMarkets } from '~/main/game/dto/available-games.dto';

import { compareOlimpbetPriority } from '../olimpbet-wc/olimpbet-priority.util';

import type { WcOddsEventDto } from './wc-odds.types';

export const HOMEPAGE_WIDGETS_TOTAL = 8;

export type HomepageWidgetItem =
  | { kind: 'wc'; event: WcOddsEventDto }
  | { kind: 'cyber'; event: GameDtoWithGroupedMarkets; isLive: boolean };

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

export function isWorldCupLeague(leagueName: string): boolean {
  return /чемпионат мира|world cup/i.test(leagueName);
}

function hasBettableOdds(event: WcOddsEventDto): boolean {
  return event.oddsHome != null || event.oddsAway != null;
}

function isPrematchLine(event: WcOddsEventDto): boolean {
  return event.phase === 'prematch' && !event.completed;
}

function isLiveEvent(event: WcOddsEventDto): boolean {
  return event.phase === 'live' && !event.completed;
}

function sortCandidates(events: WcOddsEventDto[]): WcOddsEventDto[] {
  return [...events].sort(compareWcEvents);
}

function pickFirst(
  pool: WcOddsEventDto[],
  used: Set<string>,
  predicate: (event: WcOddsEventDto) => boolean,
): WcOddsEventDto | null {
  const candidates = sortCandidates(pool.filter((event) => !used.has(event.id) && predicate(event)));
  return candidates[0] ?? null;
}

/** Card 1: upcoming prematch from line (World Cup football preferred). */
function pickLeadLineEvent(pool: WcOddsEventDto[], used: Set<string>): WcOddsEventDto | null {
  const prematch = (event: WcOddsEventDto) =>
    isPrematchLine(event) && hasBettableOdds(event);

  return (
    pickFirst(pool, used, (event) => prematch(event) && event.sport === 'soccer' && isWorldCupLeague(event.leagueName))
    ?? pickFirst(pool, used, (event) => prematch(event) && event.sport === 'soccer' && isWcPriority(event))
    ?? pickFirst(pool, used, (event) => prematch(event) && isWcPriority(event))
    ?? pickFirst(pool, used, prematch)
  );
}

/** Cards 2–3: mix World Cup, live tops and other priority prematch. */
function pickMixedTopEvents(pool: WcOddsEventDto[], used: Set<string>, count: number): WcOddsEventDto[] {
  const picked: WcOddsEventDto[] = [];
  const tiers: Array<(event: WcOddsEventDto) => boolean> = [
    (event) => event.sport === 'soccer' && isWorldCupLeague(event.leagueName) && isLiveEvent(event),
    (event) => event.sport === 'soccer' && isWorldCupLeague(event.leagueName) && isPrematchLine(event),
    (event) => event.sport === 'soccer' && isLiveEvent(event) && isWcPriority(event),
    (event) => event.sport === 'soccer' && isPrematchLine(event) && isWcPriority(event),
    (event) => isLiveEvent(event) && isWcPriority(event),
    (event) => isPrematchLine(event) && isWcPriority(event) && hasBettableOdds(event),
    (event) => isLiveEvent(event) && hasBettableOdds(event),
    (event) => isPrematchLine(event) && hasBettableOdds(event),
  ];

  for (const tier of tiers) {
    if (picked.length >= count) break;
    const next = pickFirst(pool, used, tier);
    if (!next) continue;
    used.add(next.id);
    picked.push(next);
  }

  return picked;
}

export function buildHomepageWidgets(
  wcPool: WcOddsEventDto[],
  cs2: { game: GameDtoWithGroupedMarkets; isLive: boolean } | null,
): HomepageWidgetItem[] {
  const pool = mergeWcPool(wcPool);
  const used = new Set<string>();
  const items: HomepageWidgetItem[] = [];

  const lead = pickLeadLineEvent(pool, used);
  if (lead) {
    used.add(lead.id);
    items.push({ kind: 'wc', event: lead });
  }

  for (const event of pickMixedTopEvents(pool, used, 2)) {
    items.push({ kind: 'wc', event });
  }

  if (cs2 && items.length < HOMEPAGE_WIDGETS_TOTAL) {
    items.push({ kind: 'cyber', event: cs2.game, isLive: cs2.isLive });
  }

  while (items.length < HOMEPAGE_WIDGETS_TOTAL) {
    const filler = pickFirst(
      pool,
      used,
      (event) => event.sport === 'soccer' && hasBettableOdds(event),
    );
    if (!filler) break;
    used.add(filler.id);
    items.push({ kind: 'wc', event: filler });
  }

  return items.slice(0, HOMEPAGE_WIDGETS_TOTAL);
}
