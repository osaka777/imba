import type { CyberGame } from "~/entities/cybersport/api/client";
import { CYBER_SPORTS } from "~/entities/cybersport/lib/cyberSportsList";
import type { WcEvent } from "~/entities/wc-odds/api/client";
import { filterWcEventsBySport } from "~/entities/wc-odds/line/groupWcByLeague";
import {
  filterVisibleWcLineEvents,
  filterVisibleWcLiveEvents,
} from "~/entities/wc-odds/lib/wcLineEvents";
import { sportIsTwoWay } from "~/entities/wc-odds/lib/wcLiveScore";
import {
  compareWcEventPriority,
  isWcPriorityEvent,
  sortWcEventsByPriority,
} from "~/entities/wc-odds/lib/wcPriority";

export const TOP_EVENTS_CARD_LIMIT = 8;
export const TOP_EVENTS_FETCH_LIMIT = 100;
export const HOMEPAGE_TOP_EVENTS_TOTAL = 8;

export type HomepageTopEventsSlots = {
  soccer: number;
  tennis: number;
  cs2: number;
};

/** Homepage carousel: football first, then tennis / CS2 by priority. */
export const DEFAULT_HOMEPAGE_TOP_EVENTS_SLOTS: HomepageTopEventsSlots = {
  soccer: 4,
  tennis: 1,
  cs2: 2,
};

const CS2_SPORT_KEY = CYBER_SPORTS[0]?.name ?? "esports.cs";

export type TopEventsSportFilter = "all" | "cybersport" | string;

export type TopEventWcItem = {
  kind: "wc";
  key: string;
  event: WcEvent;
};

export type TopEventCyberItem = {
  kind: "cyber";
  key: string;
  event: CyberGame;
  isLive: boolean;
};

export type TopEventItem = TopEventWcItem | TopEventCyberItem;

export function mergeTopEventsPool(live: WcEvent[], line: WcEvent[]): WcEvent[] {
  const byId = new Map<string, WcEvent>();
  for (const event of line) byId.set(event.id, event);
  for (const event of live) byId.set(event.id, event);
  return [...byId.values()];
}

function sortUpcomingEvents(events: WcEvent[]): WcEvent[] {
  return [...events].sort((a, b) => {
    if (a.phase === "live" && b.phase !== "live") return -1;
    if (b.phase === "live" && a.phase !== "live") return 1;
    const priorityDelta = compareWcEventPriority(a, b);
    if (priorityDelta !== 0) return priorityDelta;
    return Date.parse(a.commenceTime) - Date.parse(b.commenceTime);
  });
}

export function pickWcTopEvents(
  pool: WcEvent[],
  sport: TopEventsSportFilter,
  limit: number,
): WcEvent[] {
  const safePool = pool.filter((event) => event?.id && event.commenceTime);
  const visible = [
    ...filterVisibleWcLiveEvents(safePool),
    ...filterVisibleWcLineEvents(safePool),
  ];
  const deduped = mergeTopEventsPool(
    visible.filter((event) => event.phase === "live"),
    visible.filter((event) => event.phase !== "live"),
  );

  const filtered =
    sport === "all" ? deduped : filterWcEventsBySport(deduped, sport);

  const priority = filtered.filter((event) => isWcPriorityEvent(event));
  const sortedPriority = sortWcEventsByPriority(priority);

  if (sortedPriority.length >= limit) {
    return sortedPriority.slice(0, limit);
  }

  const rest = sortUpcomingEvents(
    filtered.filter((event) => !isWcPriorityEvent(event)),
  );

  const merged: WcEvent[] = [];
  const seen = new Set<string>();
  for (const event of [...sortedPriority, ...rest]) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    merged.push(event);
    if (merged.length >= limit) break;
  }

  return merged;
}

export function pickCyberTopEvents(
  liveBySport: Record<string, CyberGame[]>,
  lineBySport: Record<string, CyberGame[]>,
  limit: number,
  options?: { requireTeamLogos?: boolean },
): TopEventCyberItem[] {
  const merged: TopEventCyberItem[] = [];
  const seen = new Set<string>();

  const hasLogos = (event: CyberGame) =>
    Boolean(event.team1Icon?.trim() && event.team2Icon?.trim());

  for (const { name } of CYBER_SPORTS) {
    for (const event of liveBySport[name] ?? []) {
      if (seen.has(event.eventId)) continue;
      if (options?.requireTeamLogos && !hasLogos(event)) continue;
      seen.add(event.eventId);
      merged.push({ kind: "cyber", key: event.eventId, event, isLive: true });
    }
  }

  for (const { name } of CYBER_SPORTS) {
    for (const event of lineBySport[name] ?? []) {
      if (seen.has(event.eventId)) continue;
      if (options?.requireTeamLogos && !hasLogos(event)) continue;
      seen.add(event.eventId);
      merged.push({ kind: "cyber", key: event.eventId, event, isLive: false });
    }
  }

  merged.sort((a, b) => {
    const aPriority = a.event.priority ?? 0;
    const bPriority = b.event.priority ?? 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    const aTime = a.event.meta?.raw_start_at ?? "";
    const bTime = b.event.meta?.raw_start_at ?? "";
    return aTime.localeCompare(bTime);
  });

  return merged.slice(0, limit);
}

