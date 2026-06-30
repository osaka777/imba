import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { getMainTotalsCategoryTitle } from "~/entities/wc-odds/lib/wcMarketScopeLabel";
import { isOvertimeMarketKey, normalizeWcMarketKey, stripOvertimeMarketSuffix } from "~/entities/wc-odds/lib/wcRate";

export type WcMarketTabId = string;

export type WcMarketTab = {
  id: WcMarketTabId;
  label: string;
  isFastEvents?: boolean;
};

const TAB_ORDER: string[] = [
  "Основные",
  "Серия пенальти",
  "Быстрые события",
  "Результат + тотал",
  "1-й тайм",
  "2-й тайм",
  "1-я четверть",
  "2-я четверть",
  "3-я четверть",
  "4-я четверть",
  "1-й сет",
  "2-й сет",
  "3-й сет",
  "4-й сет",
  "5-й сет",
  "1-й сет/матч",
  "Тай-брейк",
  "Угловые",
  "Желтые карточки",
  "Фолы",
  "Офсайды",
  "Эйсы",
  "Двойные ошибки",
  "Брейки",
];

const CANONICAL_BLOCK_ORDER: string[] = [
  "1X2",
  "Двойной шанс",
  "Тотал",
  "Тотал (с ОТ)",
  "Тотал (Чет/Нечет)",
  "Тотал (Чет/Нечет, с ОТ)",
  "Индивидуальный тотал",
  "Индивидуальный тотал (с ОТ)",
  "Фора",
  "Фора (с ОТ)",
  "Обе забьют",
  "Гол в обоих таймах",
  "Результат + тотал",
  "Точный счёт",
  "Количество сетов",
  "Следующий гол",
];

/** First N canonical main-line blocks stay expanded on mobile (not raw array index). */
export const WC_MOBILE_DEFAULT_OPEN_CANONICAL_COUNT = 5;

/** Whether a category accordion should start open on mobile (survives DC/time-window splits). */
export function isWcMobileDefaultOpenCategory(
  categoryName: string,
  groups: WcMarketGroup[],
  openCount = WC_MOBILE_DEFAULT_OPEN_CANONICAL_COUNT,
): boolean {
  // Penalty series categories are always expanded when present
  if (/серии?\s*пенальти|пенальти\s*по\s*команд|разница\s*по\s*пенальти|победитель\s*в\s*серии|счёт\s*в\s*серии|счет\s*в\s*серии/i.test(categoryName)) {
    return true;
  }

  const canonical = getCanonicalMarketBlock(categoryName, groups);
  const canonicalIdx = CANONICAL_BLOCK_ORDER.indexOf(canonical);
  if (canonicalIdx >= 0 && canonicalIdx < openCount) return true;

  const lower = categoryName.trim().toLowerCase();
  if (/^тотал/i.test(lower) && !/индивид/i.test(lower) && !/чет.*нечет/i.test(lower)) {
    const totalsIdx = CANONICAL_BLOCK_ORDER.indexOf("Тотал");
    return totalsIdx >= 0 && totalsIdx < openCount;
  }

  return false;
}

const EXACT_TAB_NAMES = new Set([
  "Серия пенальти",
  "Быстрые события",
  "1-й сет",
  "2-й сет",
  "3-й сет",
  "4-й сет",
  "5-й сет",
  "1-й сет/матч",
  "Тай-брейк",
  "1-й тайм",
  "2-й тайм",
  "1-я четверть",
  "2-я четверть",
  "3-я четверть",
  "4-я четверть",
  "Результат + тотал",
  "П1: выиграет ровно 1 сет",
  "П2: выиграет ровно 1 сет",
  "Победа хотя бы в одном сете",
]);

