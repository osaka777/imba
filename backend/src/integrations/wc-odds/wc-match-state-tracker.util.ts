import { extractOlimpbetScore, parseScorePair, statValue } from '../olimpbet-wc/olimpbet-event-result.util';
import { parsePeriodScoreList } from '../olimpbet-wc/olimpbet-score-scope.util';
import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';

import { tennisGameScoreHadDeuce, detectTennisPointWinner, inferTennisGameClosingPointWinner, isTennisGameStartScore, parseTennisGameScore } from './tennis-game-score.util';
import {
  emptyMatchState,
  parseMatchState,
  tennisGameKey,
  type WcMatchState,
  type WcMatchStateSoccer,
  type WcMatchStateTennis,
  type WcProbabilitySnapshotResult,
  type WcTennisGameState,
} from './wc-match-state.types';

export function getTennisCurrentSetIndex(detail: OlimpbetEventDetail): number {
  const periods = parsePeriodScoreList(detail);
  if (periods.length > 0) return periods.length;

  const phase = Number(statValue(detail, 'match_phase'));
  if (Number.isFinite(phase) && phase >= 1) return phase;

  return 1;
}

export function getTennisSetGames(
  detail: OlimpbetEventDetail,
  setIndex: number,
): { home: number; away: number } {
  const pair = parsePeriodScoreList(detail)[setIndex - 1];
  return pair ?? { home: 0, away: 0 };
}

/** Valid completed tennis set (games within set, incl. 7-6 tiebreak). */
export function isValidTennisSetFinalScore(home: number, away: number): boolean {
  if (home === away) return false;
  const max = Math.max(home, away);
  const min = Math.min(home, away);
  if (max >= 6 && max - min >= 2) return true;
  if (max === 7 && min === 6) return true;
  return false;
}

function inferCompletedGameWinner(game: WcTennisGameState): 'home' | 'away' | null {
  if (game.pointWinners && Object.keys(game.pointWinners).length > 0) {
    let home = 0;
    let away = 0;
    for (const winner of Object.values(game.pointWinners)) {
      if (winner === 'home') home += 1;
      else if (winner === 'away') away += 1;
    }
    if (home > away) return 'home';
    if (away > home) return 'away';
  }

  if (game.pointsWon) {
    const { home = 0, away = 0 } = game.pointsWon;
    if (home > away) return 'home';
    if (away > home) return 'away';
  }

  if (game.lastGameScore) {
    const parsed = parseTennisGameScore(game.lastGameScore);
    if (parsed) {
      const winner = inferTennisGameClosingPointWinner(parsed);
      if (winner) return winner;
    }
  }

  return null;
}

/**
 * Reconstruct set game score from tracked games when Olimpbet strips scores_by_periods.
 * Uses partial game winners + valid tennis set constraints when some games lack point data.
 */
export function inferTennisSetGamesFromMatchState(
  state: WcMatchState | null | undefined,
  setIndex: number,
): { home: number; away: number } | null {
  const tennis = state?.tennis;
  if (!tennis) return null;

  const cached = tennis.setScores?.[setIndex - 1];
  if (cached) return cached;

  const expected = tennis.gamesCompletedBySet[String(setIndex)];
  if (expected == null || expected <= 0) return null;

  let knownHome = 0;
  let knownAway = 0;
  let unknown = 0;

  for (let gameIndex = 1; gameIndex <= expected; gameIndex += 1) {
    const game = tennis.games[tennisGameKey(setIndex, gameIndex)];
    if (!game?.completed) return null;

    const winner = inferCompletedGameWinner(game);
    if (winner === 'home') knownHome += 1;
    else if (winner === 'away') knownAway += 1;
    else unknown += 1;
  }

  if (unknown === 0) {
    return { home: knownHome, away: knownAway };
  }

  const candidates: Array<{ home: number; away: number }> = [];
  for (let home = 0; home <= expected; home += 1) {
    const away = expected - home;
    if (!isValidTennisSetFinalScore(home, away)) continue;
    if (home < knownHome || away < knownAway) continue;
    if (home - knownHome + away - knownAway !== unknown) continue;
    candidates.push({ home, away });
  }

  return candidates.length === 1 ? candidates[0] : null;
}

function ensureTennis(state: WcMatchState): WcMatchStateTennis {
  if (!state.tennis) {
    state.tennis = { games: {}, gamesCompletedBySet: {} };
  }
  return state.tennis;
}

function ensureGame(
  tennis: WcMatchStateTennis,
  setIndex: number,
  gameIndex: number,
) {
  const key = tennisGameKey(setIndex, gameIndex);
  if (!tennis.games[key]) {
    tennis.games[key] = { deuce: false, completed: false };
  }
  return tennis.games[key];
}

