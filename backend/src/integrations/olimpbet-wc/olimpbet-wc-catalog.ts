import type { OlimpbetProbability } from './olimpbet-wc.types';

const API_HOST = 'https://olimpbet.kz/api';

export type OlimpbetCatalogOutcome = {
  id: number;
  code: string;
  shortName: string;
  /** Human-readable label from Olimpbet catalog (e.g. "Фол", "Удар от ворот"). */
  name: string;
};

export type OlimpbetCatalogMarket = {
  id: number;
  name: string;
  outcomes: Map<number, OlimpbetCatalogOutcome>;
};

export type VirtualCategoryRef = {
  marketId: number;
  categoryName: string;
  parameters: Array<{ type: string; value: string }>;
};

export type OlimpbetMarketCatalog = {
  markets: Map<number, OlimpbetCatalogMarket>;
  marketLabels: Map<number, string>;
  virtualCategoryRefs: Map<number, VirtualCategoryRef[]>;
  loadedAtMs: number;
};

let catalogCache: OlimpbetMarketCatalog | null = null;

async function fetchJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_HOST}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function paramValue(
  parameters: OlimpbetProbability['parameters'] | undefined,
  type: string,
): string | undefined {
  return parameters?.find((p) => p.type === type)?.value;
}

function setLabel(value: string | undefined): string | null {
  if (!value) return null;
  const ordinals: Record<string, string> = {
    '1': '1-м',
    '2': '2-м',
    '3': '3-м',
    '4': '4-м',
    '5': '5-м',
  };
  return ordinals[value] ? `${ordinals[value]} сете` : `${value}-м сете`;
}

function gameLabel(value: string | undefined): string | null {
  if (!value) return null;
  return `${value}-й гейм`;
}

function halfLabel(value: string | undefined): string | null {
  if (!value) return null;
  if (value === '1') return '1-й тайм';
  if (value === '2') return '2-й тайм';
  return `пол. ${value}`;
}

function looksLikeTemplate(label: string): boolean {
  return /[\[\]{}]|_\w+_\w+|\{\$competitor/i.test(label);
}

function isScopedScoreInGameMarket(catalogName: string): boolean {
  return /^SCORE_SET|^EXACT_POINT_GAME_SET|^SCORE_FIRST_X_GAMES_SET/i.test(catalogName);
}

const TECHNICAL_OUTCOME_SUFFIX: Record<string, string> = {
  Аут: 'Аут',
  Фол: 'Фол',
  Угл: 'Угловой',
  УдарОтВор: 'Удар от ворот',
  УдарОтВорот: 'Удар от ворот',
  Офсайд: 'Офсайд',
  Гол: 'Гол',
  Карт: 'Карточка',
  Небудет: 'Не будет',
};

function humanizeOutcomeCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return '';
  if (/^П[12]$/.test(trimmed)) return trimmed;
  if (trimmed === 'Х' || trimmed === 'X') return 'X';
  if (/^Ф[12]/.test(trimmed)) return trimmed.replace(/\s.*/, '');
  if (/^К[12]$/.test(trimmed)) return trimmed;
  if (/^\d+:\d+$/.test(trimmed)) return trimmed;
  if (/^\d+_\d+$/.test(trimmed)) {
    const [home, away] = trimmed.split('_');
    const fmt = (part: string) => (part === '50' ? 'A' : part);
    return `${fmt(home)}:${fmt(away)}`;
  }
  if (/^\d+_\d+_[12]$/.test(trimmed)) {
    const [a, b] = trimmed.split('_');
    return `${a}:${b}`;
  }
  return trimmed;
}

/** Strip internal prefixes like ПерФакт5мин_Фол → Фол. */
export function humanizeTechnicalOutcomeCode(code: string): string {
  let rest = code.trim();
  rest = rest
    .replace(/^К[12]_ПерФакт_/i, '')
    .replace(/^ПерФакт\d*мин_/i, '')
    .replace(/^ПерФакт_/i, '')
    .replace(/^\d+мин_?/i, '')
    .replace(/^Сл_/i, '')
    .replace(/_ERR(OR)?$/i, '');

  if (TECHNICAL_OUTCOME_SUFFIX[rest]) return TECHNICAL_OUTCOME_SUFFIX[rest]!;

  const lastPart = rest.split('_').pop() ?? rest;
  if (TECHNICAL_OUTCOME_SUFFIX[lastPart]) return TECHNICAL_OUTCOME_SUFFIX[lastPart]!;

  if (/^небудет$/i.test(rest.replace(/\s/g, ''))) return 'Не будет';

  const humanized = rest.replace(/_/g, ' ').trim();
  return humanized || humanizeOutcomeCode(code);
}

function pickCatalogOutcomeLabel(outcome: OlimpbetCatalogOutcome | undefined, code: string): string {
  const shortName = outcome?.shortName?.trim() ?? '';
  const catalogName = outcome?.name?.trim() ?? '';

  if (shortName && !looksLikeTemplate(shortName) && !/^перфакт/i.test(shortName.replace(/\s/g, ''))) {
    return shortName;
  }
  if (catalogName && !looksLikeTemplate(catalogName) && catalogName !== ' ') {
    return catalogName;
  }
  return humanizeTechnicalOutcomeCode(code);
}

