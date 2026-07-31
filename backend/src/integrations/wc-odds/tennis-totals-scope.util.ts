import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';
import {
  looksLikeTennisSetPeriods,
  parseMarketScopeFromText,
  parsePeriodScoreList,
} from '../olimpbet-wc/olimpbet-score-scope.util';

import { tennisGameKey, type WcMatchState } from './wc-match-state.types';

export type TennisTotalsScope = {
  setNum: number;
  gameNum?: number;
  unit: 'points' | 'games';
};

export type TennisGamesPair = { home: number; away: number };

/** Parse tennis totals label: set games vs points within a scoped game. */
export function parseTennisTotalsScopeFromText(text: string): TennisTotalsScope | null {
  const setMatch = text.match(/(\d+)-[йи]\s+сет/i);
  if (!setMatch) return null;

  const setNum = Number(setMatch[1]);
  if (!Number.isFinite(setNum) || setNum < 1) return null;

  const gameMatch = text.match(/(\d+)-[йи]\s+гейм/i);
  const gameNum = gameMatch ? Number(gameMatch[1]) : undefined;
  if (gameNum != null && (!Number.isFinite(gameNum) || gameNum < 1)) return null;

  if (/тотал\s+очков/i.test(text)) {
    return { setNum, gameNum, unit: 'points' };
  }
  if (/тотал\s+геймов/i.test(text)) {
    return { setNum, gameNum, unit: 'games' };
  }
  if (gameNum != null) {
    return { setNum, gameNum, unit: 'points' };
  }
  if (parseMarketScopeFromText(text)?.kind === 'set') {
    return { setNum, unit: 'games' };
  }

  return null;
}

/**
 * Match-level tennis «Тотал геймов» (no «N-й сет» scope).
 * Must not use set score (0:2) — sum games across completed sets instead.
 */
export function isMatchLevelTennisGamesTotal(
  scopeHint: string | null | undefined,
  tennisScope: TennisTotalsScope | null = scopeHint
    ? parseTennisTotalsScopeFromText(scopeHint)
    : null,
): boolean {
  if (tennisScope) return false;
  if (!scopeHint) return true;
  if (/тотал\s+сетов/i.test(scopeHint)) return false;
  if (/тотал\s+очков/i.test(scopeHint)) return false;
  if (/тотал\s+геймов/i.test(scopeHint)) return true;
  // Unscoped «Тотал · 22.5» on tennis feed — games, not sets.
  return /тотал/i.test(scopeHint);
}

function sumGamesPair(periods: Array<{ home: number; away: number }>): TennisGamesPair {
  let home = 0;
  let away = 0;
  for (const period of periods) {
    home += period.home;
    away += period.away;
  }
  return { home, away };
}

/** Sum tennis games across sets from live detail and/or persisted match state. */
export function resolveTennisMatchGamesPair(
  detail?: OlimpbetEventDetail,
  matchState?: WcMatchState | null,
): TennisGamesPair | null {
  const fromDetail = parsePeriodScoreList(detail);
  if (fromDetail.length > 0 && looksLikeTennisSetPeriods(fromDetail)) {
    return sumGamesPair(fromDetail);
  }

  const fromResult = matchState?.result?.periodScores;
  if (fromResult?.length && looksLikeTennisSetPeriods(fromResult)) {
    return sumGamesPair(fromResult);
  }

  const fromSets = matchState?.tennis?.setScores;
  if (fromSets?.length && looksLikeTennisSetPeriods(fromSets)) {
    return sumGamesPair(fromSets);
  }

  return null;
}

/** Combined match games total (period scores, or gamesCompletedBySet fallback). */
export function resolveTennisMatchGamesTotal(
  detail?: OlimpbetEventDetail,
  matchState?: WcMatchState | null,
): number | null {
  const pair = resolveTennisMatchGamesPair(detail, matchState);
  if (pair) return pair.home + pair.away;

  const bySet = matchState?.tennis?.gamesCompletedBySet;
  if (!bySet) return null;
  const totals = Object.values(bySet).filter((n) => Number.isFinite(n) && n > 0);
  if (totals.length === 0) return null;
  return totals.reduce((sum, n) => sum + n, 0);
}

export function isTennisGamePointsTotalsScope(scopeHint: string | null | undefined): boolean {
  if (!scopeHint) return false;
  const scope = parseTennisTotalsScopeFromText(scopeHint);
  return scope?.unit === 'points' && scope.gameNum != null;
}

export function tennisGamePointsPlayed(
  matchState: WcMatchState | null | undefined,
  setNum: number,
  gameNum: number,
): number | null {
  const game = matchState?.tennis?.games[tennisGameKey(setNum, gameNum)];
  if (!game) return null;

  if (game.pointsWon) {
    return (game.pointsWon.home ?? 0) + (game.pointsWon.away ?? 0);
  }

  const winners = game.pointWinners;
  if (winners && Object.keys(winners).length > 0) {
    return Object.keys(winners).length;
  }

  return null;
}

export function isTennisScopedGameCompleted(
  matchState: WcMatchState | null | undefined,
  setNum: number,
  gameNum: number,
): boolean {
  const game = matchState?.tennis?.games[tennisGameKey(setNum, gameNum)];
  return Boolean(game?.completed);
}