const FAST_EVENT_PATTERN =
  /(\(\s*5\s*мин|\(\s*10\s*мин|в течение матча|оставшееся время|5\s*минут)/i;

const STAT_ROOT_PATTERNS: RegExp[] = [
  /^углов/i,
  /^желт/i,
  /^фол/i,
  /^офсайд/i,
  /^аут/i,
  /^удар/i,
  /^штанг/i,
  /^сейв/i,
  /^замен/i,
  /^видеопросмотр/i,
  /^перехват/i,
  /^успешн/i,
  /^% точных/i,
  /^касани/i,
  /^специальн/i,
  /^спец\.?став/i,
  /^эйс/i,
  /^двойные?\s+ошиб/i,
  /^брейк/i,
  /^ожидаем/i,
  /^выигранн/i,
  /^выход мед/i,
  /^5\s*минут/i,
];

const MAIN_BLOCK_PATTERNS: RegExp[] = [
  /^1x2$/i,
  /^исход(\s+матча)?$/i,
  /двойной\s+шанс/i,
  /^тотал(\s|$|\()/i,
  /^тотал$/i,
  /индивидуальный\s+тотал/i,
  /^фора(\s|$|\()/i,
  /гандикап/i,
  /обе\s+забьют/i,
  /точн.*сч[её]t/i,
  /следующий\s+гол/i,
  /^тайм/i,
  /победител/i,
  /победа/i,
  /матч\s*[-–]\s*сет/i,
  /четверть/i,
  /период/i,
  /результат/i,
  /сухая/i,
  /команд/i,
  /азиатск/i,
  /чет\/?нечет/i,
];

function tabSortIndex(tab: string): number {
  const exact = TAB_ORDER.indexOf(tab);
  if (exact >= 0) return exact;

  const base = tab.split(",")[0]?.trim() ?? tab;
  const baseIdx = TAB_ORDER.indexOf(base);
  if (baseIdx >= 0) return baseIdx + 0.5;

  return TAB_ORDER.length + tab.localeCompare("", "ru");
}

function canonicalBlockSortIndex(block: string): number {
  const idx = CANONICAL_BLOCK_ORDER.indexOf(block);
  return idx >= 0 ? idx : CANONICAL_BLOCK_ORDER.length + block.localeCompare("", "ru");
}

function isStatRootName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return STAT_ROOT_PATTERNS.some((pattern) => pattern.test(lower));
}

function isFastEventCategory(name: string): boolean {
  return FAST_EVENT_PATTERN.test(name);
}

function isOtMarketGroup(group: WcMarketGroup): boolean {
  return isOvertimeMarketKey(group.marketKey);
}

function totalsBlockName(categoryName: string, groups: WcMarketGroup[]): string | null {
  const lower = categoryName.toLowerCase();
  const anyOt = groups.some(isOtMarketGroup);

  if (/индивид/i.test(lower)) {
    return anyOt ? "Индивидуальный тотал (с ОТ)" : "Индивидуальный тотал";
  }
  if (/чет/i.test(lower) && /нечет/i.test(lower)) {
    return anyOt ? "Тотал (Чет/Нечет, с ОТ)" : "Тотал (Чет/Нечет)";
  }
  if (/тотал/i.test(lower) || groups.some((g) => stripOvertimeMarketSuffix(g.marketKey).startsWith("totals"))) {
    return anyOt ? "Тотал (с ОТ)" : "Тотал";
  }
  return null;
}

const FRONTEND_CATALOG_LABELS: Record<string, string> = {
  WINNER_YES_NO: "Победа: да/нет",
  WINNER_10MIN: "Победа (10 мин)",
  WINNER_5MIN: "Победа (5 мин)",
  FIRST_GOAL_AND_WINNER: "Первый гол и победа",
  SCORE_AFTER_X_GOALS: "Счет после X голов",
  STRONG_WILLED_TEAM1: "П1: волевая победа",
  STRONG_WILLED_TEAM2: "П2: волевая победа",
  STRONG_WILLED_ANY_TEAM: "Волевая победа",
  TEAM1_GOALS_BOTH: "П1: голы в обоих таймах",
  TEAM2_GOALS_BOTH: "П2: голы в обоих таймах",
  GOALS_TEAM1: "Забьёт команда 1",
  GOALS_TEAM2: "Забьёт команда 2",
  EXACT_GOALS: "Точное число голов",
  EXACT_GOALS_TEAM1: "Точное число голов (хозяева)",
  EXACT_GOALS_TEAM2: "Точное число голов (гости)",
  GOAL_RANGE: "Диапазон голов",
  GOAL_RANGE_TEAM1: "Диапазон голов (хозяева)",
  GOAL_RANGE_TEAM2: "Диапазон голов (гости)",
  SCORE_VARIANT: "Точный счёт",
  CORRECT_SCORE: "Точный счёт",
  CORRECT_SCORE_ANY: "Точный счёт",
  WINX2_AND_TOTAL: "X2 + тотал",
  X2_AND_TOTAL: "X2 + тотал",
  WIN1_AND_TOTAL: "П1 + тотал",
  WIN2_AND_TOTAL: "П2 + тотал",
  DEUSE_POINT: "Дьюс",
  MULTISCORE_SET: "Мультисчёт сета",
  NEXT_POINTS_GAME: "Следующее очко в гейме",
  RACE_TO_POINT_GAME: "Гонка по очкам в гейме",
  OWNGOAL_YES_NO: "Автогол в матче",
  NUMBER_FINAL_SCORE_YES_NO: "Цифра в итоговом счёте",
};

function isExact1X2Category(category: string): boolean {
  const trimmed = category.trim();
  return /^1x2$/i.test(trimmed) || /^исход\s+матча$/i.test(trimmed);
}

/** Composite / display categories must stay separate — not fold into 1X2/Тотал/Фора. */
export function shouldKeepCategoryIntact(categoryName: string, groups: WcMarketGroup[]): boolean {
  const category = categoryName.trim();
  if (!category) return false;

  if (groups.some((g) => g.marketKey.startsWith("display_") && /NEXT_GOAL|OR_|AND_|YES_NO|HALF_MATCH|1HALF_2HALF|WINNER_\d+MIN|EXACT_|GOAL_RANGE|SCORE_TEAM|SERIESPENALTY|SERIES_PENALTY|MARGIN_PENALTY|NEXT_SERIESPENALTY|WINNER_SERIESPENALTY/i.test(g.marketKey))) {
    return true;
  }

  if (/^исход\s+(или|1-)/i.test(category)) return true;
  if (/^п[12]:\s*выиграет/i.test(category)) return true;
  if (/^победа\s+хотя\s+бы/i.test(category)) return true;
  if (/^win\d+\s+or\b/i.test(category)) return true;
  if (/^draw\s+or\b/i.test(category)) return true;
  if (/следующ/i.test(category)) return true;
  if (/:\s*(победа|двойной\s+шанс)\s+и/i.test(category)) return true;
  if (/тайм\s*[-–]\s*матч/i.test(category)) return true;
  if (/победа\s+и\s+/i.test(category) && !/^фора/i.test(category)) return true;
  if (/двойной\s+шанс\s+и\s+/i.test(category)) return true;
  if (/команд[аы]\s+забьет\s+и/i.test(category)) return true;
  if (/at least one doesnt score/i.test(category)) return true;
  if (/^точн/i.test(category) && /тайм/i.test(category)) return true;
  if (/победа\s+в\s+половинах/i.test(category)) return true;
  if (/как\s+определится\s+победитель/i.test(category)) return true;
  if (/^гол\s+в\s+интервале/i.test(category)) return true;
  if (/когда\s+будет\s+забит/i.test(category)) return true;
  if (/специальн/i.test(category)) return true;
  if (/как\s+будет\s+забит/i.test(category)) return true;
  if (/последн/i.test(category) && /факт|событи/i.test(category)) return true;
  if (/минут.*гол|чет.*нечет/i.test(category)) return true;
  if (/пенальти.*удал|удал.*матч|будет\s+пенальти/i.test(category)) return true;

  return false;
}

const ENGLISH_CATEGORY_LABELS: Record<string, string> = {
  "SCORE VARIANT": "Точный счёт",
  "SCORE_VARIANT": "Точный счёт",
  "DRAW AND TOTAL": "Ничья + тотал",
  "BOTHTEAM WILL SCORE OVER: да/нет": "Обе забьют + тотал (больше)",
  "BOTHTEAM WILL SCORE UNDER: да/нет": "Обе забьют + тотал (меньше)",
  "DRAW IN MATCH WITH SCORE: да/нет": "Ничья с указанным счётом",
  "DRAWN MINUTES TOTAL UNDER: да/нет": "Ничейные минуты + тотал (меньше)",
  "WIN AND TOTAL OVER DRAW: да/нет": "Победа или ничья + тотал (больше)",
  "WIN AND TOTAL UNDER DRAW: да/нет": "Победа или ничья + тотал (меньше)",
  "DRAW OR OVER": "Ничья или тотал (больше)",
  "DRAW OR UNDER": "Ничья или тотал (меньше)",
  "DEUSE POINT": "Дьюс",
  "MULTISCORE SET": "Мультисчёт сета",
  "40:40": "40:40",
  "OWNGOAL: да/нет": "Автогол в матче",
  "NUMBER FINAL SCORE: да/нет": "Цифра в итоговом счёте",
};

/** Humanize stale technical category keys from cached feed snapshots. */
export function humanizeWcCategoryName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const englishLabel = ENGLISH_CATEGORY_LABELS[trimmed]
    ?? ENGLISH_CATEGORY_LABELS[trimmed.toUpperCase()];
  if (englishLabel) return englishLabel;

  const staleLabel = humanizeStaleEnglishGroupLabel(trimmed);
  if (staleLabel) return staleLabel;

  const staticLabel =
    FRONTEND_CATALOG_LABELS[trimmed]
    ?? FRONTEND_CATALOG_LABELS[trimmed.replace(/_WITH_?PARAMS?$/i, "")];
  if (staticLabel) return staticLabel;

  const minMatch = /^WINNER_(\d+)MIN$/i.exec(trimmed);
  if (minMatch) return `Победа (${minMatch[1]} мин)`;

  if (/^GOAL15MIN/i.test(trimmed.replace(/\s*:.*$/, ""))) {
    return "Гол в 15-минутном интервале";
  }

  if (/^[A-Z][A-Z0-9_]+$/.test(trimmed) && trimmed.includes("_")) {
    const stripped = trimmed
      .replace(/_WITH_?PARAMS?$/i, "")
      .replace(/_WITH_?OT$/i, " (с ОТ)");
    const pattern =
      /^EXACT_GOALS/i.test(stripped) ? ( /TEAM1/i.test(stripped) ? "Точное число голов (хозяева)" : /TEAM2/i.test(stripped) ? "Точное число голов (гости)" : "Точное число голов" )
      : /^GOAL_RANGE/i.test(stripped) ? ( /TEAM1/i.test(stripped) ? "Диапазон голов (хозяева)" : /TEAM2/i.test(stripped) ? "Диапазон голов (гости)" : "Диапазон голов" )
      : /^WINX2_AND_TOTAL|^X2_AND_TOTAL/i.test(stripped) ? "X2 + тотал"
      : /^WIN1_AND_TOTAL/i.test(stripped) ? "П1 + тотал"
      : /^WIN2_AND_TOTAL/i.test(stripped) ? "П2 + тотал"
      : /^WIN1_OR_OVER/i.test(stripped) ? "П1 или тотал (больше)"
      : /^WIN2_OR_OVER/i.test(stripped) ? "П2 или тотал (больше)"
      : /^DRAW_OR_OVER/i.test(stripped) ? "Ничья или тотал (больше)"
      : /^WIN1_OR_UNDER/i.test(stripped) ? "П1 или тотал (меньше)"
      : /^WIN2_OR_UNDER/i.test(stripped) ? "П2 или тотал (меньше)"
      : /^DRAW_OR_UNDER/i.test(stripped) ? "Ничья или тотал (меньше)"
      : /^WIN1_OR_CLEANSHEET|^WIN1_OR_AT_LEAST/i.test(stripped) ? "П1 или сухой счёт"
      : /^WIN2_OR_CLEANSHEET|^WIN2_OR_AT_LEAST/i.test(stripped) ? "П2 или сухой счёт"
      : /^DRAW_OR_CLEANSHEET|^DRAW_OR_AT_LEAST/i.test(stripped) ? "Ничья или сухой счёт"
      : /^DRAW_AND_TOTAL/i.test(stripped) ? "Ничья + тотал"
      : /^SCORE_VARIANT|^CORRECT_SCORE/i.test(stripped) ? "Точный счёт"
      : /^BOTHTEAM_WILL_SCORE_OVER/i.test(stripped) ? "Обе забьют + тотал (больше)"
      : /^BOTHTEAM_WILL_SCORE_UNDER/i.test(stripped) ? "Обе забьют + тотал (меньше)"
      : /^OWNGOAL/i.test(stripped) ? "Автогол в матче"
      : /^NUMBER_FINAL_SCORE/i.test(stripped) ? "Цифра в итоговом счёте"
      : /^SCORING_EVENTS/i.test(stripped) ? "Голевые факты"
      : null;
    if (pattern) return pattern;

    return stripped
      .replace(/_YES_NO$/i, ": да/нет")
      .replace(/_3X$/i, "")
      .replace(/_/g, " ")
      .replace(/\bWINX2\b/gi, "X2")
      .replace(/\bWINNER\b/gi, "Победа")
      .replace(/\bGOALS\b/gi, "Голы")
      .replace(/\bGOAL\b/gi, "Гол")
      .replace(/\bRANGE\b/gi, "диапазон")
      .replace(/\bEXACT\b/gi, "Точное")
      .replace(/\bTEAM1\b/gi, "команда 1")
      .replace(/\bTEAM2\b/gi, "команда 2")
      .replace(/\bSTRONG\b/gi, "Волевая")
      .replace(/\bWILLED\b/gi, "победа")
      .replace(/\bBOTH\b/gi, "в обоих таймах")
      .replace(/\s+/g, " ")
      .trim();
  }

  return trimmed;
}

/** Fix cached group labels like «STRONG WILLED команда 1» / «команда 1 Голы BOTH». */
function humanizeStaleEnglishGroupLabel(name: string): string | null {
  const trimmed = name.trim();
  if (/^STRONG\s+WILLED\s+команда\s+1$/i.test(trimmed)) return "П1: волевая победа";
  if (/^STRONG\s+WILLED\s+команда\s+2$/i.test(trimmed)) return "П2: волевая победа";
  if (/^CLEAN\s+WIN\s+команда\s+1$/i.test(trimmed)) return "П1";
  if (/^CLEAN\s+WIN\s+команда\s+2$/i.test(trimmed)) return "П2";
  if (/^OWNGOAL/i.test(trimmed)) return "Автогол в матче";
  if (/^NUMBER\s+FINAL\s+SCORE/i.test(trimmed)) return "Цифра в итоговом счёте";
  if (/^команда\s+1\s+Голы\s+BOTH$/i.test(trimmed)) return "П1: голы в обоих таймах";
  if (/^команда\s+2\s+Голы\s+BOTH$/i.test(trimmed)) return "П2: голы в обоих таймах";
  if (/^SCORE\s+AFTER\s+X\s+Гол/i.test(trimmed)) return "Счет после X голов";
  if (/^SCORE\s+AFTER/i.test(trimmed)) {
    const goalNum = trimmed.match(/(\d+)/);
    return goalNum ? `Счет после ${goalNum[1]} голов` : "Счет после X голов";
  }
  if (/^SCORE\s+AFTER.*не\s*будет/i.test(trimmed)) return "Не будет";
  if (/^FIRST\s+Гол\s+AND/i.test(trimmed)) return "Первый гол и победа";
  if (/^SCORING\s+EVENTS/i.test(trimmed)) {
    const map: Record<string, string> = {
      HATTRICK: "Хет-трик",
      DOUBLE: "Дубль",
      KICKGOAL: "Гол ногой",
      HEADER: "Гол головой",
      DIRECT_FREEKICK: "Гол со штрафного",
      DIRECT: "Гол со штрафного",
      STRIKER: "Нападающий забьёт",
      MIDFIELDER: "Полузащитник забьёт",
      DEFENDER: "Защитник забьёт",
      GOALPOST: "Штанга или перекладина",
      GOALPOST_CROSSBAR: "Штанга или перекладина",
      DISALLOWED: "Гол не засчитан",
      DISALLOWED_GOAL: "Гол не засчитан",
      GOALKEEPER: "Вратарь забьёт",
    };
    const tokenMatch = /^SCORING\s+EVENTS\s+([A-Z_]+)/i.exec(trimmed);
    if (tokenMatch) {
      const raw = tokenMatch[1]!.toUpperCase().replace(/:.*$/i, '');
      if (map[raw]) return map[raw]!;
      const short = raw.replace(/_GOAL.*$/i, '');
      if (map[short]) return map[short]!;
    }
    return "Голевые факты";
  }
  return null;
}

/** Category title for odds accordion — sport-specific overrides. */
export function formatWcCategoryDisplayName(name: string, sport?: string): string {
  const humanized = humanizeWcCategoryName(name);
  return getMainTotalsCategoryTitle(humanized, sport);
}

function isScopedDoubleChanceBlock(categoryName: string, groups: WcMarketGroup[]): boolean {
  if (groups.every((g) => g.marketKey.startsWith("display_") && /DOUBLE_CHANCE/i.test(g.marketKey))) {
    return true;
  }
  if (/\(\d+\s*[–-]\s*\d+\s*мин\)|\(\d+\s*мин\)/i.test(categoryName)) return true;
  return groups.some((g) => /\d+\s*[–-]\s*\d+\s*мин|\(\d+\s*мин\)/i.test(g.label ?? ""));
}

function handicapBlockName(categoryName: string, groups: WcMarketGroup[]): string | null {
  const lower = categoryName.toLowerCase();
  const anyOt = groups.some(isOtMarketGroup);
  if (
    /^фора/i.test(lower)
    || /гандикап/i.test(lower)
    || groups.some((g) => {
      const base = stripOvertimeMarketSuffix(g.marketKey);
      return base === "handicap" || base === "handicap_3way";
    })
  ) {
    return anyOt ? "Фора (с ОТ)" : "Фора";
  }
  return null;
}

/** Stable accordion title for merged main markets. */
export function getCanonicalMarketBlock(categoryName: string, groups: WcMarketGroup[]): string {
  const category = categoryName.trim();
  if (!category) return "Прочее";

  if (isStatRootName(category) && !category.includes(",")) return category;

  const totalsBlock = totalsBlockName(category, groups);
  if (totalsBlock) return totalsBlock;

  const handicapBlock = handicapBlockName(category, groups);
  if (handicapBlock) return handicapBlock;

  const keys = new Set(groups.map((g) => normalizeWcMarketKey(g.marketKey)));
  const has = (key: string) => keys.has(key);
  const onlyCanonicalH2h =
    groups.length > 0 && groups.every((g) => g.marketKey === "h2h");

  if (has("btts") || has("goals_both_min")) {
    if (/обоих\s+тайм/i.test(category)) return "Гол в обоих таймах";
    return "Обе забьют";
  }
  if (onlyCanonicalH2h || isExact1X2Category(category)) return "1X2";
  if (has("double_chance")) {
    if (isScopedDoubleChanceBlock(category, groups)) {
      return humanizeWcCategoryName(groups[0]?.label?.trim() || category);
    }
    return "Двойной шанс";
  }
  if (has("handicap") || has("handicap_3way")) return handicapBlockName(category, groups) ?? "Фора";
  if (has("even_odd")) return totalsBlockName(category, groups) ?? "Тотал (Чет/Нечет)";

  const lower = category.toLowerCase();
  if (/^1x2$/i.test(category) || /^исход\s+матча$/i.test(category)) return "1X2";
  if (/двойной\s+шанс/i.test(lower)) {
    if (isScopedDoubleChanceBlock(category, groups)) {
      return humanizeWcCategoryName(groups[0]?.label?.trim() || category);
    }
    return "Двойной шанс";
  }
  if (/^тотал/i.test(lower)) {
    return totalsBlockName(category, groups) ?? "Тотал";
  }
  if (/фор|гандикап|3\s*исход/i.test(lower)) {
    return handicapBlockName(category, groups) ?? "Фора";
  }
  if (/обе\s+заб/i.test(lower)) return "Обе забьют";
  if (groups.some((g) => /NEXT_POINTS|RACE_TO_POINT/i.test(g.marketKey))) {
    return "Следующее очко в гейме";
  }
  if (groups.some((g) => /DEUSE_POINT/i.test(g.marketKey)) || /^40:40$/i.test(category)) {
    return "40:40";
  }
  if (groups.some((g) => /MULTISCORE/i.test(g.marketKey))) {
    return "Мультисчёт сета";
  }
  if (/следующ.*очк/i.test(lower)) return "Следующее очко в гейме";
  if (/следующ.*гол/i.test(lower)) return "Следующий гол";
  if (/гол\s+в\s+интервале/i.test(lower)) return "Гол в интервале";
  if (/когда\s+будет\s+забит/i.test(lower)) return category;
  if (/точн/i.test(lower)) return "Точный счёт";
  if (/и\s+тотал|п[12]тот|хтот|1х\s+и/i.test(lower.replace(/\s/g, ""))) {
    return "Результат + тотал";
  }

  return humanizeWcCategoryName(category);
}

/** BetAPI-style subgame tab for a market category name. */
export function deriveTabKey(categoryName: string): string {
  const name = categoryName.trim();
  if (!name) return "Основные";

  if (isFastEventCategory(name)) return "Быстрые события";

  if (EXACT_TAB_NAMES.has(name)) return name;

  // Penalty shootout categories → dedicated tab
  if (/серии?\s*пенальти|пенальти\s*по\s*команд|разница\s*по\s*пенальти|счёт\s*в\s*серии|счет\s*в\s*серии/i.test(name)) {
    return "Серия пенальти";
  }

  if (/,\s*\d+-й\s+тайм$/i.test(name)) return name;
  if (/,\s*\d+-й\s+сет$/i.test(name)) return name;
  if (/^эйсы,\s/i.test(name)) return name;
  if (/^двойные ошибки,\s/i.test(name)) return name;

  if (isStatRootName(name) && !name.includes(",")) return name;

  const setInName = name.match(/(?:в|во)\s+(\d+)-м\s+сете|(\d+)-го\s+сета/i);
  if (setInName) {
    const num = setInName[1] || setInName[2];
    return `${num}-й сет`;
  }

  const halfInName = name.match(/(?:в|во)\s+(\d+)-м\s+тайме|(\d+)-го\s+тайма/i);
  if (halfInName) {
    const num = halfInName[1] || halfInName[2];
    return `${num}-й тайм`;
  }

  if (/тай-брейк/i.test(name)) {
    const setNum = name.match(/(\d+)-м\s+сете/);
    if (setNum) return `Тай-брейк в ${setNum[1]}-м сете`;
    return "Тай-брейк";
  }

  if (MAIN_BLOCK_PATTERNS.some((pattern) => pattern.test(name.toLowerCase()))) {
    return "Основные";
  }

  if (/^\d+-й\s+сет$/i.test(name)) return name;

  const setScoped = name.match(/^(\d+-[йи]\s+сет)(?:\s*[,·]|,\s)/i);
  if (setScoped) return setScoped[1]!;

  const halfScoped = name.match(/^(\d+-[йи]\s+тайм)(?:\s*[,·]|,\s)/i);
  if (halfScoped) return halfScoped[1]!;

  return "Основные";
}

export function isTotalsCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "тотал" || lower === "total" || lower.startsWith("тотал ");
}

export function isHandicapCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "фора" || lower.includes("гандикап") || lower.includes("handicap");
}