export function resolveVirtualCategoryName(
  catalog: OlimpbetMarketCatalog,
  marketId: number,
  parameters: OlimpbetProbability['parameters'] | undefined,
): string | null {
  const refs = catalog.virtualCategoryRefs.get(marketId);
  if (!refs?.length) return null;

  const probParams = (parameters ?? []).map((p) => ({ type: p.type, value: p.value }));
  if (!probParams.length) return refs[0]?.categoryName ?? null;

  for (const ref of refs) {
    if (!ref.parameters.length) continue;
    const matches = ref.parameters.every((rp) =>
      probParams.some((pp) => pp.type === rp.type && pp.value === rp.value),
    );
    if (matches) return ref.categoryName;
  }

  const defaultRef = refs.find((ref) => !ref.parameters.length);
  return defaultRef?.categoryName ?? refs[0]?.categoryName ?? null;
}

export async function loadOlimpbetMarketCatalog(): Promise<OlimpbetMarketCatalog> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.loadedAtMs < 60 * 60_000) {
    return catalogCache;
  }

  const [marketsRes, categoriesRes] = await Promise.all([
    fetchJson<{ items: Array<{ id: number; name: string; orderedOutcomeTypes?: Array<{ id: number; code?: string; shortName?: string; name?: string }> }> }>(
      '/markets?locale=ru',
    ),
    fetchJson<{ items: Array<{ name: string; orderedMarkets?: Array<{ marketId: number; parameters?: Array<{ type: string; value: string }> }> }> }>(
      '/market-categories?locale=ru',
    ),
  ]);

  const markets = new Map<number, OlimpbetCatalogMarket>();
  for (const m of marketsRes?.items ?? []) {
    const outcomes = new Map<number, OlimpbetCatalogOutcome>();
    for (const o of m.orderedOutcomeTypes ?? []) {
      outcomes.set(o.id, {
        id: o.id,
        code: o.code ?? String(o.id),
        shortName: o.shortName?.trim() ?? '',
        name: o.name?.trim() ?? '',
      });
    }
    markets.set(m.id, { id: m.id, name: m.name, outcomes });
  }

  const marketLabels = new Map<number, string>();
  const virtualCategoryRefs = new Map<number, VirtualCategoryRef[]>();

  for (const cat of categoriesRes?.items ?? []) {
    for (const om of cat.orderedMarkets ?? []) {
      if (!marketLabels.has(om.marketId)) {
        marketLabels.set(om.marketId, cat.name);
      }

      const refs = virtualCategoryRefs.get(om.marketId) ?? [];
      refs.push({
        marketId: om.marketId,
        categoryName: cat.name,
        parameters: (om.parameters ?? []).map((p) => ({ type: p.type, value: p.value })),
      });
      virtualCategoryRefs.set(om.marketId, refs);
    }
  }

  catalogCache = { markets, marketLabels, virtualCategoryRefs, loadedAtMs: now };
  return catalogCache;
}

