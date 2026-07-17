import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { formatWcCategoryDisplayName, humanizeWcCategoryName } from "~/entities/wc-odds/lib/wcOddsCategories";
import { isPlainYesNoGroup } from "~/entities/wc-odds/lib/wcYesNoOutcomes";
import { normalizeWcMarketKey } from "~/entities/wc-odds/lib/wcRate";
import {
  resolveComboVariantGroupLabel,
  type ComboLabelTeams,
} from "~/entities/wc-odds/lib/wcGroupSubLabel";

export { isPlainYesNoGroup };

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractHalfFromGroup(group: WcMarketGroup): string | null {
  for (const outcome of group.outcomes) {
    const haystack = `${outcome.outcomeKey}|${group.key}|${group.label ?? ""}`;
    const half = haystack.match(/PARAMETER_HALF_NUMBER:(\d+)/i)?.[1];
    if (half) return `${half}-й тайм`;
    const inLabel = haystack.match(/(\d+-[йи]\s+тайм)/i)?.[1];
    if (inLabel) return inLabel;
  }
  return null;
}

/** Accordion title for scoped yes/no rows (BTTS half, display half markets). */
export function resolveYesNoScopedAccordionTitle(
  categoryName: string,
  group: WcMarketGroup,
  teams?: ComboLabelTeams,
): string | null {
  if (!isPlainYesNoGroup(group)) return null;

  if (/^display_GOALS_TEAM/i.test(group.marketKey)) return null;

  const combo = resolveComboVariantGroupLabel(group.marketKey, teams, group.label);
  if (combo && normalizeLabel(combo) !== normalizeLabel(categoryName)) {
    return combo;
  }

  const category = categoryName.trim();
  const label = humanizeWcCategoryName(group.label?.trim() ?? "");
  const baseKey = normalizeWcMarketKey(group.marketKey);

  if (baseKey === "goals_both_half" || /GOALS_BOTH_HALF|GOALS_BOTHHALF/i.test(group.marketKey)) {
    if (label && !normalizeLabel(label).includes(normalizeLabel(category))) {
      return label;
    }
    const half = extractHalfFromGroup(group);
    if (half) return `${half} · Обе забьют`;
    if (/^\d+-[йи]\s+тайм$/i.test(category)) return `${category} · Обе забьют`;
    return "Гол в обоих таймах";
  }

  if (baseKey === "goals_both_teams_both_halves") {
    return label || "Обе забьют в обоих таймах";
  }

  if (baseKey === "btts") {
    const half = extractHalfFromGroup(group);
    if (half && !normalizeLabel(category).includes(normalizeLabel(half))) {
      return `${half} · Обе забьют`;
    }
    if (/^\d+-[йи]\s+тайм$/i.test(category)) return `${category} · Обе забьют`;
  }

  if (
    label
    && normalizeLabel(label) !== normalizeLabel(category)
    && !category.toLowerCase().includes(label.toLowerCase())
    && /обе\s+заб|гол\s+в\s+обоих|да\s*\/?\s*нет/i.test(`${label} ${group.marketKey}`)
  ) {
    return label;
  }

  if (shouldShowYesNoGroupSubLabel(group, category)) {
    const lineSub = formatYesNoLineSubLabel(category, group);
    if (lineSub) return `${category} · ${lineSub}`;
    if (label && normalizeLabel(label) !== normalizeLabel(category)) return label;
  }

  return null;
}

export function shouldExpandYesNoByScope(
  categoryName: string,
  groups: WcMarketGroup[],
  teams?: ComboLabelTeams,
): boolean {
  if (groups.length <= 1) return false;
  if (!groups.every(isPlainYesNoGroup)) return false;

  const titles = groups
    .map((group) => resolveYesNoScopedAccordionTitle(categoryName, group, teams))
    .filter((title): title is string => Boolean(title));

  if (titles.length !== groups.length) return false;
  return new Set(titles.map(normalizeLabel)).size > 1;
}

/** Split scoped Да/Нет blocks (BTTS half, corners combos) into separate blue headers. */
export function expandYesNoScopedCategories(
  entries: Array<[string, WcMarketGroup[]]>,
  teams?: ComboLabelTeams,
): Array<[string, WcMarketGroup[]]> {
  const result: Array<[string, WcMarketGroup[]]> = [];

  for (const [categoryName, groups] of entries) {
    if (shouldExpandYesNoByScope(categoryName, groups, teams)) {
      for (const group of groups) {
        const title = resolveYesNoScopedAccordionTitle(categoryName, group, teams);
        if (title) result.push([title, [group]]);
      }
      continue;
    }

    if (groups.length === 1) {
      const title = resolveYesNoScopedAccordionTitle(categoryName, groups[0]!, teams);
      if (
        title
        && normalizeLabel(title) !== normalizeLabel(categoryName)
        && /обе\s+заб|гол\s+в\s+обоих/i.test(title)
      ) {
        result.push([title, groups]);
        continue;
      }
    }

    result.push([categoryName, groups]);
  }

  return result;
}

