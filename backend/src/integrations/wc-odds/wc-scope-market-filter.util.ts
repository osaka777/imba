import { parseDisplayOutcomeParameters } from '../olimpbet-wc/olimpbet-probability-settlement.util';
import {
  isMarketScopeFinalized,
  parseMarketScopeFromText,
  type MarketScope,
} from '../olimpbet-wc/olimpbet-score-scope.util';
import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';

import type { WcGroupedMarkets, WcMarketGroup } from './wc-odds-markets.util';

const PURE_SCOPE_CATEGORY = /^\d+-[йи]\s+(?:сет|тайм)$|^\d+-я\s+четверть$/i;

function parseScopeFromParamTail(tail: string): MarketScope | null {
  const params: Record<string, string> = {};
  for (const chunk of tail.split('|')) {
    const colon = chunk.indexOf(':');
    if (colon <= 0) continue;
    params[chunk.slice(0, colon)] = chunk.slice(colon + 1);
  }

  const setNum = Number(params.PARAMETER_SET_NUMBER);
  if (Number.isFinite(setNum) && setNum >= 1) return { kind: 'set', index: setNum };

  const half = params.PARAMETER_HALF_NUMBER;
  if (half === '1') return { kind: 'half', index: 1 };
  if (half === '2') return { kind: 'half', index: 2 };

  const quarter = Number(params.PARAMETER_QUARTER_NUMBER);
  if (Number.isFinite(quarter) && quarter >= 1 && quarter <= 4) {
    return { kind: 'quarter', index: quarter };
  }

  return null;
}

function parseScopeFromGroupKey(key: string): MarketScope | null {
  const tail = key.includes('__') ? key.split('__').slice(1).join('__') : key;
  return parseScopeFromParamTail(tail);
}

function parseScopeFromOutcomeKey(outcomeKey: string): MarketScope | null {
  const normalized = outcomeKey.replace(/_base$/i, '');
  const fromTail = parseScopeFromParamTail(
    /^DISPLAY_\d+_\d+_?(.*)$/.exec(normalized)?.[1]?.trim() ?? '',
  );
  if (fromTail) return fromTail;
  return parseScopeFromParamTail(
    Object.entries(parseDisplayOutcomeParameters(normalized))
      .map(([type, value]) => `${type}:${value}`)
      .join('|'),
  );
}

export function resolveMarketGroupScope(category: string, group: WcMarketGroup): MarketScope | null {
  const trimmedCategory = category.trim();
  if (PURE_SCOPE_CATEGORY.test(trimmedCategory)) {
    const categoryScope = parseMarketScopeFromText(trimmedCategory);
    if (categoryScope) return categoryScope;
  }

  const sources = [
    group.label,
    trimmedCategory,
    group.key,
    ...group.outcomes.map((outcome) => outcome.outcomeKey),
    ...group.outcomes.map((outcome) => outcome.name),
  ];

  for (const source of sources) {
    if (!source) continue;
    const fromText = parseMarketScopeFromText(source);
    if (fromText) return fromText;
    const fromKey = parseScopeFromGroupKey(source);
    if (fromKey) return fromKey;
    const fromOutcome = parseScopeFromOutcomeKey(source);
    if (fromOutcome) return fromOutcome;
  }

  return null;
}

export function resolveBetPlacementScope(input: {
  marketKey: string;
  outcomeKey?: string | null;
  outcomeName?: string | null;
  groupKey?: string | null;
  totalsGroupLabel?: string | null;
}): MarketScope | null {
  const pseudoGroup: WcMarketGroup = {
    key: input.groupKey ?? '',
    marketKey: input.marketKey,
    label: input.totalsGroupLabel ?? input.outcomeName ?? '',
    outcomes: input.outcomeKey
      ? [{ name: input.outcomeName ?? '', price: 0, outcomeKey: input.outcomeKey }]
      : [],
  };

  return resolveMarketGroupScope(input.totalsGroupLabel ?? input.outcomeName ?? '', pseudoGroup)
    ?? resolveMarketGroupScope('', pseudoGroup);
}

export function isScopedMarketGroupFinalized(
  category: string,
  group: WcMarketGroup,
  detail?: OlimpbetEventDetail | null,
): boolean {
  if (!detail) return false;
  const scope = resolveMarketGroupScope(category, group);
  if (!scope) return false;
  return isMarketScopeFinalized(detail, scope);
}

/** Remove live markets for periods that already finished (set / half / quarter). */
export function filterFinalizedScopeMarkets(
  grouped: WcGroupedMarkets,
  detail?: OlimpbetEventDetail | null,
): WcGroupedMarkets {
  if (!detail) return grouped;

  const result: WcGroupedMarkets = {};

  for (const [category, groups] of Object.entries(grouped)) {
    const trimmedCategory = category.trim();
    if (PURE_SCOPE_CATEGORY.test(trimmedCategory)) {
      const categoryScope = parseMarketScopeFromText(trimmedCategory);
      if (categoryScope && isMarketScopeFinalized(detail, categoryScope)) {
        continue;
      }
    }

    const kept = groups.filter((group) => !isScopedMarketGroupFinalized(category, group, detail));
    if (kept.length > 0) result[category] = kept;
  }

  return result;
}