export function formatOutcomeLabel(
  catalog: OlimpbetMarketCatalog,
  marketId: number,
  prob: OlimpbetProbability,
): string {
  const market = catalog.markets.get(marketId);
  const catalogName = market?.name ?? '';
  const outcome = market?.outcomes.get(prob.outcomeTypeId);
  const code = outcome?.code ?? '';
  let label = pickCatalogOutcomeLabel(outcome, code) || String(prob.outcomeTypeId);

  const goalsRange = paramValue(prob.parameters, 'PARAMETER_GOALS_RANGE');
  const rangeFrom =
    paramValue(prob.parameters, 'PARAMETER_FROM')
    ?? paramValue(prob.parameters, 'PARAMETER_MIN')
    ?? paramValue(prob.parameters, 'PARAMETER_LOW');
  const rangeTo =
    paramValue(prob.parameters, 'PARAMETER_TO')
    ?? paramValue(prob.parameters, 'PARAMETER_MAX')
    ?? paramValue(prob.parameters, 'PARAMETER_HIGH');

  if (/GOAL_RANGE/i.test(catalogName)) {
    if (goalsRange != null && goalsRange.trim()) {
      return goalsRange.trim().replace(/-/g, '–');
    }
    if (rangeFrom != null && rangeTo != null) {
      return `${rangeFrom}–${rangeTo}`;
    }
  }

  const winningMethod = formatWinningMethodOutcome(code);
  if (winningMethod) return winningMethod;

  if (/SCORE_AFTER/i.test(catalogName)) {
    const compact = code.replace(/\s/g, '');
    if (/небудет|небудет/i.test(compact) || /_нет$/i.test(compact) || /^нет$/i.test(compact)) {
      return 'Не будет';
    }
  }

  const nextGoal = formatNextGoalOutcome(code);
  if (nextGoal) return nextGoal;

  const bttsOutcome = formatBttsAndOutcomeCode(code);
  if (bttsOutcome) return bttsOutcome;

  const firstGoalWinner = formatFirstGoalAndWinnerCode(code);
  if (firstGoalWinner) return firstGoalWinner;

  if (code.includes('Да') || code.endsWith('_Да')) {
    const halfWinLabel = formatHalfWinYesNoLabel(code);
    label = halfWinLabel ?? 'Да';
  } else if (code.includes('Нет') || code.endsWith('_Нет')) {
    const halfWinLabel = formatHalfWinYesNoLabel(code);
    label = halfWinLabel ?? 'Нет';
  } else if (/^П[12]$/.test(code)) label = code;
  else if (code === 'Х' || code === 'X') label = 'X';
  else if (/^\d+:\d+$/.test(code) || /^\d+_\d+_[12]$/.test(code)) {
    label = humanizeOutcomeCode(code);
  }

  const homeScore = paramValue(prob.parameters, 'PARAMETER_HOME_SCORE');
  const awayScore = paramValue(prob.parameters, 'PARAMETER_AWAY_SCORE');
  const setNum = paramValue(prob.parameters, 'PARAMETER_SET_NUMBER');
  const gameNum = paramValue(prob.parameters, 'PARAMETER_GAME_NUMBER');
  const pointNum = paramValue(prob.parameters, 'PARAMETER_POINT_NUMBER');
  const exact = paramValue(prob.parameters, 'PARAMETER_EXACT');
  const exactGoals = paramValue(prob.parameters, 'PARAMETER_EXACT_GOALS');
  const number = paramValue(prob.parameters, 'PARAMETER_NUMBER');
  const line = paramValue(prob.parameters, 'PARAMETER_VALUE');
  const half = paramValue(prob.parameters, 'PARAMETER_HALF_NUMBER');

  if (homeScore != null && awayScore != null) {
    const fmtPoint = (v: string) => (v === '50' ? 'A' : v);
    const score = `${fmtPoint(homeScore)}:${fmtPoint(awayScore)}`;
    if (looksLikeTemplate(label) || /счет/i.test(label) || isScopedScoreInGameMarket(catalogName)) {
      return score;
    }
    if (!label.includes(':')) return `${label} ${score}`.trim();
  }

  if (/^MULTISCORE/i.test(catalogName)) {
    const multiMatch = /^РазСчет(.+?)_Сет/i.exec(code);
    if (multiMatch) return multiMatch[1]!.replace(/,/g, ', ');
    if (/^\d/.test(label.trim())) return label.trim();
  }

  if (/EXACT_GOALS/i.test(catalogName) && exactGoals != null) {
    return formatExactGoalsValue(exactGoals);
  }

  if (/^NUMBER_OF_SETS/i.test(catalogName)) {
    const setCount = paramValue(prob.parameters, 'PARAMETER_VALUE')
      ?? paramValue(prob.parameters, 'PARAMETER_NUMBER');
    if (setCount != null) return setCountLabel(setCount);
  }

  if (/^RACE_TO_GAME/i.test(catalogName)) {
    if (/^П1|^К1|^ОчкоП1/i.test(code)) return 'П1';
    if (/^П2|^К2|^ОчкоП2/i.test(code)) return 'П2';
  }

  if (exact != null && (looksLikeTemplate(label) || /очк|кол/i.test(label) || /EXACT_GOALS/i.test(catalogName))) {
    return /GOAL/i.test(catalogName) ? goalCountLabel(exact) : exact;
  }

  if (number != null && looksLikeTemplate(label)) {
    return number;
  }

  if (line != null) {
    label = label.replace(/\[\]/g, line).replace(/\{\}/g, line);
    if (!label.includes(line) && looksLikeTemplate(label)) {
      label = line;
    }
  }

  if (half != null) {
    const halfText = halfLabel(half);
    if (halfText && !label.includes('тайм') && !/EXACT_GOALS/i.test(catalogName)) {
      label = looksLikeTemplate(label) ? halfText : `${label} (${halfText})`;
    }
  }

  const contextParts = [setLabel(setNum), gameLabel(gameNum), pointNum ? `${pointNum} очко` : null]
    .filter(Boolean);

  if (/^ОчкоП1/i.test(code)) return 'П1';
  if (/^ОчкоП2/i.test(code)) return 'П2';

  if (looksLikeTemplate(label)) {
    if (/^П[12]_?/i.test(code)) return code.startsWith('П') ? code.replace(/_.*/, '') : humanizeOutcomeCode(code);
    if (/^Ф[12]/i.test(code)) return code.replace(/\s.*/, '');
    if (/^К[12]/.test(code)) return code.replace(/_.*/, '');
    if (contextParts.length) return contextParts.join(', ');
    return humanizeOutcomeCode(code) || label.replace(/[\[\]{}]/g, '').trim();
  }

  if (
    /^(DEUSE_POINT|NEXT_POINTS_GAME|RACE_TO_POINT_GAME)/i.test(catalogName)
    && /^(Да|Нет|П1|П2)$/i.test(label.trim())
  ) {
    return label.trim();
  }

  if (/^\d+:\d+$/.test(label.trim())) {
    return label.trim();
  }

  if (
    contextParts.length
    && !isScopedScoreInGameMarket(catalogName)
    && !contextParts.some((part) => label.includes(part.replace(/[^\d]/g, '')))
  ) {
    label = `${label} (${contextParts.join(', ')})`;
  }

  return label.trim();
}

export function catalogMarketLabel(catalog: OlimpbetMarketCatalog, marketId: number): string {
  return catalog.marketLabels.get(marketId) ?? catalog.markets.get(marketId)?.name ?? `Market ${marketId}`;
}

const CATALOG_MARKET_LABELS: Record<string, string> = {
  WINNER_YES_NO: 'Победа: да/нет',
  WINNER_10MIN: 'Победа (10 мин)',
  WINNER_5MIN: 'Победа (5 мин)',
  WINNER_REST_OF_MATCH_3X: 'Исход матча в оставшееся время',
  WINNER_REST_OF_MATCH: 'Исход матча в оставшееся время',
  GOALS_TEAM1: 'Забьёт команда 1',
  GOALS_TEAM2: 'Забьёт команда 2',
  DEUSE_POINT: 'Дьюс',
  NEXT_POINTS_GAME: 'Следующее очко в гейме',
  RACE_TO_POINT_GAME: 'Гонка по очкам в гейме',
};

function stripCatalogSuffixes(name: string): string {
  return name
    .replace(/_WITH_?PARAMS?$/i, '')
    .replace(/_WITH_?OT$/i, '');
}

/** Fallback humanize (WINNING METHOD FOOTBALL) — not a bettor-facing group title. */
export function isTechnicalEnglishCatalogLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  if (!/[а-яё]/i.test(trimmed)) {
    return /^[A-Z][A-Z0-9\s_():+-]*$/.test(trimmed);
  }
  return /\b(HOW|WILL|BE|SCORED|SCORE|AFTER|STRONG|WILLED|BOTH|FIRST|AND|WINNER|GOAL|SCORING|EVENTS|MIDFIELDER|STRIKER|DEFENDER|HATTRICK|GOALKEEPER|MINUTE|EVEN|ODD|LAST|EVENT|PENALTY|REDCARD|MATCH)\b/i.test(trimmed);
}

