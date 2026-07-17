import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { humanizeWcCategoryName } from "~/entities/wc-odds/lib/wcOddsCategories";
import { normalizeWcMarketKey } from "~/entities/wc-odds/lib/wcRate";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isEvenOddOutcomeWord(value: string): boolean {
  const normalized = normalizeLabel(value).replace(/ё/g, "е");
  return normalized === "чет" || normalized === "нечет" || normalized === "ч" || normalized === "н";
}

export function isPeriodScopeCategory(categoryName: string): boolean {
  const category = categoryName.trim();
  return /^\d+-[йи]\s+(сет|тайм)$/i.test(category)
    || /^\d+-[яи]\s+четверть$/i.test(category);
}

function formatSetScope(n: string): string {
  return `${n}-й сет`;
}

function formatHalfScope(n: string): string {
  return `${n}-й тайм`;
}

function formatQuarterScope(n: string): string {
  return `${n}-я четверть`;
}

function extractScopeFromParameters(group: WcMarketGroup): string | null {
  for (const outcome of group.outcomes) {
    const haystack = `${outcome.outcomeKey}|${group.key}`;
    const set = haystack.match(/PARAMETER_SET_NUMBER:(\d+)/i)?.[1];
    if (set) return formatSetScope(set);
    const half = haystack.match(/PARAMETER_HALF_NUMBER:(\d+)/i)?.[1];
    if (half) return formatHalfScope(half);
    const quarter = haystack.match(/PARAMETER_QUARTER_NUMBER:(\d+)/i)?.[1];
    if (quarter) return formatQuarterScope(quarter);
  }
  return null;
}

function stripCategoryPrefix(label: string, categoryName: string): string {
  const category = categoryName.trim();
  if (!category) return label.trim();
  const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return label.replace(new RegExp(`^${escaped}\\s*`, "i"), "").trim();
}

/** Scope row label for even/odd inside a shared accordion. */
export function formatEvenOddScopeLabel(
  group: WcMarketGroup,
  categoryName: string,
): string | null {
  if (normalizeWcMarketKey(group.marketKey) !== "even_odd") return null;

  const category = categoryName.trim();
  const label = humanizeWcCategoryName(group.label?.trim() ?? "");
  const stripped = stripCategoryPrefix(label, category);

  if (/TEAM1_EVEN_ODD/i.test(group.marketKey) && !/п1/i.test(category)) return "П1";
  if (/TEAM2_EVEN_ODD/i.test(group.marketKey) && !/п2/i.test(category)) return "П2";

  if (stripped && stripped !== label.trim()) {
    if (/^\d+-[йи]\s+сет$/i.test(stripped)) return stripped;
    if (/^\d+-[йи]\s+тайм$/i.test(stripped)) return stripped;
    if (/^\d+-[яи]\s+четверть$/i.test(stripped)) return stripped;
    if (/^матч$/i.test(stripped)) return "Матч";
    if (stripped && !/чет/i.test(stripped)) return stripped;
  }

  const fromParams = extractScopeFromParameters(group);
  if (fromParams && !category.includes(fromParams)) return fromParams;

  const setInLabel = label.match(/(\d+-[йи]\s+сет)/i)?.[1];
  if (setInLabel && !category.includes(setInLabel)) return setInLabel;

  const halfInLabel = label.match(/(\d+-[йи]\s+тайм)/i)?.[1];
  if (halfInLabel && !category.includes(halfInLabel)) return halfInLabel;

  const quarterInLabel = label.match(/(\d+-[яи]\s+четверть)/i)?.[1];
  if (quarterInLabel && !category.includes(quarterInLabel)) return quarterInLabel;

  if (/_ot$/i.test(group.marketKey) || /WITH_?OT/i.test(group.marketKey.replace(/^display_/i, ""))) {
    return "с ОТ";
  }

  if (
    label
    && normalizeLabel(label) !== normalizeLabel(category)
    && !category.toLowerCase().includes(label.toLowerCase())
    && !(/чет/i.test(label) && /нечет/i.test(label))
    && !isEvenOddOutcomeWord(label)
  ) {
    return label;
  }

  return null;
}

function evenOddBaseTitle(categoryName: string): string {
  const category = categoryName.trim();
  if (/чет/i.test(category) && /нечет/i.test(category)) return category;
  return "Тотал (Чет/Нечет)";
}

export function mergeEvenOddCategoryWithScope(
  categoryName: string,
  group: WcMarketGroup,
): string | null {
  if (normalizeWcMarketKey(group.marketKey) !== "even_odd") return null;

  const category = categoryName.trim();
  const baseTitle = evenOddBaseTitle(category);
  const scope =
    formatEvenOddScopeLabel(group, category)
    ?? formatEvenOddScopeLabel(group, baseTitle);

  if (!scope) {
    if (/чет/i.test(category) && /нечет/i.test(category)) {
      return `${category} · Матч`;
    }
    if (isPeriodScopeCategory(category)) {
      return `${category} · ${baseTitle}`;
    }
    return null;
  }

  const merged = `${scope} · ${baseTitle}`;
  if (normalizeLabel(merged) === normalizeLabel(category)) return category;
  if (category.includes(scope) && /чет/i.test(category) && /нечет/i.test(category)) {
    return category;
  }

  return merged;
}

export function shouldShowEvenOddGroupSubLabel(
  group: WcMarketGroup,
  categoryName: string,
): boolean {
  if (normalizeWcMarketKey(group.marketKey) !== "even_odd") return false;

  const scope = formatEvenOddScopeLabel(group, categoryName);
  if (!scope) return false;

  const category = categoryName.trim();
  const merged = mergeEvenOddCategoryWithScope(categoryName, group);
  if (merged && normalizeLabel(merged) === normalizeLabel(category)) return false;
  if (category.includes(scope)) return false;

  return true;
}

export function shouldExpandEvenOddByScope(
  categoryName: string,
  groups: WcMarketGroup[],
): boolean {
  if (groups.length <= 1) return false;
  if (!groups.every((group) => normalizeWcMarketKey(group.marketKey) === "even_odd")) {
    return false;
  }
  return groups.every((group) => mergeEvenOddCategoryWithScope(categoryName, group) !== null);
}

/** Split «Тотал (Чет/Нечет)» with several scopes into separate accordion titles. */
export function expandEvenOddScopeCategories(
  entries: Array<[string, WcMarketGroup[]]>,
): Array<[string, WcMarketGroup[]]> {
  const result: Array<[string, WcMarketGroup[]]> = [];

  for (const [categoryName, groups] of entries) {
    if (shouldExpandEvenOddByScope(categoryName, groups)) {
      for (const group of groups) {
        const title = mergeEvenOddCategoryWithScope(categoryName, group);
        if (title) result.push([title, [group]]);
      }
      continue;
    }

    if (
      groups.length === 1
      && isPeriodScopeCategory(categoryName)
      && normalizeWcMarketKey(groups[0]!.marketKey) === "even_odd"
    ) {
      const title = mergeEvenOddCategoryWithScope(categoryName, groups[0]!);
      if (title && normalizeLabel(title) !== normalizeLabel(categoryName)) {
        result.push([title, groups]);
        continue;
      }
    }

    result.push([categoryName, groups]);
  }

  return result;
}