export function is1X2Category(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "1x2" || lower === "исход матча";
}

/** @deprecated use deriveTabKey — kept for compatibility */
export function isStatMarketCategory(name: string): boolean {
  return deriveTabKey(name) !== "Основные";
}

function isCoreSetOrHalfBlock(categoryName: string, tabKey: string): boolean {
  if (tabKey === "Основные") return false;
  if (categoryName === tabKey) return true;

  const lower = categoryName.toLowerCase();
  const tabLower = tabKey.toLowerCase();

  if (tabLower.includes("сет") && (isTotalsCategory(categoryName) || isHandicapCategory(categoryName))) {
    return lower.includes("сет") || categoryName === "Тотал" || categoryName === "Фора";
  }

  if (tabLower.includes("тайм") && (isTotalsCategory(categoryName) || isHandicapCategory(categoryName))) {
    return lower.includes("тайм") || categoryName === "Тотал" || categoryName === "Фора";
  }

  if (tabLower.includes("четверть") && (isTotalsCategory(categoryName) || isHandicapCategory(categoryName) || /чет/i.test(lower))) {
    return lower.includes("четверть") || categoryName === "Тотал" || categoryName === "Фора";
  }

  if (tabLower === categoryName) return true;

  return false;
}

function mergeByCanonicalBlock(
  entries: Array<[string, WcMarketGroup[]]>,
): Array<[string, WcMarketGroup[]]> {
  const merged = new Map<string, WcMarketGroup[]>();
  const separate: Array<[string, WcMarketGroup[]]> = [];

  for (const [categoryName, groups] of entries) {
    if (shouldKeepCategoryIntact(categoryName, groups)) {
      separate.push([humanizeWcCategoryName(categoryName), groups]);
      continue;
    }

    for (const group of groups) {
      const block = getCanonicalMarketBlock(categoryName, [group]);
      const existing = merged.get(block) ?? [];
      merged.set(block, [...existing, group]);
    }
  }

  const mergedEntries = [...merged.entries()].sort(
    ([a], [b]) => canonicalBlockSortIndex(a) - canonicalBlockSortIndex(b) || a.localeCompare(b, "ru"),
  );

  const separateSorted = separate.sort(
    ([a], [b]) => a.localeCompare(b, "ru"),
  );

  return [...mergedEntries, ...separateSorted];
}

