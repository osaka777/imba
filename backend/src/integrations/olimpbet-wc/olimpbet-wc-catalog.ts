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

  if (code.includes('Да') || code.endsWith('_Да')) label = 'Да';
  else if (code.includes('Нет') || code.endsWith('_Нет')) label = 'Нет';
  else if (/^П[12]$/.test(code)) label = code;
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

/** Pattern-based Russian labels for Olimpbet catalog codes. */
export function resolveCatalogPatternLabel(catalogName: string): string | null {
  const base = stripCatalogSuffixes(catalogName);

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
  if (/^MULTISCORE_SET/i.test(base)) return 'Мультисчёт сета';

  return null;
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

/** Turn Olimpbet catalog codes (WINNER_10MIN) into UI labels like on olimpbet.kz. */
export function humanizeCatalogMarketName(
  catalogName: string,
  parameters?: OlimpbetProbability['parameters'],
): string {
  if (/^DOUBLE_CHANCE$/i.test(catalogName)) return 'Двойной шанс';

  const staticLabel = CATALOG_MARKET_LABELS[catalogName] ?? CATALOG_MARKET_LABELS[stripCatalogSuffixes(catalogName)];
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
      .replace(/\bREST OF MATCH\b/gi, 'оставшееся время')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return catalogName;
}
