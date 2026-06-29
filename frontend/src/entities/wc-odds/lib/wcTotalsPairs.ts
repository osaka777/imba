import type { WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { isOvertimeMarketKey, normalizeWcMarketKey } from "~/entities/wc-odds/lib/wcRate";

export type TotalsPairRow = {
  under?: WcMarketOutcome;
  over?: WcMarketOutcome;
  point: number | string;
};

function displayOutcomeTypeId(outcomeKey: string): number | null {
  const match = outcomeKey.match(/^DISPLAY_\d+_(\d+)_/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

function lineFromOutcomeKey(outcomeKey: string): string | null {
  const canonical = outcomeKey.match(/^(?:OVER|UNDER)_(.+)$/);
  if (canonical) return canonical[1]!;
  const legacy = outcomeKey.match(/^TOTAL_\d+_(.+)$/);
  if (legacy) return legacy[1]!;
  return null;
}

export function isLikelyUnderOutcome(outcome: WcMarketOutcome): boolean {
  if (outcome.outcomeKey.startsWith("UNDER")) return true;
  const name = outcome.name.trim();
  if (/^тм$/i.test(name) || /^м$/i.test(name) || /меньше/i.test(name)) return true;
  if (/^under$/i.test(name)) return true;
  return /under/i.test(outcome.outcomeKey);
}

export function isLikelyOverOutcome(outcome: WcMarketOutcome): boolean {
  if (outcome.outcomeKey.startsWith("OVER")) return true;
  const name = outcome.name.trim();
  if (/^тб$/i.test(name) || /^б$/i.test(name) || /больше/i.test(name)) return true;
  if (/^over$/i.test(name)) return true;
  return /over/i.test(outcome.outcomeKey);
}

function parseLineFromLabel(label: string): number | string | null {
  const match = label.match(/(-?[\d.]+)\s*$/);
  return match ? match[1]! : null;
}

function resolveTotalsPoint(
  group: WcMarketGroup,
  under?: WcMarketOutcome,
  over?: WcMarketOutcome,
): number | string {
  const fromOutcome = under?.point ?? over?.point;
  if (fromOutcome != null && Number.isFinite(Number(fromOutcome))) {
    return fromOutcome;
  }

  for (const outcome of group.outcomes) {
    const fromKey = lineFromOutcomeKey(outcome.outcomeKey);
    if (fromKey != null) return fromKey;
  }

  const fromLabel = parseLineFromLabel(group.label);
  if (fromLabel != null) return fromLabel;

  return "";
}

function pickDistinctUnderOver(group: WcMarketGroup): { under?: WcMarketOutcome; over?: WcMarketOutcome } {
  let under = group.outcomes.find((o) => o.outcomeKey.startsWith("UNDER"));
  let over = group.outcomes.find((o) => o.outcomeKey.startsWith("OVER"));

  if (!under) under = group.outcomes.find((o) => isLikelyUnderOutcome(o) && !isLikelyOverOutcome(o));
  if (!over) over = group.outcomes.find((o) => isLikelyOverOutcome(o) && !isLikelyUnderOutcome(o));

  if (under && over && under.outcomeKey === over.outcomeKey) {
    over = undefined;
  }

  if ((!under || !over) && group.outcomes.length === 2) {
    const sorted = [...group.outcomes].sort((a, b) => {
      const idA = displayOutcomeTypeId(a.outcomeKey) ?? 0;
      const idB = displayOutcomeTypeId(b.outcomeKey) ?? 0;
      return idA - idB;
    });
    if (!under && !over) {
      const firstUnder = sorted.find(isLikelyUnderOutcome);
      const firstOver = sorted.find(isLikelyOverOutcome);
      if (firstUnder && firstOver && firstUnder.outcomeKey !== firstOver.outcomeKey) {
        under = firstUnder;
        over = firstOver;
      } else {
        under = sorted[0];
        over = sorted[1];
      }
    } else if (!under) {
      under = sorted.find((o) => o !== over);
    } else if (!over) {
      over = sorted.find((o) => o !== under);
    }
  }

  if (under && over && under.outcomeKey === over.outcomeKey) {
    over = undefined;
  }

  return { under, over };
}

/** Pair over/under outcomes for totals blocks (canonical or legacy DISPLAY keys). */
export function findTotalsPair(group: WcMarketGroup): TotalsPairRow {
  const { under, over } = pickDistinctUnderOver(group);

  return {
    under,
    over,
    point: resolveTotalsPoint(group, under, over),
  };
}

export function hasCompleteTotalsPair(group: WcMarketGroup): boolean {
  const { under, over } = findTotalsPair(group);
  return Boolean(under && over);
}

function totalsGroupBucketKey(group: WcMarketGroup, point: number | string): string | null {
  if (point === "" || point == null) return null;
  const marketKey = normalizeWcMarketKey(group.marketKey);
  const ot = isOvertimeMarketKey(group.marketKey) ? "ot" : "main";
  const scope = group.label.replace(/\s*(-?[\d.,]+)\s*$/, "").trim() || group.key;
  return `${marketKey}|${ot}|${scope}|${point}`;
}

/** Merge split totals rows (e.g. separate market ids) into one over/under pair per line. */
export function coalesceTotalsGroups(groups: WcMarketGroup[]): WcMarketGroup[] {
  const buckets = new Map<string, WcMarketGroup>();
  const unbucketed: WcMarketGroup[] = [];

  for (const group of groups) {
    const { point } = findTotalsPair(group);
    const bucketKey = totalsGroupBucketKey(group, point);
    if (!bucketKey) {
      unbucketed.push(group);
      continue;
    }
    const existing = buckets.get(bucketKey);

    if (!existing) {
      buckets.set(bucketKey, {
        ...group,
        outcomes: [...group.outcomes],
      });
      continue;
    }

    const seen = new Set(existing.outcomes.map((o) => o.outcomeKey));
    for (const outcome of group.outcomes) {
      if (!seen.has(outcome.outcomeKey)) {
        existing.outcomes.push(outcome);
        seen.add(outcome.outcomeKey);
      }
    }

    if (group.label.length > 0 && group.label.length < existing.label.length) {
      existing.label = group.label;
    }
  }

  return [...buckets.values(), ...unbucketed];
}
