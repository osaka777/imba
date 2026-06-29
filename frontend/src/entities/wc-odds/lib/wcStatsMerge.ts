import type { WcStatListItem } from "~/entities/wc-odds/api/client";

/** Stats shown in the progress block — used to pick the richer snapshot. */
const RICH_STAT_IDS = new Set([
  "possession",
  "shots_on",
  "shots_off",
  "dangerous_attacks",
  "fouls",
  "offsides",
  "substitutions",
  "penalty_minutes",
  "aces",
  "double_faults",
]);

const STICKY_MS = 4000;
const stickyByEvent = new Map<string, { statList: WcStatListItem[]; at: number }>();

function statListWeight(list?: WcStatListItem[] | null): number {
  if (!list?.length) return 0;
  let weight = list.length;
  for (const row of list) {
    if (RICH_STAT_IDS.has(row.id)) weight += 10;
  }
  return weight;
}

/** Prefer the richer stats snapshot — inline odds ticks must not wipe structured stats. */
export function pickRicherStatList(
  prev?: WcStatListItem[] | null,
  incoming?: WcStatListItem[] | null,
): WcStatListItem[] | undefined {
  const prevWeight = statListWeight(prev);
  const incWeight = statListWeight(incoming);
  if (incWeight === 0) return prev ?? undefined;
  if (prevWeight === 0) return incoming;
  return incWeight >= prevWeight ? incoming : prev;
}

/** Keep last good statList for a few seconds when WS sends odds-only / empty payloads. */
export function mergeStatListForEvent(
  eventId: string,
  prev?: WcStatListItem[] | null,
  incoming?: WcStatListItem[] | null,
): WcStatListItem[] | undefined {
  const sticky = stickyByEvent.get(eventId);
  const merged = pickRicherStatList(
    pickRicherStatList(prev, sticky?.statList),
    incoming,
  );

  if (merged?.length) {
    stickyByEvent.set(eventId, { statList: merged, at: Date.now() });
    return merged;
  }

  if (sticky && Date.now() - sticky.at <= STICKY_MS) {
    return sticky.statList;
  }

  return prev ?? undefined;
}
