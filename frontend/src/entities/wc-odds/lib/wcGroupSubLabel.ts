import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { humanizeWcCategoryName } from "~/entities/wc-odds/lib/wcOddsCategories";
import { extractTimeWindowRange } from "~/entities/wc-odds/lib/wcYesNoTimeGroups";
import {
  formatYesNoLineSubLabel,
  mergeYesNoCategoryWithLine,
  shouldShowYesNoGroupSubLabel,
} from "~/entities/wc-odds/lib/wcYesNoLineTitle";
import { isPlainYesNoGroup } from "~/entities/wc-odds/lib/wcYesNoOutcomes";
import {
  formatEvenOddScopeLabel,
  shouldShowEvenOddGroupSubLabel,
} from "~/entities/wc-odds/lib/wcEvenOddScope";
import { isGoalsTeamMarketGroup } from "~/entities/wc-odds/lib/wcGoalsTeamScope";
import {
  formatDoubleChanceIntervalLabel,
  shouldShowDoubleChanceGroupSubLabel,
} from "~/entities/wc-odds/lib/wcDoubleChanceScope";
import {
  formatWinnerIntervalLabel,
  shouldShowWinnerGroupSubLabel,
} from "~/entities/wc-odds/lib/wcWinScope";
import { normalizeWcMarketKey } from "~/entities/wc-odds/lib/wcRate";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeScopeLabel(value: string): string {
  return value.trim().toLowerCase()
    .replace(/\s*[·,]\s*/g, " ")
    .replace(/\s+/g, " ");
}

function scopeLabelMatchesCategory(scope: string, categoryName: string): boolean {
  const scopeNorm = normalizeScopeLabel(scope);
  const categoryNorm = normalizeScopeLabel(categoryName);
  if (!scopeNorm || !categoryNorm) return false;
  return scopeNorm === categoryNorm
    || categoryNorm.includes(scopeNorm)
    || scopeNorm.includes(categoryNorm);
}

export type ComboLabelTeams = {
  homeTeam?: string;
  awayTeam?: string;
};

/** Short team tag for HT/FT headers: «Аргентина» → «Арг», «Spain» → «Spa». */
export function shortTeamCode(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const token = cleaned.split(/[\s./\-–—_]+/).find((part) => /[\p{L}\p{N}]/u.test(part)) ?? cleaned;
  const letters = Array.from(token).filter((ch) => /[\p{L}\p{N}]/u.test(ch)).join("");
  if (!letters) return token.slice(0, 3);
  if (letters.length <= 3) return letters;
  return letters.slice(0, 3);
}

function htFtSideLabel(side: "1" | "2" | "X", teams?: ComboLabelTeams): string {
  if (side === "X") return "X";
  const home = teams?.homeTeam?.trim();
  const away = teams?.awayTeam?.trim();
  if (side === "1" && home) return shortTeamCode(home) || "1";
  if (side === "2" && away) return shortTeamCode(away) || "2";
  return side;
}

/** HT/FT code: «1/2» or «Арг/Исп» when team names are known. */
export function resolveHalfMatchHtFtLabel(
  marketKey: string,
  teams?: ComboLabelTeams,
): string | null {
  const stem = marketKey.replace(/^display_/i, "");
  const match = /^HALF_MATCH_(W1|W2|X)(W1|W2|X)_AND_TOTAL/i.exec(stem);
  if (!match) return null;
  const code: Record<string, "1" | "2" | "X"> = { W1: "1", W2: "2", X: "X" };
  const ht = code[match[1]!.toUpperCase()];
  const ft = code[match[2]!.toUpperCase()];
  if (!ht || !ft) return null;
  return `${htFtSideLabel(ht, teams)}/${htFtSideLabel(ft, teams)}`;
}