/** Pattern-based Russian labels for Olimpbet catalog codes. */
export function resolveCatalogPatternLabel(catalogName: string): string | null {
  const base = stripCatalogSuffixes(catalogName)
    .replace(/_YES_NO$/i, '')
    .replace(/\s+/g, '');

  if (/^EXACT_GOALS/i.test(base)) {
    if (/TEAM1/i.test(base)) return 'Точное число голов (хозяева)';
    if (/TEAM2/i.test(base)) return 'Точное число голов (гости)';
    return 'Точное число голов';
  }
  if (/^GOAL_RANGE/i.test(base)) {
    if (/TEAM1/i.test(base)) return 'Диапазон голов (хозяева)';
    if (/TEAM2/i.test(base)) return 'Диапазон голов (гости)';
    return 'Диапазон голов';
  }
  if (/^WINX2_AND_TOTAL|^X2_AND_TOTAL/i.test(base)) return 'X2 + тотал';
  if (/^WIN1_AND_TOTAL/i.test(base)) return 'П1 + тотал';
  if (/^WIN2_AND_TOTAL/i.test(base)) return 'П2 + тотал';
  if (/^DRAW_AND_TOTAL/i.test(base)) return 'Ничья + тотал';
  if (/^BOTHTEAM_WILL_SCORE_OVER/i.test(base)) return 'Обе забьют + тотал (больше)';
  if (/^BOTHTEAM_WILL_SCORE_UNDER/i.test(base)) return 'Обе забьют + тотал (меньше)';
  if (/^DRAW_IN_MATCH_WITH_SCORE/i.test(base)) return 'Ничья с указанным счётом';
  if (/^NUMBER_OF_SETS/i.test(base)) return 'Количество сетов';
  if (/^SCORE_VARIANT|^CORRECT_SCORE/i.test(base)) return 'Точный счёт';
  if (/^DRAWN_MINUTES_TOTAL/i.test(base)) return 'Ничейные минуты + тотал (меньше)';
  if (/^WIN_AND_TOTAL_OVER_DRAW/i.test(base)) return 'Победа или ничья + тотал (больше)';
  if (/^WIN_AND_TOTAL_UNDER_DRAW/i.test(base)) return 'Победа или ничья + тотал (меньше)';
  if (/^DRAW_OR_OVER/i.test(base)) return 'Ничья или тотал (больше)';
  if (/^DRAW_OR_UNDER/i.test(base)) return 'Ничья или тотал (меньше)';
  if (/^GOALS_TEAM1$/i.test(base)) return 'Забьёт команда 1';
  if (/^GOALS_TEAM2$/i.test(base)) return 'Забьёт команда 2';
  if (/^TEAM1_WIN_EXACTLY_1SET/i.test(base)) return 'П1: выиграет ровно 1 сет';
  if (/^TEAM2_WIN_EXACTLY_1SET/i.test(base)) return 'П2: выиграет ровно 1 сет';
  if (/^SET_TEAM1$/i.test(base)) return 'П1: победа хотя бы в одном сете';
  if (/^SET_TEAM2$/i.test(base)) return 'П2: победа хотя бы в одном сете';
  if (/^TEAM1_WIN_BOTHPART$/i.test(base)) return 'П1 в обеих половинах';
  if (/^TEAM2_WIN_BOTHPART$/i.test(base)) return 'П2 в обеих половинах';
  if (/^TEAM1_WIN_ONE_PART$/i.test(base)) return 'П1 хотя бы в одной половине';
  if (/^TEAM2_WIN_ONE_PART$/i.test(base)) return 'П2 хотя бы в одной половине';
  if (/^DRAW_ONE_HALF$/i.test(base)) return 'Х хотя бы в одной половине';
  if (/^STRONG_WILLED_TEAM1$/i.test(base)) return 'П1: волевая победа';
  if (/^STRONG_WILLED_TEAM2$/i.test(base)) return 'П2: волевая победа';
  if (/^STRONG_WILLED_ANY_TEAM$/i.test(base)) return 'Волевая победа';
  if (/^TEAM1_GOALS_BOTH$/i.test(base)) return 'П1: голы в обоих таймах';
  if (/^TEAM2_GOALS_BOTH$/i.test(base)) return 'П2: голы в обоих таймах';
  if (/^SCORE_AFTER_X_GOALS$/i.test(base)) return 'Счет после X голов';
  const scoreAfterSets = /^SCORE_AFTER_(\d+)SETS$/i.exec(base);
  if (scoreAfterSets) return `Счет после ${scoreAfterSets[1]}-го сета`;
  if (/^FIRST_GOAL_AND_WINNER$/i.test(base)) return 'Первый гол и победа';
  if (/^LAST_GOAL_AND_WINNER$/i.test(base)) return 'Последний гол и победа';
  if (/^NOT_WIN_IN_REGULATION_TIME_BUT_TO_QUALIFY_TEAM1/i.test(base)) {
    return 'П1: не выиграет в основное время, но пройдёт';
  }
  if (/^NOT_WIN_IN_REGULATION_TIME_AND_NOT_TO_QUALIFY_TEAM1/i.test(base)) {
    return 'П1: не выиграет в основное время и не пройдёт';
  }
  if (/^NOT_LOSE_IN_REGULATION_TIME_AND_TO_QUALIFY_TEAM1/i.test(base)) {
    return 'П1: не проиграет в основное время и пройдёт';
  }
  if (/^NOT_LOSE_IN_REGULATION_TIME_BUT_NOT_TO_QUALIFY_TEAM1/i.test(base)) {
    return 'П1: не проиграет в основное время, но не пройдёт';
  }
  if (/^NOT_WIN_IN_REGULATION_TIME_BUT_TO_QUALIFY_TEAM2/i.test(base)) {
    return 'П2: не выиграет в основное время, но пройдёт';
  }
  if (/^NOT_WIN_IN_REGULATION_TIME_AND_NOT_TO_QUALIFY_TEAM2/i.test(base)) {
    return 'П2: не выиграет в основное время и не пройдёт';
  }
  if (/^NOT_LOSE_IN_REGULATION_TIME_AND_TO_QUALIFY_TEAM2/i.test(base)) {
    return 'П2: не проиграет в основное время и пройдёт';
  }
  if (/^NOT_LOSE_IN_REGULATION_TIME_BUT_NOT_TO_QUALIFY_TEAM2/i.test(base)) {
    return 'П2: не проиграет в основное время, но не пройдёт';
  }
  if (/^MULTISCORE_SET/i.test(base)) return 'Мультисчёт сета';
  if (/^CLEAN_WIN_TEAM1/i.test(base)) return 'П1: сухая победа';
  if (/^CLEAN_WIN_TEAM2/i.test(base)) return 'П2: сухая победа';
  if (/^CLEAN_WINNER$/i.test(base)) return 'Сухая победа';
  if (/^OWNGOAL/i.test(base)) return 'Автогол в матче';
  if (/^NUMBER_FINAL_SCORE/i.test(base)) return 'Цифра в итоговом счёте';
  if (/^SCORING_EVENTS/i.test(base)) return 'Голевые факты';

  const nextGoalTime = /^NEXT_GOAL_TIME_(\d+)MIN$/i.exec(base);
  if (nextGoalTime) return `В течение ${nextGoalTime[1]} мин`;
  const team1Time = /^NEXT_GOAL_TIME_TEAM1_(\d+)MIN$/i.exec(base);
  if (team1Time) return `П1 · в течение ${team1Time[1]} мин`;
  const team2Time = /^NEXT_GOAL_TIME_TEAM2_(\d+)MIN$/i.exec(base);
  if (team2Time) return `П2 · в течение ${team2Time[1]} мин`;
  if (/^GOAL15MIN_YES_NO$/i.test(base)) return 'Гол в интервале';
  if (/^HOW_WILL_GOAL_BE_SCORED$/i.test(base)) return 'Как будет забит гол';
  if (/^LAST_EVENT$/i.test(base)) return 'Последнее событие';
  if (/^MINUTE_GOAL_EVEN_ODD$/i.test(base)) return 'Минута гола (чёт/нечет)';
  if (/^PENALTY_REDCARD/i.test(base)) return 'Пенальти и удаление';
  if (/^PENALTY_MATCH/i.test(base)) return 'Пенальти в матче';
  if (/^PENALTY_OR_REDCARD/i.test(base)) return 'Пенальти или удаление';
  if (/^REDCARD/i.test(base)) return 'Удаление';

  return null;
}

