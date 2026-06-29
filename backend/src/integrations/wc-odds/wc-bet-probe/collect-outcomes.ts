import {
  isTotalsMarketKey,
  isWcBetPlacementAllowed,
  normalizeWcMarketKey,
  type WcGroupedMarkets,
  type WcMarketGroup,
} from '../wc-odds-markets.util';

import type { WcBetProbeCandidate, WcBetProbeGroupRef } from './types';

const MIN_PRICE = 1.01;

const PRIORITY_MARKET_KEYS = new Set([
  'totals',
  'totals_home',
  'totals_away',
  'h2h',
  'double_chance',
  'even_odd',
  'handicap',
]);

function marketPriority(marketKey: string): number {
  const normalized = normalizeWcMarketKey(marketKey);
  if (PRIORITY_MARKET_KEYS.has(normalized)) return 0;
  if (marketKey.startsWith('display_TOTAL') || /INDIVIDUAL_TOTAL/i.test(marketKey)) return 1;
  if (marketKey.startsWith('display_')) return 3;
  return 2;
}

function isOutcomeOffered(outcome: { price?: number | null; suspended?: boolean | null }): boolean {
  if (outcome.suspended) return false;
  const price = Number(outcome.price);
  return Number.isFinite(price) && price >= MIN_PRICE;
}

function extractTotalsLine(outcome: { point?: number | null; outcomeKey: string }, groupLabel: string): string | null {
  if (outcome.point != null) return String(outcome.point);
  const fromKey = outcome.outcomeKey.match(/^(OVER|UNDER)_(.+)$/);
  if (fromKey) return fromKey[2];
  const fromLabel = groupLabel.match(/([\d]+(?:[.,]\d+)?)/);
  return fromLabel ? fromLabel[1].replace(',', '.') : null;
}

function buildOutcomeTitle(marketKey: string, groupLabel: string, outcome: { outcomeKey: string; name: string }): string {
  const key = normalizeWcMarketKey(marketKey);
  if (isTotalsMarketKey(key)) {
    const line = extractTotalsLine(outcome, groupLabel);
    const side = outcome.outcomeKey.startsWith('UNDER') ? 'Меньше' : 'Больше';
    const setScope = groupLabel.match(/(\d+-[йи]\s+сет)/i)?.[1];
    const base = setScope ? `${setScope} — Тотал` : /тотал/i.test(groupLabel) ? groupLabel : 'Тотал';
    return line ? `${base} ${line} — ${side}` : `${groupLabel} — ${side}`;
  }
  return `${groupLabel}: ${outcome.name}`;
}

function iterGroups(grouped: WcGroupedMarkets): WcBetProbeGroupRef[] {
  const out: WcBetProbeGroupRef[] = [];
  for (const [category, groups] of Object.entries(grouped ?? {})) {
    for (const group of groups ?? []) {
      out.push({ ...group, category });
    }
  }
  return out;
}

/** Collect outcomes a real user could tap in the coupon (mirrors frontend rules). */
export function collectBettableOutcomes(
  grouped: WcGroupedMarkets,
  opts: {
    bettingOpen: boolean;
    maxOutcomes: number;
    /** Dry-run audit on finished matches — inspect priced outcomes anyway. */
    includeWhenClosed?: boolean;
  },
): WcBetProbeCandidate[] {
  if (!opts.bettingOpen && !opts.includeWhenClosed) return [];

  const groups = iterGroups(grouped)
    .filter((group) => group.outcomes?.length)
    .sort((a, b) => {
      const pa = marketPriority(a.marketKey);
      const pb = marketPriority(b.marketKey);
      if (pa !== pb) return pa - pb;
      return a.key.localeCompare(b.key);
    });

  const candidates: WcBetProbeCandidate[] = [];

  for (const group of groups) {
    for (const outcome of group.outcomes) {
      if (!isOutcomeOffered(outcome)) continue;
      if (!isWcBetPlacementAllowed(group.marketKey, outcome.outcomeKey)) continue;

      const line = isTotalsMarketKey(normalizeWcMarketKey(group.marketKey))
        ? extractTotalsLine(outcome, group.label)
        : outcome.point != null
          ? String(outcome.point)
          : null;

      candidates.push({
        marketKey: group.marketKey,
        groupKey: group.key,
        groupLabel: group.label,
        outcome,
        line,
        outcomeName: buildOutcomeTitle(group.marketKey, group.label, outcome),
        clientOdds: Number(outcome.price),
        totalsGroupLabel: isTotalsMarketKey(normalizeWcMarketKey(group.marketKey)) ? group.label : undefined,
      });
    }
  }

  return candidates.slice(0, opts.maxOutcomes);
}

export function findVisibleButNotBettable(grouped: WcGroupedMarkets): Array<{
  marketKey: string;
  groupKey: string;
  outcomeKey: string;
  price: number;
}> {
  const mismatches: Array<{ marketKey: string; groupKey: string; outcomeKey: string; price: number }> = [];
  for (const group of iterGroups(grouped)) {
    for (const outcome of group.outcomes ?? []) {
      if (!isOutcomeOffered(outcome)) continue;
      if (isWcBetPlacementAllowed(group.marketKey, outcome.outcomeKey)) continue;
      mismatches.push({
        marketKey: group.marketKey,
        groupKey: group.key,
        outcomeKey: outcome.outcomeKey,
        price: Number(outcome.price),
      });
    }
  }
  return mismatches;
}

export function countGroupedOutcomes(grouped: WcGroupedMarkets): number {
  let count = 0;
  for (const group of iterGroups(grouped)) {
    count += group.outcomes?.length ?? 0;
  }
  return count;
}

export function pickSetTotalsCandidates(candidates: WcBetProbeCandidate[]): WcBetProbeCandidate[] {
  return candidates.filter((c) => {
    const normalized = normalizeWcMarketKey(c.marketKey);
    if (!isTotalsMarketKey(normalized)) return false;
    return /\d+-[йи]\s+сет/i.test(c.groupLabel) || /\d+-[йи]\s+сет/i.test(c.outcomeName);
  });
}

export type { WcMarketGroup };