function shouldMergeCanonical(tabId: WcMarketTabId): boolean {
  return tabId === "Основные" || tabId === "all" || tabId === "Быстрые события";
}

/**
 * Within a tab, merge related markets into canonical blocks (1X2, Тотал, Фора, …).
 */
export function regroupEntriesForDisplay(
  entries: Array<[string, WcMarketGroup[]]>,
  tabId: WcMarketTabId,
): Array<[string, WcMarketGroup[]]> {
  if (tabId === "all") {
    const mainLine: Array<[string, WcMarketGroup[]]> = [];
    const rest: Array<[string, WcMarketGroup[]]> = [];

    for (const entry of entries) {
      if (deriveTabKey(entry[0]) === "Основные") mainLine.push(entry);
      else rest.push(entry);
    }

    const mergedMain = mergeByCanonicalBlock(mainLine);
    const mergedRest = rest.sort(([a], [b]) => tabSortIndex(a) - tabSortIndex(b) || a.localeCompare(b, "ru"));
    return [...mergedMain, ...mergedRest];
  }

  if (shouldMergeCanonical(tabId)) {
    if (tabId === "Основные" || tabId === "Быстрые события") {
      return mergeByCanonicalBlock(entries);
    }
  }

  const tabKey = tabId;
  const coreGroups: WcMarketGroup[] = [];
  const result: Array<[string, WcMarketGroup[]]> = [];

  for (const [categoryName, groups] of entries) {
    if (isCoreSetOrHalfBlock(categoryName, tabKey)) {
      coreGroups.push(...groups);
    } else {
      result.push([categoryName, groups]);
    }
  }

  if (coreGroups.length > 0) {
    result.unshift([tabKey, coreGroups]);
  }

  return result;
}