const SCORING_EVENTS_LABELS: Record<string, string> = {
  HATTRICK: 'Хет-трик',
  DOUBLE: 'Дубль',
  KICKGOAL: 'Гол ногой',
  HEADER: 'Гол головой',
  DIRECT_FREEKICK: 'Гол со штрафного',
  STRIKER: 'Нападающий забьёт',
  MIDFIELDER: 'Полузащитник забьёт',
  DEFENDER: 'Защитник забьёт',
  GOALPOST_CROSSBAR: 'Штанга или перекладина',
  DISALLOWED_GOAL: 'Гол не засчитан',
  GOALKEEPER: 'Вратарь забьёт',
  BALL_WILLBE_IN_THEGOAL_BUT_IT_WONT_COUNT: 'Мяч в воротах, но не засчитан',
  PLAYER_WILL_MAKE_ATLEAST_TWO_ASSISTS: '2+ голевые передачи',
};

/** Virtual category for «Цифра в итоговом счёте … (Да/Нет)» when catalog refs are missing. */
export function resolveNumberFinalScoreCategoryName(
  catalogName: string,
  parameters?: OlimpbetProbability['parameters'],
): string | null {
  const base = stripCatalogSuffixes(catalogName).replace(/_YES_NO$/i, '');
  if (!/^NUMBER_FINAL_SCORE/i.test(base)) return null;

  const half = paramValue(parameters, 'PARAMETER_HALF_NUMBER');
  const quarter = paramValue(parameters, 'PARAMETER_QUARTER_NUMBER');
  if (half === '1') return 'Цифра в итоговом счёте 1-й половины (Да/Нет)';
  if (half === '2') return 'Цифра в итоговом счёте 2-й половины (Да/Нет)';
  if (quarter === '1') return 'Цифра в итоговом счёте 1-й четверти (Да/Нет)';
  if (quarter === '2') return 'Цифра в итоговом счёте 2-й четверти (Да/Нет)';
  if (quarter === '3') return 'Цифра в итоговом счёте 3-й четверти (Да/Нет)';
  if (quarter === '4') return 'Цифра в итоговом счёте 4-й четверти (Да/Нет)';
  return 'Цифра в итоговом счёте (Да/Нет)';
}

/** «Цифра «3»» — which digit appears in the final score. */
export function resolveNumberFinalScoreGroupLabel(
  catalogStem: string,
  parameters?: OlimpbetProbability['parameters'],
): string | null {
  if (!/^NUMBER_FINAL_SCORE/i.test(catalogStem)) return null;
  const exact = paramValue(parameters, 'PARAMETER_EXACT');
  if (exact != null && String(exact).trim()) {
    return `Цифра «${String(exact).trim()}»`;
  }
  return null;
}