export function isLineOnlyGroupLabel(label: string): boolean {
  return /^-?\d+(?:[.,]\d+)?$/.test(label.trim());
}

export function extractLineFromGroup(group: WcMarketGroup): string | null {
  const label = group.label?.trim();
  if (label && isLineOnlyGroupLabel(label)) {
    return label.replace(",", ".");
  }

  for (const outcome of group.outcomes) {
    const fromKey = outcome.outcomeKey.match(/PARAMETER_VALUE:([\d.]+)/)?.[1];
    if (fromKey) return fromKey;
  }

  for (const outcome of group.outcomes) {
    if (outcome.point != null && Number.isFinite(Number(outcome.point))) {
      return String(outcome.point).replace(",", ".");
    }
  }

  return null;
}

function categoryIncludesLine(categoryName: string, line: string): boolean {
  const category = categoryName.trim();
  if (!line || category.includes(line)) return true;
  if (/гейм/i.test(category)) {
    const games = formatGameCountLine(line);
    if (category.includes(games)) return true;
    if (category.includes(`${line} гейм`)) return true;
  }
  return false;
}

/** Center pivot for Да/Нет rows (game count, totals line, etc.). */
export function resolveYesNoPivotLine(
  group: WcMarketGroup,
  categoryName: string,
): { pivot: string; showPivot: boolean } {
  const line = extractLineFromGroup(group);
  if (!line || categoryIncludesLine(categoryName, line)) {
    return { pivot: "", showPivot: false };
  }

  const category = categoryName.trim();
  if (/гейм/i.test(category) || /COUNT_SET|NUMBER_OF_GAME/i.test(group.marketKey)) {
    const n = Number(line.replace(",", "."));
    if (Number.isFinite(n) && Number.isInteger(n)) {
      return { pivot: String(n), showPivot: true };
    }
    return { pivot: formatGameCountLine(line), showPivot: true };
  }

  const side = inferTotalSide(category, group.marketKey);
  return { pivot: formatLineToken(line, side), showPivot: true };
}

export function shouldShowYesNoGroupSubLabel(
  group: WcMarketGroup,
  categoryName: string,
): boolean {
  if (!isPlainYesNoGroup(group)) return false;
  if (mergeYesNoCategoryWithLine(categoryName, group)) return false;

  const lineSub = formatYesNoLineSubLabel(categoryName, group);
  if (!lineSub) return false;

  const { showPivot } = resolveYesNoPivotLine(group, categoryName);
  if (showPivot) return false;

  const label = humanizeWcCategoryName(group.label?.trim() ?? "");
  const category = categoryName.trim();
  if (label && label.toLowerCase() === category.toLowerCase()) return false;
  if (label && /кол-?во\s+гейм/i.test(label) && /кол-?во\s+гейм/i.test(category)) return false;

  return true;
}

export function formatGameCountLine(value: string): string {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n)) return `${value} геймов`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} гейм`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} гейма`;
  return `${n} геймов`;
}

function mergeGameCountCategoryTitle(category: string, line: string): string {
  const games = formatGameCountLine(line);
  const setInCategory = category.match(/^(\d+-[йи]\s+сет)\s*·/i);
  if (setInCategory) return `${setInCategory[1]} · ${games}`;
  if (/кол-?во\s+гейм|количество\s+гейм/i.test(category)) {
    return category.replace(/кол-?во\s+геймов?|количество\s+геймов?/i, games);
  }
  return `${category} · ${games}`;
}

/** Row sublabel when several Да/Нет lines stay under one accordion. */
export function formatYesNoLineSubLabel(categoryName: string, group: WcMarketGroup): string | null {
  if (!isPlainYesNoGroup(group)) return null;
  const line = extractLineFromGroup(group);
  if (!line) return null;

  const category = categoryName.trim();
  if (/гейм/i.test(category) || /COUNT_SET|NUMBER_OF_GAME/i.test(group.marketKey)) {
    return formatGameCountLine(line);
  }

  const side = inferTotalSide(category, group.marketKey);
  return formatLineToken(line, side);
}

function inferTotalSide(categoryName: string, marketKey: string): "Б" | "М" | null {
  const haystack = `${categoryName} ${marketKey}`.toLowerCase();
  if (/under|_tm\b|меньше/i.test(haystack)) return "М";
  if (/over|_tb\b|больше/i.test(haystack)) return "Б";
  return null;
}

function formatLineToken(line: string, side: "Б" | "М" | null): string {
  const normalized = line.replace(",", ".");
  return side ? `${normalized}${side}` : normalized;
}

function normalizeYesNoSuffix(text: string): string {
  return text
    .replace(/\(\s*да\s*\/\s*нет\s*\)/gi, "(Да/Нет)")
    .replace(/:\s*да\s*\/\s*нет/gi, " (Да/Нет)")
    .replace(/\s+/g, " ")
    .trim();
}