/** Sort key 0..8 for HALF_MATCH W1W1…W2W2 (stable regardless of team labels). */
export function halfMatchHtFtSortIndex(marketKey: string): number {
  const stem = marketKey.replace(/^display_/i, "");
  const match = /^HALF_MATCH_(W1|W2|X)(W1|W2|X)_AND_TOTAL/i.exec(stem);
  if (!match) return 99;
  const order = ["W1W1", "W1X", "W1W2", "XW1", "XX", "XW2", "W2W1", "W2X", "W2W2"];
  const idx = order.indexOf(`${match[1]!.toUpperCase()}${match[2]!.toUpperCase()}`);
  return idx < 0 ? 99 : idx;
}

function teamTag(side: "1" | "2", teams?: ComboLabelTeams): string {
  if (side === "1") {
    const home = teams?.homeTeam?.trim();
    return home ? shortTeamCode(home) || "П1" : "П1";
  }
  const away = teams?.awayTeam?.trim();
  return away ? shortTeamCode(away) || "П2" : "П2";
}

function resultTag(token: string, teams?: ComboLabelTeams): string {
  const t = token.toUpperCase();
  if (t === "W1" || t === "WIN1" || t === "1") return teamTag("1", teams);
  if (t === "W2" || t === "WIN2" || t === "2") return teamTag("2", teams);
  if (t === "X" || t === "DRAW") return "X";
  if (t === "1X") return "1X";
  if (t === "12") return "12";
  if (t === "X2") return "X2";
  return token;
}

function extractLineHint(label?: string | null): string | null {
  if (!label) return null;
  const only = label.trim().match(/^-?\d+(?:[.,]\d+)?$/);
  if (only) return only[0]!.replace(",", ".");
  const embedded = label.trim().match(/(-?\d+(?:[.,]\d+)?)\s*$/);
  if (embedded && !/[а-яa-z]/i.test(label.slice(0, Math.max(0, label.length - embedded[0].length)))) {
    return embedded[1]!.replace(",", ".");
  }
  const fromText = label.match(/(?:тотал|т[бм]|м|б)\s*(-?\d+(?:[.,]\d+)?)/i);
  if (fromText) return fromText[1]!.replace(",", ".");
  return null;
}