/** «П1» / «П2» — sub-label when team clean-win yes/no rows share one category. */
export function resolveCleanWinTeamSideGroupLabel(catalogStem: string): string | null {
  const base = stripCatalogSuffixes(catalogStem).replace(/_YES_NO$/i, '');
  if (/^CLEAN_WIN_TEAM1/i.test(base)) return 'П1';
  if (/^CLEAN_WIN_TEAM2/i.test(base)) return 'П2';
  return null;
}

/** «Хет-трик», «Полузащитник забьёт» — sub-label under «Голевые факты (Да/Нет)». */
export function resolveScoringEventsGroupLabel(catalogStem: string): string | null {
  if (!/^SCORING_EVENTS/i.test(catalogStem)) return null;

  const tail = stripCatalogSuffixes(catalogStem)
    .replace(/_YES_NO$/i, '')
    .replace(/^SCORING_EVENTS_/i, '');

  const sortedKeys = Object.keys(SCORING_EVENTS_LABELS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (tail === key || tail.startsWith(`${key}_`)) {
      return SCORING_EVENTS_LABELS[key]!;
    }
  }

  return tail
    .replace(/_GOAL$/i, '')
    .replace(/_/g, ' ')
    .replace(/\bGOAL\b/gi, 'гол')
    .trim();
}

/** Compact «Первый гол и победа» group titles for special football display markets. */
export function resolveSpecialBetsGroupLabel(
  catalogStem: string,
  category: string,
): string | null {
  const base = stripCatalogSuffixes(catalogStem).replace(/_YES_NO$/i, '');
  const cat = category.trim().toLowerCase();

  if (/^HOW_WILL_GOAL_BE_SCORED$/i.test(base)) {
    if (/как\s+будет\s+забит/i.test(cat)) return '';
    return 'Как будет забит гол';
  }
  if (/^LAST_EVENT$/i.test(base)) {
    if (/последн/i.test(cat)) return '';
    return 'Последнее событие';
  }
  if (/^MINUTE_GOAL_EVEN_ODD$/i.test(base)) {
    if (/минут.*гол|чет.*нечет/i.test(cat)) return '';
    return 'Минута гола (чёт/нечет)';
  }
  if (/^PENALTY_REDCARD/i.test(base)) {
    if (/пенальти.*удал/i.test(cat)) return '';
    return 'Пенальти и удаление';
  }
  if (/^PENALTY_MATCH/i.test(base)) {
    if (/пенальти/i.test(cat)) return '';
    return 'Пенальти в матче';
  }
  if (/^PENALTY_OR_REDCARD/i.test(base)) {
    if (/пенальти.*или.*удал/i.test(cat)) return '';
    return 'Пенальти или удаление';
  }
  if (/^REDCARD/i.test(base)) {
    if (/удал/i.test(cat)) return '';
    return 'Удаление';
  }

  return null;
}

/** Compact «П1-Да» / «Х-Нет» labels for basketball half-win yes/no markets. */
export function formatHalfWinYesNoLabel(code: string): string | null {
  const compact = code.replace(/\s/g, '');
  const match = /^(П1ОбеПол|П2ОбеПол|П1Пол|П2Пол|НичьяПол)(Да|Нет)$/i.exec(compact);
  if (!match) return null;

  const prefix = /^Ничья/i.test(match[1]!) ? 'Х' : match[1]!.slice(0, 2);
  const yn = match[2]!.charAt(0).toUpperCase() + match[2]!.slice(1).toLowerCase();
  return `${prefix}-${yn}`;
}

/** «П1 · П2» — who scores first · match result (FIRST_GOAL_AND_WINNER). */
export function formatFirstGoalAndWinnerCode(code: string): string | null {
  const compact = code.replace(/\s/g, '');
  if (/^ПерГ_?(Не)?[бБ]удет$/i.test(compact) || /^ПерГ_Нет$/i.test(compact)) {
    return 'Гола не будет';
  }

  const match = /^ПерГ([12])_([ПP][12]|Х|X)$/i.exec(compact);
  if (!match) return null;

  const firstGoal = match[1] === '1' ? 'П1' : 'П2';
  const winnerRaw = match[2]!.toUpperCase().replace(/P/g, 'П');
  const winner = winnerRaw === 'Х' ? 'X' : winnerRaw;
  return `${firstGoal} · ${winner}`;
}

export function isHalfWinMarketName(catalogName: string): boolean {
  return /^(TEAM[12]_WIN_(BOTHPART|ONE_PART)|DRAW_ONE_HALF)$/i.test(stripCatalogSuffixes(catalogName));
}

