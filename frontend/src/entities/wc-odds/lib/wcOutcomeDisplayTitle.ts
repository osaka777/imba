import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { buildTimeWindowYesNoTitle } from "~/entities/wc-odds/lib/wcYesNoTimeGroups";

const OUTCOME_ALIASES: Record<string, string> = {
  "1Х": "1X",
  "Х2": "X2",
  ТБ: "Б",
  ТМ: "М",
};

/** Phrase → bettor shorthand (order matters: longer phrases first). */
const MARKET_LABEL_RULES: Array<{ pattern: RegExp; replace: string }> = [
  { pattern: /обе\s+(?:команд(?:ы|а)\s+)?заб(?:ь|ью)ют\s+и\s+исход/gi, replace: "ОЗ" },
  { pattern: /обе\s+(?:команд(?:ы|а)\s+)?заб(?:ь|ью)ют/gi, replace: "ОЗ" },
  { pattern: /результат\s*(?:\+|и)\s*тотал/gi, replace: "1X2+Т" },
  { pattern: /диапазон\s+голов|goal\s*range/i, replace: "ДиапГолов" },
  { pattern: /точное\s+число\s+голов|exact\s*goals/i, replace: "Точн. голов" },
  { pattern: /x2\s*\+\s*тотал|winx2\s+and\s+total/i, replace: "X2+Т" },
  { pattern: /двойной\s+шанс/gi, replace: "ДШ" },
  { pattern: /инд(?:ивидуальный|\.)\s*тотал\s*(?:команд(?:ы|а)\s*)?1|инд\.?\s*тотал\s*хоз/gi, replace: "ИТ1" },
  { pattern: /инд(?:ивидуальный|\.)\s*тотал\s*(?:команд(?:ы|а)\s*)?2|инд\.?\s*тотал\s*гост/gi, replace: "ИТ2" },
  { pattern: /инд(?:ивидуальный|\.)\s*тотал/gi, replace: "ИТ" },
  { pattern: /гол\s+в\s+обоих\s+таймах/gi, replace: "ГОТ" },
  { pattern: /точн(?:ый|ого)\s+сч[её]т/gi, replace: "ТС" },
  { pattern: /след(?:ующ(?:ее|ий))?\s*очк(?:о)?(?:\s*в\s*гейме)?/gi, replace: "Сл.очко" },
  { pattern: /сч[её]т\s*в\s*гейме/gi, replace: "Счёт гейма" },
  { pattern: /deuse\s*point/gi, replace: "Дьюс" },
  { pattern: /след(?:ующий)?\.?\s*гол/gi, replace: "СГ" },
  { pattern: /исход\s+матча/gi, replace: "1X2" },
  { pattern: /тотал\s*\(\s*чет\s*\/\s*нечет[^)]*\)/gi, replace: "ТЧН" },
  { pattern: /тотал\s*\(\s*с\s*ОТ\s*\)/gi, replace: "Т(ОТ)" },
  { pattern: /фора\s*\(\s*с\s*ОТ\s*\)/gi, replace: "Ф(ОТ)" },
  { pattern: /тотал/gi, replace: "Т" },
  { pattern: /фора|гандикап/gi, replace: "Ф" },
  { pattern: /исход/gi, replace: "1X2" },
  { pattern: /победа/gi, replace: "П" },
  { pattern: /оставшееся\s+время/gi, replace: "ост." },
];