export function buildMarketTabs(
  entries: Array<[string, WcMarketGroup[]]>,
): WcMarketTab[] {
  if (!entries.length) return [{ id: "all", label: "Все" }];

  const tabKeys = new Set<string>();
  for (const [name] of entries) {
    tabKeys.add(deriveTabKey(name));
  }

  const tabs: WcMarketTab[] = [{ id: "all", label: "Все" }];

  const sorted = [...tabKeys].sort((a, b) => tabSortIndex(a) - tabSortIndex(b));
  for (const key of sorted) {
    tabs.push({
      id: key,
      label: key,
      isFastEvents: key === "Быстрые события",
    });
  }

  return tabs;
}

export function filterGroupedMarketsByTab(
  entries: Array<[string, WcMarketGroup[]]>,
  tabId: WcMarketTabId,
): Array<[string, WcMarketGroup[]]> {
  if (tabId === "all") return entries;
  return entries.filter(([name]) => deriveTabKey(name) === tabId);
}

function parseLineFromLabel(label: string): number | null {
  const m = label.match(/(-?[\d.]+)\s*$/);
  return m ? Number(m[1]) : null;
}

function sortByLine(groups: WcMarketGroup[]): WcMarketGroup[] {
  return [...groups].sort((a, b) => {
    const lineA = a.outcomes[0]?.point ?? parseLineFromLabel(a.label) ?? 0;
    const lineB = b.outcomes[0]?.point ?? parseLineFromLabel(b.label) ?? 0;
    return Number(lineA) - Number(lineB);
  });
}

export function packSmallGroups<T>(items: [string, T][], maxGroupSize = 15): Array<Array<[string, T]>> {
  const result: Array<Array<[string, T]>> = [];

  if (items.length <= maxGroupSize && items.length > 1) {
    const mid = Math.ceil(items.length / 2);
    result.push(items.slice(0, mid));
    result.push(items.slice(mid));
    return result;
  }

  for (let i = 0; i < items.length; i += maxGroupSize) {
    result.push(items.slice(i, i + maxGroupSize));
  }

  return result;
}

export { sortByLine };
