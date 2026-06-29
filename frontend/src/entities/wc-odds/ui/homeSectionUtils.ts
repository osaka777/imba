import type { WcEvent } from "~/entities/wc-odds/api/client";
import { filterWcEventsBySport } from "~/entities/wc-odds/line/groupWcByLeague";
import { sortWcEventsByPriority } from "~/entities/wc-odds/lib/wcPriority";
import { sportIsTwoWay } from "~/entities/wc-odds/lib/wcLiveScore";
import { wcEventHasListStats } from "~/entities/wc-odds/lib/wcListStatCols";

import {
  LIVE_HOME_SPORTS,
  PREMATCH_HOME_SPORTS,
  type HomeSportFilterItem,
} from "./homeSportFilters";

/** Grid columns — override via `--home-cols` / `--home-cols-2way` on `.wrap`. */
export const HOME_TABLE_COLUMNS = "var(--home-cols)";
export const HOME_TABLE_COLUMNS_2WAY = "var(--home-cols-2way)";

export function getHomeTableColumnsForSport(sport: string): string {
  return sportIsTwoWay(sport) ? HOME_TABLE_COLUMNS_2WAY : HOME_TABLE_COLUMNS;
}

export function isHomeSportTwoWay(sport: string): boolean {
  return sportIsTwoWay(sport);
}

export function sortPrematchEvents(events: WcEvent[]): WcEvent[] {
  return sortWcEventsByPriority(events);
}

/** @deprecated use sortPrematchEvents */
export function sortPopularEvents(events: WcEvent[]): WcEvent[] {
  return sortPrematchEvents(events);
}

export function getAvailableSportNames(
  events: WcEvent[],
  sports: HomeSportFilterItem[],
): string[] {
  return sports
    .filter((sport) => filterWcEventsBySport(events, sport.name).length > 0)
    .map((sport) => sport.name);
}

export function pickBestSport(
  events: WcEvent[],
  sports: HomeSportFilterItem[],
  current?: string,
): string | undefined {
  if (current && filterWcEventsBySport(events, current).length > 0) {
    return current;
  }

  for (const sport of sports) {
    if (filterWcEventsBySport(events, sport.name).length > 0) {
      return sport.name;
    }
  }

  return undefined;
}

export function pickBestSportFromCounts(
  counts: Record<string, number>,
  sports: HomeSportFilterItem[],
  current?: string,
): string | undefined {
  if (current && (counts[current] ?? 0) > 0) return current;

  for (const sport of sports) {
    if ((counts[sport.name] ?? 0) > 0) return sport.name;
  }

  return sports[0]?.name;
}

/** Replace cached rows for one sport after a targeted fetch. */
export function mergeHomePanelEvents(
  prev: WcEvent[],
  incoming: WcEvent[],
  sport: string,
): WcEvent[] {
  const incomingIds = new Set(incoming.map((event) => event.id));
  const rest = prev.filter((event) => event.sport !== sport && !incomingIds.has(event.id));
  return [...rest, ...incoming];
}

/** Fetch deeper live list so home can surface matches with real Olimpbet stats. */
export const LIVE_HOME_FETCH_LIMIT = 40;

/** Live home: stats-rich rows first, then priority order within each group. */
export function sortLiveHomeEvents(events: WcEvent[]): WcEvent[] {
  const sorted = sortWcEventsByPriority(events);
  const withStats: WcEvent[] = [];
  const withoutStats: WcEvent[] = [];

  for (const event of sorted) {
    if (wcEventHasListStats(event)) withStats.push(event);
    else withoutStats.push(event);
  }

  return [...withStats, ...withoutStats];
}

export function pickVisibleLiveHomeEvents(
  events: WcEvent[],
  sport: string | undefined,
  limit: number,
): WcEvent[] {
  const filtered = filterWcEventsBySport(events, sport);
  const pool = filtered.length > 0 ? filtered : filterWcEventsBySport(events, undefined);
  return sortLiveHomeEvents(pool).slice(0, limit);
}

export function pickVisibleEvents(
  events: WcEvent[],
  sport: string | undefined,
  limit: number,
): WcEvent[] {
  const filtered = filterWcEventsBySport(events, sport);
  const sorted = sortWcEventsByPriority(filtered.length > 0 ? filtered : filterWcEventsBySport(events, undefined));
  return sorted.slice(0, limit);
}

export function getHomeSports(variant: "live" | "prematch"): HomeSportFilterItem[] {
  return variant === "live" ? LIVE_HOME_SPORTS : PREMATCH_HOME_SPORTS;
}

export function buildHomeSportHref(variant: "live" | "prematch", sport: string): string {
  if (variant === "live") {
    return `/live?sport=${encodeURIComponent(sport)}`;
  }
  return `/line/${sport}`;
}