const STANDARD_SHORT = new Set([
  "П1", "П2", "X", "1X", "X2", "12", "Да", "Нет", "Б", "М", "Чет", "Неч", "—",
]);

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function cleanWcOutcomeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "—";
  if (/^\d+:\d+$/.test(trimmed)) return trimmed;
  if (OUTCOME_ALIASES[trimmed]) return OUTCOME_ALIASES[trimmed]!;
  if (/^DISPLAY_/i.test(trimmed)) return "—";
  if (/^PARAMETER_/i.test(trimmed)) return "—";
  if (/[\[\]{}]|ПерХГейм/i.test(trimmed)) {
    const score = trimmed.match(/(\d+:\d+)/);
    if (score) return score[1]!;
    return "—";
  }
  if (/^перфакт/i.test(trimmed.replace(/\s/g, ""))) {
    const stripped = trimmed
      .replace(/^перфакт\d*мин_?\s*/i, "")
      .replace(/^перфакт_?\s*/i, "")
      .trim();
    if (stripped) return stripped;
  }
  return trimmed;
}

export function abbreviateWcMarketLabel(label: string): string {
  let result = label.trim();
  if (!result) return result;

  for (const rule of MARKET_LABEL_RULES) {
    result = result.replace(rule.pattern, rule.replace);
  }

  return result
    .replace(/\s*\(\s*с\s*ОТ\s*\)/gi, "(ОТ)")
    .replace(/\s+и\s+/gi, "·")
    .replace(/\s+/g, " ")
    .trim();
}

export function abbreviateWcOutcomeName(name: string, outcomeKey?: string): string {
  if (outcomeKey === "YES") return "Да";
  if (outcomeKey === "NO") return "Нет";

  const trimmed = name.trim();
  const yesNoWithContext = /^(да|нет)\s*[(:]/i.exec(trimmed);
  if (yesNoWithContext) {
    return yesNoWithContext[1]!.charAt(0).toUpperCase() + yesNoWithContext[1]!.slice(1).toLowerCase();
  }

  const normalized = cleanWcOutcomeName(name)
    .replace(/Х/g, "X")
    .replace(/^1Х$/i, "1X");

  if (/^[PП]1$/i.test(normalized)) return "П1";
  if (/^[PП]2$/i.test(normalized)) return "П2";
  if (/^[XХ]$/i.test(normalized)) return "X";
  if (/^1X$/i.test(normalized)) return "1X";
  if (/^X2$/i.test(normalized)) return "X2";
  if (normalized === "12") return "12";
  if (/^да$/i.test(normalized)) return "Да";
  if (/^нет$/i.test(normalized)) return "Нет";
  if (/^SCORE\s+AFTER/i.test(normalized) && /не\s*будет/i.test(normalized)) return "Не будет";
  if (/^П[12]\s*·\s*[ПP12XХ]$/i.test(normalized)) return normalized.replace(/\s+/g, " ").replace(/P/g, "П").replace(/Х/g, "X");
  if (/^гола\s+не\s+будет$/i.test(normalized)) return "Гола не будет";
  if (/^к1пob1/i.test(normalized.replace(/\s/g, "")) || /^к1.*1.*сет/i.test(normalized.replace(/\s/g, ""))) {
    if (/нет/i.test(normalized)) return "Нет";
    if (/да/i.test(normalized)) return "Да";
  }
  if (/^к2пob1/i.test(normalized.replace(/\s/g, "")) || /^к2.*1.*сет/i.test(normalized.replace(/\s/g, ""))) {
    if (/нет/i.test(normalized)) return "Нет";
    if (/да/i.test(normalized)) return "Да";
  }
  if (/^больше$/i.test(normalized)) return "Б";
  if (/^меньше$/i.test(normalized)) return "М";
  if (/^чет$/i.test(normalized)) return "Чет";
  if (/^нечет$/i.test(normalized)) return "Неч";
  if (/^ничья$/i.test(normalized)) return "X";

  const teamYesNo = /^([PП][12])\s*:\s*(да|нет)$/i.exec(normalized);
  if (teamYesNo) {
    const side = teamYesNo[1]!.replace(/P/i, "П");
    return `${side}·${capitalizeWord(teamYesNo[2]!)}`;
  }

  const drawYesNo = /^ничья\s*:\s*(да|нет)$/i.exec(normalized);
  if (drawYesNo) return `X·${capitalizeWord(drawYesNo[1]!)}`;

  const halfWinYesNo = /^(Х|П1|П2)-(Да|Нет)$/i.exec(normalized);
  if (halfWinYesNo) return `${halfWinYesNo[1]}-${halfWinYesNo[2]}`;

  return normalized;
}

function extractGoalsRangeFromOutcomeKey(outcomeKey: string): string | null {
  const match = /PARAMETER_GOALS_RANGE:([^|]+)/i.exec(outcomeKey);
  if (!match?.[1]) return null;
  return match[1].trim().replace(/-/g, "–");
}

function isGenericGoalRangeLabel(name: string): boolean {
  const compact = name.trim().replace(/\s/g, "").toLowerCase();
  return compact === "диапголов" || /^диапазон\s*голов$/i.test(name.trim());
}

function extractExactGoalsFromOutcomeKey(outcomeKey: string): string | null {
  const match = /PARAMETER_EXACT_GOALS:([^|]+)/i.exec(outcomeKey);
  if (!match?.[1]) return null;

  const value = match[1].trim();
  if (value.endsWith("+")) {
    const base = value.slice(0, -1);
    return /^\d+$/.test(base) ? `${base}+ голов` : `${value} голов`;
  }
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} гол`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} гола`;
    return `${n} голов`;
  }
  return value;
}

