import type { WcEvent } from "~/entities/wc-odds/api/client";
import { isWcEventBettingOpen } from "~/entities/wc-odds/lib/wcRate";
import { wcMaxLiveWindowMs } from "~/entities/wc-odds/lib/wcLivePlay";
import { mergeWcParsedScore } from "~/entities/wc-odds/lib/wcLiveScore";
import { mergeStatListForEvent } from "~/entities/wc-odds/lib/wcStatsMerge";

function oddsEqual(a: WcEvent, b: WcEvent): boolean {
  return (
    a.oddsHome === b.oddsHome &&
    a.oddsDraw === b.oddsDraw &&
    a.oddsAway === b.oddsAway &&
    a.odds1X === b.odds1X &&
    a.odds12 === b.odds12 &&
    a.oddsX2 === b.oddsX2 &&
    a.marketsCount === b.marketsCount &&
    a.sport === b.sport &&
    a.leagueName === b.leagueName &&
    a.oddsOver === b.oddsOver &&
    a.oddsUnder === b.oddsUnder &&
    a.totalLine === b.totalLine &&
    a.bettingOpen === b.bettingOpen &&
    a.completed === b.completed &&
    a.homeScore === b.homeScore &&
    a.awayScore === b.awayScore &&
    a.phase === b.phase &&
    a.homeTeamIcon === b.homeTeamIcon &&
    a.awayTeamIcon === b.awayTeamIcon &&
    a.hasBroadcast === b.hasBroadcast &&
    a.hasLiveTracker === b.hasLiveTracker &&
    a.priorityLevel === b.priorityLevel &&
    a.isPriority === b.isPriority &&
    JSON.stringify(a.parsedScore) === JSON.stringify(b.parsedScore) &&
    JSON.stringify(a.statList) === JSON.stringify(b.statList)
  );
}

export function isWcValidListOdd(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value > 1;
}

/** True when the list row can show at least one bet or extra markets on the match page. */
export function wcEventHasActiveListBets(event: WcEvent): boolean {
  if ((event.marketsCount ?? 0) > 0) return true;
  return (
    isWcValidListOdd(event.oddsHome)
    || isWcValidListOdd(event.oddsDraw)
    || isWcValidListOdd(event.oddsAway)
    || isWcValidListOdd(event.odds1X)
    || isWcValidListOdd(event.odds12)
    || isWcValidListOdd(event.oddsX2)
    || isWcValidListOdd(event.oddsOver)
    || isWcValidListOdd(event.oddsUnder)
  );
}

/** Hide started / finished matches on the line (client-side, instant at kickoff). */
export function filterVisibleWcLineEvents(events: WcEvent[]): WcEvent[] {
  const nowMs = Date.now();
  return events.filter(
    (event) =>
      isWcEventBettingOpen(event)
      && event.phase !== "live"
      && new Date(event.commenceTime).getTime() > nowMs,
  );
}


/** Match is definitively over — safe to drop from the live list. */
export function isWcLiveListTerminal(event: WcEvent, nowMs: number = Date.now()): boolean {
  if (event.completed || event.phase === "finished") return true;
  const kickoffMs = Date.parse(event.commenceTime);
  if (!Number.isFinite(kickoffMs)) return false;
  return nowMs - kickoffMs > wcMaxLiveWindowMs(event.sport);
}

/** Live list: in-play matches stay put until the match is over (ignore brief market gaps). */
export function filterVisibleWcLiveEvents(events: WcEvent[]): WcEvent[] {
  const nowMs = Date.now();
  return events.filter((event) => {
    if (isWcLiveListTerminal(event, nowMs)) return false;
    if (event.phase !== "live") return false;

    const kickoffMs = Date.parse(event.commenceTime);
    if (!Number.isFinite(kickoffMs) || kickoffMs > nowMs) return false;

    return true;
  });
}

