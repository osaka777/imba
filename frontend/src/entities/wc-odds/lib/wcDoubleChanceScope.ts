import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { humanizeWcCategoryName } from "~/entities/wc-odds/lib/wcOddsCategories";
import { extractTimeWindowRange } from "~/entities/wc-odds/lib/wcYesNoTimeGroups";
import { normalizeWcMarketKey } from "~/entities/wc-odds/lib/wcRate";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isScopedDoubleChanceGroup(group: WcMarketGroup): boolean {
  return (
    normalizeWcMarketKey(group.marketKey) === "double_chance"
    && /^display_/i.test(group.marketKey)
  );
}

export function formatDoubleChanceIntervalLabel(group: WcMarketGroup): string | null {
  const range = extractTimeWindowRange(group);
  if (!range) return null;
  return `${range.from}–${range.to} мин`;
}

export function resolveDoubleChanceScopedBlockName(
  categoryName: string,
  group: WcMarketGroup,
): string {
  const category = categoryName.trim();
  const interval = formatDoubleChanceIntervalLabel(group);
  if (!interval) return humanizeWcCategoryName(group.label?.trim() || category);

  if (/в течение матча|оставшееся время/i.test(category)) {
    return `Двойной шанс ${interval}`;
  }

  if (/\(\s*\d+\s*[–-]\s*\d+\s*мин\s*\)/i.test(category)) {
    return humanizeWcCategoryName(category);
  }

  if (!/двойной\s+шанс/i.test(category)) {
    return `${interval} · ${category}`;
  }

  return humanizeWcCategoryName(group.label?.trim() || `${category} (${interval})`);
}

export function shouldExpandDoubleChanceByScope(
  categoryName: string,
  groups: WcMarketGroup[],
): boolean {
  if (groups.length <= 1) return false;
  if (!groups.every(isScopedDoubleChanceGroup)) return false;

  const intervals = groups
    .map((group) => formatDoubleChanceIntervalLabel(group))
    .filter((label): label is string => Boolean(label));

  if (intervals.length !== groups.length) return false;
  return new Set(intervals.map(normalizeLabel)).size > 1;
}

/** Split merged «Двойной шанс в течение матча» into per-interval accordions. */
export function expandDoubleChanceScopeCategories(
  entries: Array<[string, WcMarketGroup[]]>,
): Array<[string, WcMarketGroup[]]> {
  const result: Array<[string, WcMarketGroup[]]> = [];

  for (const [categoryName, groups] of entries) {
    if (!shouldExpandDoubleChanceByScope(categoryName, groups)) {
      result.push([categoryName, groups]);
      continue;
    }

    const sorted = [...groups].sort((left, right) => {
      const leftFrom = extractTimeWindowRange(left)?.from ?? Number.MAX_SAFE_INTEGER;
      const rightFrom = extractTimeWindowRange(right)?.from ?? Number.MAX_SAFE_INTEGER;
      return leftFrom - rightFrom;
    });

    for (const group of sorted) {
      const interval = formatDoubleChanceIntervalLabel(group);
      const title = interval
        ? resolveDoubleChanceScopedBlockName(categoryName, group)
        : categoryName;
      result.push([title, [group]]);
    }
  }

  return result;
}

export function shouldShowDoubleChanceGroupSubLabel(
  group: WcMarketGroup,
  categoryName: string,
): boolean {
  if (!isScopedDoubleChanceGroup(group)) return false;

  const interval = formatDoubleChanceIntervalLabel(group);
  if (!interval) return false;

  const category = categoryName.trim().toLowerCase();
  if (category === interval.toLowerCase()) return false;
  if (category.includes(interval.toLowerCase())) return false;

  return true;
}
