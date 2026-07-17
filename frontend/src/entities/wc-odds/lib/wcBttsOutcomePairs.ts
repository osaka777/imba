import type { WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { extractBttsResultSuffix } from "~/entities/wc-odds/lib/wcOutcomeDisplayTitle";
import { findYesNoOutcomes } from "~/entities/wc-odds/lib/wcYesNoOutcomes";

const RESULT_ORDER = ["X", "П1", "П2", "12", "1X", "X2"] as const;

export type BttsOutcomePairRow = {
  key: string;
  group: WcMarketGroup;
  result: string;
  yes?: WcMarketOutcome;
  no?: WcMarketOutcome;
};

export function parseBttsOutcomeLabel(
  name: string,
): { yn: "Да" | "Нет"; result: string } | null {
  const match = /^ОЗ·(Да|Нет)·(.+)$/i.exec(name.trim());
  if (!match) return null;

  const yn = match[1]!.toLowerCase() === "да" ? "Да" : "Нет";
  const raw = match[2]!.trim().replace(/Х/g, "X");
  const upper = raw.toUpperCase();

  const result =
    upper === "P1" || upper === "П1" ? "П1"
      : upper === "P2" || upper === "П2" ? "П2"
        : upper === "X" ? "X"
          : upper === "1X" ? "1X"
            : upper === "12" ? "12"
              : upper === "X2" ? "X2"
                : raw;

  return { yn, result };
}

export function isLegacyBttsOutcomeGroup(group: WcMarketGroup): boolean {
  if (!/WINNER_AND_GOALS_BOTH|DOUBLECHANCE_AND_GOALS_BOTH|GOALS_BOTH_AND_WINNER_HALF/i.test(group.marketKey)) {
    return false;
  }
  return group.outcomes.some((outcome) => parseBttsOutcomeLabel(outcome.name) != null);
}

export function isSplitBttsOutcomeYesNoGroup(group: WcMarketGroup): boolean {
  if (group.outcomes.length !== 2) return false;
  if (!/BOTH_TEAM_TO_SCORE/i.test(group.marketKey)) return false;
  return group.outcomes.some((outcome) => parseBttsOutcomeLabel(outcome.name) != null);
}

export function isBttsAndOutcomeMarketGroup(group: WcMarketGroup): boolean {
  return isLegacyBttsOutcomeGroup(group) || isSplitBttsOutcomeYesNoGroup(group);
}

function resolveSplitGroupResult(group: WcMarketGroup): string | null {
  const fromKey = extractBttsResultSuffix(group.marketKey);
  if (fromKey) return fromKey;

  const label = group.label?.trim();
  if (label && /^(П1|П2|X|1X|12|X2)$/i.test(label)) {
    return label.replace(/Х/g, "X").replace(/^P(\d)$/i, "П$1");
  }

  for (const outcome of group.outcomes) {
    const parsed = parseBttsOutcomeLabel(outcome.name);
    if (parsed) return parsed.result;
  }

  return null;
}

function buildLegacyPairRows(group: WcMarketGroup): BttsOutcomePairRow[] {
  const buckets = new Map<string, { yes?: WcMarketOutcome; no?: WcMarketOutcome }>();

  for (const outcome of group.outcomes) {
    const parsed = parseBttsOutcomeLabel(outcome.name);
    if (!parsed) continue;

    const bucket = buckets.get(parsed.result) ?? {};
    if (parsed.yn === "Да") bucket.yes = outcome;
    else bucket.no = outcome;
    buckets.set(parsed.result, bucket);
  }

  return [...buckets.entries()].map(([result, pair]) => ({
    key: `${group.key}::${result}`,
    group,
    result,
    yes: pair.yes,
    no: pair.no,
  }));
}

function buildSplitPairRow(group: WcMarketGroup): BttsOutcomePairRow | null {
  const result = resolveSplitGroupResult(group);
  if (!result) return null;

  const { yes, no } = findYesNoOutcomes(group);
  if (!yes && !no) return null;

  return {
    key: group.key,
    group,
    result,
    yes,
    no,
  };
}

function sortResultRows(rows: BttsOutcomePairRow[]): BttsOutcomePairRow[] {
  const order = new Map(RESULT_ORDER.map((value, index) => [value, index]));

  return [...rows].sort((left, right) => {
    const leftIndex = order.get(left.result as typeof RESULT_ORDER[number]) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = order.get(right.result as typeof RESULT_ORDER[number]) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.result.localeCompare(right.result, "ru");
  });
}

/** «Обе забьют и Исход» — pair Да/Нет rows with result pivot (X, П1, 12, …). */
export function buildBttsOutcomePairRows(groups: WcMarketGroup[]): BttsOutcomePairRow[] {
  const rows: BttsOutcomePairRow[] = [];

  for (const group of groups) {
    if (isLegacyBttsOutcomeGroup(group)) {
      rows.push(...buildLegacyPairRows(group));
      continue;
    }

    if (isSplitBttsOutcomeYesNoGroup(group)) {
      const row = buildSplitPairRow(group);
      if (row) rows.push(row);
    }
  }

  return sortResultRows(rows);
}

export function isBttsAndOutcomeCategory(categoryName: string, groups: WcMarketGroup[]): boolean {
  if (/обе\s+заб.*исход/i.test(categoryName)) return true;
  return groups.some(isBttsAndOutcomeMarketGroup);
}
