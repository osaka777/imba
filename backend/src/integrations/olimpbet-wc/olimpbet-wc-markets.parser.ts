import {
  resolveWcMarketKey,
  isJunkSpecialtyCatalogName,
} from './olimpbet-wc-market-keys.util';
import { isOlimpbetEsportsSportId, olimpbetSportIdToSlug } from './olimpbet-sport.util';

import type { WcGroupedMarkets, WcMarketGroup } from '../wc-odds/wc-odds-markets.util';
import { finalizeGroupedMarkets } from '../wc-odds/wc-odds-markets.util';
import {
  isValidEsportsMapCorrectScore,
  parseScorePairLabel,
  stripPlaceholderMapCorrectScoreMarkets,
  stripFlatPlaceholderEsportsMarkets,
} from './olimpbet-map-correct-score.util';

import {
  catalogMarketLabel,
  formatOutcomeLabel,
  formatEsportsMapTeamOutcome,
  formatResultingComparisonLabel,
  formatWinningMethodOutcome,
  formatBttsAndOutcomeCode,
  formatFirstGoalAndWinnerCode,
  formatNextGoalOutcome,
  humanizeCatalogMarketName,
  isTechnicalEnglishCatalogLabel,
  resolveBttsOutcomeGroupLabel,
  resolveComboDisplayGroupLabel,
  resolveNextGoalGroupLabel,
  resolveCleanWinTeamSideGroupLabel,
  resolveNumberFinalScoreCategoryName,
  resolveNumberFinalScoreGroupLabel,
  resolveResultingGroupLabel,
  resolveScoringEventsGroupLabel,
  resolveSpecialBetsGroupLabel,
  loadOlimpbetMarketCatalog,
  resolveVirtualCategoryName,
  resolveYesNoMarketLabel,
  resolveYesNoMarketLabelFromCatalog,
  type OlimpbetMarketCatalog,
} from './olimpbet-wc-catalog';
import type { OlimpbetEventDetail, OlimpbetProbability, OlimpbetProbabilityMarket } from './olimpbet-wc.types';

const LINKED_PRIORITY = new Set([
  'Corners',
  'Yellow_cards',
  'Fouls',
  'Shots_on_target',
  'Offsides',
  'Outs',
  'Goal_kicks',
  'Woodwork',
  'Shots',
  'Saves',
  'Substitutions',
  'Var',
  'Medical_team_on_the_field',
  'Won_aerial_duels',
  'Expected_goals',
  'Interceptions',
  'Successful_dribbles',
  'Successful_tackles',
  'Completed_passes_percentage',
  'Touching_ball_by_goalkeeper',
  'Spesial_bets',
  'Aces',
  'Double_faults',
  '5_minutes',
]);

const SETTLED_MARKETS = new Set([
  'h2h',
  'totals',
  'totals_home',
  'totals_away',
  'even_odd',
  'btts',
  'double_chance',
  'handicap',
  'goals_both_min',
  'handicap_3way',
]);