export function wcTopEventBadge(priorityLevel: number | undefined): "SUPERTOP" | "TOP" | null {
  if ((priorityLevel ?? 0) >= 2) return "SUPERTOP";
  if ((priorityLevel ?? 0) >= 1) return "TOP";
  return null;
}

export function cyberTopEventBadge(priority: number | undefined): "SUPERTOP" | "TOP" | null {
  if ((priority ?? 0) >= 2) return "SUPERTOP";
  if ((priority ?? 0) >= 1) return "TOP";
  return null;
}

/** Short label for top-event cards (full name stays in title). */
export function formatTopEventLeague(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  if (/чемпионат мира/i.test(trimmed)) {
    const round = trimmed.match(/(1\/\d+)\s*финал/i)?.[1];
    return round ? `ЧМ-2026 · ${round}` : "ЧМ-2026";
  }

  if (trimmed.length <= 30) return trimmed;
  return `${trimmed.slice(0, 28).trimEnd()}…`;
}

export function topEventIsTwoWay(item: TopEventItem): boolean {
  if (item.kind === "cyber") {
    return true;
  }
  return sportIsTwoWay(item.event.sport);
}

export function extractCyberWinOdds(event: CyberGame): {
  home: number | null;
  draw: number | null;
  away: number | null;
} {
  const markets = event.groupedMarkets ?? {};
  let home: number | null = null;
  let draw: number | null = null;
  let away: number | null = null;

  for (const group of Object.values(markets)) {
    if (!Array.isArray(group)) continue;
    for (const market of group) {
      if (!market || typeof market !== "object") continue;
      const key = typeof market.market === "string" ? market.market : "";
      const cf = Number(market.cf);
      if (!Number.isFinite(cf) || cf <= 1) continue;

      if (/^WIN__P1|^WIN_OT__P1|^WIN_RT__P1/.test(key)) home = cf;
      if (/^WIN__PX|^WIN_RT__PX/.test(key)) draw = cf;
      if (/^WIN__P2|^WIN_OT__P2|^WIN_RT__P2/.test(key)) away = cf;
    }
  }

  return { home, draw, away };
}

export function wcEventToTopItems(events: WcEvent[]): TopEventWcItem[] {
  return events.map((event) => ({
    kind: "wc",
    key: event.id,
    event,
  }));
}

function takeWcSportSlots(
  pool: WcEvent[],
  sport: string,
  count: number,
  usedIds: Set<string>,
  out: TopEventItem[],
): void {
  if (count <= 0) return;

  const picked = pickWcTopEvents(
    pool.filter((event) => !usedIds.has(event.id)),
    sport,
    count,
  );

  for (const event of picked) {
    usedIds.add(event.id);
    out.push({ kind: "wc", key: event.id, event });
  }
}

/** Curated homepage widgets: priority football ×2, tennis ×1, CS2 ×1. */
export function pickHomepageTopEvents(
  wcPool: WcEvent[],
  cs2Live: CyberGame[],
  cs2Line: CyberGame[],
  slots: HomepageTopEventsSlots = DEFAULT_HOMEPAGE_TOP_EVENTS_SLOTS,
): TopEventItem[] {
  const usedWcIds = new Set<string>();
  const items: TopEventItem[] = [];

  takeWcSportSlots(wcPool, "soccer", slots.soccer, usedWcIds, items);
  takeWcSportSlots(wcPool, "tennis", slots.tennis, usedWcIds, items);

  if (slots.cs2 > 0) {
    const cs2Items = pickCyberTopEvents(
      { [CS2_SPORT_KEY]: cs2Live },
      { [CS2_SPORT_KEY]: cs2Line },
      slots.cs2,
      { requireTeamLogos: true },
    );
    items.push(...cs2Items);
  }

  return items.slice(0, HOMEPAGE_TOP_EVENTS_TOTAL);
}