/** «ОЗ·Да·П1» for combined both-to-score + match-result markets. */
export function formatBttsAndOutcomeCode(code: string): string | null {
  const c = code.replace(/\s/g, '');

  const legacy = /^Обе(Да|Нет)(П1|П2|Х)(Пол)?$/i.exec(c);
  if (legacy) {
    const yn = legacy[1]!.charAt(0).toUpperCase() + legacy[1]!.slice(1).toLowerCase();
    const result = legacy[2]!.toUpperCase() === 'Х' ? 'X' : legacy[2]!.toUpperCase();
    return `ОЗ·${yn}·${result}`;
  }

  const dcLegacy = /^(1Х|12|Х2)_Обе(Да|Нет)$/i.exec(c);
  if (dcLegacy) {
    const dc = dcLegacy[1]!.replace(/Х/g, 'X').toUpperCase();
    const yn = dcLegacy[2]!.charAt(0).toUpperCase() + dcLegacy[2]!.slice(1).toLowerCase();
    return `ОЗ·${yn}·${dc}`;
  }

  const split = /^(П1|П2|1Х|12|Х2)иОбеЗаб(?:Пол)?_(Да|Нет)$/i.exec(c);
  if (split) {
    const result = split[1]!.replace(/Х/g, 'X').toUpperCase();
    const yn = split[2]!.charAt(0).toUpperCase() + split[2]!.slice(1).toLowerCase();
    return `ОЗ·${yn}·${result}`;
  }

  const drawSplit = /^Нич(?:и|ья)?ОбеЗаб(?:Пол)?_(Да|Нет)$/i.exec(c);
  if (drawSplit) {
    const yn = drawSplit[1]!.charAt(0).toUpperCase() + drawSplit[1]!.slice(1).toLowerCase();
    return `ОЗ·${yn}·X`;
  }

  return null;
}

/** Short group title (П1 / X / 1X) for split BTTS+result yes/no markets. */
export function resolveBttsOutcomeGroupLabel(catalogStem: string): string | null {
  const base = stripCatalogSuffixes(catalogStem).replace(/_YES_NO$/i, '');
  if (/^WIN1_AND_BOTH_TEAM_TO_SCORE/i.test(base) || /^WIN1_BOTH_TEAM_TO_SCORE_HALF/i.test(base)) {
    return 'П1';
  }
  if (/^DRAW_AND_BOTH_TEAM_TO_SCORE/i.test(base) || /^DRAW_BOTH_TEAM_TO_SCORE_HALF/i.test(base)) {
    return 'X';
  }
  if (/^WIN2_AND_BOTH_TEAM_TO_SCORE/i.test(base) || /^WIN2_BOTH_TEAM_TO_SCORE_HALF/i.test(base)) {
    return 'П2';
  }
  if (/^1X_AND_BOTH_TEAM_TO_SCORE/i.test(base)) return '1X';
  if (/^12_AND_BOTH_TEAM_TO_SCORE/i.test(base)) return '12';
  if (/^X2_AND_BOTH_TEAM_TO_SCORE/i.test(base)) return 'X2';
  return null;
}

export function isCombinedBttsOutcomeMarketName(catalogName: string): boolean {
  const base = stripCatalogSuffixes(catalogName).replace(/_YES_NO$/i, '');
  return /^(WINNER_AND_GOALS_BOTH|DOUBLECHANCE_AND_GOALS_BOTH|GOALS_BOTH_AND_WINNER_HALF)$/i.test(base)
    || /^WIN[12]_AND_BOTH_TEAM_TO_SCORE/i.test(base)
    || /^DRAW_AND_BOTH_TEAM_TO_SCORE/i.test(base)
    || /^[12]X_AND_BOTH_TEAM_TO_SCORE/i.test(base)
    || /^WIN[12]_BOTH_TEAM_TO_SCORE_HALF/i.test(base)
    || /^DRAW_BOTH_TEAM_TO_SCORE_HALF/i.test(base);
}

/** «П1» / «Будет гол» / «Не будет» for next-goal markets. */
export function formatNextGoalOutcome(code: string): string | null {
  const c = code.replace(/\s/g, '');

  if (/^Сл_Гол1/i.test(c)) return 'П1';
  if (/^Сл_Гол2/i.test(c)) return 'П2';
  if (/^Сл_ГолНик/i.test(c)) return 'Никто';

  if (/^СлГол_\d+мин_НеБудет$/i.test(c) || /^НетСл_Гол\d+мин/i.test(c)) return 'Не будет';
  if (/^СлГол_\d+мин$/i.test(c)) return 'Будет гол';

  if (/^К1СлГол_\d+мин_НеБудет$/i.test(c)) return 'Не будет';
  if (/^К2СлГол_\d+мин_НеБудет$/i.test(c)) return 'Не будет';
  if (/^К1СлГол_\d+мин$/i.test(c)) return 'П1';
  if (/^К2СлГол_\d+мин$/i.test(c)) return 'П2';

  if (/^СлГолвТечМатч_Да$/i.test(c)) return 'Да';
  if (/^СлГолвТечМатч_Нет$/i.test(c)) return 'Нет';

  return null;
}

/** Compact group title for next-goal display markets. */
export function resolveNextGoalGroupLabel(
  catalogStem: string,
  parameters?: OlimpbetProbability['parameters'],
): string | null {
  const base = stripCatalogSuffixes(catalogStem);
  const param = (type: string) => parameters?.find((p) => p.type === type)?.value;

  if (/^GOAL15MIN_YES_NO$/i.test(base)) {
    const from = param('PARAMETER_FROM');
    const to = param('PARAMETER_TO');
    if (from != null && to != null) return `${from}–${to} мин`;
    return null;
  }

  const timeMin = /^NEXT_GOAL_TIME_(\d+)MIN$/i.exec(base);
  if (timeMin) return `В течение ${timeMin[1]} мин`;

  const team1Time = /^NEXT_GOAL_TIME_TEAM1_(\d+)MIN$/i.exec(base);
  if (team1Time) return `П1 · в течение ${team1Time[1]} мин`;

  const team2Time = /^NEXT_GOAL_TIME_TEAM2_(\d+)MIN$/i.exec(base);
  if (team2Time) return `П2 · в течение ${team2Time[1]} мин`;

  if (/^NEXT_GOAL_HALF$/i.test(base)) {
    const half = param('PARAMETER_HALF_NUMBER');
    if (half === '1') return '1-й тайм';
    if (half === '2') return '2-й тайм';
  }

  if (/^NEXT_GOAL_PERIOD$/i.test(base)) {
    const period = param('PARAMETER_HALF_NUMBER') ?? param('PARAMETER_PERIOD_NUMBER');
    if (period) return `${period}-й период`;
  }

  if (/^NEXT_GOAL$|^NEXT_GOAL_2WAY$|^NEXT_GOAL_2WAY_WITH_OT$/i.test(base)) {
    return '';
  }

  return null;
}

