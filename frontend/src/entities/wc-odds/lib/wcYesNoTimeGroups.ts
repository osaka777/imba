import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { resolveLiveMatchMinute } from "~/entities/wc-odds/lib/wcLiveClock";
import { findYesNoOutcomes, isYesOutcome, isNoOutcome } from "~/entities/wc-odds/lib/wcYesNoOutcomes";

export { findYesNoOutcomes } from "~/entities/wc-odds/lib/wcYesNoOutcomes";

function yesNoLabel(outcome: WcMarketOutcome): "Да" | "Нет" | null {
  if (isYesOutcome(outcome)) return "Да";
  if (isNoOutcome(outcome)) return "Нет";
  return null;
}

export function extractTimeWindowMinutes(group: WcMarketGroup): number {
  return extractTimeWindowRange(group)?.from ?? Number.MAX_SAFE_INTEGER;
}

export function extractTimeWindowRange(
  group: WcMarketGroup,
): { from: number; to: number } | null {
  const fromLabel = group.label.match(/(\d+)\s*[–-]\s*(\d+)\s*мин/i);
  if (fromLabel) {
    return { from: Number(fromLabel[1]), to: Number(fromLabel[2]) };
  }

  let from: number | null = null;
  let to: number | null = null;

  for (const outcome of group.outcomes) {
    const fromKey = outcome.outcomeKey.match(/PARAMETER_FROM:(\d+)/)?.[1];
    const toKey = outcome.outcomeKey.match(/PARAMETER_TO:(\d+)/)?.[1];
    if (fromKey) from = Number(fromKey);
    if (toKey) to = Number(toKey);
  }

  if (from != null && to != null) return { from, to };
  return null;
}

function hasTimeWindowGroups(groups: WcMarketGroup[]): boolean {
  return groups.some((group) =>
    /\d+\s*[–-]\s*\d+\s*мин/i.test(group.label)
    || group.outcomes.some((outcome) => /PARAMETER_FROM:\d+/i.test(outcome.outcomeKey)),
  );
}

export function isTimeWindowYesNoCategory(
  categoryName: string,
  groups: WcMarketGroup[],
): boolean {
  if (groups.length === 1 && categoryMatchesTimeWindowLabel(categoryName, groups[0]!)) {
    return false;
  }

  if (/GOAL15MIN/i.test(categoryName)) return hasTimeWindowGroups(groups);
  if (!/да\/нет/i.test(categoryName)) {
    return groups.some((group) => /GOAL15MIN/i.test(group.marketKey) && hasTimeWindowGroups([group]));
  }

  return hasTimeWindowGroups(groups);
}

/** Hide elapsed 15-minute goal windows during live play. */
export function filterRelevantTimeWindowGroups(
  groups: WcMarketGroup[],
  event: Pick<WcEventDetail, "phase" | "parsedScore">,
): WcMarketGroup[] {
  const currentMinute = resolveLiveMatchMinute(event);
  if (currentMinute == null) return groups;

  const filtered = groups.filter((group) => {
    const range = extractTimeWindowRange(group);
    if (!range) return true;
    return currentMinute < range.to;
  });

  return filtered.length > 0 ? filtered : groups;
}

export function sortTimeWindowYesNoGroups(groups: WcMarketGroup[]): WcMarketGroup[] {
  return [...groups].sort(
    (left, right) => extractTimeWindowMinutes(left) - extractTimeWindowMinutes(right),
  );
}

export function formatTimeWindowYesNoCategoryName(
  baseCategory: string,
  group: WcMarketGroup,
): string | null {
  const range = extractTimeWindowRange(group);
  const interval = range
    ? `${range.from}–${range.to} мин`
    : group.label.replace(/^GOAL15MIN:\s*да\/нет\s*/i, "").trim();

  if (!interval) return null;

  if (/GOAL15MIN|15-минут|интервал/i.test(baseCategory)) {
    return interval;
  }

  return `${interval} · ${baseCategory.trim()}`;
}

function categoryMatchesTimeWindowLabel(categoryName: string, group: WcMarketGroup): boolean {
  const range = extractTimeWindowRange(group);
  if (!range) return false;
  const interval = `${range.from}–${range.to} мин`;
  const category = categoryName.trim().toLowerCase();
  return category === interval.toLowerCase();
}

export function expandTimeWindowYesNoCategories(
  entries: Array<[string, WcMarketGroup[]]>,
): Array<[string, WcMarketGroup[]]> {
  const result: Array<[string, WcMarketGroup[]]> = [];

  for (const [categoryName, groups] of entries) {
    if (!isTimeWindowYesNoCategory(categoryName, groups) || groups.length <= 1) {
      result.push([categoryName, groups]);
      continue;
    }

    for (const group of sortTimeWindowYesNoGroups(groups)) {
      const title = formatTimeWindowYesNoCategoryName(categoryName, group);
      result.push([title ?? categoryName, [group]]);
    }
  }

  return result;
}

export function buildTimeWindowYesNoTitle(
  group: WcMarketGroup,
  outcome: WcMarketOutcome,
  categoryName: string,
): string | null {
  const isGoal15 =
    /GOAL15MIN/i.test(categoryName)
    || /GOAL15MIN/i.test(group.marketKey);
  const isWhenNextGoal =
    /когда\s+будет\s+забит/i.test(categoryName)
    && /GOAL15MIN/i.test(group.marketKey);
  if (!isGoal15 && !isWhenNextGoal && !/да\/нет/i.test(categoryName)) return null;

  const yn = yesNoLabel(outcome);
  if (!yn) {
    if (/^след\.?\s*гол$/i.test(outcome.name.trim())) {
      const timeMatch = group.label.match(/(\d+\s*[–-]\s*\d+\s*мин)/i);
      if (timeMatch) return `${timeMatch[1]!.replace(/\s+/g, " ").trim()}·Да`;
      return "Да";
    }
    return null;
  }

  const timeMatch = group.label.match(/(\d+\s*[–-]\s*\d+\s*мин)/i);
  if (timeMatch) {
    return `${timeMatch[1]!.replace(/\s+/g, " ").trim()}·${yn}`;
  }

  const stripped = group.label
    .replace(new RegExp(`^${escapeRegExp(categoryName)}\\s*`, "i"), "")
    .trim();
  if (stripped && stripped !== group.label) {
    return `${stripped}·${yn}`;
  }

  return yn;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
