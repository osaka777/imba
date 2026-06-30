import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { humanizeWcCategoryName } from "~/entities/wc-odds/lib/wcOddsCategories";
import { extractTimeWindowRange } from "~/entities/wc-odds/lib/wcYesNoTimeGroups";
import { mergeYesNoCategoryWithLine } from "~/entities/wc-odds/lib/wcYesNoLineTitle";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Show set/game/point context once above П1/П2 or Да/Нет rows. */
export function needsGroupSubLabel(group: WcMarketGroup, categoryName: string): boolean {
  const label = group.label?.trim();
  if (!label) return false;

  if (mergeYesNoCategoryWithLine(categoryName, group)) return false;

  const timeRange = extractTimeWindowRange(group);
  if (
    timeRange
    && `${timeRange.from}–${timeRange.to} мин`.toLowerCase() === categoryName.trim().toLowerCase()
  ) {
    return false;
  }

  const category = categoryName.trim();
  if (normalizeLabel(label) === normalizeLabel(category)) return false;

  if (/NEXT_POINTS|RACE_TO_POINT|RACE_TO_GAME|DEUSE_POINT|SCORE_SET|SCORE_WINNER|EXACT_POINT/i.test(group.marketKey)) {
    return true;
  }

  if (/TEAM[12]_WIN_(BOTHPART|ONE_PART)|DRAW_ONE_HALF/i.test(group.marketKey)) {
    return true;
  }

  if (/SCORING_EVENTS/i.test(group.marketKey)) {
    const sub = formatGroupSubLabel(group, categoryName);
    return Boolean(sub) && normalizeLabel(sub) !== normalizeLabel(categoryName);
  }

  if (/CLEAN_WIN_TEAM/i.test(group.marketKey)) {
    const sub = formatGroupSubLabel(group, categoryName);
    return Boolean(sub) && normalizeLabel(sub) !== normalizeLabel(categoryName);
  }

  if (/NUMBER_FINAL_SCORE/i.test(group.marketKey)) {
    const sub = formatGroupSubLabel(group, categoryName);
    return Boolean(sub) && normalizeLabel(sub) !== normalizeLabel(categoryName);
  }

  if (/SCORE_AFTER/i.test(group.marketKey)) {
    const sub = formatGroupSubLabel(group, categoryName);
    return Boolean(sub) && normalizeLabel(sub) !== normalizeLabel(categoryName);
  }

  if (/NOT_(WIN|LOSE)_IN_REGULATION_TIME/i.test(group.marketKey.replace(/\s+/g, ''))) {
    return true;
  }

  if (/NEXT_GOAL_TIME/i.test(group.marketKey) && label) {
    return true;
  }

  if (/HOW_WILL_GOAL_BE_SCORED|LAST_EVENT|MINUTE_GOAL_EVEN_ODD/i.test(group.marketKey)) {
    return Boolean(label) && normalizeLabel(label) !== normalizeLabel(category);
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
  let label = humanizeWcCategoryName(group.label.trim());
  const category = categoryName.trim();

  if (/^Счет после X голов$/i.test(label) && /сч[её]т\s+после\s+\d+/i.test(category)) {
    label = category;
  }

  if (/^DEUSE|^Дьюс/i.test(category) && /^Дьюс/i.test(label)) {
    return label.replace(/^Дьюс\s*/i, "").trim() || label;
  }

  return label;
}