function isBrokenExactGoalsLabel(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (/^Т\d?Кол$/i.test(trimmed.replace(/\s/g, ""))) return true;
  if (/^Кол\s*Пол\b/i.test(trimmed)) return true;
  return false;
}

function isBrokenSetCountLabel(name: string): boolean {
  const compact = name.trim().replace(/\s/g, "");
  return /^КолСет$/i.test(compact) || /^Количествосетов?$/i.test(compact);
}

function extractSetCountFromOutcomeKey(outcomeKey: string): string | null {
  const match = /PARAMETER_VALUE:([^|]+)/i.exec(outcomeKey);
  return match?.[1]?.trim() ?? null;
}

function formatSetCountValue(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} сет`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} сета`;
  return `${n} сетов`;
}

function labelsMatch(a: string, b: string): boolean {
  const left = abbreviateWcMarketLabel(a).toLowerCase();
  const right = abbreviateWcMarketLabel(b).toLowerCase();
  return left === right || a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Result leg for «Обе забьют и Исход» display markets (encoded in marketKey). */
export function extractBttsResultSuffix(marketKey: string): string | null {
  if (!/BOTH_TEAM_TO_SCORE/i.test(marketKey)) return null;

  const key = marketKey.toUpperCase();
  if (/_1X_AND_/.test(key)) return "1X";
  if (/_12_AND_/.test(key)) return "12";
  if (/_X2_AND_/.test(key)) return "X2";
  if (/WIN1|TEAM1_WILL_WIN/.test(key)) return "П1";
  if (/WIN2|TEAM2_WILL_WIN/.test(key)) return "П2";
  if (/DRAW/.test(key)) return "X";

  return null;
}

function buildBttsResultComboTitle(
  marketKey: string,
  shortOutcome: string,
): string | null {
  if (shortOutcome !== "Да" && shortOutcome !== "Нет") return null;

  const resultSuffix = extractBttsResultSuffix(marketKey);
  if (!resultSuffix) return null;

  return `ОЗ·${shortOutcome}·${resultSuffix}`;
}

function extractResultLegFromMarketKey(marketKey: string): string | null {
  const key = marketKey.toUpperCase();
  if (/WIN1|TEAM1_WILL_WIN|_W1\b|W1W1|W1X|W1W2/.test(key) && !/WIN2|TEAM2/.test(key)) {
    if (/1X_AND|_1X_/.test(key)) return "1X";
    if (/12_AND|_12_/.test(key)) return "12";
    return "П1";
  }
  if (/WIN2|TEAM2_WILL_WIN|_W2\b|W2W2|X2|W1W2/.test(key) && !/WIN1|TEAM1/.test(key)) {
    if (/X2_AND|_X2_/.test(key)) return "X2";
    return "П2";
  }
  if (/DRAW|_X_AND|W1X|XW2|_WX_/.test(key)) return "X";
  return null;
}

function inferDisplayYesNo(
  outcome: WcMarketGroup["outcomes"][number],
  group: WcMarketGroup,
): "Да" | "Нет" | null {
  if (!/YES_NO/i.test(group.marketKey)) return null;
  if (group.outcomes.length !== 2) return null;
  const sorted = [...group.outcomes].sort((a, b) => a.outcomeKey.localeCompare(b.outcomeKey));
  if (sorted[0]?.outcomeKey === outcome.outcomeKey) return "Да";
  if (sorted[1]?.outcomeKey === outcome.outcomeKey) return "Нет";
  return null;
}

function extractComboTotalLine(group: WcMarketGroup): string | null {
  const fromLabel = group.label.match(/(-?[\d.]+)\s*$/);
  if (fromLabel) return fromLabel[1]!;
  for (const outcome of group.outcomes) {
    const fromKey = outcome.outcomeKey.match(/PARAMETER_VALUE:([\d.]+)/);
    if (fromKey) return fromKey[1]!;
  }
  return null;
}

function formatComboSide(side: "Б" | "М"): string {
  return side === "Б" ? "больше" : "меньше";
}

function buildReadableComboTitle(
  result: string,
  line: string,
  side: "Б" | "М",
  yn?: "Да" | "Нет",
): string {
  const base = `${result} · тотал ${line} · ${formatComboSide(side)}`;
  return yn ? `${base} · ${yn}` : base;
}

function buildDisplayComboTitle(
  group: WcMarketGroup,
  outcome: WcMarketGroup["outcomes"][number],
): string | null {
  const mk = group.marketKey;
  const shortOutcome = abbreviateWcOutcomeName(cleanWcOutcomeName(outcome.name), outcome.outcomeKey);
  const yn =
    shortOutcome === "Да" || shortOutcome === "Нет"
      ? shortOutcome
      : inferDisplayYesNo(outcome, group);
  const result = extractResultLegFromMarketKey(mk);
  const line = extractComboTotalLine(group);
  const side =
    /UNDER|_UNDER_|_TM\b|ТМ/i.test(outcome.outcomeKey + outcome.name) ? "М"
      : /OVER|_OVER_|_TB\b|ТБ/i.test(outcome.outcomeKey + outcome.name) ? "Б"
        : null;
  const wantsYesNo = /YES_NO/i.test(mk);

  if (/BOTHTEAM_WILL_SCORE_OVER/i.test(mk) && yn && line) {
    return buildReadableComboTitle("ОЗ", line, "Б", yn);
  }
  if (/BOTHTEAM_WILL_SCORE_UNDER/i.test(mk) && yn && line) {
    return buildReadableComboTitle("ОЗ", line, "М", yn);
  }

  if (/AND_TOTAL/i.test(mk) && !wantsYesNo && result && line && side) {
    return buildReadableComboTitle(result, line, side);
  }

  if (!yn) return null;

  if (/BOTH_TEAM_TO_SCORE/i.test(mk)) {
    const btts = extractBttsResultSuffix(mk);
    if (btts) return `ОЗ·${yn}·${btts}`;
  }

  if (/OR_CLEANSHEET|OR_AT_LEAST_ONE_DOESNT|NOT_SCORE|CLEANSHEET/i.test(mk) && result) {
    return `${result}·ОЗ·${yn}`;
  }

  if (/WIN_AND_TOTAL|AND_TOTAL|DRAW_AND_TOTAL|_TOTAL_/i.test(mk) && result && line && side) {
    return buildReadableComboTitle(result, line, side, yn ?? undefined);
  }

  if (/WIN_AND_TOTAL|AND_TOTAL|DRAW_AND_TOTAL/i.test(mk) && result && line) {
    return yn ? `${result} · тотал ${line} · ${yn}` : `${result} · тотал ${line}`;
  }

  if (/INDTOTAL|TEAM_TOTAL|TEAM1|TEAM2/i.test(mk) && result && line && side) {
    const team = /TEAM2|INDTOTAL2/i.test(mk) ? "ИТ2" : "ИТ1";
    return buildReadableComboTitle(`${result} · ${team}`, line, side, yn ?? undefined);
  }

  if (/DOUBLE_CHANCE|_1X_|_X2_|_12_/i.test(mk) && line && side) {
    const dc = /_1X_/i.test(mk) ? "1X" : /_X2_/i.test(mk) ? "X2" : /_12_/i.test(mk) ? "12" : null;
    if (dc) return buildReadableComboTitle(dc, line, side, yn ?? undefined);
  }

  if (result) return `${result}·${yn}`;

  return null;
}

/** Compact label for odds buttons (not coupon). */
export function buildWcOutcomeButtonTitle(
  group: WcMarketGroup,
  outcome: WcMarketGroup["outcomes"][number],
  categoryName: string,
): string {
  const timeWindowTitle = buildTimeWindowYesNoTitle(group, outcome, categoryName);
  if (timeWindowTitle) return timeWindowTitle;

  const outcomeName = cleanWcOutcomeName(outcome.name);

  if (/GOAL_RANGE/i.test(group.marketKey)) {
    const goalsRange = extractGoalsRangeFromOutcomeKey(outcome.outcomeKey);
    if (goalsRange) return goalsRange;
    if (isGenericGoalRangeLabel(outcomeName)) return "—";
  }

  const exactGoalsFromKey = isBrokenExactGoalsLabel(outcomeName)
    ? extractExactGoalsFromOutcomeKey(outcome.outcomeKey)
    : null;
  const setCountFromKey = isBrokenSetCountLabel(outcomeName)
    ? extractSetCountFromOutcomeKey(outcome.outcomeKey)
    : null;
  const shortOutcome = exactGoalsFromKey
    ?? (setCountFromKey ? formatSetCountValue(setCountFromKey) : null)
    ?? abbreviateWcOutcomeName(outcomeName, outcome.outcomeKey);

  if (/NUMBER_OF_SETS/i.test(group.marketKey)) {
    const setCount = extractSetCountFromOutcomeKey(outcome.outcomeKey)
      ?? (outcome.point != null ? String(outcome.point) : null);
    if (setCount) return formatSetCountValue(setCount);
  }

  if (/^\d+:\d+(,\s*\d+:\d+)*$/.test(outcomeName.trim())) {
    return outcomeName.trim();
  }

  if (/^\d+:\d+$/.test(shortOutcome)) {
    if (/гейм|сч[её]т/i.test(categoryName) || /гейм|сч[её]т/i.test(group.label)) {
      return shortOutcome;
    }
  }

  if (/NEXT_POINTS|RACE_TO_POINT/i.test(group.marketKey)) {
    if (/^П1$/i.test(shortOutcome) || /^П2$/i.test(shortOutcome)) return shortOutcome;
    if (/^\d+-[её]?\s*очко$/i.test(shortOutcome) || /^\d+\s*очко$/i.test(shortOutcome)) {
      const side = /ОчкоП1|_1461|HOME/i.test(outcome.outcomeKey + outcomeName) ? "П1" : "П2";
      if (group.outcomes.length === 2) return side;
    }
  }

  if (/DEUSE_POINT/i.test(group.marketKey) && (shortOutcome === "Да" || shortOutcome === "Нет")) {
    return shortOutcome;
  }

  if (/WINNER_SET/i.test(group.marketKey) && (shortOutcome === "П1" || shortOutcome === "П2")) {
    return shortOutcome;
  }

  if (/WINNING_METHOD/i.test(group.marketKey) || /^П[12]\s*·\s*.+/i.test(shortOutcome)) {
    return shortOutcome;
  }

  if (/^ОЗ·(Да|Нет)·/i.test(shortOutcome)) {
    return shortOutcome;
  }

  const plainNextGoalKey = group.marketKey.replace(/^display_/i, "");
  if (/^NEXT_GOAL$|^NEXT_GOAL_2WAY$|^NEXT_GOAL_2WAY_WITH_OT$/i.test(plainNextGoalKey)) {
    if (/^(П1|П2|Никто|X)$/.test(shortOutcome)) return shortOutcome;
  }

  if (/NEXT_GOAL_TIME/i.test(group.marketKey)) {
    const normalized =
      /^след\.?\s*гол$/i.test(shortOutcome) || shortOutcome === "—" ? "Будет гол"
        : /^гола\s+не\s+будет$/i.test(shortOutcome) ? "Не будет"
          : shortOutcome;
    if (/^(Будет гол|Не будет|П1|П2)$/.test(normalized)) return normalized;
  }

  if (/GOAL15MIN/i.test(group.marketKey)) {
    const yn =
      shortOutcome === "Да" || shortOutcome === "Нет"
        ? shortOutcome
        : /^след\.?\s*гол$/i.test(shortOutcome) ? "Да"
          : null;
    if (yn) {
      const interval = group.label.match(/(\d+\s*[–-]\s*\d+\s*мин)/i)?.[1]?.replace(/\s+/g, " ").trim();
      if (interval) return `${interval}·${yn}`;
      return yn;
    }
  }

  if (/HOW_WILL_GOAL_BE_SCORED|LAST_EVENT|MINUTE_GOAL_EVEN_ODD/i.test(group.marketKey)) {
    return shortOutcome;
  }

  if (/SCORING_EVENTS|CLEAN_WIN_TEAM|NUMBER_FINAL_SCORE|OWNGOAL/i.test(group.marketKey)
    && (shortOutcome === "Да" || shortOutcome === "Нет")) {
    return shortOutcome;
  }

  if (!group.label?.trim()) {
    return shortOutcome;
  }

  const bttsCombo = buildBttsResultComboTitle(group.marketKey, shortOutcome);
  if (bttsCombo) return bttsCombo;

  const displayCombo = buildDisplayComboTitle(group, outcome);
  if (displayCombo) return displayCombo;

  if (/^т[бм]$/i.test(shortOutcome) && group.outcomes.length === 2) {
    const line = extractComboTotalLine(group);
    const side = /^тм$|^м$/i.test(shortOutcome) ? "М" : "Б";
    if (line) return `${line}·${side}`;
  }

  if (STANDARD_SHORT.has(shortOutcome) && group.outcomes.length <= 3) {
    if (["П1", "X", "П2", "1X", "12", "X2"].includes(shortOutcome)) {
      return shortOutcome;
    }
  }

  const shortGroup = abbreviateWcMarketLabel(group.label);
  const fullTitle = `${group.label}: ${outcomeName}`;

  if (labelsMatch(group.label, categoryName)) {
    if (shortOutcome === "Да" || shortOutcome === "Нет") {
      const inferred = buildDisplayComboTitle(group, outcome);
      if (inferred) return inferred;
    }
    if (/^\d+\+?\s*гол/i.test(shortOutcome) || /^\d+\+?\s*голов/i.test(shortOutcome)) {
      return shortOutcome;
    }
    if (/^\d+\s*сет/i.test(shortOutcome)) {
      return shortOutcome;
    }
    return shortOutcome;
  }

  if (fullTitle.length <= 12 && !/обе\s+заб/i.test(group.label)) {
    return fullTitle;
  }

  if (shortGroup && shortGroup !== shortOutcome) {
    return `${shortGroup}·${shortOutcome}`;
  }

  return shortOutcome;
}
