import type { MessageKey, TranslateParams } from "~/shared/i18n/messages";
import { translate } from "~/shared/i18n/messages";

type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

/**
 * Exact RU (and EN feed) market/tab labels → message keys for UI display.
 * Matching / odds logic still uses the original RU string.
 */
const WC_LABEL_KEYS: Record<string, MessageKey> = {
  Основные: "wc.tabMain",
  Main: "wc.tabMain",
  "Серия пенальти": "wc.tabPenalties",
  "Penalty shootout": "wc.tabPenalties",
  "Быстрые события": "wc.tabFast",
  "Fast events": "wc.tabFast",
  "Результат + тотал": "wc.tabResultTotal",
  "Result + total": "wc.tabResultTotal",
  "1-й тайм": "wc.tabHalf1",
  "1st half": "wc.tabHalf1",
  "2-й тайм": "wc.tabHalf2",
  "2nd half": "wc.tabHalf2",
  "1-я четверть": "wc.tabQ1",
  "1st quarter": "wc.tabQ1",
  "2-я четверть": "wc.tabQ2",
  "2nd quarter": "wc.tabQ2",
  "3-я четверть": "wc.tabQ3",
  "3rd quarter": "wc.tabQ3",
  "4-я четверть": "wc.tabQ4",
  "4th quarter": "wc.tabQ4",
  "1-й сет": "wc.tabSet1",
  "1st set": "wc.tabSet1",
  "2-й сет": "wc.tabSet2",
  "2nd set": "wc.tabSet2",
  "3-й сет": "wc.tabSet3",
  "3rd set": "wc.tabSet3",
  "4-й сет": "wc.tabSet4",
  "4th set": "wc.tabSet4",
  "5-й сет": "wc.tabSet5",
  "5th set": "wc.tabSet5",
  "1-й сет/матч": "wc.tabSet1Match",
  "1st set/match": "wc.tabSet1Match",
  "Тай-брейк": "wc.tabTiebreak",
  "Tie-break": "wc.tabTiebreak",
  Угловые: "wc.tabCorners",
  Corners: "wc.tabCorners",
  "Желтые карточки": "wc.tabYellow",
  "Yellow cards": "wc.tabYellow",
  Фолы: "wc.tabFouls",
  Fouls: "wc.tabFouls",
  Офсайды: "wc.tabOffsides",
  Offsides: "wc.tabOffsides",
  Эйсы: "wc.tabAces",
  Aces: "wc.tabAces",
  "Двойные ошибки": "wc.tabDoubleFaults",
  "Double faults": "wc.tabDoubleFaults",
  Брейки: "wc.tabBreaks",
  Breaks: "wc.tabBreaks",
  "Двойной шанс": "wc.blockDC",
  "Double chance": "wc.blockDC",
  Тотал: "wc.blockTotal",
  Total: "wc.blockTotal",
  "Тотал (с ОТ)": "wc.blockTotalOT",
  "Total (incl. OT)": "wc.blockTotalOT",
  "Тотал (Чет/Нечет)": "wc.blockTotalOE",
  "Total (Odd/Even)": "wc.blockTotalOE",
  "Тотал (Чет/Нечет, с ОТ)": "wc.blockTotalOEOT",
  "Total (Odd/Even, incl. OT)": "wc.blockTotalOEOT",
  "Азиатский тотал": "wc.blockAsianTotal",
  "Asian total": "wc.blockAsianTotal",
  "Тотал (3 исхода)": "wc.blockTotal3",
  "Total (3-way)": "wc.blockTotal3",
  "Индивидуальный тотал": "wc.blockIndTotal",
  "Team total": "wc.blockIndTotal",
  "Индивидуальный тотал (с ОТ)": "wc.blockIndTotalOT",
  "Team total (incl. OT)": "wc.blockIndTotalOT",
  Фора: "wc.blockHandicap",
  Handicap: "wc.blockHandicap",
  "Фора (с ОТ)": "wc.blockHandicapOT",
  "Handicap (incl. OT)": "wc.blockHandicapOT",
  "Обе забьют": "wc.blockBTS",
  "Both teams to score": "wc.blockBTS",
  "Гол в обоих таймах": "wc.blockGoalBothHalves",
  "Goal in both halves": "wc.blockGoalBothHalves",
  "Точный счёт": "wc.blockCorrectScore",
  "Correct score": "wc.blockCorrectScore",
  "Количество сетов": "wc.blockSetsCount",
  "Number of sets": "wc.blockSetsCount",
  "Следующий гол": "wc.blockNextGoal",
  "Next goal": "wc.blockNextGoal",
  Прочее: "wc.other",
  Other: "wc.other",
};

