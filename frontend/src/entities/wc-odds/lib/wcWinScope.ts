import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { humanizeWcCategoryName } from "~/entities/wc-odds/lib/wcOddsCategories";
import { extractTimeWindowRange } from "~/entities/wc-odds/lib/wcYesNoTimeGroups";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isScopedWinnerGroup(group: WcMarketGroup): boolean {
  return /^display_WINNER_/i.test(group.marketKey);
}

export function formatWinnerIntervalLabel(group: WcMarketGroup): string | null {
  const range = extractTimeWindowRange(group);
  if (!range) return null;
  return `${range.from}–${range.to} мин`;
}

export function resolveWinnerScopedBlockName(
  categoryName: string,
  group: WcMarketGroup,
): string {
  const category = categoryName.trim();
  const interval = formatWinnerIntervalLabel(group);
  if (!interval) return humanizeWcCategoryName(group.label?.trim() || category);

  if (/в течение матча|оставшееся время/i.test(category)) {
    return `Победа ${interval}`;
  }

  if (/\(\s*\d+\s*мин\s*\)/i.test(category)) {
    return `${category} · ${interval}`;
  }

  return humanizeWcCategoryName(group.label?.trim() || `${category} (${interval})`);
}

export function shouldExpandWinnerByScope(
  categoryName: string,
  groups: WcMarketGroup[],
): boolean {
  if (groups.length <= 1) return false;
  if (!groups.every(isScopedWinnerGroup)) return false;

  const intervals = groups
    .map((group) => formatWinnerIntervalLabel(group))
    .filter((label): label is string => Boolean(label));

  if (intervals.length !== groups.length) return false;
  return new Set(intervals.map(normalizeLabel)).size > 1;
}

/** Split merged «Победа в течение матча» into per-interval accordions. */
export function expandWinnerScopeCategories(
  entries: Array<[string, WcMarketGroup[]]>,
): Array<[string, WcMarketGroup[]]> {
  const result: Array<[string, WcMarketGroup[]]> = [];

  for (const [categoryName, groups] of entries) {
    if (!shouldExpandWinnerByScope(categoryName, groups)) {
      result.push([categoryName, groups]);
      continue;
    }

    const sorted = [...groups].sort((left, right) => {
      const leftFrom = extractTimeWindowRange(left)?.from ?? Number.MAX_SAFE_INTEGER;
      const rightFrom = extractTimeWindowRange(right)?.from ?? Number.MAX_SAFE_INTEGER;
      return leftFrom - rightFrom;
    });

    for (const group of sorted) {
      const title = formatWinnerIntervalLabel(group)
        ? resolveWinnerScopedBlockName(categoryName, group)
        : categoryName;
      result.push([title, [group]]);
    }
  }

  return result;
}

export function shouldShowWinnerGroupSubLabel(
  group: WcMarketGroup,
  categoryName: string,
): boolean {
  if (!isScopedWinnerGroup(group)) return false;

  const interval = formatWinnerIntervalLabel(group);
  if (!interval) return false;

  const category = categoryName.trim().toLowerCase();
  if (category === interval.toLowerCase()) return false;
  if (category.includes(interval.toLowerCase())) return false;

  return true;
}
