import {
  resolveWcMarketKey,
} from './olimpbet-wc-market-keys.util';

import type { WcGroupedMarkets, WcMarketGroup } from '../wc-odds/wc-odds-markets.util';
import { finalizeGroupedMarkets } from '../wc-odds/wc-odds-markets.util';

import {
  catalogMarketLabel,
  formatOutcomeLabel,
  humanizeCatalogMarketName,
  loadOlimpbetMarketCatalog,
  resolveVirtualCategoryName,
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
  TOTAL_ASIAN: 'Тотал',
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
  SCORE: 'Счет',
  SCORE_SET: 'Счет в гейме',
  SCORE_FIRST_X_GAMES_SET: 'Счет',
  EXACT_POINT_GAME_SET: 'Точное количество очков гейма',
  WINNER_2GAMES_SET: 'Исход двух геймов',
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

function marketGroupSig(marketKey: string, prob: OlimpbetProbability): string {
  const baseKey = marketKey.replace(/_ot$/i, '');
  const catalogStem = baseKey.replace(/^display_/i, '');
  if (/^SCORE_SET|^EXACT_POINT_GAME_SET|^SCORE_WINNER/i.test(catalogStem)) {
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
  if (
    mk === 'totals'
    || mk === 'totals_home'
    || mk === 'totals_away'
    || /^TOTAL/i.test(catalogName)
  ) {
    if (/TEAM_TOTAL|INDIVIDUAL_TOTAL/i.test(catalogName) || /индивид/i.test(category)) {
      return /_WITH_?OT$/i.test(catalogName) ? 'Индивидуальный тотал (с ОТ)' : 'Индивидуальный тотал';
    }
    if (/чет\/?нечет|even/i.test(category + catalogName)) return 'Тотал (Чет/Нечет)';
    return /_WITH_?OT$/i.test(catalogName) ? 'Тотал (с ОТ)' : 'Тотал';
  }
  if (mk === 'even_odd' || /^EVEN_ODD/i.test(catalogName)) {
    return /_WITH_?OT$/i.test(catalogName) ? 'Тотал (Чет/Нечет, с ОТ)' : 'Тотал (Чет/Нечет)';
  }
  if (/^NEXT_POINTS_GAME|^RACE_TO_POINT_GAME/i.test(catalogName)) {
    return MARKET_CODE_TO_CATEGORY[catalogName] ?? 'Следующее очко в гейме';
  }
  if (/^DEUSE_POINT/i.test(catalogName) || /ровно.*40:40/i.test(category)) return '40:40';
  if (/^NEXT_GOAL/i.test(catalogName)) return 'Следующий гол';
  if (/следующ.*очк|очко.*гейм/i.test(category)) return category;
  if (/^NEXT_GOAL/i.test(catalogName) || (/следующ/i.test(category) && /гол/i.test(category))) {
    return 'Следующий гол';
  }
  if (/^SCORE_SET/i.test(catalogName)) return category;
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
  const code = catalog.markets.get(marketId)?.outcomes.get(outcomeTypeId)?.code ?? '';
  let label = substituteCompetitorLabels(name, homeTeam, awayTeam).trim();
  label = label.replace(/\[\]/g, line ?? '').replace(/\{\}/g, line ?? '').trim();

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

  if (/^К1$/i.test(label) || (/^К1_/i.test(code) && !/_\d/.test(code.replace(/^К1_/i, '')))) return 'П1';
  if (/^К2$/i.test(label) || (/^К2_/i.test(code) && !/_\d/.test(code.replace(/^К2_/i, '')))) return 'П2';
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
  if (/^слгол/i.test(label.replace(/\s/g, ''))) return 'След. гол';
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
    return score && score.includes(':') ? score : label.replace(/точный\s*сч[её]т/i, '').trim() || score;
  }

  label = label
    .replace(/DISPLAY_\d+_\d+_[A-Z0-9_|]+/gi, '')
    .replace(/PARAMETER_[A-Z_]+:[^|]+/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^\d+:\d+$/.test(label)) return label;

  if (!label || (/^[\d_|:|-]+$/.test(label) && !/^\d+:\d+$/.test(label))) {
    return humanizeFallbackOutcomeCode(code) || '—';
  }

  if (/[\[\]{}]|перхгейм/i.test(label)) {
    const score = code.match(/(\d+)_(\d+)(?:_\d+)?$/);
    if (score) return `${score[1]}:${score[2]}`;
    return '—';
  }

  return label;
}

function humanizeFallbackOutcomeCode(code: string): string {
  const trimmed = code.trim();
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

  const half = paramValue(parameters, 'PARAMETER_HALF_NUMBER');
  const exactGoalsCategory = resolveExactGoalsCategory(catalogName, half);
  if (exactGoalsCategory) return exactGoalsCategory;

  const virtualCategory = resolveVirtualCategoryName(catalog, marketId, parameters);
  if (virtualCategory) return virtualCategory;

  const quarter = paramValue(parameters, 'PARAMETER_QUARTER_NUMBER');
  if (quarter) return quarterCategoryLabel(quarter);

  const setNum = paramValue(parameters, 'PARAMETER_SET_NUMBER');
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
  if (!gameNum && !setNum) return null;
  if (!/гейм/i.test(category) && !/^SCORE_SET|^EXACT_POINT_GAME_SET|^SCORE_FIRST_X_GAMES/i.test(catalogStem)) {
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

function buildScopedTotalsHandicapLabel(
  kind: 'totals' | 'handicap',
  category: string,
  marketKey: string,
  setNum?: string,
  gameNum?: string,
  half?: string,
  quarter?: string,
  line?: string,
): string {
  const scopeParts: string[] = [];

  if (/^\d+-[йи]\s+сет$/i.test(category.trim())) {
    scopeParts.push(category.trim());
  } else if (setNum) {
    scopeParts.push(`${setNum}-й сет`);
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

  const unit = gameNum
    ? 'очков'
    : scopeParts.some((p) => /сет/i.test(p)) || /^\d+-[йи]\s+сет$/i.test(category)
      ? 'геймов'
      : half || quarter
        ? 'очков'
        : 'голов';

  const prefix = kind === 'handicap' ? 'Фора' : `Тотал ${unit}`;
  let head = scopeParts.length ? `${scopeParts.join(', ')} · ${prefix}` : prefix;

  if (kind === 'totals' && /индивид/i.test(category)) {
    const base = baseMarketKey(marketKey);
    if (base === 'totals_home') head = `П1 · ${head}`;
    else if (base === 'totals_away') head = `П2 · ${head}`;
  }

  return line ? `${head} · ${line}` : head;
}

function buildGroupLabel(
  category: string,
  marketKey: string,
  parameters?: OlimpbetProbability['parameters'],
): string {
  const line = paramValue(parameters, 'PARAMETER_VALUE');
  const half = paramValue(parameters, 'PARAMETER_HALF_NUMBER');
  const setNum = paramValue(parameters, 'PARAMETER_SET_NUMBER');
  const gameNum = paramValue(parameters, 'PARAMETER_GAME_NUMBER');
  const quarter = paramValue(parameters, 'PARAMETER_QUARTER_NUMBER');
  const from = paramValue(parameters, 'PARAMETER_FROM');
  const to = paramValue(parameters, 'PARAMETER_TO');

  const pointNum = paramValue(parameters, 'PARAMETER_POINT_NUMBER');

  const scoreInGameLabel = buildScoreInGameGroupLabel(category, marketKey, setNum, gameNum);
  if (scoreInGameLabel) return scoreInGameLabel;

  const catalogStem = marketKey.replace(/^display_/i, '');

  if (/^DEUSE_POINT/i.test(catalogStem)) {
    const parts: string[] = [];
    if (setNum && !/\d+-й\s*сет/i.test(category)) parts.push(`${setNum}-й сет`);
    if (gameNum) parts.push(`${gameNum}-й гейм`);
    return parts.length ? parts.join(', ') : '40:40';
  }

  if (/^WINNER_SET/i.test(catalogStem)) {
    if (gameNum && !/\d+-й\s*гейм/i.test(category)) return `${gameNum}-й гейм`;
    return '';
  }

  if (/^MULTISCORE/i.test(catalogStem)) {
    return '';
  }

  if (/следующ.*очк|NEXT_POINTS/i.test(category) && setNum && gameNum) {
    const parts = [`${setNum}-й сет`, `${gameNum}-й гейм`];
    if (pointNum) parts.push(`${pointNum}-е очко`);
    return parts.join(', ');
  }

  const suffixParts = [
    half === '1' ? '1-й тайм' : half === '2' ? '2-й тайм' : null,
    quarter ? quarterCategoryLabel(quarter) : null,
    from != null && to != null ? `${from}–${to} мин` : null,
    line ? String(line) : null,
    setNum && !category.includes('сете') ? `${setNum}-й сет` : null,
    gameNum && !category.includes('гейм') ? `${gameNum}-й гейм` : null,
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
    );
  }

  if (!suffixParts.length) return displayCategory;
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

function sortExactScoreOutcomes<T extends { name: string }>(
  marketKey: string,
  catalogName: string,
  outcomes: T[],
): T[] {
  if (!/^CORRECT_SCORE|^SCORE_VARIANT/i.test(catalogName) && !/CORRECT_SCORE|SCORE_VARIANT/i.test(marketKey)) {
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
): Array<{ category: string; group: WcMarketGroup }> {
  const catalogMarket = catalog.markets.get(market.marketId);
  if (!catalogMarket) return [];

  const active = market.probabilities.filter(
    (p) => !hasPlayerParam(p) && p.odd > 1 && p.tradingStatus !== 'PROBABILITY_SUSPENDED',
  );
  if (!active.length) return [];

  const { marketKey: resolvedMarketKey } = resolveWcMarketKey(catalogMarket.name, isMainEvent);
  let baseKey =
    /_WITH_?OT$/i.test(catalogMarket.name) && !resolvedMarketKey.startsWith('display_')
      ? `${resolvedMarketKey}_ot`
      : resolvedMarketKey;

  const bySig = new Map<string, { marketKey: string; innerSig: string; probs: OlimpbetProbability[] }>();
  for (const p of active) {
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
    const category = isMainEvent
      ? canonicalizeCategory(rawCategory, catalogMarket.name, marketKey)
      : rawCategory;
    const line = probs[0].parameters?.find((p) => p.type === 'PARAMETER_VALUE')?.value;
    const groupLabel = buildGroupLabel(category, marketKey, probs[0].parameters);
    const groupKey = `${market.marketId}__${innerSig}`;

    const outcomes = probs.map((p) => {
      const rawName = formatOutcomeLabel(catalog, market.marketId, p);
      const name = normalizeOutcomeDisplayName(
        rawName,
        catalog,
        market.marketId,
        p.outcomeTypeId,
        homeTeam,
        awayTeam,
        line,
      );
      let outcomeKey = `OUT_${p.outcomeTypeId}`;
      const mk = baseMarketKey(marketKey);
      if (mk === 'h2h') outcomeKey = mapH2hOutcome(p.outcomeTypeId, catalog, market.marketId);
      else if ((mk === 'totals' || mk === 'totals_home' || mk === 'totals_away') && line) {
        outcomeKey = mapTotalsOutcome(p.outcomeTypeId, catalog, market.marketId, line);
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
      else if (/DEUSE_POINT/i.test(catalogMarket.name)) {
        outcomeKey = mapYesNoOutcome(p.outcomeTypeId, catalog, market.marketId);
      }
      else if (mk === 'double_chance') {
        outcomeKey = mapDcOutcome(p.outcomeTypeId, catalog, market.marketId, name);
      }
      else outcomeKey = `DISPLAY_${market.marketId}_${p.outcomeTypeId}_${innerSig}`;

      return {
        name,
        price: p.odd,
        point: line != null ? Number(line) : undefined,
        outcomeKey,
        suspended: p.tradingStatus === 'PROBABILITY_SUSPENDED' || !!p.suspended,
      };
    });

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

export async function parseOlimpbetEventToGroupedMarkets(
  detail: OlimpbetEventDetail,
  sectionLabel = '',
  isMainEvent = true,
): Promise<WcGroupedMarkets> {
  const catalog = await loadOlimpbetMarketCatalog();
  const grouped: WcGroupedMarkets = {};
  const { homeTeam, awayTeam } = eventTeamNames(detail);

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

    const items = parseMarketGroup(catalog, market, sectionLabel, isMainEvent, homeTeam, awayTeam);
    for (const { category, group } of items) {
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(group);
    }
  }

  return finalizeGroupedMarkets(grouped);
}

export async function parseOlimpbetFullEvent(
  main: OlimpbetEventDetail,
  linked: Array<{ detail: OlimpbetEventDetail; sectionLabel: string }>,
): Promise<WcGroupedMarkets> {
  let merged = await parseOlimpbetEventToGroupedMarkets(main, '', true);
  for (const row of linked) {
    const extra = await parseOlimpbetEventToGroupedMarkets(row.detail, row.sectionLabel, false);
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
