import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { mergeYesNoCategoryWithLine } from "~/entities/wc-odds/lib/wcYesNoLineTitle";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Show set/game/point context once above П1/П2 or Да/Нет rows. */
export function needsGroupSubLabel(group: WcMarketGroup, categoryName: string): boolean {
  const label = group.label?.trim();
  if (!label) return false;

  if (mergeYesNoCategoryWithLine(categoryName, group)) return false;

  const category = categoryName.trim();
  if (normalizeLabel(label) === normalizeLabel(category)) return false;

  if (/NEXT_POINTS|RACE_TO_POINT|DEUSE_POINT|SCORE_SET|SCORE_WINNER|EXACT_POINT/i.test(group.marketKey)) {
    return true;
  }

  if (/^40:40$/i.test(categoryName.trim())) return true;

  if (group.outcomes.every((outcome) => /^\d+:\d+$/.test(outcome.name.trim()))) {
    const sub = formatGroupSubLabel(group, categoryName);
    if (sub && normalizeLabel(sub) !== normalizeLabel(category)) return true;
    if (/SCORE_SET|SCORE_WINNER|EXACT_POINT/i.test(group.marketKey)) return true;
  }

  if (!/^display_/i.test(group.marketKey) || group.outcomes.length !== 2) return false;

  const shortNames = group.outcomes.every((outcome) =>
    /^(П1|П2|Да|Нет|X|1X|X2|12)$/i.test(outcome.name.trim()),
  );

  return shortNames && !category.includes(label);
}

export function formatGroupSubLabel(group: WcMarketGroup, categoryName: string): string {
  const label = group.label.trim();
  const category = categoryName.trim();

  if (/^DEUSE|^Дьюс/i.test(category) && /^Дьюс/i.test(label)) {
    return label.replace(/^Дьюс\s*/i, "").trim() || label;
  }

  return label;
}