/** «1X · тотал меньше» / «Арг · тотал больше 1.5» from display_* combo market keys. */
export function resolveComboVariantGroupLabel(
  marketKey: string,
  teams?: ComboLabelTeams,
  groupLabel?: string | null,
): string | null {
  const rawStem = marketKey.replace(/^display_/i, "");
  const stem = rawStem
    .replace(/_YES_NO$/i, "")
    .replace(/_HALF$/i, "")
    .replace(/_PERIOD$/i, "");

  if (/^SERIESPENALTY/i.test(stem)) return null;

  const line = extractLineHint(groupLabel);

  const halfMatch = resolveHalfMatchHtFtLabel(marketKey, teams);
  if (halfMatch) {
    // Keep HT/FT only in the accordion title — lines stay as М/Б pivots inside.
    if (/_AND_TOTAL_HALF/i.test(rawStem)) return `${halfMatch} · тотал 1-го тайма`;
    if (/_AND_TOTAL/i.test(stem)) return `${halfMatch} · тотал`;
    return halfMatch;
  }

  // Spa · тотал меньше 1.5  (победа + тотал да/нет)
  const winAndTotal = /^WIN_AND_(?:IND)?TOTAL_(OVER|UNDER)(?:_HALF)?_TEAM([12])/i.exec(rawStem);
  if (winAndTotal) {
    const side = winAndTotal[1]!.toUpperCase() === "OVER" ? "больше" : "меньше";
    const team = teamTag(winAndTotal[2] as "1" | "2", teams);
    const ind = /INDTOTAL/i.test(rawStem) ? "инд. тотал" : "тотал";
    return line ? `${team} · ${ind} ${side} ${line}` : `${team} · ${ind} ${side}`;
  }

  // Spa · 1-й тайм  (когда забьёт первый гол)
  const willScore = /^WILL_SCORE_GOAL_IN_([12])HALF_TEAM([12])/i.exec(rawStem);
  if (willScore) {
    return `${teamTag(willScore[2] as "1" | "2", teams)} · ${willScore[1]}-й тайм`;
  }

  // Spa забьёт · Spa   /  Spa забьёт · 1X
  const teamScoreResult = /^TEAM([12])_WILL_SCORE_(?:AND_)?(WIN1|WIN2|DRAW|1X|12|X2|TEAM[12]_WILL_WIN)/i.exec(rawStem);
  if (teamScoreResult) {
    const scorer = teamTag(teamScoreResult[1] as "1" | "2", teams);
    let resultToken = teamScoreResult[2]!;
    if (/TEAM1_WILL_WIN/i.test(resultToken)) resultToken = "WIN1";
    if (/TEAM2_WILL_WIN/i.test(resultToken)) resultToken = "WIN2";
    return `${scorer} забьёт · ${resultTag(resultToken, teams)}`;
  }

  // Первый Spa · Spa
  const firstGoal = /^FIRST_GOAL([12])_AND_(WIN1|WIN2|DRAW|1X|12|X2)/i.exec(rawStem);
  if (firstGoal) {
    return `Первый ${teamTag(firstGoal[1] as "1" | "2", teams)} · ${resultTag(firstGoal[2]!, teams)}`;
  }

  // Spa или тотал меньше 2.5
  const winOrTotal = /^(WIN1|WIN2|DRAW)_OR_(OVER|UNDER)/i.exec(rawStem);
  if (winOrTotal) {
    const result = resultTag(winOrTotal[1]!, teams);
    const side = winOrTotal[2]!.toUpperCase() === "OVER" ? "больше" : "меньше";
    return line ? `${result} или тотал ${side} ${line}` : `${result} или тотал ${side}`;
  }

  // Spa · голы
  const goalRange = /^TEAM([12])_GOAL_RANGE/i.exec(rawStem);
  if (goalRange) {
    return `${teamTag(goalRange[1] as "1" | "2", teams)} · голы`;
  }

  const totalSide =
    /_TOTAL_UNDER/i.test(stem) ? "меньше"
      : /_TOTAL_OVER/i.test(stem) ? "больше"
        : null;

  const variants: Array<[RegExp, string]> = [
    [/^1X_AND_/i, "1X"],
    [/^12_AND_/i, "12"],
    [/^X2_AND_/i, "X2"],
    [/^WIN1_AND_/i, teams ? teamTag("1", teams) : "П1"],
    [/^WIN2_AND_/i, teams ? teamTag("2", teams) : "П2"],
    [/^DRAW_AND_/i, "X"],
  ];

  for (const [pattern, label] of variants) {
    if (!pattern.test(stem)) continue;
    if (totalSide) {
      return line ? `${label} · тотал ${totalSide} ${line}` : `${label} · тотал ${totalSide}`;
    }
    if (/_AND_TOTAL/i.test(stem)) {
      return line ? `${label} · тотал ${line}` : `${label} · тотал`;
    }
    return label;
  }

  return null;
}

function resolvedGroupSubLabel(
  group: WcMarketGroup,
  categoryName: string,
  teams?: ComboLabelTeams,
): string {
  const dcInterval = formatDoubleChanceIntervalLabel(group);
  if (shouldShowDoubleChanceGroupSubLabel(group, categoryName) && dcInterval) {
    return dcInterval;
  }

  const winInterval = formatWinnerIntervalLabel(group);
  if (shouldShowWinnerGroupSubLabel(group, categoryName) && winInterval) {
    return winInterval;
  }

  const combo = resolveComboVariantGroupLabel(group.marketKey, teams, group.label);
  if (combo) return combo;

  if (isPlainYesNoGroup(group)) {
    const lineSub = formatYesNoLineSubLabel(categoryName, group);
    if (lineSub) return lineSub;
  }

  if (normalizeWcMarketKey(group.marketKey) === "even_odd") {
    const evenOddScope = formatEvenOddScopeLabel(group, categoryName);
    if (evenOddScope) return evenOddScope;
  }

  let label = humanizeWcCategoryName(group.label?.trim() ?? "");
  const category = categoryName.trim();

  if (/^победа\s+map$/i.test(label) || /^победа\s+на\s+карте$/i.test(label)) {
    if (/^\d+-я карта$/i.test(category)) return "";
  }

  if (/^Счет после X голов$/i.test(label) && /сч[её]т\s+после\s+\d+/i.test(category)) {
    label = category;
  }

  if (/^DEUSE|^Дьюс/i.test(category) && /^Дьюс/i.test(label)) {
    return label.replace(/^Дьюс\s*/i, "").trim() || label;
  }

  return label;
}

