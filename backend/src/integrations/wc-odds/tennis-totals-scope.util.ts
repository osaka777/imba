import { parseMarketScopeFromText } from '../olimpbet-wc/olimpbet-score-scope.util';

import { tennisGameKey, type WcMatchState } from './wc-match-state.types';

export type TennisTotalsScope = {
  setNum: number;
  gameNum?: number;
  unit: 'points' | 'games';
};

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