/** «П1 · основное время» / «П2 · пенальти» for football winning-method markets. */
export function formatWinningMethodOutcome(code: string): string | null {
  const compact = code.replace(/\s/g, '');
  const football = /^К([12])_(ОснВремя|ОТ|Пен)$/i.exec(compact);
  if (football) {
    const side = football[1] === '1' ? 'П1' : 'П2';
    const method = football[2]!.toLowerCase();
    const methodText =
      method === 'оснвремя' ? 'основное время'
        : method === 'от' ? 'ОТ'
          : 'пенальти';
    return `${side} · ${methodText}`;
  }

  const mma = /^К([12])(Нокаут|Сдача|РешСудей|ТехНокаут|Дисквал)$/i.exec(compact);
  if (mma) {
    const side = mma[1] === '1' ? 'П1' : 'П2';
    const methodMap: Record<string, string> = {
      нокаут: 'нокаут',
      сдача: 'сдача',
      решсудей: 'решение судей',
      технокаут: 'тех. нокаут',
      дисквал: 'дисквалификация',
    };
    return `${side} · ${methodMap[mma[2]!.toLowerCase()] ?? mma[2]}`;
  }

  if (/^ПобНичья$/i.test(compact)) return 'Ничья';

  return null;
}

export function isQualificationYesNoMarketName(catalogName: string): boolean {
  const base = stripCatalogSuffixes(catalogName).replace(/_YES_NO$/i, '').replace(/\s+/g, '');
  return /^NOT_(WIN|LOSE)_IN_REGULATION_TIME/i.test(base);
}

function goalCountLabel(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} гол`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} гола`;
  return `${n} голов`;
}

export function setCountLabel(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} сет`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} сета`;
  return `${n} сетов`;
}

function formatExactGoalsValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.endsWith('+')) {
    const base = trimmed.slice(0, -1);
    if (/^\d+$/.test(base)) return `${base}+ голов`;
    return `${trimmed} голов`;
  }
  if (/^\d+$/.test(trimmed)) return goalCountLabel(trimmed);
  return trimmed;
}

/** «Счет после 3 голов» — matches Olimpbet virtual category titles. */
export function formatScoreAfterGoalsLabel(goalCount: number): string {
  if (!Number.isFinite(goalCount) || goalCount <= 0) return 'Счет после X голов';
  return `Счет после ${goalCount} голов`;
}

/** Turn Olimpbet catalog codes (WINNER_10MIN) into UI labels like on olimpbet.kz. */
export function humanizeCatalogMarketName(
  catalogName: string,
  parameters?: OlimpbetProbability['parameters'],
): string {
  if (/^DOUBLE_CHANCE$/i.test(catalogName)) return 'Двойной шанс';

  const stem = stripCatalogSuffixes(catalogName);
  if (/^SCORE_AFTER_X_GOALS/i.test(stem)) {
    const goalNum = Number(paramValue(parameters, 'PARAMETER_GOAL_NUMBER'));
    if (Number.isFinite(goalNum) && goalNum > 0) {
      return formatScoreAfterGoalsLabel(goalNum);
    }
  }
  const scoreAfterSets = /^SCORE_AFTER_(\d+)SETS$/i.exec(stem);
  if (scoreAfterSets) {
    return `Счет после ${scoreAfterSets[1]}-го сета`;
  }

  const staticLabel = CATALOG_MARKET_LABELS[catalogName] ?? CATALOG_MARKET_LABELS[stem];
  if (staticLabel) return staticLabel;

  const patternLabel = resolveCatalogPatternLabel(catalogName);
  if (patternLabel) return patternLabel;

  const minMatch = /^WINNER_(\d+)MIN$/i.exec(catalogName);
  if (minMatch) return `Победа (${minMatch[1]} мин)`;

  const from = paramValue(parameters, 'PARAMETER_FROM');
  const to = paramValue(parameters, 'PARAMETER_TO');
  if (/^WINNER_/i.test(catalogName) && from != null && to != null) {
    return `Победа (${from}–${to} мин)`;
  }

  if (/^[A-Z][A-Z0-9_]+$/.test(catalogName) && catalogName.includes('_')) {
    return stripCatalogSuffixes(catalogName)
      .replace(/_WITH_OT$/i, ' (с ОТ)')
      .replace(/_YES_NO$/i, ': да/нет')
      .replace(/_3X$/i, '')
      .replace(/_/g, ' ')
      .replace(/\bWITH PARAMS\b/gi, '')
      .replace(/\bWINX2\b/gi, 'X2')
      .replace(/\bWINNER\b/gi, 'Победа')
      .replace(/\bGOALS\b/gi, 'Голы')
      .replace(/\bGOAL\b/gi, 'Гол')
      .replace(/\bRANGE\b/gi, 'диапазон')
      .replace(/\bEXACT\b/gi, 'Точное')
      .replace(/\bTEAM1\b/gi, 'команда 1')
      .replace(/\bTEAM2\b/gi, 'команда 2')
      .replace(/\bSTRONG\b/gi, 'Волевая')
      .replace(/\bWILLED\b/gi, 'победа')
      .replace(/\bBOTH\b/gi, 'в обоих таймах')
      .replace(/\bREST OF MATCH\b/gi, 'оставшееся время')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return catalogName;
}
