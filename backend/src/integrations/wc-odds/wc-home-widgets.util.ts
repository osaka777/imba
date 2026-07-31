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

/** Big tennis tournaments — grand slams / masters-style titles. */
export function isBigTennisTournament(leagueName: string): boolean {
  return /wimbledon|roland\s*garros|french\s*open|us\s*open|australian\s*open|atp\s*finals|wta\s*finals|masters|miami\s*open|indian\s*wells|madrid\s*open|rome|monte[\s-]?carlo|shanghai|paris\s*masters|grand\s*slam|опен|уимблдон|ролан\s*гаррос|australian|майами|мадрид|рим|шанхай|индиан[\s-]?уэллс/i.test(
    leagueName,
  );
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
    ?? pickFirst(pool, used, (event) => prematch(event) && event.sport === 'soccer' && hasBettableOdds(event))
    ?? pickFirst(pool, used, (event) => prematch(event) && isWcPriority(event))
    ?? pickFirst(pool, used, prematch)
  );
}

/** Next soccer tops after the lead card. */
function pickSoccerTopEvents(pool: WcOddsEventDto[], used: Set<string>, count: number): WcOddsEventDto[] {
  const picked: WcOddsEventDto[] = [];
  const tiers: Array<(event: WcOddsEventDto) => boolean> = [
    (event) => event.sport === 'soccer' && isWorldCupLeague(event.leagueName) && isLiveEvent(event),
    (event) => event.sport === 'soccer' && isWorldCupLeague(event.leagueName) && isPrematchLine(event),
    (event) => event.sport === 'soccer' && isLiveEvent(event) && isWcPriority(event),
    (event) => event.sport === 'soccer' && isPrematchLine(event) && isWcPriority(event),
    (event) => event.sport === 'soccer' && isLiveEvent(event) && hasBettableOdds(event),
    (event) => event.sport === 'soccer' && isPrematchLine(event) && hasBettableOdds(event),
  ];

  for (const tier of tiers) {
    while (picked.length < count) {
      const next = pickFirst(pool, used, tier);
      if (!next) break;
      used.add(next.id);
      picked.push(next);
    }
    if (picked.length >= count) break;
  }

  return picked;
}

/** Priority tennis — prefer big tournaments, then any priority tennis. */
function pickPriorityTennis(pool: WcOddsEventDto[], used: Set<string>, count: number): WcOddsEventDto[] {
  const picked: WcOddsEventDto[] = [];
  const tiers: Array<(event: WcOddsEventDto) => boolean> = [
    (event) =>
      event.sport === 'tennis' &&
      hasBettableOdds(event) &&
      isBigTennisTournament(event.leagueName) &&
      isLiveEvent(event),
    (event) =>
      event.sport === 'tennis' &&
      hasBettableOdds(event) &&
      isBigTennisTournament(event.leagueName),
    (event) =>
      event.sport === 'tennis' &&
      hasBettableOdds(event) &&
      isWcPriority(event) &&
      isLiveEvent(event),
    (event) => event.sport === 'tennis' && hasBettableOdds(event) && isWcPriority(event),
  ];

  for (const tier of tiers) {
    while (picked.length < count) {
      const next = pickFirst(pool, used, tier);
      if (!next) break;
      used.add(next.id);
      picked.push(next);
    }
    if (picked.length >= count) break;
  }

  return picked;
}

function cyberPriority(game: GameDtoWithGroupedMarkets): number {
  return Number((game as { priority?: number }).priority ?? 0) || 0;
}

function isCs2Sport(sport: string | undefined): boolean {
  const s = String(sport || '').toLowerCase();
  return s === 'esports.cs' || s.includes('csgo') || s.includes('cs2') || s.endsWith('.cs');
}

/**
 * Order cyber for homepage:
 * 1) high-priority CS2
 * 2) other high-priority cyber
 * 3) remaining CS2
 * 4) rest
 */
export function sortHomepageCyberLive(
  cyberLive: Array<{ game: GameDtoWithGroupedMarkets; isLive: boolean }>,
): Array<{ game: GameDtoWithGroupedMarkets; isLive: boolean }> {
  return [...cyberLive].sort((a, b) => {
    const aCs = isCs2Sport(a.game.sport) ? 1 : 0;
    const bCs = isCs2Sport(b.game.sport) ? 1 : 0;
    const aPri = cyberPriority(a.game);
    const bPri = cyberPriority(b.game);
    const aHigh = aPri > 0 ? 1 : 0;
    const bHigh = bPri > 0 ? 1 : 0;

    // High-pri CS2 first, then other high-pri, then CS2, then rest — within group by priority.
    const aRank = aCs && aHigh ? 3 : aHigh ? 2 : aCs ? 1 : 0;
    const bRank = bCs && bHigh ? 3 : bHigh ? 2 : bCs ? 1 : 0;
    if (bRank !== aRank) return bRank - aRank;
    if (bPri !== aPri) return bPri - aPri;
    return 0;
  });
}

/**
 * Homepage top strip order:
 * 1) football tops (lead + more soccer)
 * 2) priority CS2 / big tennis
 * 3) more CS2 / cyber fillers, then soccer fillers
 */
export function buildHomepageWidgets(
  wcPool: WcOddsEventDto[],
  cyberLive: Array<{ game: GameDtoWithGroupedMarkets; isLive: boolean }> = [],
): HomepageWidgetItem[] {
  const pool = mergeWcPool(wcPool);
  const used = new Set<string>();
  const items: HomepageWidgetItem[] = [];
  const cyberOrdered = sortHomepageCyberLive(cyberLive);

  const lead = pickLeadLineEvent(pool, used);
  if (lead) {
    used.add(lead.id);
    items.push({ kind: 'wc', event: lead });
  }

  // Keep football block first (~3–4 soccer cards).
  for (const event of pickSoccerTopEvents(pool, used, 3)) {
    items.push({ kind: 'wc', event });
  }

  // Then priority tennis / CS2.
  for (const event of pickPriorityTennis(pool, used, 1)) {
    if (items.length >= HOMEPAGE_WIDGETS_TOTAL) break;
    items.push({ kind: 'wc', event });
  }

  let cyberInserted = 0;
  for (const cyber of cyberOrdered) {
    if (items.length >= HOMEPAGE_WIDGETS_TOTAL) break;
    if (cyberInserted >= 2) break;
    items.push({ kind: 'cyber', event: cyber.game, isLive: cyber.isLive });
    cyberInserted += 1;
  }

  // Remaining slots: more CS2/cyber, then soccer fillers.
  for (const cyber of cyberOrdered.slice(cyberInserted)) {
    if (items.length >= HOMEPAGE_WIDGETS_TOTAL) break;
    items.push({ kind: 'cyber', event: cyber.game, isLive: cyber.isLive });
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
