import { normalizeWcMarketKey } from './wc-odds-markets.util';

/** How a market should be settled — drives resolver selection, not per-market hardcoding. */
export type SettlementProfile =
  | 'SCORE'
  | 'SEQUENCE'
  | 'TIME_WINDOW'
  | 'OLIMPBET_ONLY'
  | 'DISPLAY';

const SCORE_MARKET_KEYS = new Set([
  'h2h',
  'totals',
  'totals_home',
  'totals_away',
  'handicap',
  'handicap_3way',
  'btts',
  'even_odd',
  'goals_both_min',
  'double_chance',
]);

export function catalogNameFromMarketKey(marketKey: string): string | null {
  if (!marketKey.startsWith('display_')) return null;
  return marketKey.slice('display_'.length);
}

/** Classify market for settlement pipeline (regex on Olimpbet catalog name). */
export function resolveSettlementProfile(marketKey: string): SettlementProfile {
  const catalog = catalogNameFromMarketKey(marketKey);

  if (catalog) {
    if (/^HOW_WILL_|^CORRECT_SCORE|^SCORE_SET|^FIRST_GOAL_AND|^LAST_GOAL_AND/i.test(catalog)) {
      return 'OLIMPBET_ONLY';
    }
  if (
    /NEXT_GOAL_TIME|_TIME_\d+MIN|WINNER_\d+MIN|DRAWN_MINUTES|WHEN.*GOAL|GOAL15MIN/i.test(catalog)
    || /GOAL.*TIME/i.test(catalog)
  ) {
    return 'TIME_WINDOW';
  }
    if (
      /DEUSE_POINT|NEXT_POINTS|RACE_TO|NEXT_GOAL|LAST_GOAL|GOALS_TEAM|NEXT_GOAL_HALF|LAST_GOAL_HALF/i.test(
        catalog,
      )
    ) {
      return 'SEQUENCE';
    }
    return 'DISPLAY';
  }

  const normalized = normalizeWcMarketKey(marketKey);
  if (SCORE_MARKET_KEYS.has(normalized)) return 'SCORE';

  return 'SCORE';
}

/** Plain «следующий гол» (who scores N) — not timing / how-scored / half variants. */
export function isPlainNextGoalMarket(marketKey: string): boolean {
  const catalog = catalogNameFromMarketKey(marketKey);
  return catalog === 'NEXT_GOAL';
}
