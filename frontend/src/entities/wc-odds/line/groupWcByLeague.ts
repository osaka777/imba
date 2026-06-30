import type { WcEvent } from "~/entities/wc-odds/api/client";
import {
  compareWcEventPriority,
  maxWcEventsPriorityLevel,
  sortWcEventsByPriority,
} from "~/entities/wc-odds/lib/wcPriority";

export type WcLeagueBlock = {
  leagueName: string;
  sport: string;
  events: WcEvent[];
  priorityLevel: number;
  isPriority: boolean;
};

export function groupWcEventsByLeague(events: WcEvent[]): WcLeagueBlock[] {
  const map = new Map<string, WcLeagueBlock>();
  const leagueOrder: string[] = [];

  for (const event of events) {
    const leagueName = event.leagueName || "Olimpbet";
    const sport = event.sport || "soccer";
    const key = `${sport}::${leagueName}`;
    const block = map.get(key);
    if (block) {
      block.events.push(event);
      continue;
    }
    map.set(key, {
      leagueName,
      sport,
      events: [event],
      priorityLevel: 0,
      isPriority: false,
    });
    leagueOrder.push(key);
  }

  const blocks = leagueOrder.map((key) => {
    const block = map.get(key)!;
    block.events = sortWcEventsByPriority(block.events);
    block.priorityLevel = maxWcEventsPriorityLevel(block.events);
    block.isPriority = block.priorityLevel > 0;
    return block;
  });

  return blocks.sort((a, b) => {
    const priorityDelta = b.priorityLevel - a.priorityLevel;
    if (priorityDelta !== 0) return priorityDelta;
    const timeDelta =
      Date.parse(a.events[0]?.commenceTime ?? "") - Date.parse(b.events[0]?.commenceTime ?? "");
    if (timeDelta !== 0) return timeDelta;
    return a.leagueName.localeCompare(b.leagueName, "ru");
  });
}

/** Live list: preserve feed order — no priority re-sort (prevents row jumping). */
export function groupWcEventsByLeagueStable(events: WcEvent[]): WcLeagueBlock[] {
  const map = new Map<string, WcLeagueBlock>();
  const leagueOrder: string[] = [];

  for (const event of events) {
    const leagueName = event.leagueName || "Olimpbet";
    const sport = event.sport || "soccer";
    const key = `${sport}::${leagueName}`;
    const block = map.get(key);
    if (block) {
      block.events.push(event);
      continue;
    }
    map.set(key, {
      leagueName,
      sport,
      events: [event],
      priorityLevel: 0,
      isPriority: false,
    });
    leagueOrder.push(key);
  }

  return leagueOrder.map((key) => {
    const block = map.get(key)!;
    block.priorityLevel = maxWcEventsPriorityLevel(block.events);
    block.isPriority = block.priorityLevel > 0;
    return block;
  });
}

export function filterWcEventsByTournament(
  events: WcEvent[],
  tournamentId?: string | null,
  leagueName?: string | null,
): WcEvent[] {
  if (tournamentId) {
    const id = Number(tournamentId);
    if (Number.isFinite(id)) {
      return events.filter((event) => event.tournamentId === id);
    }
  }
  if (leagueName) {
    return events.filter((event) => event.leagueName === leagueName);
  }
  return events;
}

export function filterWcEventsBySport(events: WcEvent[], sport?: string): WcEvent[] {
  if (!sport) return events;
  return events.filter((event) => event.sport === sport);
}

export function filterWcEventsByBroadcast(
  events: WcEvent[],
  broadcastOnly?: boolean,
): WcEvent[] {
  if (!broadcastOnly) return events;
  return events.filter((event) => event.hasBroadcast);
}

export function filterWcEventsByHours(events: WcEvent[], hours: string): WcEvent[] {
  if (!hours || hours === "all") return events;
  const limitHours = Number(hours);
  if (!Number.isFinite(limitHours) || limitHours <= 0) return events;

  const now = Date.now();
  const maxMs = limitHours * 60 * 60 * 1000;
  return events.filter((event) => {
    const delta = Date.parse(event.commenceTime) - now;
    return delta > 0 && delta <= maxMs;
  });
}

export function filterWcEventsByDate(events: WcEvent[], date?: string | null): WcEvent[] {
  if (!date) return events;
  return events.filter((event) => event.commenceTime.slice(0, 10) === date);
}

export function sortWcEventsForDisplay(events: WcEvent[]): WcEvent[] {
  return [...events].sort((a, b) => {
    const priorityDelta = compareWcEventPriority(a, b);
    if (priorityDelta !== 0) return priorityDelta;
    if (a.leagueName !== b.leagueName) {
      return a.leagueName.localeCompare(b.leagueName, "ru");
    }
    return Date.parse(a.commenceTime) - Date.parse(b.commenceTime);
  });
}
