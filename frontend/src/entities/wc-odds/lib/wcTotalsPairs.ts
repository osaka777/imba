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
  if (canonical) return canonical[1]!.replace(/_/g, ".");
  const legacy = outcomeKey.match(/^TOTAL_\d+_(.+)$/);
  if (legacy) return legacy[1]!.replace(/_/g, ".");
  const display = outcomeKey.match(/^DISPLAY_\d+_\d+_(.+)$/i);
  if (display) return display[1]!.replace(/_/g, ".");
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

function parseLineFromOutcomeName(name: string): string | null {
  const trimmed = name.trim();
  const embedded = trimmed.match(
    /(?:тм|тб|м|б|over|under|больше|меньше)\s*[\(:]?\s*(-?[\d]+[.,][\d]+|-?[\d]+)/i,
  );
  if (embedded) return embedded[1]!.replace(",", ".");

  const trailing = trimmed.match(/(-?[\d]+[.,][\d]+)\s*$/);
  if (trailing) return trailing[1]!.replace(",", ".");

  return null;
}

function parseLineFromLabel(label: string): number | string | null {
  const trimmed = label.trim();
  if (/^(12|1x|x2|п1|п2|x)$/i.test(trimmed)) return null;

  const dotted = trimmed.match(/·\s*(-?[\d.,]+)\s*$/i);
  if (dotted) return dotted[1]!.replace(",", ".");

  const decimal = trimmed.match(/(-?[\d]+[.,][\d]+)\s*$/);
  if (decimal) return decimal[1]!.replace(",", ".");

  const match = trimmed.match(/(-?[\d.]+)\s*$/);
  return match ? match[1]!.replace(",", ".") : null;
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
    const fromName = parseLineFromOutcomeName(outcome.name);
    if (fromName != null) return fromName;
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

function normalizeTotalsOrientation(
  under: WcMarketOutcome | undefined,
  over: WcMarketOutcome | undefined,
): { under?: WcMarketOutcome; over?: WcMarketOutcome } {
  if (under && over && isLikelyOverOutcome(under) && isLikelyUnderOutcome(over)) {
    return { under: over, over: under };
  }
  return { under, over };
}

/** Pair over/under outcomes for totals blocks (canonical or legacy DISPLAY keys). */
export function findTotalsPair(group: WcMarketGroup): TotalsPairRow {
  const picked = pickDistinctUnderOver(group);
  const { under, over } = normalizeTotalsOrientation(picked.under, picked.over);

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

/** «12 + тотал», «1X + тотал» — display combo with ТМ/ТБ rows per line. */
export function isComboResultTotalGroup(group: WcMarketGroup): boolean {
  if (!/AND_TOTAL/i.test(group.marketKey)) return false;
  if (group.outcomes.length !== 2) return false;
  if (isYesNoMarketKey(group.marketKey)) return false;

  const hasUnder = group.outcomes.some((o) => isLikelyUnderOutcome(o) && !isLikelyOverOutcome(o));
  const hasOver = group.outcomes.some((o) => isLikelyOverOutcome(o) && !isLikelyUnderOutcome(o));
  return hasUnder && hasOver;
}

function isYesNoMarketKey(marketKey: string): boolean {
  const stem = marketKey.replace(/^display_/i, "").replace(/_ot$/i, "");
  return /_YES_NO$/i.test(stem);
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