/** Show set/game/point context once above П1/П2 or Да/Нет rows. */
export function needsGroupSubLabel(
  group: WcMarketGroup,
  categoryName: string,
  teams?: ComboLabelTeams,
): boolean {
  const label = group.label?.trim();
  if (!label && !/^display_/i.test(group.marketKey)) return false;

  if (mergeYesNoCategoryWithLine(categoryName, group)) return false;

  if (shouldShowYesNoGroupSubLabel(group, categoryName)) return true;

  if (shouldShowEvenOddGroupSubLabel(group, categoryName)) return true;

  if (shouldShowDoubleChanceGroupSubLabel(group, categoryName)) return true;

  if (shouldShowWinnerGroupSubLabel(group, categoryName)) return true;

  if (isGoalsTeamMarketGroup(group)) return false;

  const comboVariant = resolveComboVariantGroupLabel(group.marketKey, teams, group.label);
  if (comboVariant && normalizeLabel(comboVariant) !== normalizeLabel(categoryName)) {
    return true;
  }

  const timeRange = extractTimeWindowRange(group);
  if (
    timeRange
    && `${timeRange.from}–${timeRange.to} мин`.toLowerCase() === categoryName.trim().toLowerCase()
  ) {
    return false;
  }

  const category = categoryName.trim();
  const humanizedLabel = label ? humanizeWcCategoryName(label) : "";
  if (humanizedLabel && normalizeLabel(humanizedLabel) === normalizeLabel(category)) return false;
  if (label && normalizeLabel(label) === normalizeLabel(category)) return false;

  if (/NEXT_POINTS|RACE_TO_POINT|RACE_TO_GAME|DEUSE_POINT/i.test(group.marketKey)) {
    const sub = formatGroupSubLabel(group, categoryName);
    if (sub && scopeLabelMatchesCategory(sub, category)) return false;
    return true;
  }

  if (/SCORE_SET|SCORE_WINNER|EXACT_POINT/i.test(group.marketKey)) {
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

  if (/WINNER_MAP/i.test(group.marketKey) && /^\d+-я карта$/i.test(category)) {
    return false;
  }

  if (/ROUNDS_WINNIGMARGIN_MAP/i.test(group.marketKey)) {
    const sub = formatGroupSubLabel(group, categoryName);
    return Boolean(sub) && normalizeLabel(sub) !== normalizeLabel(category);
  }

  if (/WINNER_ROUND/i.test(group.marketKey)) {
    const sub = formatGroupSubLabel(group, categoryName);
    return Boolean(sub) && normalizeLabel(sub) !== normalizeLabel(category);
  }

  if (/^(FIRST_BLOOD|FIRST_TOWER|BARRACKS|ROSHAN|RACE_TO_KILL)_MAP/i.test(group.marketKey)) {
    if (normalizeLabel(humanizedLabel) === normalizeLabel(category)) return false;
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

export function formatGroupSubLabel(
  group: WcMarketGroup,
  categoryName: string,
  teams?: ComboLabelTeams,
): string {
  return resolvedGroupSubLabel(group, categoryName, teams);
}