const FAST_EVENT_CATEGORY = /(\(\s*5\s*мин|\(\s*10\s*мин|в течение матча|оставшееся время|rest_of_match|_5_?min|_10_?min|_x_min)/i;

const CATEGORY_ORDER = [
  '1X2',
  'Двойной шанс',
  'Тотал',
  'Фора',
  'Обе забьют',
  'Индивидуальный тотал',
  'Точный счёт',
  'Следующий гол',
  'Тайм',
  'Угловые',
  'Желтые карточки',
  'Фолы',
  'Удары от ворот',
  'Ауты',
  'Удары в створ',
  'Офсайды',
  'Штанги/Перекладины',
  'Удары по воротам',
  'Сейвы',
  'Замены',
  'Видеопросмотры',
  'Выход мед.бригады на поле',
  'Выигранные верховые единоборства',
  'Ожидаемые голы (xG)',
  'Перехваты',
  'Успешные обводки',
  'Успешные отборы',
  '% точных передач',
  'Касания мяча вратарем',
  'Специальные ставки',
  'Эйсы',
  'Двойные ошибки',
  '5 минут',
];

const MARKET_CODE_TO_CATEGORY: Record<string, string> = {
  MATCH_WINNER_X3: '1X2',
  TOTAL: 'Тотал',
  TOTAL_ASIAN: 'Азиатский тотал',
  TOTAL_ASIAN_HALF: 'Азиатский тотал',
  TOTAL_3WAY: 'Тотал (3 исхода)',
  TOTAL_HALF_3WAY: 'Тотал (3 исхода)',
  GOALS_BOTH: 'Обе забьют',
  GOALS_BOTHHALF: 'Гол в обоих таймах',
  GOALS_BOTH_BOTHHALF: 'Обе забьют в обоих таймах',
  GOALS_BOTH_MIN_YES_NO: 'Обе забьют (мин.)',
  HANDICAP: 'Фора',
  HANDICAP_ASIAN: 'Фора',
  HANDICAP_EUROPEAN: 'Фора',
  HANDICAP_3WAY: 'Фора',
  HANDICAP_3WAY_HALF: 'Фора',
  DOUBLE_CHANCE: 'Двойной шанс',
  CORRECT_SCORE: 'Точный счет',
  CORRECT_SCORE_ANY: 'Точный счет',
  SCORE_VARIANT: 'Точный счет',
  NEXT_GOAL: 'Следующий гол',
  TEAM_TOTAL: 'Индивидуальный тотал',
  TEAM_TOTAL_1: 'Индивидуальный тотал 1-го',
  TEAM_TOTAL_2: 'Индивидуальный тотал 2-го',
  INDIVIDUAL_TOTAL_TEAM1: 'Индивидуальный тотал',
  INDIVIDUAL_TOTAL_TEAM2: 'Индивидуальный тотал',
  COUNT_SET: 'Тотал',
  EVEN_ODD: 'Тотал',
  TOTAL_SET: 'Тотал',
  HANDICAP_BY_SET: 'Фора',
  SCORE: 'Точный счёт',
  SCORE_SET: 'Счет в гейме',
  SCORE_FIRST_X_GAMES_SET: 'Счёт первых геймов',
  EXACT_POINT_GAME_SET: 'Точное количество очков гейма',
  WINNER_2GAMES_SET: 'Исход двух геймов',
  WINNER_2GAMES_SET_4WAY: 'Исход двух геймов',
  WINNER_GAME: 'Победа в гейме',
  RACE_TO_GAME: 'Гонка по геймам',
  RACE_TO_POINT_GAME: 'Гонка по очкам в гейме',
  NEXT_POINTS_GAME: 'Следующее очко в гейме',
  SET_TEAM1: 'Победа хотя бы в одном сете',
  SET_TEAM2: 'Победа хотя бы в одном сете',
  TEAM1_WIN_EXACTLY_1SET_YES_NO: 'П1: выиграет ровно 1 сет',
  TEAM2_WIN_EXACTLY_1SET_YES_NO: 'П2: выиграет ровно 1 сет',
  GOALS_TEAM1: 'Забьёт команда 1',
  GOALS_TEAM2: 'Забьёт команда 2',
  WINNER_YES_NO: 'Победа: да/нет',
  NUMBER_OF_SETS: 'Количество сетов',
};

function categorySortIndex(name: string): number {
  const lower = name.toLowerCase();
  const idx = CATEGORY_ORDER.findIndex((c) => lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower));
  return idx >= 0 ? idx : CATEGORY_ORDER.length + lower.charCodeAt(0);
}

function sortGroupedMarkets(grouped: WcGroupedMarkets): WcGroupedMarkets {
  const entries = Object.entries(grouped).sort(
    ([a], [b]) => categorySortIndex(a) - categorySortIndex(b) || a.localeCompare(b, 'ru'),
  );
  return finalizeGroupedMarkets(Object.fromEntries(entries));
}

function paramSig(prob: OlimpbetProbability): string {
  const parts = (prob.parameters ?? [])
    .filter((p) => p.type !== 'PARAMETER_PLAYER_ID')
    .map((p) => `${p.type}:${p.value}`)
    .sort();
  return parts.join('|') || 'base';
}

function handicapGroupSig(prob: OlimpbetProbability): string {
  const line = prob.parameters?.find((p) => p.type === 'PARAMETER_VALUE')?.value;
  const half = prob.parameters?.find((p) => p.type === 'PARAMETER_HALF_NUMBER')?.value ?? '';
  const quarter = prob.parameters?.find((p) => p.type === 'PARAMETER_QUARTER_NUMBER')?.value ?? '';
  const setNum = prob.parameters?.find((p) => p.type === 'PARAMETER_SET_NUMBER')?.value ?? '';
  const gameNum = prob.parameters?.find((p) => p.type === 'PARAMETER_GAME_NUMBER')?.value ?? '';
  if (line != null && line !== '') {
    const absLine = Math.abs(Number(line));
    if (Number.isFinite(absLine)) {
      return `hcp|${half}|${quarter}|${setNum}|${gameNum}|${absLine}`;
    }
  }
  return paramSig(prob);
}

function scoreSetGroupSig(prob: OlimpbetProbability): string {
  const setNum = prob.parameters?.find((p) => p.type === 'PARAMETER_SET_NUMBER')?.value ?? '';
  const gameNum = prob.parameters?.find((p) => p.type === 'PARAMETER_GAME_NUMBER')?.value ?? '';
  return `scoreset|${setNum}|${gameNum}`;
}

function scoreMapGroupSig(prob: OlimpbetProbability): string {
  const mapNum = prob.parameters?.find((p) => p.type === 'PARAMETER_MAP_NUMBER')?.value ?? '';
  return `scoremap|${mapNum}`;
}

function marketGroupSig(marketKey: string, prob: OlimpbetProbability): string {
  const baseKey = marketKey.replace(/_ot$/i, '');
  const catalogStem = baseKey.replace(/^display_/i, '');
  if (/^NUMBER_OF_SETS/i.test(catalogStem)) {
    return 'number_of_sets';
  }
  if (/^SCORE_MAP$/i.test(catalogStem)) {
    return scoreMapGroupSig(prob);
  }
  if (/^SCORE_SET|^EXACT_POINT_GAME_SET|^SCORE_WINNER|^WINNER_2GAMES|^SCORE_TIE_BREAK|^SCORE_FIRST_X_GAMES/i.test(catalogStem)) {
    return scoreSetGroupSig(prob);
  }
  if (
    baseKey === 'handicap'
    || baseKey === 'totals'
    || baseKey === 'totals_home'
    || baseKey === 'totals_away'
  ) {
    return handicapGroupSig(prob);
  }
  return paramSig(prob);
}

function hasPlayerParam(prob: OlimpbetProbability): boolean {
  return (prob.parameters ?? []).some((p) => p.type === 'PARAMETER_PLAYER_ID');
}

function isFastEventCategory(category: string): boolean {
  return FAST_EVENT_CATEGORY.test(category);
}

function baseMarketKey(marketKey: string): string {
  return marketKey.replace(/_ot$/i, '');
}

function isPeriodTabCategory(category: string): boolean {
  return /^\d+-я\s+четверть$/i.test(category)
    || /^\d+-й\s+тайм$/i.test(category)
    || /^\d+-й\s+сет$/i.test(category);
}

function isHandicapOtScope(catalogName: string, marketKey: string): boolean {
  return /_WITH_?OT$/i.test(catalogName) || /_ot$/i.test(marketKey);
}

/** Display labels for RU canonical buckets when building the EN market catalog. */
const CANONICAL_CATEGORY_EN: Record<string, string> = {
  '1X2': '1X2',
  'Двойной шанс': 'Double Chance',
  'Фора': 'Handicap',
  'Фора (с ОТ)': 'Handicap (incl. OT)',
  'Тотал': 'Total',
  'Тотал (с ОТ)': 'Total (incl. OT)',
  'Тотал (Чет/Нечет)': 'Total (Odd/Even)',
  'Тотал (Чет/Нечет, с ОТ)': 'Total (Odd/Even, incl. OT)',
  'Индивидуальный тотал': 'Team Total',
  'Индивидуальный тотал (с ОТ)': 'Team Total (incl. OT)',
  'Обе забьют': 'Both Teams to Score',
  'Гол в обоих таймах': 'Goal in Both Halves',
  'Результат + тотал': 'Result + Total',
  'Точный счёт': 'Correct Score',
  'Забьёт команда 1': 'Team 1 to Score',
  'Забьёт команда 2': 'Team 2 to Score',
  'Победа: да/нет': 'Win: Yes/No',
  'Диапазон голов': 'Goal Range',
  'Диапазон голов (хозяева)': 'Goal Range (Home)',
  'Диапазон голов (гости)': 'Goal Range (Away)',
  'Точное число голов': 'Exact Goals',
  'Точное число голов (хозяева)': 'Exact Goals (Home)',
  'Точное число голов (гости)': 'Exact Goals (Away)',
  'Тотал раундов': 'Total Rounds',
  'Индивидуальный тотал по раундам': 'Team Total Rounds',
  'Следующий гол': 'Next Goal',
  'Гол в интервале': 'Goal in Interval',
  'Количество сетов': 'Number of Sets',
  'Голевые факты (Да/Нет)': 'Scoring Events (Yes/No)',
  'Автогол в матче': 'Own Goal',
  'Цифра в итоговом счёте (Да/Нет)': 'Digit in Final Score (Yes/No)',
  'Следующее очко в гейме': 'Next Point in Game',
  'Исход двух геймов': 'Two Games Winner',
  '40:40': '40:40',
  'Серия пенальти': 'Penalty Shootout',
  'Никто не забьет в обоих таймах': 'No Goals in Either Half',
  'Гонка по геймам': 'Race to Games',
};

function localizeCategoryLabel(category: string, locale: 'ru' | 'en'): string {
  if (locale !== 'en') return category;
  const mapped = CANONICAL_CATEGORY_EN[category];
  if (mapped) return mapped;
  // Period tabs / leftover provider strings that still carry RU morphology.
  return category
    .replace(/^(\d+)-й\s+тайм$/i, 'Half $1')
    .replace(/^(\d+)-я\s+четверть$/i, 'Quarter $1')
    .replace(/^(\d+)-й\s+сет$/i, 'Set $1')
    .replace(/^(\d+)-я\s+карта$/i, 'Map $1')
    .replace(/\s*\(с ОТ\)/gi, ' (incl. OT)')
    .replace(/\s*\(1-й тайм\)/gi, ' (1st Half)')
    .replace(/\s*\(2-й тайм\)/gi, ' (2nd Half)');
}

/** Collapse Olimpbet virtual categories into stable UI buckets. */
function canonicalizeCategory(
  category: string,
  catalogName: string,
  marketKey: string,
): string {
  if (isFastEventCategory(category)) return category;

  if (/WIN\d+_AND_TOTAL|WINX2_AND_TOTAL|X2_AND_TOTAL/i.test(catalogName)) return 'Результат + тотал';

  if (/^GOALS_TEAM1$/i.test(catalogName)) return 'Забьёт команда 1';
  if (/^GOALS_TEAM2$/i.test(catalogName)) return 'Забьёт команда 2';
  if (/^WINNER_YES_NO$/i.test(catalogName)) return 'Победа: да/нет';
  if (/^GOAL_RANGE/i.test(catalogName)) {
    if (/TEAM1/i.test(catalogName)) return 'Диапазон голов (хозяева)';
    if (/TEAM2/i.test(catalogName)) return 'Диапазон голов (гости)';
    return 'Диапазон голов';
  }
  if (/^EXACT_GOALS/i.test(catalogName)) {
    if (/тайм/i.test(category)) return category;
    if (/TEAM1/i.test(catalogName)) return 'Точное число голов (хозяева)';
    if (/TEAM2/i.test(catalogName)) return 'Точное число голов (гости)';
    return 'Точное число голов';
  }

  if (isPeriodTabCategory(category)) return category;

  const mk = baseMarketKey(marketKey);

  if ((mk === 'h2h' || /^MATCH_WINNER/i.test(catalogName)) && !/^WINNER_YES_NO$/i.test(catalogName)) return '1X2';
  if (
    (mk === 'double_chance' && !marketKey.startsWith('display_'))
    || (catalogName.startsWith('DOUBLE_CHANCE') && !marketKey.startsWith('display_'))
  ) {
    return 'Двойной шанс';
  }
  if (mk === 'handicap' || mk === 'handicap_3way' || /^HANDICAP/i.test(catalogName)) {
    return isHandicapOtScope(catalogName, marketKey) ? 'Фора (с ОТ)' : 'Фора';
  }
  if (mk === 'btts' || mk === 'goals_both_min' || /^GOALS_BOTH/i.test(catalogName)) {
    if (/обоих\s+тайм/i.test(category)) return 'Гол в обоих таймах';
    return 'Обе забьют';
  }
  // Only canonical totals_* keys — not specialty TOTAL_GOALS_MINUTES / TOTAL_FOULS_* (display_*).
  if (mk === 'totals' || mk === 'totals_home' || mk === 'totals_away') {
    if (/^TOTAL_MAP$/i.test(catalogName) && /^\d+-я карта$/i.test(category)) {
      return category;
    }
    if (/^INDIVIDUAL_TOTAL_TEAM[12]_MAP$/i.test(catalogName) && /индивидуальный тотал/i.test(category)) {
      return category;
    }
    if (/^TOTAL_ROUNDS$/i.test(catalogName)) return 'Тотал раундов';
    if (/^INDIVIDUAL_TOTAL_TEAM[12]_ROUNDS$/i.test(catalogName)) return 'Индивидуальный тотал по раундам';
    // Keep Olimpbet virtual names: injury time, asian half totals, 3-way half, etc.
    // Never leave TOTAL_ASIAN / 3-way under plain «Тотал» (looks like basketball lines).
    if (/^TOTAL_ASIAN(_HALF)?$/i.test(catalogName)) {
      if (/азиатск/i.test(category)) return category.trim();
      return 'Азиатский тотал';
    }
    if (/^TOTAL(_HALF)?_3WAY$/i.test(catalogName)) {
      if (/3\s*исход/i.test(category)) return category.trim();
      return 'Тотал (3 исхода)';
    }
    if (
      /компенсирован|добавленн|азиатск|3\s*исход|add_?time|asian/i.test(category)
      || /компенсирован|добавленн|азиатск|3\s*исход/i.test(catalogName)
      || /^TOTAL_ADD_TIME/i.test(catalogName)
    ) {
      if (category.trim()) return category;
    }
    if (/TEAM_TOTAL|INDIVIDUAL_TOTAL/i.test(catalogName) || /индивид/i.test(category)) {
      return /_WITH_?OT$/i.test(catalogName) ? 'Индивидуальный тотал (с ОТ)' : 'Индивидуальный тотал';
    }
    if (/чет\/?нечет|even/i.test(category + catalogName)) return 'Тотал (Чет/Нечет)';
    // Half/quarter already resolved to period tab — keep there (not generic Тотал).
    if (isPeriodTabCategory(category)) return category;
    return /_WITH_?OT$/i.test(catalogName) ? 'Тотал (с ОТ)' : 'Тотал';
  }
  if (mk === 'even_odd' || /^EVEN_ODD/i.test(catalogName)) {
    return /_WITH_?OT$/i.test(catalogName) ? 'Тотал (Чет/Нечет, с ОТ)' : 'Тотал (Чет/Нечет)';
  }
  if (/^NEXT_POINTS_GAME|^RACE_TO_POINT_GAME/i.test(catalogName)) {
    return MARKET_CODE_TO_CATEGORY[catalogName] ?? 'Следующее очко в гейме';
  }
  if (/^DEUSE_POINT/i.test(catalogName) || /ровно.*40:40/i.test(category)) return '40:40';
  if (/^GOAL15MIN/i.test(catalogName)) return 'Гол в интервале';
  if (/^NEXT_GOAL_TIME/i.test(catalogName)) {
    return category.trim() || humanizeCatalogMarketName(catalogName);
  }
  if (/^NEXT_GOAL_HALF|^NEXT_GOAL_PERIOD|^NEXT_GOAL_EXTRA|^NEXT_GOALSCORER|^NEXT_GOAL_MIN/i.test(catalogName)) {
    return category.trim() || humanizeCatalogMarketName(catalogName);
  }
  if (/^NEXT_GOAL$/i.test(catalogName) || /^NEXT_GOAL_2WAY/i.test(catalogName)) {
    return 'Следующий гол';
  }
  if (/следующ.*очк|очко.*гейм/i.test(category)) return category;
  if (/следующ/i.test(category) && /гол/i.test(category) && !/когда/i.test(category)) {
    return 'Следующий гол';
  }
  if (/^NUMBER_OF_SETS/i.test(catalogName) || /NUMBER_OF_SETS/i.test(marketKey)) {
    return 'Количество сетов';
  }
  if (/^SCORING_EVENTS/i.test(catalogName)) {
    if (/[а-яё]/i.test(category) && category !== catalogName) return category;
    return 'Голевые факты (Да/Нет)';
  }
  if (/^OWNGOAL/i.test(catalogName)) {
    if (/[а-яё]/i.test(category) && category !== catalogName) return category;
    return 'Автогол в матче';
  }
  if (/^NUMBER_FINAL/i.test(catalogName)) {
    if (/[а-яё]/i.test(category) && category !== catalogName) return category;
    return 'Цифра в итоговом счёте (Да/Нет)';
  }
  if (/^SCORE_SET/i.test(catalogName)) return category;
  if (/^WINNER_2GAMES/i.test(catalogName)) {
    return MARKET_CODE_TO_CATEGORY[catalogName] ?? 'Исход двух геймов';
  }
  if (/^CORRECT_SCORE|^SCORE_VARIANT/i.test(catalogName) || /точн/i.test(category)) return 'Точный счёт';

  if (/^[A-Z][A-Z0-9_]+$/.test(catalogName) && catalogName.includes('_')) {
    if (/[а-яё]/i.test(category) && category !== catalogName) return category;
    return humanizeCatalogMarketName(catalogName);
  }

  if (/^[A-Z][A-Z0-9_]+$/.test(category) && category.includes('_')) {
    return humanizeCatalogMarketName(category);
  }

  const lower = category.toLowerCase();
  if (lower === 'исход матча') return '1X2';
  if (lower.includes('европейск') || lower.includes('3 исход')) return 'Фора';

  return category;
}

function normalizeOutcomeDisplayName(
  name: string,
  catalog: OlimpbetMarketCatalog,
  marketId: number,
  outcomeTypeId: number,
  homeTeam: string,
  awayTeam: string,
  line?: string,
): string {
  const market = catalog.markets.get(marketId);
  const outcome = market?.outcomes.get(outcomeTypeId);
  const code = outcome?.code ?? '';
  const catalogMarketName = market?.name ?? '';
  let label = substituteCompetitorLabels(name, homeTeam, awayTeam).trim();

  // Olimpbet ships the "any other" bucket of enumerated markets (correct score,
  // exact points, …) as an unresolved template with empty brackets and no value
  // to substitute — e.g. "ТочныйСчет[]", "ТКолОчк ГеймСет[]". Without this guard
  // the raw template string leaks to bettors as an outcome name. Present it as a
  // readable "other" bucket instead.
  const hasEmptyTemplate = /\[\s*\]|\{\s*\}/.test(name);
  const hasSubstitutionValue = line != null && String(line).trim() !== '';
  if (hasEmptyTemplate && !hasSubstitutionValue) {
    const ctx = `${name} ${code} ${catalogMarketName}`;
    if (/CORRECT_SCORE|SCORE_VARIANT|точн\w*\s*сч[её]т|точныйсч[её]т/i.test(ctx)) {
      return 'Другой счёт';
    }
    return 'Другое';
  }

  label = label.replace(/\[\]/g, line ?? '').replace(/\{\}/g, line ?? '').trim();

  const resulting = formatResultingComparisonLabel(
    code,
    outcome?.name,
    outcome?.shortName ?? label,
    catalogMarketName,
  );
  if (resulting) return resulting;

  if (/^([ПP][12])_(да|нет)$/i.test(code)) {
    const side = code.charAt(0).replace(/P/i, 'П') + code.charAt(1);
    const yn = code.split('_')[1]?.toLowerCase();
    if (yn) return `${side}: ${yn}`;
  }
  if (/^ничья_в_матче(_(да|нет))?$/i.test(code.replace(/\s/g, ''))) {
    const yn = code.match(/_(да|нет)$/i)?.[1]?.toLowerCase();
    return yn ? `Ничья: ${yn}` : 'Ничья';
  }

  const goalRangeCode = /^К([12])[_-](\d+)[_-](\d+)/i.exec(code);
  if (goalRangeCode) {
    return `П${goalRangeCode[1]}: ${goalRangeCode[2]}–${goalRangeCode[3]}`;
  }
  const comboTotalCode = /^(?:WINX2|X2|WIN1|WIN2|1X|12|X2).*TOTAL.*?([\d.]+)[_-]([БМ])$/i.exec(code.replace(/\s/g, ''));
  if (comboTotalCode) {
    const side = comboTotalCode[2]!.toUpperCase() === 'Б' ? 'больше' : 'меньше';
    return `${comboTotalCode[1]} — ${side}`;
  }

  const winningMethod = formatWinningMethodOutcome(code);
  if (winningMethod) return winningMethod;

  const nextGoal = formatNextGoalOutcome(code);
  if (nextGoal) return nextGoal;

  const bttsOutcome = formatBttsAndOutcomeCode(code);
  if (bttsOutcome) return bttsOutcome;

  const firstGoalWinner = formatFirstGoalAndWinnerCode(code);
  if (firstGoalWinner) return firstGoalWinner;

  const esportsMapTeam = formatEsportsMapTeamOutcome(code, catalogMarketName);
  if (esportsMapTeam) return esportsMapTeam;

  const compactLabel = label.replace(/\s/g, '');
  if (/ПерКр_?Карта1|ПерБаш_?Карта1|Барак_?КартаП1|Рош_?КартаП1/i.test(compactLabel)) return 'П1';
  if (/ПерКр_?Карта2|ПерБаш_?Карта2|Барак_?КартаП2|Рош_?КартаП2/i.test(compactLabel)) return 'П2';

  if (/^К1$/i.test(label) || /^К1\b/i.test(label) || (/^К1_/i.test(code) && !/^К1[_-]\d/.test(code) && !/^ПерГ1_/i.test(code))) return 'П1';
  if (/^К2$/i.test(label) || /^К2\b/i.test(label) || (/^К2_/i.test(code) && !/^К2[_-]\d/.test(code) && !/^ПерГ2_/i.test(code))) return 'П2';
  if (/^П1$/i.test(code)) return 'П1';
  if (/^П2$/i.test(code)) return 'П2';
  if (code === 'Х' || code === 'X') return 'X';

  const teamYesNo = /^([ПP][12])\s*:\s*(да|нет)$/i.exec(label);
  if (teamYesNo) {
    const side = teamYesNo[1]!.replace(/P/i, 'П');
    return `${side}: ${teamYesNo[2]!.toLowerCase()}`;
  }
  if (/^ничья\s+в\s+матче\s*:\s*(да|нет)$/i.test(label)) {
    const yn = label.match(/:\s*(да|нет)$/i)?.[1]?.toLowerCase();
    return yn ? `Ничья: ${yn}` : 'Ничья';
  }
  if (/^ничья\s+в\s+матче$/i.test(label)) return 'Ничья';

  if (/^SCORE\s+AFTER/i.test(label)) {
    if (/не\s*будет/i.test(label)) return 'Не будет';
    const score = label.match(/(\d+:\d+)/);
    if (score) return score[1]!;
  }

  const halfWinCode = /^(П1ОбеПол|П2ОбеПол|П1Пол|П2Пол|НичьяПол)(Да|Нет)$/i.exec(code.replace(/\s/g, ''));
  if (halfWinCode) {
    const prefix = /^Ничья/i.test(halfWinCode[1]!) ? 'Х' : halfWinCode[1]!.slice(0, 2);
    const yn = halfWinCode[2]!.charAt(0).toUpperCase() + halfWinCode[2]!.slice(1).toLowerCase();
    return `${prefix}-${yn}`;
  }

  if (/^Ф1/i.test(code) || /^Ф1/i.test(label)) {
    const suffix = line ? ` (${line})` : '';
    return `Ф1${suffix}`.trim();
  }
  if (/^Ф2/i.test(code) || /^Ф2/i.test(label)) {
    const suffix = line ? ` (${line})` : '';
    return `Ф2${suffix}`.trim();
  }
  if (/^1[ХX]$/i.test(label.replace(/\s/g, ''))) return '1X';
  if (/^[ХX]2$/i.test(label.replace(/\s/g, ''))) return 'X2';
  if (label === '12') return '12';
  if (/^т[бм]$/i.test(label)) return label.toUpperCase();
  if (/тм/i.test(code) || /_М$/i.test(code) || /_М_/i.test(code)) return 'ТМ';
  if (/тб/i.test(code) || /_Б$/i.test(code) || /_Б_/i.test(code)) return 'ТБ';
  if (/^ровно$/i.test(label)) return 'Ровно';
  if (/никто/i.test(label) || /no\s*goal/i.test(label)) return 'Никто';
  if (/небудет/i.test(label.replace(/\s/g, '')) || /_небудет/i.test(code)) return 'Не будет';
  if (/^ОчкоП1/i.test(code)) return 'П1';
  if (/^ОчкоП2/i.test(code)) return 'П2';
  if (/^да\s*\(/i.test(label)) return 'Да';
  if (/^нет\s*\(/i.test(label)) return 'Нет';
  const setWinYesNo = /^К([12]).*?(\d+).*?сет.*?(да|нет)$/i.exec(
    code.replace(/\s/g, '').replace(/об/g, 'ob'),
  );
  if (setWinYesNo) {
    return setWinYesNo[3]!.charAt(0).toUpperCase() + setWinYesNo[3]!.slice(1).toLowerCase();
  }
  if (/^К1.*1.*сет/i.test(code.replace(/\s/g, ''))) {
    if (/нет/i.test(code)) return 'Нет';
    if (/да/i.test(code)) return 'Да';
  }
  if (/^К2.*1.*сет/i.test(code.replace(/\s/g, ''))) {
    if (/нет/i.test(code)) return 'Нет';
    if (/да/i.test(code)) return 'Да';
  }
  if (/^перфакт/i.test(label.replace(/\s/g, ''))) {
    const stripped = label
      .replace(/^перфакт\d*мин_?\s*/i, '')
      .replace(/^перфакт_?\s*/i, '')
      .trim();
    if (stripped) return stripped;
  }
  if (/^\d+:\d+$/.test(label)) return label;
  if (/точный\s*сч/i.test(label.replace(/\s/g, ''))) {
    const score = humanizeFallbackOutcomeCode(code);
    if (score && score.includes(':') && !/[\[\]{}]/.test(score)) return score;
    const stripped = label.replace(/точный\s*сч[её]т/i, '').trim();
    if (/^\d+:\d+$/.test(stripped)) return stripped;
    // Catch-all "any other score" bucket ships as an unresolved template
    // (code "ТочныйСчет[]"); never leak the raw template to bettors.
    return 'Другой счёт';
  }

  // Scope fragments ("3-м сете", "2-й гейм") must never appear as outcome names —
  // they belong on the group/category. Treat a pure scope label as the catch-all
  // bucket of an enumerated score book.
  if (/^\d+\s*[-–—]?\s*м\s+сет[еу]?$/i.test(label) || /^\d+\s*[-–—]?\s*[йи]\s+гейм$/i.test(label)) {
    return /сч[её]т|score|тай-?брейк/i.test(`${code} ${catalogMarketName}`) ? 'Другой счёт' : 'Другое';
  }

  label = label
    .replace(/DISPLAY_\d+_\d+_[A-Z0-9_|]+/gi, '')
    .replace(/PARAMETER_[A-Z_]+:[^|]+/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^\d+:\d+$/.test(label)) return label;

  if (!label || (/^[\d_|:|-]+$/.test(label) && !/^\d+:\d+$/.test(label))) {
    const fallback = humanizeFallbackOutcomeCode(code);
    if (fallback && /^\d+:\d+$/.test(fallback)) return fallback;
    // Enumerated markets (correct score, exact points, …) share one template
    // code ("ТочныйСчет[]") across all outcomes; the real value lives in `name`.
    // A non-score sentinel name ("-1:-1", "-1") is the "any other" bucket — surface
    // it as a readable label instead of leaking the template code.
    if (/\[\s*\]|\{\s*\}/.test(code)) {
      return /сч[её]т|score/i.test(`${code} ${catalogMarketName}`) ? 'Другой счёт' : 'Другое';
    }
    return fallback || '—';
  }

  if (/[\[\]{}]|перхгейм/i.test(label)) {
    const score = code.match(/(\d+)_(\d+)(?:_\d+)?$/);
    if (score) return `${score[1]}:${score[2]}`;
    if (/\[\s*\]|\{\s*\}/.test(code)) {
      return /сч[её]т|score/i.test(`${code} ${catalogMarketName}`) ? 'Другой счёт' : 'Другое';
    }
    return '—';
  }

  // Enumerated markets share one template code across all outcomes; resolved
  // outcomes carry a value in `name`, but the "any other" bucket falls back to the
  // template text itself (e.g. name "ТКолОчк_ГеймСет", code "ТКолОчк_ГеймСет[]").
  // Detect that exact case and surface a readable "other" label.
  if (/\[\s*\]|\{\s*\}/.test(code)) {
    const codeText = code.replace(/\[\s*\]|\{\s*\}/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (codeText && label.replace(/\s+/g, ' ').trim() === codeText) {
      return /сч[её]т|score/i.test(`${code} ${catalogMarketName}`) ? 'Другой счёт' : 'Другое';
    }
  }

  return label;
}

function humanizeFallbackOutcomeCode(code: string): string {
  // Strip Olimpbet's empty template markers ("ТочныйСчет[]" → "ТочныйСчет") so a
  // raw, unresolved template never leaks to bettors as an outcome name.
  const trimmed = code.replace(/\[\s*\]|\{\s*\}/g, '').trim();
  if (!trimmed) return '';
  if (/^П[12]$/.test(trimmed)) return trimmed;
  if (trimmed === 'Х' || trimmed === 'X') return 'X';
  if (/^Ф[12]/.test(trimmed)) return trimmed.split(/\s/)[0] ?? trimmed;
  if (/^К[12]/.test(trimmed)) return trimmed.startsWith('К1') ? 'П1' : 'П2';
  if (/^\d+:\d+$/.test(trimmed)) return trimmed;
  if (/^\d+_\d+$/.test(trimmed)) {
    const [home, away] = trimmed.split('_');
    const fmt = (part: string) => (part === '50' ? 'A' : part);
    return `${fmt(home)}:${fmt(away)}`;
  }
  return trimmed.replace(/_/g, ' ');
}

function substituteCompetitorLabels(label: string, homeTeam: string, awayTeam: string): string {
  return label
    .replace(/\{\$competitor1\}/gi, homeTeam)
    .replace(/\{\$competitor2\}/gi, awayTeam)
    .replace(/\{competitor1\}/gi, homeTeam)
    .replace(/\{competitor2\}/gi, awayTeam);
}

function eventTeamNames(detail: OlimpbetEventDetail): { homeTeam: string; awayTeam: string } {
  const comps = detail.competitors ?? [];
  const home = comps[0]?.name ?? '';
  const away = comps[1]?.name ?? '';
  return { homeTeam: home, awayTeam: away };
}

function quarterCategoryLabel(quarter: string): string {
  const labels: Record<string, string> = {
    '1': '1-я четверть',
    '2': '2-я четверть',
    '3': '3-я четверть',
    '4': '4-я четверть',
  };
  return labels[quarter] ?? `${quarter}-я четверть`;
}

function setCategoryLabel(setNum: string): string {
  const labels: Record<string, string> = {
    '1': '1-й сет',
    '2': '2-й сет',
    '3': '3-й сет',
    '4': '4-й сет',
    '5': '5-й сет',
  };
  return labels[setNum] ?? `${setNum}-й сет`;
}

/** Readable category keys from Olimpbet virtual categories (tennis tiebreak, etc.). */
function normalizeResolvedCategoryName(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return trimmed;

  const tiebreakSet = /^очки\s+в\s+тай-?брейке\s+(\d+)\s*[-–—]?\s*[йи]\s+сет$/i.exec(trimmed);
  if (tiebreakSet) return `${setCategoryLabel(tiebreakSet[1]!)} · Тай-брейк`;
  if (/^очки\s+в\s+тай-?брейке$/i.test(trimmed)) return 'Тай-брейк';

  const tiebreakFirst = /^(\d+)\s*[-–—]?\s*[йи]\s+сет\s*[,·•]\s*тай-?брейк$/i.exec(trimmed);
  if (tiebreakFirst) return `${setCategoryLabel(tiebreakFirst[1]!)} · Тай-брейк`;

  const scoreGameSet = /^сч[её]т\s+в\s+гейме\s*[,·•]?\s*(\d+)\s*[-–—]?\s*[йи]\s+сет/i.exec(trimmed);
  if (scoreGameSet) return `${setCategoryLabel(scoreGameSet[1]!)} · Счёт в гейме`;

  const nextPoint = /^следующ.*очк.*(?:[,·•]\s*)?(\d+)\s*[-–—]?\s*[йи]\s+сет/i.exec(trimmed);
  if (nextPoint) return `${setCategoryLabel(nextPoint[1]!)} · Следующее очко`;

  const marketThenSet = /^(.+?)\s+(\d+)\s*[-–—]?\s*[йи]\s+сет$/i.exec(trimmed);
  if (marketThenSet && !/^\d+-[йи]\s+сет$/i.test(trimmed)) {
    const setLabel = setCategoryLabel(marketThenSet[2]!);
    const market = marketThenSet[1]!.trim();
    if (/^очки\s+в\s+тай-?брейке$/i.test(market)) return `${setLabel} · Тай-брейк`;
    if (/^сч[её]т\s+в\s+гейме$/i.test(market)) return `${setLabel} · Счёт в гейме`;
    if (/^следующ/i.test(market) && /очк/i.test(market)) return `${setLabel} · Следующее очко`;
  }

  return trimmed;
}

function resolveExactGoalsCategory(catalogName: string, half?: string): string | null {
  if (!/^EXACT_GOALS/i.test(catalogName)) return null;

  let base = 'Точное число голов';
  if (/TEAM1/i.test(catalogName)) base = 'Точное число голов (хозяева)';
  else if (/TEAM2/i.test(catalogName)) base = 'Точное число голов (гости)';

  if (half === '1') return `${base} (1-й тайм)`;
  if (half === '2') return `${base} (2-й тайм)`;

  return base;
}

function resolveCategory(
  catalog: OlimpbetMarketCatalog,
  marketId: number,
  catalogName: string,
  sectionLabel: string,
  isMainEvent: boolean,
  parameters?: OlimpbetProbability['parameters'],
): string {
  if (!isMainEvent && sectionLabel) return sectionLabel;

  if (/^NUMBER_OF_SETS/i.test(catalogName)) return 'Количество сетов';

  if (/^SERIESPENALTY/i.test(catalogName)) return 'Серия пенальти';
  if (/^NO_GOALS_IN_BOTH_HALF/i.test(catalogName)) return 'Никто не забьет в обоих таймах';

  const setNum = paramValue(parameters, 'PARAMETER_SET_NUMBER');
  if (/^RACE_TO_GAME/i.test(catalogName)) {
    if (setNum) return setCategoryLabel(setNum);
    return 'Гонка по геймам';
  }

  const half = paramValue(parameters, 'PARAMETER_HALF_NUMBER');
  const exactGoalsCategory = resolveExactGoalsCategory(catalogName, half);
  if (exactGoalsCategory) return exactGoalsCategory;

  if (/_YES_NO$/i.test(catalogName)) {
    const fromCatalog = resolveYesNoMarketLabelFromCatalog(catalog, marketId);
    if (fromCatalog) return fromCatalog;
    const labeled = resolveYesNoMarketLabel(catalogName);
    if (labeled) return labeled;
  }

  const virtualCategory = resolveVirtualCategoryName(catalog, marketId, parameters);
  if (virtualCategory) {
    if (/специальн/i.test(virtualCategory) && /_YES_NO$/i.test(catalogName)) {
      const fromCatalog = resolveYesNoMarketLabelFromCatalog(catalog, marketId);
      if (fromCatalog) return fromCatalog;
      const labeled = resolveYesNoMarketLabel(catalogName)
        ?? humanizeCatalogMarketName(catalogName, parameters);
      if (/[а-яё]/i.test(labeled) && labeled !== catalogName) return labeled;
    }
    let resolved = normalizeResolvedCategoryName(virtualCategory);
    if (catalogName.startsWith('DOUBLE_CHANCE')) {
      const from = paramValue(parameters, 'PARAMETER_FROM');
      const to = paramValue(parameters, 'PARAMETER_TO');
      if (from !== undefined && to !== undefined && !/\(\s*\d+\s*[–-]\s*\d+\s*мин\s*\)/i.test(resolved)) {
        resolved = `Двойной шанс (${from}–${to} мин)`;
      }
    }
    return resolved;
  }

  if (/^SCORING_EVENTS/i.test(catalogName)) return 'Голевые факты (Да/Нет)';
  if (/^OWNGOAL/i.test(catalogName)) return 'Автогол в матче';
  const numberFinalCategory = resolveNumberFinalScoreCategoryName(catalogName, parameters);
  if (numberFinalCategory) return numberFinalCategory;

  const quarter = paramValue(parameters, 'PARAMETER_QUARTER_NUMBER');
  if (quarter) return quarterCategoryLabel(quarter);

  if (/^MULTISCORE/i.test(catalogName)) {
    if (setNum) return setCategoryLabel(setNum);
    return 'Мультисчёт сета';
  }

  if (setNum) {
    if (/^TOTAL|^COUNT_SET|^TOTAL_SET|^HANDICAP|^EVEN_ODD|^SCORE_SET|^WINNER_GAME|^WINNER_SET|^MULTISCORE/i.test(catalogName)) {
      return setCategoryLabel(setNum);
    }
    if (/WIN\d+_AND_TOTAL|WINX2_AND_TOTAL|X2_AND_TOTAL/i.test(catalogName)) {
      return 'Результат + тотал';
    }
  }

  if (half === '1') return '1-й тайм';
  if (half === '2') return '2-й тайм';

  if (/WIN\d+_AND_TOTAL|WINX2_AND_TOTAL|X2_AND_TOTAL/i.test(catalogName)) return 'Результат + тотал';

  const raw = catalogMarketLabel(catalog, marketId);
  const mapped = MARKET_CODE_TO_CATEGORY[catalogName];
  if (catalogName.startsWith('DOUBLE_CHANCE') && isScopedPeriodMarket(parameters)) {
    const from = paramValue(parameters, 'PARAMETER_FROM');
    const to = paramValue(parameters, 'PARAMETER_TO');
    if (from !== undefined && to !== undefined) return `Двойной шанс (${from}–${to} мин)`;
  }
  if (mapped === 'Двойной шанс' || catalogName.startsWith('DOUBLE_CHANCE')) {
    const from = paramValue(parameters, 'PARAMETER_FROM');
    const to = paramValue(parameters, 'PARAMETER_TO');
    if (from !== undefined && to !== undefined) return `Двойной шанс (${from}–${to} мин)`;
  }
  if (mapped) return mapped;

  if (/^GOAL15MIN/i.test(catalogName)) {
    return 'Гол в интервале';
  }

  const humanized = humanizeCatalogMarketName(catalogName, parameters);
  if (humanized !== catalogName) return humanized;

  const rawLower = raw.toLowerCase();
  if (rawLower.includes('тотал') && !rawLower.includes('индивиду')) return 'Тотал';
  if (rawLower.includes('фор') || rawLower.includes('гандикап')) return 'Фора';
  if (rawLower.includes('следующ') && rawLower.includes('очк')) return 'Следующее очко в гейме';
  if (rawLower.includes('следующий гол')) return 'Следующий гол';

  return raw;
}

function buildScoreInGameGroupLabel(
  category: string,
  marketKey: string,
  setNum?: string,
  gameNum?: string,
): string | null {
  const catalogStem = marketKey.replace(/^display_/i, '');
  if (/^RACE_TO_GAME|^RACE_TO_POINT/i.test(catalogStem)) return null;
  if (!gameNum && !setNum) return null;
  if (
    !/\d+-[йи]\s+гейм/i.test(category)
    && !/сч[её]т\s+в\s+гейме/i.test(category)
    && !/^SCORE_SET|^EXACT_POINT_GAME_SET|^SCORE_FIRST_X_GAMES/i.test(catalogStem)
  ) {
    return null;
  }

  const parts: string[] = [];
  if (setNum && !/\d+-й\s*сет/i.test(category) && !category.includes('сете')) {
    parts.push(`${setNum}-й сет`);
  }
  if (gameNum && !/\d+-й\s*гейм/i.test(category)) {
    parts.push(`${gameNum}-й гейм`);
  }

  return parts.length ? parts.join(', ') : null;
}

/** Genitive unit for linked stat sections (corners/fouls/…), not match goals. */
function totalsUnitFromStatCategory(category: string): string | null {
  const name = category.trim().toLowerCase();
  if (!name) return null;

  if (/^углов/.test(name)) return 'угловых';
  if (/^желт/.test(name)) return 'жёлтых карточек';
  if (/^фол/.test(name)) return 'фолов';
  if (/^офсайд/.test(name)) return 'офсайдов';
  if (/^аут/.test(name)) return 'аутов';
  if (/удар.*створ/.test(name)) return 'ударов в створ';
  if (/удар.*от\s+ворот/.test(name)) return 'ударов от ворот';
  if (/удар.*по\s+ворот|^удары$/.test(name)) return 'ударов';
  if (/штанг|перекладин/.test(name)) return 'штанг';
  if (/^сейв/.test(name)) return 'сейвов';
  if (/^замен/.test(name)) return 'замен';
  if (/видеопросмотр|var/i.test(name)) return 'видеопросмотров';
  if (/^перехват/.test(name)) return 'перехватов';
  if (/успешн.*обвод/.test(name)) return 'успешных обводок';
  if (/успешн.*отбор/.test(name)) return 'успешных отборов';
  if (/%\s*точн|точн.*передач/.test(name)) return 'точных передач';
  if (/касани.*вратар/.test(name)) return 'касаний мяча вратарём';
  if (/ожидаем|xg/i.test(name)) return 'ожидаемых голов (xG)';
  if (/верхов|единоборств/.test(name)) return 'верховых единоборств';
  if (/мед\.?\s*бригад|медицин/.test(name)) return 'выходов мед.бригады';
  if (/^эйс/.test(name)) return 'эйсов';
  if (/двойн.*ошиб/.test(name)) return 'двойных ошибок';
  if (/^брейк/.test(name)) return 'брейков';

  return null;
}

/** Period totals unit by Olimpbet sport (half/quarter). Soccer ≠ basketball. */
function periodTotalsUnitForSportId(sportId?: number | null): string {
  const slug = sportId != null ? olimpbetSportIdToSlug(sportId) : 'soccer';
  switch (slug) {
    case 'basketball':
    case 'cyber-basketball':
    case 'volleyball':
    case 'table-tennis':
      return 'очков';
    case 'tennis':
      return 'геймов';
    case 'mma':
      return 'раундов';
    case 'soccer':
    case 'hockey':
    case 'cyber-football':
    default:
      return 'голов';
  }
}

function resolveTotalsUnitLabel(
  catalogName: string,
  category: string,
  mapNum?: string,
  gameNum?: string,
  setNum?: string,
  half?: string,
  quarter?: string,
  sportId?: number | null,
): string {
  if (/TOTAL_MAP|INDIVIDUAL_TOTAL_TEAM[12]_MAP/i.test(catalogName)) return 'раундов';
  if (/TOTAL_ROUNDS|INDIVIDUAL_TOTAL_TEAM[12]_ROUNDS/i.test(catalogName)) return 'раундов';
  if (mapNum) return 'раундов';
  if (/ADD_TIME|компенсирован|добавленн/i.test(`${catalogName} ${category}`)) return 'минут';
  if (sportId != null && isOlimpbetEsportsSportId(sportId) && /^TOTAL/i.test(catalogName) && !/MAP|ROUND/i.test(catalogName)) {
    return 'карт';
  }
  if (gameNum) return 'очков';
  if (setNum || /^\d+-[йи]\s+сет$/i.test(category)) return 'геймов';

  const statUnit = totalsUnitFromStatCategory(category);
  if (statUnit) return statUnit;

  if (half || quarter) return periodTotalsUnitForSportId(sportId);
  return periodTotalsUnitForSportId(sportId);
}

function buildScopedTotalsHandicapLabel(
  kind: 'totals' | 'handicap',
  category: string,
  marketKey: string,
  setNum?: string,
  gameNum?: string,
  half?: string,
  quarter?: string,
  line?: string,
  catalogName = '',
  sportId?: number | null,
  mapNum?: string,
): string {
  // Keep rich Olimpbet category titles (injury time, asian half, 3-way half).
  if (
    kind === 'totals'
    && (
      /компенсирован|добавленн|азиатск|3\s*исход/i.test(category)
      || /ADD_TIME|ASIAN|HALF_3WAY/i.test(catalogName)
    )
  ) {
    const head = category.trim() || `Тотал ${resolveTotalsUnitLabel(catalogName, category, mapNum, gameNum, setNum, half, quarter, sportId)}`;
    let titled = head;
    const base = baseMarketKey(marketKey);
    if (base === 'totals_home') titled = `П1 · ${titled}`;
    else if (base === 'totals_away') titled = `П2 · ${titled}`;
    return line ? `${titled} · ${line}` : titled;
  }

  const scopeParts: string[] = [];

  if (/^\d+-[йи]\s+сет$/i.test(category.trim())) {
    scopeParts.push(category.trim());
  } else if (setNum) {
    scopeParts.push(`${setNum}-й сет`);
  }

  if (/^\d+-я карта$/i.test(category.trim())) {
    scopeParts.push(category.trim());
  } else if (mapNum && !scopeParts.length) {
    scopeParts.push(`${mapNum}-я карта`);
  }

  if (gameNum && !/\d+-й\s*гейм/i.test(category)) {
    scopeParts.push(`${gameNum}-й гейм`);
  }

  if (!scopeParts.length && half) {
    scopeParts.push(half === '1' ? '1-й тайм' : '2-й тайм');
  }
  if (!scopeParts.length && quarter) {
    scopeParts.push(quarterCategoryLabel(quarter));
  }

  const unit = resolveTotalsUnitLabel(
    catalogName,
    category,
    mapNum,
    gameNum,
    setNum,
    half,
    quarter,
    sportId,
  );

  const prefix = kind === 'handicap'
    ? 'Фора'
    // Soccer/hockey: Olimpbet-style plain "Тотал" (not "Тотал голов")
    : (unit === 'голов' ? 'Тотал' : `Тотал ${unit}`);
  let head = scopeParts.length ? `${scopeParts.join(', ')} · ${prefix}` : prefix;

  const base = baseMarketKey(marketKey);
  // Team totals: always prefix side (cards/corners/ind. goals), not only "индивид" categories.
  if (kind === 'totals' && (base === 'totals_home' || base === 'totals_away')) {
    if (base === 'totals_home') head = `П1 · ${head}`;
    else head = `П2 · ${head}`;
  } else if (kind === 'totals' && /индивид/i.test(category)) {
    if (base === 'totals_home') head = `П1 · ${head}`;
    else if (base === 'totals_away') head = `П2 · ${head}`;
  }

  return line ? `${head} · ${line}` : head;
}

function halfScopeAlreadyInCategory(category: string, half: string): boolean {
  const normalized = category.trim().toLowerCase();
  if (half === '1') {
    return /1\s*[-–—]?\s*(?:й|м)\s+тайм/i.test(normalized)
      || /в\s+1\s*[-–—]?\s*м\s+тайм/i.test(normalized);
  }
  if (half === '2') {
    return /2\s*[-–—]?\s*(?:й|м)\s+тайм/i.test(normalized)
      || /во\s+2\s*[-–—]?\s*м\s+тайм/i.test(normalized);
  }
  return false;
}

/** True when category already names the set (nominative "1-й сет" or locative "в 1-м сете"). */
function setScopeAlreadyInCategory(category: string, setNum?: string | null): boolean {
  if (!setNum) return /\d+\s*[-–—]?\s*[йи]\s+сет|\d+\s*[-–—]?\s*м\s+сет/i.test(category);
  const n = String(setNum);
  return new RegExp(
    `(?:^|\\s)(?:в[о]?\\s+)?${n}\\s*[-–—]?\\s*(?:[йи]|м)\\s+сет`,
    'i',
  ).test(category);
}

function buildGroupLabel(
  category: string,
  marketKey: string,
  parameters?: OlimpbetProbability['parameters'],
  catalogName = '',
  sportId?: number | null,
): string {
  const line = paramValue(parameters, 'PARAMETER_VALUE');
  const half = paramValue(parameters, 'PARAMETER_HALF_NUMBER');
  const setNum = paramValue(parameters, 'PARAMETER_SET_NUMBER');
  const gameNum = paramValue(parameters, 'PARAMETER_GAME_NUMBER');
  const quarter = paramValue(parameters, 'PARAMETER_QUARTER_NUMBER');
  const mapNum = paramValue(parameters, 'PARAMETER_MAP_NUMBER');
  const roundNum = paramValue(parameters, 'PARAMETER_ROUND_NUMBER');
  const winningMargin = paramValue(parameters, 'PARAMETER_WINNING_MARGIN');
  const from = paramValue(parameters, 'PARAMETER_FROM');
  const to = paramValue(parameters, 'PARAMETER_TO');

  const pointNum = paramValue(parameters, 'PARAMETER_POINT_NUMBER');

  const catalogStem = marketKey.replace(/^display_/i, '');

  if (/специальн/i.test(category) && /^display_/i.test(marketKey)) {
    const marketHumanized = humanizeCatalogMarketName(catalogStem, parameters);
    if (/[а-яё]/i.test(marketHumanized) && marketHumanized !== catalogStem) {
      return marketHumanized;
    }
  }

  const resultingGroupLabel = resolveResultingGroupLabel(catalogStem);
  if (resultingGroupLabel !== null) return resultingGroupLabel;

  const comboGroupLabel = resolveComboDisplayGroupLabel(catalogStem);
  if (comboGroupLabel) {
    if (mapNum && /_TOTAL_MAP$/i.test(catalogStem)) {
      return `${mapNum}-я карта · ${comboGroupLabel}`;
    }
    return comboGroupLabel;
  }

  const specialBetsGroupLabel = resolveSpecialBetsGroupLabel(catalogStem, category);
  if (specialBetsGroupLabel !== null) return specialBetsGroupLabel;

  const scoringEventsLabel = resolveScoringEventsGroupLabel(catalogStem);
  if (scoringEventsLabel) return scoringEventsLabel;

  const cleanWinTeamSide = resolveCleanWinTeamSideGroupLabel(catalogStem);
  if (cleanWinTeamSide) return cleanWinTeamSide;

  const numberFinalScoreLabel = resolveNumberFinalScoreGroupLabel(catalogStem, parameters);
  if (numberFinalScoreLabel) return numberFinalScoreLabel;

  if (/^SCORE_AFTER/i.test(catalogStem)) {
    if (/сч[её]т\s+после/i.test(category)) return '';
    const labeled = humanizeCatalogMarketName(catalogStem, parameters);
    if (labeled && !/^SCORE AFTER/i.test(labeled)) return labeled;
  }

  if (/^FIRST_GOAL_AND|^LAST_GOAL_AND/i.test(catalogStem)) {
    if (/первый\s+гол|последний\s+гол/i.test(category)) return '';
  }

  const nextGoalGroupLabel = resolveNextGoalGroupLabel(catalogStem, parameters);
  if (nextGoalGroupLabel !== null) return nextGoalGroupLabel;

  if (/^RACE_TO_GAME/i.test(catalogStem)) {
    const target = paramValue(parameters, 'PARAMETER_NUMBER')
      ?? paramValue(parameters, 'PARAMETER_VALUE')
      ?? gameNum;
    const raceLabel = target ? `Гонка до ${target} геймов` : 'Гонка по геймам';
    if (setNum && !setScopeAlreadyInCategory(category, setNum)) {
      return `${setNum}-й сет · ${raceLabel}`;
    }
    return raceLabel;
  }

  const scoreInGameLabel = buildScoreInGameGroupLabel(category, marketKey, setNum, gameNum);
  if (scoreInGameLabel) return scoreInGameLabel;

  if (/^DEUSE_POINT/i.test(catalogStem)) {
    const parts: string[] = [];
    if (setNum && !setScopeAlreadyInCategory(category, setNum)) parts.push(`${setNum}-й сет`);
    if (gameNum) parts.push(`${gameNum}-й гейм`);
    return parts.length ? parts.join(', ') : '40:40';
  }

  if (/^WINNER_SET/i.test(catalogStem)) {
    if (gameNum && !/\d+-й\s*гейм/i.test(category)) return `${gameNum}-й гейм`;
    return '';
  }

  if (/^WINNER_MAP/i.test(catalogStem)) {
    if (/^\d+-я карта$/i.test(category.trim())) return '';
    return 'Победа на карте';
  }

  if (/^ROUNDS_WINNIGMARGIN_MAP/i.test(catalogStem)) {
    if (winningMargin) {
      const marginText = winningMargin.replace(/-/g, '–');
      if (/разниц/i.test(category)) return `Разница ${marginText} раундов`;
      return `Разница ${marginText} раундов`;
    }
    return '';
  }

  if (/^WINNER_ROUND$/i.test(catalogStem)) {
    const parts: string[] = [];
    if (mapNum && !/^\d+-я карта$/i.test(category.trim())) parts.push(`${mapNum}-я карта`);
    if (roundNum) parts.push(`${roundNum}-й раунд`);
    return parts.length ? parts.join(' · ') : '';
  }

  if (/^(FIRST_BLOOD|FIRST_TOWER|BARRACKS|ROSHAN|RACE_TO_KILL)_MAP/i.test(catalogStem)) {
    const humanized = humanizeCatalogMarketName(catalogStem, parameters);
    if (humanized && humanized.trim().toLowerCase() === category.trim().toLowerCase()) return '';
    if (humanized && humanized !== catalogStem) return humanized;
  }

  if (/^MULTISCORE/i.test(catalogStem)) {
    return '';
  }

  if (/^SCORE_TIE_BREAK|^TIE_BREAK_SET/i.test(catalogStem)) {
    // Category already carries set + "тай-брейк" (e.g. "Счет тай-брейка в 3-м сете",
    // "Тай-брейк во 2-м сете") — don't repeat it as a group sub-label.
    if (/тай-?брейк/i.test(category)) return '';
  }

  if (/^NUMBER_OF_SETS/i.test(catalogStem)) {
    return 'Количество сетов';
  }

  if (/следующ.*очк|NEXT_POINTS/i.test(category) && setNum && gameNum) {
    const parts = [`${setNum}-й сет`, `${gameNum}-й гейм`];
    if (pointNum) parts.push(`${pointNum}-е очко`);
    return parts.join(', ');
  }

  if (/^WINNER_2GAMES/i.test(catalogStem) && (setNum || gameNum)) {
    const parts: string[] = [];
    if (setNum && !setScopeAlreadyInCategory(category, setNum)) parts.push(`${setNum}-й сет`);
    if (gameNum && !/\d+-[йи]\s+гейм/i.test(category)) parts.push(`${gameNum}-й гейм`);
    return parts.join(', ');
  }

  const suffixParts = [
    half === '1' && !halfScopeAlreadyInCategory(category, '1') ? '1-й тайм'
      : half === '2' && !halfScopeAlreadyInCategory(category, '2') ? '2-й тайм'
        : null,
    quarter ? quarterCategoryLabel(quarter) : null,
    from != null && to != null ? `${from}–${to} мин` : null,
    line ? String(line) : null,
    setNum && !setScopeAlreadyInCategory(category, setNum) ? `${setNum}-й сет` : null,
    gameNum && !/\d+-[йи]\s+гейм/i.test(category) ? `${gameNum}-й гейм` : null,
  ].filter(Boolean);

  const displayCategory = /^[A-Z][A-Z0-9_]+$/.test(category) && category.includes('_')
    ? humanizeCatalogMarketName(category, parameters)
    : category;

  if (marketKey === 'h2h' && displayCategory === '1X2') return '1X2';
  if (baseMarketKey(marketKey) === 'double_chance') {
    return suffixParts.length ? `Двойной шанс ${suffixParts.join(' ')}` : 'Двойной шанс';
  }
  if (baseMarketKey(marketKey) === 'btts' || baseMarketKey(marketKey) === 'goals_both_min') return displayCategory;

  if (
    baseMarketKey(marketKey) === 'totals'
    || baseMarketKey(marketKey) === 'totals_home'
    || baseMarketKey(marketKey) === 'totals_away'
  ) {
    return buildScopedTotalsHandicapLabel(
      'totals',
      category,
      marketKey,
      setNum,
      gameNum,
      half,
      quarter,
      line ? String(line) : undefined,
      catalogName,
      sportId,
      mapNum,
    );
  }

  if (
    baseMarketKey(marketKey) === 'handicap'
    || baseMarketKey(marketKey) === 'handicap_3way'
  ) {
    return buildScopedTotalsHandicapLabel(
      'handicap',
      category,
      marketKey,
      setNum,
      gameNum,
      half,
      quarter,
      line ? String(line) : undefined,
      catalogName,
      sportId,
      mapNum,
    );
  }

  if (!suffixParts.length) {
    const bttsGroupLabel = resolveBttsOutcomeGroupLabel(catalogStem);
    if (bttsGroupLabel) return bttsGroupLabel;

    if (
      /^WINNER_AND_GOALS_BOTH$/i.test(catalogStem)
      || /^DOUBLECHANCE_AND_GOALS_BOTH$/i.test(catalogStem)
    ) {
      return displayCategory;
    }

    if (marketKey.startsWith('display_') && !/^WINNER_2GAMES/i.test(catalogStem)) {
      const marketHumanized = humanizeCatalogMarketName(catalogStem, parameters);
      if (
        marketHumanized !== catalogStem
        && !isTechnicalEnglishCatalogLabel(marketHumanized)
        && marketHumanized.trim().toLowerCase() !== category.trim().toLowerCase()
        && !(half && halfScopeAlreadyInCategory(category, half))
      ) {
        return marketHumanized;
      }
    }
    return displayCategory;
  }
  if (category.length > 24) return `${suffixParts.join(' ')}`.trim() || category;
  return `${category} ${suffixParts.join(' ')}`.trim();
}

function paramValue(
  parameters: OlimpbetProbability['parameters'] | undefined,
  type: string,
): string | undefined {
  return parameters?.find((p) => p.type === type)?.value;
}

function mapH2hOutcome(outcomeTypeId: number, catalog: OlimpbetMarketCatalog, marketId: number): string {
  const code = catalog.markets.get(marketId)?.outcomes.get(outcomeTypeId)?.code ?? '';
  if (code === 'П1' || code.includes('П1')) return 'HOME';
  if (code === 'Х' || code === 'X' || code.includes('Х')) return 'DRAW';
  if (code === 'П2' || code.includes('П2')) return 'AWAY';
  return `OUT_${outcomeTypeId}`;
}

function mapTotalsOutcome(outcomeTypeId: number, catalog: OlimpbetMarketCatalog, marketId: number, line: string): string {
  const code = catalog.markets.get(marketId)?.outcomes.get(outcomeTypeId)?.code ?? '';
  const norm = code.replace(/\s/g, '').toLowerCase();
  if (/^б$|^тб|^over|^больше/i.test(norm) || code.includes('Б')) return `OVER_${line}`;
  if (/^м$|^тм|^under|^меньше/i.test(norm) || code.includes('М')) return `UNDER_${line}`;
  return `TOTAL_${outcomeTypeId}_${line}`;
}

function mapEvenOddOutcome(outcomeTypeId: number, catalog: OlimpbetMarketCatalog, marketId: number): string {
  const code = catalog.markets.get(marketId)?.outcomes.get(outcomeTypeId)?.code ?? '';
  const norm = code.replace(/\s/g, '').toLowerCase();
  if (/нечет|odd/i.test(norm)) return 'ODD';
  if (/чет|even/i.test(norm)) return 'EVEN';
  return `EO_${outcomeTypeId}`;
}

function dedupeOutcomesByKey<T extends { outcomeKey: string; price: number }>(outcomes: T[]): T[] {
  const best = new Map<string, T>();
  for (const outcome of outcomes) {
    const prev = best.get(outcome.outcomeKey);
    if (!prev || outcome.price > prev.price) best.set(outcome.outcomeKey, outcome);
  }
  return [...best.values()];
}

function parseExactScoreLabel(name: string): { home: number; away: number } | null {
  const match = name.trim().match(/^(\d+):(\d+)$/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
}

function compareExactScoreOutcomes(
  left: { name: string },
  right: { name: string },
): number {
  const leftScore = parseExactScoreLabel(left.name);
  const rightScore = parseExactScoreLabel(right.name);
  if (!leftScore && !rightScore) return left.name.localeCompare(right.name, 'ru');
  if (!leftScore) return 1;
  if (!rightScore) return -1;

  const leftBucket =
    leftScore.home > leftScore.away ? 0 : leftScore.home === leftScore.away ? 1 : 2;
  const rightBucket =
    rightScore.home > rightScore.away ? 0 : rightScore.home === rightScore.away ? 1 : 2;
  if (leftBucket !== rightBucket) return leftBucket - rightBucket;

  if (leftBucket === 0) {
    if (leftScore.away !== rightScore.away) return leftScore.away - rightScore.away;
    return leftScore.home - rightScore.home;
  }
  if (leftBucket === 1) return leftScore.home - rightScore.home;
  if (leftScore.home !== rightScore.home) return leftScore.home - rightScore.home;
  return leftScore.away - rightScore.away;
}

function sortExactScoreOutcomes<T extends { name: string; point?: number }>(
  marketKey: string,
  catalogName: string,
  outcomes: T[],
): T[] {
  if (/NUMBER_OF_SETS/i.test(marketKey) || /^NUMBER_OF_SETS/i.test(catalogName)) {
    if (outcomes.length < 2) return outcomes;
    return [...outcomes].sort((a, b) => Number(a.point ?? 0) - Number(b.point ?? 0));
  }
  if (
    !/^CORRECT_SCORE|^SCORE_VARIANT|^SCORE_MAP$/i.test(catalogName)
    && !/CORRECT_SCORE|SCORE_VARIANT|SCORE_MAP|^display_SCORE/i.test(marketKey)
  ) {
    return outcomes;
  }
  if (outcomes.length < 2) return outcomes;
  return [...outcomes].sort(compareExactScoreOutcomes);
}

function mapBttsOutcome(outcomeTypeId: number, catalog: OlimpbetMarketCatalog, marketId: number): string {
  const code = catalog.markets.get(marketId)?.outcomes.get(outcomeTypeId)?.code ?? '';
  if (code.includes('Да')) return 'YES';
  if (code.includes('Нет')) return 'NO';
  return `BTTS_${outcomeTypeId}`;
}

function mapNextGoalTimeOutcome(outcomeTypeId: number, catalog: OlimpbetMarketCatalog, marketId: number): string {
  const code = catalog.markets.get(marketId)?.outcomes.get(outcomeTypeId)?.code ?? '';
  const compact = code.replace(/\s/g, '');
  if (/небудет/i.test(compact)) return 'NO';
  if (/слгол/i.test(compact)) return 'YES';
  return `NGT_${outcomeTypeId}`;
}

function mapYesNoOutcome(outcomeTypeId: number, catalog: OlimpbetMarketCatalog, marketId: number): string {
  const code = catalog.markets.get(marketId)?.outcomes.get(outcomeTypeId)?.code ?? '';
  if (code.includes('Да') || code.endsWith('_Да')) return 'YES';
  if (code.includes('Нет') || code.endsWith('_Нет')) return 'NO';
  return `YN_${outcomeTypeId}`;
}

function mapH3wOutcome(outcomeTypeId: number, catalog: OlimpbetMarketCatalog, marketId: number): string {
  const code = catalog.markets.get(marketId)?.outcomes.get(outcomeTypeId)?.code ?? '';
  const norm = code.replace(/\s/g, '').toUpperCase().replace(/Х/g, 'X');
  if (norm.startsWith('Ф1') || norm.startsWith('П1')) return 'HOME';
  if (norm === 'Х' || norm === 'X' || norm.includes('_Х')) return 'DRAW';
  if (norm.startsWith('Ф2') || norm.startsWith('П2')) return 'AWAY';
  return `H3W_${outcomeTypeId}`;
}

function mapHandicapOutcome(
  outcomeTypeId: number,
  catalog: OlimpbetMarketCatalog,
  marketId: number,
  line: string,
): string {
  const code = catalog.markets.get(marketId)?.outcomes.get(outcomeTypeId)?.code ?? '';
  const norm = code.replace(/\s/g, '').toUpperCase();
  if (norm.startsWith('Ф1') || norm.startsWith('П1') || norm === '1') {
    return `HOME_HCP_${line}`;
  }
  if (norm.startsWith('Ф2') || norm.startsWith('П2') || norm === '2') {
    return `AWAY_HCP_${line}`;
  }
  return `HCP_${outcomeTypeId}_${line}`;
}

function mapDcOutcome(
  outcomeTypeId: number,
  catalog: OlimpbetMarketCatalog,
  marketId: number,
  displayName?: string,
): string {
  const code = catalog.markets.get(marketId)?.outcomes.get(outcomeTypeId)?.code ?? '';
  const norm = code.replace(/\s/g, '').toUpperCase().replace(/Х/g, 'X');
  if (norm === '1X' || norm.endsWith('1X')) return 'DC_1X';
  if (norm === '12') return 'DC_12';
  if (norm === 'X2' || norm.endsWith('X2')) return 'DC_X2';

  const labelNorm = (displayName ?? '').replace(/\s/g, '').toUpperCase().replace(/Х/g, 'X');
  if (labelNorm === '1X') return 'DC_1X';
  if (labelNorm === '12') return 'DC_12';
  if (labelNorm === 'X2') return 'DC_X2';

  return `DC_${outcomeTypeId}`;
}

function isScopedPeriodMarket(parameters?: OlimpbetProbability['parameters']): boolean {
  return paramValue(parameters, 'PARAMETER_FROM') != null
    || paramValue(parameters, 'PARAMETER_TO') != null
    || paramValue(parameters, 'PARAMETER_HALF_NUMBER') != null
    || paramValue(parameters, 'PARAMETER_QUARTER_NUMBER') != null;
}

function parseMarketGroup(
  catalog: OlimpbetMarketCatalog,
  market: OlimpbetProbabilityMarket,
  sectionLabel: string,
  isMainEvent: boolean,
  homeTeam: string,
  awayTeam: string,
  sportId?: number | null,
  catalogLocale: 'ru' | 'en' = 'ru',
): Array<{ category: string; group: WcMarketGroup }> {
  const catalogMarket = catalog.markets.get(market.marketId);
  if (!catalogMarket) return [];
  if (isJunkSpecialtyCatalogName(catalogMarket.name)) return [];

  const eligible = market.probabilities.filter(
    (p) => !hasPlayerParam(p) && p.odd > 1,
  );
  if (!eligible.length) return [];

  const { marketKey: resolvedMarketKey } = resolveWcMarketKey(catalogMarket.name, isMainEvent);
  let baseKey =
    /_WITH_?OT$/i.test(catalogMarket.name) && !resolvedMarketKey.startsWith('display_')
      ? `${resolvedMarketKey}_ot`
      : resolvedMarketKey;

  const bySig = new Map<string, { marketKey: string; innerSig: string; probs: OlimpbetProbability[] }>();
  for (const p of eligible) {
    let marketKey = baseKey;
    if (
      baseMarketKey(marketKey) === 'double_chance'
      && isScopedPeriodMarket(p.parameters)
    ) {
      marketKey = `display_${catalogMarket.name}`;
    }
    const innerSig = marketGroupSig(marketKey, p);
    const bucketKey = `${marketKey}:::${innerSig}`;
    if (!bySig.has(bucketKey)) {
      bySig.set(bucketKey, { marketKey, innerSig, probs: [] });
    }
    bySig.get(bucketKey)!.probs.push(p);
  }

  const items: Array<{ category: string; group: WcMarketGroup }> = [];

  for (const { marketKey, innerSig, probs } of bySig.values()) {
    const rawCategory = resolveCategory(
      catalog,
      market.marketId,
      catalogMarket.name,
      sectionLabel,
      isMainEvent,
      probs[0].parameters,
    );
    let category = isMainEvent
      ? canonicalizeCategory(rawCategory, catalogMarket.name, marketKey)
      : rawCategory;
    category = normalizeResolvedCategoryName(category);
    // Prefer EN catalog/provider text when already Latin; otherwise map RU buckets.
    if (catalogLocale === 'en' && isMainEvent) {
      const preferred =
        rawCategory.trim()
        && !/[а-яё]/i.test(rawCategory)
        && !/^[A-Z][A-Z0-9_]+$/.test(rawCategory)
          ? rawCategory.trim()
          : category;
      category = localizeCategoryLabel(preferred, 'en');
    } else if (catalogLocale === 'en') {
      category = localizeCategoryLabel(category, 'en');
    }
    const line = probs[0].parameters?.find((p) => p.type === 'PARAMETER_VALUE')?.value;
    const groupLabel = buildGroupLabel(
      category,
      marketKey,
      probs[0].parameters,
      catalogMarket.name,
      sportId,
    );
    const groupKey = `${market.marketId}__${innerSig}`;

    const outcomes = probs.map((p) => {
      const probLine = paramValue(p.parameters, 'PARAMETER_VALUE');
      const rawName = formatOutcomeLabel(catalog, market.marketId, p);
      let name = normalizeOutcomeDisplayName(
        rawName,
        catalog,
        market.marketId,
        p.outcomeTypeId,
        homeTeam,
        awayTeam,
        probLine ?? line,
      );
      let outcomeKey = `OUT_${p.outcomeTypeId}`;
      const mk = baseMarketKey(marketKey);
      if (mk === 'h2h') outcomeKey = mapH2hOutcome(p.outcomeTypeId, catalog, market.marketId);
      else if ((mk === 'totals' || mk === 'totals_home' || mk === 'totals_away') && line) {
        outcomeKey = mapTotalsOutcome(p.outcomeTypeId, catalog, market.marketId, line);
        // Individual-total catalog codes sometimes carry team markers (П1/П2) instead of ТБ/ТМ.
        if (/^OVER_/i.test(outcomeKey)) name = 'ТБ';
        else if (/^UNDER_/i.test(outcomeKey)) name = 'ТМ';
      }
      else if (mk === 'even_odd') outcomeKey = mapEvenOddOutcome(p.outcomeTypeId, catalog, market.marketId);
      else if (mk === 'handicap' && line) {
        outcomeKey = mapHandicapOutcome(p.outcomeTypeId, catalog, market.marketId, line);
      }
      else if (mk === 'btts') outcomeKey = mapBttsOutcome(p.outcomeTypeId, catalog, market.marketId);
      else if (mk === 'handicap_3way') {
        outcomeKey = mapH3wOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (
        marketKey.startsWith('display_GOALS_BOTH')
        || marketKey.startsWith('display_GOALS_BOTHHALF')
      ) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (/TEAM1_WIN_EXACTLY|TEAM2_WIN_EXACTLY|SET_TEAM/i.test(catalogMarket.name)) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (/TEAM[12]_WIN_(BOTHPART|ONE_PART)|DRAW_ONE_HALF/i.test(catalogMarket.name)) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (/NOT_(WIN|LOSE)_IN_REGULATION_TIME/i.test(catalogMarket.name.replace(/\s+/g, ''))) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (/AND_BOTH_TEAM_TO_SCORE_YES_NO|BOTH_TEAM_TO_SCORE_HALF_YES_NO/i.test(catalogMarket.name)) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (/^GOAL15MIN|^NEXT_GOAL_MIN_YES_NO/i.test(catalogMarket.name)) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (/^COUNT_SET/i.test(catalogMarket.name) || /_YES_NO$/i.test(catalogMarket.name)) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (/^(WIN1|WIN2|DRAW)_OR_(OVER|UNDER)/i.test(catalogMarket.name)) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (/^TEAM[12]_WILL_SCORE_/i.test(catalogMarket.name)) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (/^NEXT_GOAL_TIME_\d+MIN$/i.test(catalogMarket.name)) {
        outcomeKey = mapNextGoalTimeOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (/DEUSE_POINT/i.test(catalogMarket.name)) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (mk === 'double_chance') {
        outcomeKey = mapDcOutcome(p.outcomeTypeId, catalog, market.marketId, name);
      }
      else if (/^NUMBER_OF_SETS/i.test(catalogMarket.name)) {
        const setCount = paramValue(p.parameters, 'PARAMETER_VALUE')
          ?? paramValue(p.parameters, 'PARAMETER_NUMBER')
          ?? innerSig;
        outcomeKey = `DISPLAY_${market.marketId}_${p.outcomeTypeId}_PARAMETER_VALUE:${setCount}`;
      }
      else if (/^SCORE_MAP$/i.test(catalogMarket.name)) {
        const homeScore = paramValue(p.parameters, 'PARAMETER_HOME_SCORE');
        const awayScore = paramValue(p.parameters, 'PARAMETER_AWAY_SCORE');
        if (homeScore != null && awayScore != null) {
          name = `${homeScore}:${awayScore}`;
          outcomeKey = `SCORE_${homeScore}:${awayScore}`;
        } else {
          outcomeKey = `DISPLAY_${market.marketId}_${p.outcomeTypeId}_${innerSig}`;
        }
      }
      else outcomeKey = `DISPLAY_${market.marketId}_${p.outcomeTypeId}_${innerSig}`;

      let point = probLine != null ? Number(probLine) : line != null ? Number(line) : undefined;
      if (/^RACE_TO_GAME/i.test(catalogMarket.name)) {
        const raceTarget = paramValue(p.parameters, 'PARAMETER_NUMBER')
          ?? paramValue(p.parameters, 'PARAMETER_VALUE')
          ?? paramValue(p.parameters, 'PARAMETER_GAME_NUMBER');
        if (raceTarget != null) point = Number(raceTarget);
      }

      const goalsRangeParam = paramValue(p.parameters, 'PARAMETER_GOALS_RANGE');
      if (/GOAL_RANGE/i.test(catalogMarket.name) && goalsRangeParam != null) {
        name = String(goalsRangeParam).replace(/-/g, '–');
      }

      if (
        (/_YES_NO$/i.test(catalogMarket.name)
          || /^(WIN1|WIN2|DRAW)_OR_(OVER|UNDER)/i.test(catalogMarket.name)
          || /^TEAM[12]_WILL_SCORE_/i.test(catalogMarket.name))
        && (outcomeKey === 'YES' || outcomeKey === 'NO')
      ) {
        name = outcomeKey === 'YES' ? 'Да' : 'Нет';
      }

      if (/^SCORE_MAP$/i.test(catalogMarket.name)) {
        const score = parseScorePairLabel(name);
        if (!score || !isValidEsportsMapCorrectScore(score.home, score.away)) {
          return null;
        }
      }

      return {
        name,
        price: p.odd,
        point,
        outcomeKey,
        suspended: p.tradingStatus === 'PROBABILITY_SUSPENDED' || !!p.suspended,
      };
    }).filter((outcome): outcome is NonNullable<typeof outcome> => outcome != null);

    const uniqueOutcomes = sortExactScoreOutcomes(
      marketKey,
      catalogMarket.name,
      dedupeOutcomesByKey(outcomes),
    );
    if (!uniqueOutcomes.length) continue;

    items.push({
      category,
      group: {
        key: groupKey,
        marketKey,
        label: groupLabel,
        outcomes: uniqueOutcomes,
      },
    });
  }

  return items;
}

function raceToGameSortKey(group: WcMarketGroup): number {
  const fromOutcome = group.outcomes.find((o) => o.point != null)?.point;
  if (fromOutcome != null && Number.isFinite(fromOutcome)) return fromOutcome;
  const fromKey = /PARAMETER_GAME_NUMBER:(\d+)/.exec(group.key);
  if (fromKey) return Number(fromKey[1]);
  const fromLabel = /до\s+(\d+)/i.exec(group.label);
  if (fromLabel) return Number(fromLabel[1]);
  return 0;
}

function sortCategoryMarketGroups(groups: WcMarketGroup[]): WcMarketGroup[] {
  if (!groups.some((g) => /RACE_TO_GAME/i.test(g.marketKey))) return groups;
  return [...groups].sort((a, b) => raceToGameSortKey(a) - raceToGameSortKey(b));
}

export async function parseOlimpbetEventToGroupedMarkets(
  detail: OlimpbetEventDetail,
  sectionLabel = '',
  isMainEvent = true,
  catalogLocale: 'ru' | 'en' = 'ru',
): Promise<WcGroupedMarkets> {
  const catalog = await loadOlimpbetMarketCatalog(catalogLocale);
  const grouped: WcGroupedMarkets = {};
  const { homeTeam, awayTeam } = eventTeamNames(detail);
  const sportId = detail.tournament?.sportId ?? null;

  const mergedMarkets = new Map<number, NonNullable<OlimpbetEventDetail['probabilities']>['markets'][number]>();
  for (const market of detail.probabilities?.markets ?? []) {
    const existing = mergedMarkets.get(market.marketId);
    if (!existing) {
      mergedMarkets.set(market.marketId, {
        ...market,
        probabilities: [...(market.probabilities ?? [])],
      });
      continue;
    }
    existing.probabilities.push(...(market.probabilities ?? []));
  }

  for (const market of mergedMarkets.values()) {
    const catalogMarket = catalog.markets.get(market.marketId);
    if (!catalogMarket) continue;

    const items = parseMarketGroup(
      catalog,
      market,
      sectionLabel,
      isMainEvent,
      homeTeam,
      awayTeam,
      sportId,
      catalogLocale,
    );
    for (const { category, group } of items) {
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(group);
    }
  }

  for (const category of Object.keys(grouped)) {
    grouped[category] = sortCategoryMarketGroups(grouped[category]!);
  }

  let cleaned = stripPlaceholderMapCorrectScoreMarkets(grouped);
  if (isOlimpbetEsportsSportId(sportId)) {
    cleaned = stripFlatPlaceholderEsportsMarkets(cleaned);
  }

  return finalizeGroupedMarkets(cleaned);
}

export async function parseOlimpbetFullEvent(
  main: OlimpbetEventDetail,
  linked: Array<{ detail: OlimpbetEventDetail; sectionLabel: string }>,
  catalogLocale: 'ru' | 'en' = 'ru',
): Promise<WcGroupedMarkets> {
  let merged = await parseOlimpbetEventToGroupedMarkets(main, '', true, catalogLocale);
  for (const row of linked) {
    const extra = await parseOlimpbetEventToGroupedMarkets(
      row.detail,
      row.sectionLabel,
      false,
      catalogLocale,
    );
    for (const [category, groups] of Object.entries(extra)) {
      if (!merged[category]) merged[category] = [];
      merged[category].push(...groups);
    }
  }
  return sortGroupedMarkets(merged);
}

export function pickLinkedEventIds(main: OlimpbetEventDetail): number[] {
  const linked = main.linkedEvents ?? [];
  const prioritized = linked.filter((e) => LINKED_PRIORITY.has(e.eventType?.code ?? ''));
  const rest = linked.filter((e) => !LINKED_PRIORITY.has(e.eventType?.code ?? ''));
  return [...prioritized, ...rest]
    .map((e) => e.eventId)
    .filter((id) => Number.isFinite(id))
    .slice(0, 50);
}

export function isBettableMarketKey(marketKey: string): boolean {
  const base = marketKey.replace(/_ot$/i, '');
  return SETTLED_MARKETS.has(marketKey) || SETTLED_MARKETS.has(base);
}