/** Longest-first RU fragments rewritten inside compound titles. */
const WC_FRAGMENTS: Array<[RegExp, MessageKey]> = [
  [/Индивидуальный тотал \(с ОТ\)/giu, "wc.blockIndTotalOT"],
  [/Индивидуальный тотал/giu, "wc.blockIndTotal"],
  [/Тотал \(Чет\/Нечет, с ОТ\)/giu, "wc.blockTotalOEOT"],
  [/Тотал \(Чет\/Нечет\)/giu, "wc.blockTotalOE"],
  [/Тотал \(3 исхода\)/giu, "wc.blockTotal3"],
  [/Тотал \(с ОТ\)/giu, "wc.blockTotalOT"],
  [/Азиатский тотал/giu, "wc.blockAsianTotal"],
  [/Фора \(с ОТ\)/giu, "wc.blockHandicapOT"],
  [/Двойной шанс/giu, "wc.blockDC"],
  [/Обе забьют/giu, "wc.blockBTS"],
  [/Гол в обоих таймах/giu, "wc.blockGoalBothHalves"],
  [/Точный счёт/giu, "wc.blockCorrectScore"],
  [/Следующий гол/giu, "wc.blockNextGoal"],
  [/Количество сетов/giu, "wc.blockSetsCount"],
  [/Результат \+ тотал/giu, "wc.tabResultTotal"],
  [/Быстрые события/giu, "wc.tabFast"],
  [/Серия пенальти/giu, "wc.tabPenalties"],
  [/Желтые карточки/giu, "wc.tabYellow"],
  [/Двойные ошибки/giu, "wc.tabDoubleFaults"],
  [/1-го тайма|1-й тайм/giu, "wc.tabHalf1"],
  [/2-го тайма|2-й тайм/giu, "wc.tabHalf2"],
  [/1-й половины|1-я половина|1-й половине/giu, "wc.half1"],
  [/2-й половины|2-я половина|2-й половине/giu, "wc.half2"],
  [/1-я четверть|1-й четверти/giu, "wc.tabQ1"],
  [/2-я четверть|2-й четверти/giu, "wc.tabQ2"],
  [/3-я четверть|3-й четверти/giu, "wc.tabQ3"],
  [/4-я четверть|4-й четверти/giu, "wc.tabQ4"],
  [/1-го сета|1-й сет/giu, "wc.tabSet1"],
  [/2-го сета|2-й сет/giu, "wc.tabSet2"],
  [/3-го сета|3-й сет/giu, "wc.tabSet3"],
  [/4-го сета|4-й сет/giu, "wc.tabSet4"],
  [/5-го сета|5-й сет/giu, "wc.tabSet5"],
  [/Тай-брейк/giu, "wc.tabTiebreak"],
  [/Угловые/giu, "wc.tabCorners"],
  [/Офсайды/giu, "wc.tabOffsides"],
  [/Фолы/giu, "wc.tabFouls"],
  [/Эйсы/giu, "wc.tabAces"],
  [/Брейки/giu, "wc.tabBreaks"],
  [/Основные/giu, "wc.tabMain"],
  [/(?<!\p{L})Тотал(?!\p{L})/giu, "wc.blockTotal"],
  [/(?<!\p{L})Фора(?!\p{L})/giu, "wc.blockHandicap"],
  [/(?<!\p{L})голов(?!\p{L})/giu, "wc.unitGoals"],
  [/(?<!\p{L})карт(?!\p{L})/giu, "wc.unitMaps"],
  [/(?<!\p{L})геймов(?!\p{L})/giu, "wc.unitGames"],
  [/(?<!\p{L})очков(?!\p{L})/giu, "wc.unitPoints"],
  [/(?<!\p{L})раундов(?!\p{L})/giu, "wc.unitRounds"],
  [/\(с ОТ\)/giu, "wc.withOtParen"],
  [/\(без ОТ\)/giu, "wc.withoutOtParen"],
  [/(?<!\p{L})с ОТ(?!\p{L})/giu, "wc.withOt"],
  [/(?<!\p{L})без ОТ(?!\p{L})/giu, "wc.withoutOt"],
];

const defaultT: TranslateFn = (key, params) => translate("ru", key, params);

function localizeNthMap(label: string, t: TranslateFn): string {
  return label.replace(
    /(\d+)(?:-?[яЙйи]\s*)?карт[аыуе]?/giu,
    (_m, n: string) => t("wc.mapN", { n }),
  );
}

function localizeMinutes(label: string, t: TranslateFn): string {
  return label
    .replace(/\((\d+)\s*[–-]\s*(\d+)\s*мин\)/giu, (_m, a: string, b: string) =>
      t("wc.minsRangeParen", { from: a, to: b }))
    .replace(/\((\d+)\s*мин\)/giu, (_m, n: string) => t("wc.minsParen", { n }))
    .replace(/(\d+)\s*[–-]\s*(\d+)\s*мин/giu, (_m, a: string, b: string) =>
      t("wc.minsRange", { from: a, to: b }))
    .replace(/(\d+)\s*мин(?!\p{L})/giu, (_m, n: string) => t("wc.mins", { n }));
}

/** Localize a WC tab/block/category label for display. Unknown strings pass through. */
export function localizeWcLabel(label: string, t: TranslateFn = defaultT): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;

  const exact = WC_LABEL_KEYS[trimmed];
  if (exact) return t(exact);

  let out = trimmed;
  for (const [pattern, key] of WC_FRAGMENTS) {
    out = out.replace(pattern, () => t(key));
  }
  out = localizeNthMap(out, t);
  out = localizeMinutes(out, t);

  // Collapse leftover RU joiners after fragment swap: "Total  1st half"
  out = out.replace(/\s{2,}/g, " ").replace(/\s*·\s*/g, " · ").trim();
  return out;
}