/** Patch odds/score — WS frames omit names (stripped in feed store); HTTP may refresh labels. */
export function mergeWcEvent(prev: WcEvent, incoming: WcEvent): WcEvent {
  const parsedScore = mergeWcParsedScore(prev.parsedScore, incoming.parsedScore);
  const statList = mergeStatListForEvent(incoming.id, prev.statList, incoming.statList);

  const merged: WcEvent = {
    ...prev,
    ...incoming,
    // Prefer incoming labels when present (HTTP); keep prev when WS stripped them.
    homeTeam: incoming.homeTeam || prev.homeTeam,
    awayTeam: incoming.awayTeam || prev.awayTeam,
    leagueName: incoming.leagueName || prev.leagueName,
    parsedScore,
    statList,
    homeScore: incoming.homeScore ?? prev.homeScore,
    awayScore: incoming.awayScore ?? prev.awayScore,
    homeTeamIcon: incoming.homeTeamIcon ?? prev.homeTeamIcon,
    awayTeamIcon: incoming.awayTeamIcon ?? prev.awayTeamIcon,
    hasBroadcast: incoming.hasBroadcast ?? prev.hasBroadcast,
    hasLiveTracker: incoming.hasLiveTracker ?? prev.hasLiveTracker,
    priorityLevel: Math.max(incoming.priorityLevel ?? 0, prev.priorityLevel ?? 0),
    isPriority: Boolean(incoming.isPriority || prev.isPriority || (incoming.priorityLevel ?? 0) > 0 || (prev.priorityLevel ?? 0) > 0),
    marketsCount: incoming.marketsCount ?? prev.marketsCount,
  };

  return oddsEqual(prev, merged) ? prev : merged;
}

/** Patch odds in place — preserve row order; by default do not append new rows from WS. */
export function mergeWcLineEvents(
  prev: WcEvent[],
  incoming: WcEvent[],
  patchOnly = true,
): WcEvent[] {
  if (incoming.length === 0) return prev;
  if (prev.length === 0) return patchOnly ? [] : incoming;

  const incomingById = new Map(incoming.map((event) => [event.id, event]));

  const merged: WcEvent[] = [];
  for (const old of prev) {
    const inc = incomingById.get(old.id);
    if (!inc) {
      merged.push(old);
      continue;
    }
    merged.push(mergeWcEvent(old, inc));
    incomingById.delete(old.id);
  }

  if (!patchOnly) {
    for (const inc of incoming) {
      if (incomingById.has(inc.id)) {
        merged.push(inc);
      }
    }
  }

  if (merged.length === prev.length && merged.every((event, i) => event === prev[i])) {
    return prev;
  }

  return merged;
}

/** WS snapshot: patch rows already loaded via paginated HTTP — do not expand the list. */
export function mergeWcListSnapshot(prev: WcEvent[], incoming: WcEvent[]): WcEvent[] {
  if (incoming.length === 0) return prev;
  if (prev.length === 0) return incoming;

  const incomingById = new Map(incoming.map((event) => [event.id, event]));
  const merged = prev.map((old) => {
    const inc = incomingById.get(old.id);
    return inc ? mergeWcEvent(old, inc) : old;
  });

  if (merged.length === prev.length && merged.every((event, i) => event === prev[i])) {
    return prev;
  }

  return merged;
}

export function mergeWcFeedDelta(
  prev: WcEvent[],
  incoming: WcEvent[],
  removedIds?: string[],
  patchOnly = true,
): WcEvent[] {
  if (incoming.length === 0 && !removedIds?.length) return prev;

  let merged = incoming.length > 0
    ? mergeWcLineEvents(prev, incoming, patchOnly)
    : prev;

  if (removedIds?.length) {
    const removed = new Set(removedIds);
    const filtered = merged.filter((event) => !removed.has(event.id));
    if (filtered.length !== merged.length) merged = filtered;
  }

  return merged;
}

export function mergeWcLiveEvents(
  prev: WcEvent[],
  incoming: WcEvent[],
  removedIds?: string[],
): WcEvent[] {
  const prevById = new Map(prev.map((event) => [event.id, event]));
  const safeRemoved = removedIds?.filter((id) => {
    const event = prevById.get(id);
    return !event || isWcLiveListTerminal(event);
  });
  return mergeWcFeedDelta(prev, incoming, safeRemoved, true);
}

export function wcLineDatesFromEvents(events: WcEvent[]): string[] {
  const dates = new Set<string>();
  for (const event of events) {
    dates.add(event.commenceTime.slice(0, 10));
  }
  return [...dates].sort();
}
