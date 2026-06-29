import type { WcMarketGroup } from "~/entities/wc-odds/api/client";

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

  return null;
}

function isYesNoDisplayGroup(group: WcMarketGroup): boolean {
  if (!/^display_/i.test(group.marketKey) || group.outcomes.length !== 2) return false;

  return group.outcomes.every((outcome) =>
    /^(Да|Нет)$/i.test(outcome.name.trim())
    || outcome.outcomeKey === "YES"
    || outcome.outcomeKey === "NO",
  );
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
  if (!isYesNoDisplayGroup(group)) return null;

  const line = extractLineFromGroup(group);
  if (!line) return null;

  const label = group.label?.trim() ?? "";
  if (label && !isLineOnlyGroupLabel(label)) return null;

  const category = categoryName.trim();
  const side = inferTotalSide(category, group.marketKey);
  const lineToken = formatLineToken(line, side);

  if (category.includes(lineToken)) return category;

  let merged = category;

  if (/\+\s*тотал\s*\(\s*больше\s*\)/i.test(category)) {
    merged = category.replace(/\+\s*тотал\s*\(\s*больше\s*\)/i, `${lineToken} (Да/Нет)`);
  } else if (/\+\s*тотал\s*\(\s*меньше\s*\)/i.test(category)) {
    merged = category.replace(/\+\s*тотал\s*\(\s*меньше\s*\)/i, `${lineToken} (Да/Нет)`);
  } else if (/\s+больше(\s*\(|\s*:|\s*да|$)/i.test(category)) {
    merged = category.replace(/\s+больше/i, ` ${lineToken}`);
  } else if (/\s+меньше(\s*\(|\s*:|\s*да|$)/i.test(category)) {
    merged = category.replace(/\s+меньше/i, ` ${lineToken}`);
  } else if (/:\s*да\s*\/\s*нет\s*$/i.test(category)) {
    merged = category.replace(/:\s*да\s*\/\s*нет\s*$/i, ` ${lineToken} (Да/Нет)`);
  } else if (/\(\s*да\s*\/\s*нет\s*\)\s*$/i.test(category)) {
    merged = category.replace(/\(\s*да\s*\/\s*нет\s*\)\s*$/i, `${lineToken} (Да/Нет)`);
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