function finalizeGame(
  tennis: WcMatchStateTennis,
  setIndex: number,
  gameIndex: number,
) {
  const game = ensureGame(tennis, setIndex, gameIndex);
  if (game.trackedFromStart && game.lastGameScore && !game.completed) {
    recordClosingPointIfNeeded(game);
  }
  game.completed = true;
}

function nextPointIndex(game: ReturnType<typeof ensureGame>): number {
  return Object.keys(game.pointWinners ?? {}).length + 1;
}

function recordPointWinner(
  game: ReturnType<typeof ensureGame>,
  winner: 'home' | 'away',
) {
  if (!game.trackedFromStart) return;
  if (!game.pointWinners) game.pointWinners = {};
  if (!game.pointsWon) game.pointsWon = { home: 0, away: 0 };

  const index = String(nextPointIndex(game));
  if (!game.pointWinners[index]) {
    game.pointWinners[index] = winner;
    game.pointsWon[winner] += 1;
  }
}

function recordClosingPointIfNeeded(game: ReturnType<typeof ensureGame>) {
  if (!game.trackedFromStart || !game.lastGameScore) return;
  const lastScore = parseTennisGameScore(game.lastGameScore);
  if (!lastScore) return;
  const winner = inferTennisGameClosingPointWinner(lastScore);
  if (winner) recordPointWinner(game, winner);
}

function markTrackedFromStartIfEligible(
  game: ReturnType<typeof ensureGame>,
  gameScoreRaw: string | null,
) {
  if (game.trackedFromStart || game.completed) return;
  if (!gameScoreRaw) return;
  if (isTennisGameStartScore(gameScoreRaw)) {
    game.trackedFromStart = true;
  }
}

function applyGameScoreTransition(
  game: ReturnType<typeof ensureGame>,
  gameScoreRaw: string,
) {
  markTrackedFromStartIfEligible(game, gameScoreRaw);

  if (game.lastGameScore && game.lastGameScore !== gameScoreRaw) {
    const winner = detectTennisPointWinner(game.lastGameScore, gameScoreRaw);
    if (winner) recordPointWinner(game, winner);
  }

  game.lastGameScore = gameScoreRaw;
  if (tennisGameScoreHadDeuce(gameScoreRaw)) {
    game.deuce = true;
  }
}

/** Advance tennis game/deuce flags from the latest feed snapshot. */
export function advanceTennisMatchState(
  state: WcMatchState,
  detail: OlimpbetEventDetail,
): WcMatchState {
  const tennis = ensureTennis(state);
  const setIndex = getTennisCurrentSetIndex(detail);
  const setGames = getTennisSetGames(detail, setIndex);
  const gamesCompleted = setGames.home + setGames.away;
  const setKey = String(setIndex);

  const periods = parsePeriodScoreList(detail);
  if (periods.length > 0) {
    tennis.setScores = periods;
  }

  const prevCompleted = tennis.gamesCompletedBySet[setKey] ?? 0;
  if (gamesCompleted > prevCompleted) {
    for (let gameIndex = prevCompleted + 1; gameIndex <= gamesCompleted; gameIndex += 1) {
      finalizeGame(tennis, setIndex, gameIndex);
    }
    tennis.gamesCompletedBySet[setKey] = gamesCompleted;
  } else if (!(setKey in tennis.gamesCompletedBySet)) {
    tennis.gamesCompletedBySet[setKey] = gamesCompleted;
  }

  const gameScoreRaw = statValue(detail, 'game_score');
  if (gameScoreRaw) {
    const currentGameIndex = gamesCompleted + 1;
    const game = ensureGame(tennis, setIndex, currentGameIndex);
    applyGameScoreTransition(game, gameScoreRaw);
  }

  return state;
}

function ensureSoccer(state: WcMatchState): WcMatchStateSoccer {
  if (!state.soccer) {
    state.soccer = { lastHome: 0, lastAway: 0, goalScorers: {}, goalMinutes: {}, initialized: false };
  }
  if (!state.soccer.goalScorers) state.soccer.goalScorers = {};
  if (!state.soccer.goalMinutes) state.soccer.goalMinutes = {};
  return state.soccer;
}

/** Parse feed `current_time` like "81:48" → match minute (integer part). */
export function parseMatchMinuteFromFeed(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const match = /^(\d+)\s*:/.exec(trimmed);
  if (!match) return null;
  const minute = Number(match[1]);
  return Number.isFinite(minute) && minute >= 0 ? minute : null;
}

