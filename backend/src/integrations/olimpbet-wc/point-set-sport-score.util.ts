import type { OlimpbetEventDetail } from './olimpbet-wc.types';

import {
  looksLikePointSetSportPeriods,
  looksLikeTennisSetPeriods,
  parsePeriodScoreList,
} from './olimpbet-score-scope.util';

/** Match totals / team totals — sum points or goals across periods. */
export function usesPointAggregateScore(marketKey: string): boolean {
  const base = marketKey.replace(/_ot$/i, '');
  return base === 'totals' || base === 'totals_home' || base === 'totals_away';
}

/** Match winner markets — use sets/games won (score field), not point sums. */
export function usesSetsWonScore(marketKey: string): boolean {
  const base = marketKey.replace(/_ot$/i, '');
  return (
    base === 'h2h'
    || base === 'double_chance'
    || base === 'handicap_3way'
  );
}

/** Volleyball / table-tennis — high point totals per set in scores_by_periods. */
export function isPointSetSportFeed(detail?: OlimpbetEventDetail): boolean {
  const periods = parsePeriodScoreList(detail);
  return periods.length > 0 && looksLikePointSetSportPeriods(periods);
}

/** Tennis — low game counts per set (4:6 style). */
export function isTennisGameFeed(detail?: OlimpbetEventDetail): boolean {
  const periods = parsePeriodScoreList(detail);
  return periods.length > 0 && looksLikeTennisSetPeriods(periods);
}