/** Merge category title with totals line, e.g. «…больше (Да/Нет)» + 1.5 → «…1.5Б (Да/Нет)». */
export function mergeYesNoCategoryWithLine(
  categoryName: string,
  group: WcMarketGroup,
): string | null {
  if (!isPlainYesNoGroup(group)) return null;

  const line = extractLineFromGroup(group);
  if (!line) return null;

  const label = group.label?.trim() ?? "";
  if (label && !isLineOnlyGroupLabel(label)) {
    const hasParamLine = group.outcomes.some((outcome) =>
      /PARAMETER_VALUE:[\d.]+/i.test(outcome.outcomeKey),
    );
    if (!hasParamLine) return null;
  }

  const category = categoryName.trim();
  const side = inferTotalSide(category, group.marketKey);
  const lineToken = formatLineToken(line, side);

  if (category.includes(lineToken)) return category;

  let merged = category;

  if (/кол-?во\s+гейм|количество\s+гейм/i.test(category) || /^\d+-[йи]\s+сет\s*·\s*кол-?во\s+гейм/i.test(category)) {
    merged = mergeGameCountCategoryTitle(category, line);
  } else if (/\+\s*тотал\s*\(\s*больше\s*\)/i.test(category)) {
    merged = category.replace(/\+\s*тотал\s*\(\s*больше\s*\)/i, `${lineToken} (Да/Нет)`);
  } else if (/\+\s*тотал\s*\(\s*меньше\s*\)/i.test(category)) {
    merged = category.replace(/\+\s*тотал\s*\(\s*меньше\s*\)/i, `${lineToken} (Да/Нет)`);
  } else if (/и\s+тотал\s*\(/i.test(category) && /\(\s*да\s*\/\s*нет\s*\)\s*$/i.test(category)) {
    merged = category.replace(
      /и\s+тотал\s*\(\s*да\s*\/\s*нет\s*\)\s*$/i,
      `и тотал ${lineToken} (Да/Нет)`,
    );
  } else if (/\s+больше(\s*\(|\s*:|\s*да|$)/i.test(category)) {
    merged = category.replace(/\s+больше/i, ` ${lineToken}`);
  } else if (/\s+меньше(\s*\(|\s*:|\s*да|$)/i.test(category)) {
    merged = category.replace(/\s+меньше/i, ` ${lineToken}`);
  } else if (/:\s*да\s*\/\s*нет\s*$/i.test(category)) {
    merged = category.replace(/:\s*да\s*\/\s*нет\s*$/i, ` ${lineToken} (Да/Нет)`);
  } else if (/\(\s*да\s*\/\s*нет\s*\)\s*$/i.test(category)) {
    merged = category.replace(/\(\s*да\s*\/\s*нет\s*\)\s*$/i, `тотал ${lineToken} (Да/Нет)`);
  } else if (/^\d+-[йи]\s+тайм$/i.test(category)) {
    merged = `${category} · тотал ${lineToken} (Да/Нет)`;
  } else {
    merged = `${category} ${lineToken}`;
  }

  return normalizeYesNoSuffix(merged);
}

export function shouldExpandYesNoByLine(
  categoryName: string,
  groups: WcMarketGroup[],
): boolean {
  if (!groups.length) return false;
  return groups.every((group) => mergeYesNoCategoryWithLine(categoryName, group) !== null);
}

/** Split yes/no categories with numeric lines into separate titled sections. */
export function expandYesNoLineCategories(
  entries: Array<[string, WcMarketGroup[]]>,
): Array<[string, WcMarketGroup[]]> {
  const result: Array<[string, WcMarketGroup[]]> = [];

  for (const [categoryName, groups] of entries) {
    if (shouldExpandYesNoByLine(categoryName, groups)) {
      for (const group of groups) {
        const title = mergeYesNoCategoryWithLine(categoryName, group);
        if (title) result.push([title, [group]]);
      }
      continue;
    }

    result.push([categoryName, groups]);
  }

  return result;
}

function isBundledYesNoCategory(categoryName: string): boolean {
  const lower = categoryName.trim().toLowerCase();
  return /^специальн/i.test(lower) && /да\s*\/?\s*нет/i.test(lower);
}

/** Split «Специальные ставки (Да/Нет)» into one accordion per market. */
export function expandBundledYesNoCategories(
  entries: Array<[string, WcMarketGroup[]]>,
): Array<[string, WcMarketGroup[]]> {
  const result: Array<[string, WcMarketGroup[]]> = [];

  for (const [categoryName, groups] of entries) {
    if (!isBundledYesNoCategory(categoryName) || groups.length <= 1) {
      result.push([categoryName, groups]);
      continue;
    }

    if (!groups.every(isPlainYesNoGroup)) {
      result.push([categoryName, groups]);
      continue;
    }

    for (const group of groups) {
      const rawLabel = group.label?.trim() || "";
      const humanized = humanizeWcCategoryName(rawLabel);
      const title = formatWcCategoryDisplayName(
        humanized && humanized !== rawLabel ? humanized : humanized || categoryName,
        undefined,
      );

      if (
        title
        && title.trim().toLowerCase() !== categoryName.trim().toLowerCase()
        && /[а-яё]/i.test(title)
      ) {
        result.push([title, [group]]);
      } else {
        result.push([categoryName, [group]]);
      }
    }
  }

  return result;
}