function recordGoal(
  soccer: WcMatchStateSoccer,
  side: 'home' | 'away',
  matchMinute: number | null,
) {
  const goalIndex = String(Object.keys(soccer.goalScorers!).length + 1);
  soccer.goalScorers![goalIndex] = side;
  if (matchMinute != null) {
    soccer.goalMinutes![goalIndex] = matchMinute;
  }
}

function captureSoccerFeedSnapshots(
  soccer: WcMatchStateSoccer,
  detail: OlimpbetEventDetail,
): void {
  const periods = parsePeriodScoreList(detail);
  if (periods.length > 0) {
    soccer.periodScores = periods;
  }

  const penRaw = statValue(detail, 'penalty_score');
  const penPair = parseScorePair(penRaw);
  if (penPair) {
    soccer.penaltyScore = { home: penPair.home, away: penPair.away };
  }
}

/** Record match goals only when feed score increases (no retroactive guess). */
export function advanceSoccerMatchState(
  state: WcMatchState,
  detail: OlimpbetEventDetail,
): WcMatchState {
  const soccer = ensureSoccer(state);
  captureSoccerFeedSnapshots(soccer, detail);
  const score = extractOlimpbetScore(detail);
  const home = score.homeScore ?? 0;
  const away = score.awayScore ?? 0;

  const matchMinute = parseMatchMinuteFromFeed(statValue(detail, 'current_time'));

  if (!soccer.initialized) {
    soccer.lastHome = home;
    soccer.lastAway = away;
    soccer.initialized = true;
    return state;
  }

  while (soccer.lastHome < home) {
    soccer.lastHome += 1;
    recordGoal(soccer, 'home', matchMinute);
  }

  while (soccer.lastAway < away) {
    soccer.lastAway += 1;
    recordGoal(soccer, 'away', matchMinute);
  }

  return state;
}

export function isTennisSetFinalized(
  detail: OlimpbetEventDetail,
  setIndex: number,
): boolean {
  const periods = parsePeriodScoreList(detail);
  return periods.length > setIndex;
}

function probabilitySnapshotKey(
  marketId: number,
  outcomeTypeId: number,
  parameters: Array<{ type: string; value: string }> | null | undefined,
): string {
  const paramStr = (parameters ?? [])
    .map((p) => `${p.type}=${p.value}`)
    .sort()
    .join('|');
  return `${marketId}:${outcomeTypeId}:${paramStr}`;
}

function mapTradingStatusToSnapshot(
  tradingStatus: string | null | undefined,
  odd: number,
): WcProbabilitySnapshotResult | null {
  const upper = (tradingStatus ?? '').toUpperCase();
  if (/WON|WINNER|\bWIN\b/.test(upper)) return 'WIN';
  if (/LOST|LOSER|\bLOSE\b/.test(upper)) return 'LOSE';
  if (/VOID|CANCEL|REFUND/.test(upper)) return 'VOID';
  if (upper.includes('RESULTED') || upper.includes('SETTLED') || upper.includes('CLOSED')) {
    if (odd >= 1 && odd < 1.01) return 'VOID';
    if (odd < 1) return 'LOSE';
  }
  return null;
}

/** Merge Olimpbet probability outcomes into durable snapshots (never discard once known). */
export function captureProbabilitySnapshots(
  state: WcMatchState,
  detail: OlimpbetEventDetail,
): WcMatchState {
  if (!detail.probabilities?.markets?.length) return state;

  if (!state.probabilitySnapshots) state.probabilitySnapshots = {};

  for (const market of detail.probabilities.markets) {
    for (const prob of market.probabilities ?? []) {
      const mapped = mapTradingStatusToSnapshot(prob.tradingStatus, prob.odd);
      if (!mapped) continue;

      const key = probabilitySnapshotKey(
        market.marketId,
        prob.outcomeTypeId,
        prob.parameters,
      );
      state.probabilitySnapshots[key] = mapped;
    }
  }

  return state;
}

export function advanceMatchState(
  prev: unknown,
  detail: OlimpbetEventDetail,
  sportSlug: string | null | undefined,
): WcMatchState {
  const base = parseMatchState(prev) ?? emptyMatchState();
  const periodScores = parsePeriodScoreList(detail);
  if (periodScores.length > 0) {
    base.result = {
      ...base.result,
      periodScores,
      capturedAt: new Date().toISOString(),
    };
  }

  if (sportSlug === 'tennis' || sportSlug === 'table-tennis') {
    advanceTennisMatchState(base, detail);
  }

  if (sportSlug === 'soccer') {
    advanceSoccerMatchState(base, detail);
  }

  captureProbabilitySnapshots(base, detail);
  base.updatedAt = new Date().toISOString();
  return base;
}
