import { WcOddsBetStatus, WcOddsPick } from '@prisma/client';

import {
  parseDisplayOutcomeKey,
  parseDisplayOutcomeParameters,
  resolveDisplayOutcomeResult,
  type OlimpbetProbabilityResult,
} from '../olimpbet-wc/olimpbet-probability-settlement.util';
import {
  extractPeriodScore,
  isMarketScopeFinalized,
  parseMarketScopeFromText,
  parsePeriodScoreList,
  pickSettlementScores,
  type MarketScope,
  type PeriodScope,
} from '../olimpbet-wc/olimpbet-score-scope.util';
import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';
import {
  isPointSetSportFeed,
  isTennisGameFeed,
} from '../olimpbet-wc/point-set-sport-score.util';
import { statValue, isOlimpbetEventCompleted } from '../olimpbet-wc/olimpbet-event-result.util';

import { isTotalsMarketKey, normalizeWcMarketKey } from './wc-odds-markets.util';
import type { WcBetSettlementInput } from './wc-odds-settlement.util';
import {
  getTennisSetGames,
  inferTennisSetGamesFromMatchState,
  isTennisSetFinalized,
  isValidTennisSetFinalScore,
  parseMatchMinuteFromFeed,
} from './wc-match-state-tracker.util';
import { parseRaceTargetFromParams, parseTennisScopedGameParams } from './tennis-market-params.util';
import { parseTennisGameScore } from './tennis-game-score.util';
import {
  tennisGameKey,
  type WcMatchState,
  type WcMatchStateSoccer,
  type WcProbabilitySnapshotResult,
  type WcTennisGameState,
} from './wc-match-state.types';
import { isPlainNextGoalMarket, resolveSettlementProfile } from './wc-settlement-profile.util';

/** Olimpbet «Специальные ставки: последнее событие» (market 1565). */
const LAST_EVENT_MARKET_ID = 1565;
const LAST_EVENT_OUTCOME_GOAL = 2356;
const LAST_EVENT_LATE_GOAL_MINUTE = 85;

export type WcSettlementContext = {
  homeScore: number;
  awayScore: number;
  detail?: OlimpbetEventDetail;
  matchState?: WcMatchState | null;
};

function mapOlimpbetResult(result: OlimpbetProbabilityResult): WcOddsBetStatus {
  if (result === 'WIN') return WcOddsBetStatus.WIN;
  if (result === 'LOSE') return WcOddsBetStatus.LOSE;
  return WcOddsBetStatus.VOID;
}

function resolveTotalsLine(bet: WcBetSettlementInput): number | null {
  const line = Number(bet.line ?? bet.outcomeKey?.replace(/^(OVER|UNDER)_/, ''));
  return Number.isFinite(line) ? line : null;
}

function resolveTotalsScopeHint(bet: WcBetSettlementInput): string | null {
  if (bet.outcomeName && parseMarketScopeFromText(bet.outcomeName)) return bet.outcomeName;
  if (bet.placementContext?.totalsGroupLabel) return bet.placementContext.totalsGroupLabel;
  return bet.outcomeName ?? null;
}

function scopeTotalForBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): number | null {
  const marketKey = normalizeWcMarketKey(bet.marketKey || 'totals');
  if (!isTotalsMarketKey(marketKey)) return null;

  const scopeHint = resolveTotalsScopeHint(bet);
  const scoped = pickSettlementScores(
    ctx.detail,
    ctx.homeScore,
    ctx.awayScore,
    bet.marketKey || 'totals',
    scopeHint,
  );

  const scope = scopeHint ? parseMarketScopeFromText(scopeHint) : null;
  if (scope?.kind === 'set' && !parsePeriodScoreList(ctx.detail)[scope.index - 1]) {
    const inferred = inferTennisSetGamesFromMatchState(ctx.matchState, scope.index);
    if (inferred) {
      scoped.homeScore = inferred.home;
      scoped.awayScore = inferred.away;
    }
  }

  if (marketKey === 'totals_home') return scoped.homeScore;
  if (marketKey === 'totals_away') return scoped.awayScore;
  return scoped.homeScore + scoped.awayScore;
}

export function parseYesNoOutcome(bet: WcBetSettlementInput): boolean | null {
  const name = bet.outcomeName ?? '';
  if (/:\s*Да/i.test(name)) return true;
  if (/:\s*Нет/i.test(name)) return false;
  return null;
}

export function parseTennisSidePick(bet: WcBetSettlementInput): 'home' | 'away' | null {
  if (bet.pick === WcOddsPick.HOME) return 'home';
  if (bet.pick === WcOddsPick.AWAY) return 'away';
  const name = bet.outcomeName ?? '';
  if (/:\s*П1/i.test(name)) return 'home';
  if (/:\s*П2/i.test(name)) return 'away';
  return null;
}

function probabilitySnapshotKeyFromBet(bet: WcBetSettlementInput): string | null {
  const parsed = bet.outcomeKey ? parseDisplayOutcomeKey(bet.outcomeKey) : null;
  if (!parsed) return null;

  const params = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
  const paramStr = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('|');
  return `${parsed.marketId}:${parsed.outcomeTypeId}:${paramStr}`;
}

function resolveFromProbabilitySnapshot(
  bet: WcBetSettlementInput,
  matchState?: WcMatchState | null,
): WcOddsBetStatus | null {
  const key = probabilitySnapshotKeyFromBet(bet);
  if (!key || !matchState?.probabilitySnapshots) return null;

  const snap: WcProbabilitySnapshotResult | undefined = matchState.probabilitySnapshots[key];
  if (!snap) return null;
  return mapOlimpbetResult(snap);
}

/** Tennis DEUSE_POINT: 40:40 in scoped game → Yes wins; game ends without deuce → No wins. */
export function resolveDeucePointBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/DEUSE_POINT/i.test(bet.marketKey)) return null;

  const scope = parseTennisScopedGameParams(bet.outcomeKey);
  if (!scope) return null;

  const yes = parseYesNoOutcome(bet);
  if (yes == null) return null;

  const game = ctx.matchState?.tennis?.games[tennisGameKey(scope.setNum, scope.gameNum)];
  if (!game) return null;

  if (game.deuce && yes) return WcOddsBetStatus.WIN;
  if (game.completed) {
    return game.deuce === yes ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }

  return null;
}

/**
 * Tennis NEXT_POINTS_GAME: settle only when point winner was tracked from game start (0:0).
 * PARAMETER_POINT_NUMBER is 1-based index within the game.
 */
export function resolveNextPointGameBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/NEXT_POINTS_GAME/i.test(bet.marketKey)) return null;

  const scope = parseTennisScopedGameParams(bet.outcomeKey);
  if (!scope?.pointNum) return null;

  const side = parseTennisSidePick(bet);
  if (!side) return null;

  const game = ctx.matchState?.tennis?.games[tennisGameKey(scope.setNum, scope.gameNum)];
  if (!game?.trackedFromStart) return null;

  const winner = game.pointWinners?.[String(scope.pointNum)];
  if (winner) {
    return winner === side ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }

  if (game.completed) {
    const pointsTracked = Object.keys(game.pointWinners ?? {}).length;
    if (scope.pointNum > pointsTracked) return WcOddsBetStatus.LOSE;
  }

  return null;
}

/**
 * Tennis RACE_TO_POINT_GAME: first to N points in scoped game (PARAMETER_POINT_NUMBER = target).
 */
export function resolveRaceToPointGameBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/RACE_TO_POINT_GAME/i.test(bet.marketKey)) return null;

  const scope = parseTennisScopedGameParams(bet.outcomeKey);
  const target = scope?.pointNum;
  if (!scope || target == null) return null;

  const side = parseTennisSidePick(bet);
  if (!side) return null;

  const game = ctx.matchState?.tennis?.games[tennisGameKey(scope.setNum, scope.gameNum)];
  if (!game?.trackedFromStart || !game.pointsWon) return null;

  const { home, away } = game.pointsWon;
  if (home >= target) {
    return side === 'home' ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }
  if (away >= target) {
    return side === 'away' ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }

  if (game.completed && home < target && away < target) {
    return WcOddsBetStatus.LOSE;
  }

  return null;
}

/**
 * Tennis RACE_TO_GAME: first to N games in scoped set.
 * Target from PARAMETER_NUMBER / PARAMETER_VALUE (not game index).
 */
export function resolveRaceToGameBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/RACE_TO_GAME/i.test(bet.marketKey)) return null;

  const params = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
  const setNum = Number(params.PARAMETER_SET_NUMBER);
  const target = parseRaceTargetFromParams(bet, [
    'PARAMETER_NUMBER',
    'PARAMETER_VALUE',
    'PARAMETER_GAME_NUMBER',
  ]);
  if (!Number.isFinite(setNum) || target == null || !ctx.detail) return null;

  const side = parseTennisSidePick(bet);
  if (!side) return null;

  const setGames = getTennisSetGames(ctx.detail, setNum);
  if (setGames.home >= target) {
    return side === 'home' ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }
  if (setGames.away >= target) {
    return side === 'away' ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }

  if (isTennisSetFinalized(ctx.detail, setNum)) {
    return WcOddsBetStatus.LOSE;
  }

  return null;
}

function parseGoalNumberFromBet(bet: WcBetSettlementInput): number | null {
  return parseRaceTargetFromParams(bet, [
    'PARAMETER_GOAL_NUMBER',
    'PARAMETER_NUMBER',
    'PARAMETER_VALUE',
  ]) ?? bet.placementContext?.expectedGoalIndex ?? null;
}

/** Soccer NEXT_GOAL: who scores goal N (tracked only after feed baseline init). */
export function resolveNextGoalBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!isPlainNextGoalMarket(bet.marketKey)) return null;

  const goalNum = parseGoalNumberFromBet(bet);
  if (goalNum == null) return null;

  const side = parseTennisSidePick(bet);
  if (!side) return null;

  const soccer = ctx.matchState?.soccer;
  if (!soccer?.initialized) return null;

  const scorer = soccer.goalScorers?.[String(goalNum)];
  if (scorer) {
    return scorer === side ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }

  if (ctx.detail && isOlimpbetEventCompleted(ctx.detail)) {
    const totalGoals = ctx.homeScore + ctx.awayScore;
    if (totalGoals < goalNum) return WcOddsBetStatus.LOSE;
  }

  return null;
}

type ExactGoalsExpectation =
  | { kind: 'exact'; value: number }
  | { kind: 'plus'; value: number };

function parseExactGoalsParameter(raw: string): ExactGoalsExpectation | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.endsWith('+')) {
    const base = Number(trimmed.slice(0, -1).replace(',', '.'));
    return Number.isFinite(base) ? { kind: 'plus', value: base } : null;
  }

  const exact = Number(trimmed.replace(',', '.'));
  return Number.isFinite(exact) ? { kind: 'exact', value: exact } : null;
}

function matchesExactGoals(total: number, expectation: ExactGoalsExpectation): boolean {
  if (expectation.kind === 'exact') return total === expectation.value;
  return total >= expectation.value;
}

/**
 * Match / half / team exact goal count (EXACT_GOALS, EXACT_GOALS_WITHPARAMS, EXACT_GOALS_TEAM1/2).
 * Supports exact N and N+ (e.g. 6+ goals) from PARAMETER_EXACT_GOALS.
 */
export function resolveExactGoalsBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/display_EXACT_GOALS/i.test(bet.marketKey)) return null;
  if (/TEAM[12]_HALF/i.test(bet.marketKey)) return null;

  const params = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
  const raw = params.PARAMETER_EXACT_GOALS;
  if (!raw) return null;

  const expectation = parseExactGoalsParameter(raw);
  if (!expectation) return null;

  if (!ctx.detail || !isOlimpbetEventCompleted(ctx.detail)) return null;

  const halfNum = params.PARAMETER_HALF_NUMBER ? Number(params.PARAMETER_HALF_NUMBER) : null;
  const teamHome = /TEAM1/i.test(bet.marketKey);
  const teamAway = /TEAM2/i.test(bet.marketKey);

  let goalCount: number | null = null;

  if (halfNum === 1 || halfNum === 2) {
    const halfScope: MarketScope = { kind: 'half', index: halfNum };
    if (!isMarketScopeFinalized(ctx.detail, halfScope)) return null;

    const periodScore = extractPeriodScore(ctx.detail, halfScope as PeriodScope);
    if (!periodScore) return null;

    if (teamHome) goalCount = periodScore.homeScore;
    else if (teamAway) goalCount = periodScore.awayScore;
    else goalCount = periodScore.homeScore + periodScore.awayScore;
  } else {
    if (teamHome) goalCount = ctx.homeScore;
    else if (teamAway) goalCount = ctx.awayScore;
    else goalCount = ctx.homeScore + ctx.awayScore;
  }

  if (goalCount == null) return null;

  return matchesExactGoals(goalCount, expectation)
    ? WcOddsBetStatus.WIN
    : WcOddsBetStatus.LOSE;
}

/**
 * Soccer EXACT_GOALS_TEAM1/2_HALF: exactly N goals by a specific team in a specific half.
 * Uses half period score from Olimpbet API first; falls back to matchState goal-minute tracking.
 */
export function resolveExactGoalsTeamHalfBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/display_EXACT_GOALS_TEAM[12]_HALF/i.test(bet.marketKey)) return null;

  const params = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
  const expectedGoals = Number(params.PARAMETER_EXACT_GOALS);
  const halfNum = Number(params.PARAMETER_HALF_NUMBER);
  if (!Number.isFinite(expectedGoals) || halfNum !== 1 && halfNum !== 2) return null;

  const teamHome = /TEAM1/i.test(bet.marketKey);
  const halfScope: MarketScope = { kind: 'half', index: halfNum };

  // Strategy A: period score from Olimpbet event detail
  if (ctx.detail && isMarketScopeFinalized(ctx.detail, halfScope)) {
    const periodScore = extractPeriodScore(ctx.detail, halfScope as PeriodScope);
    if (periodScore) {
      const teamScore = teamHome ? periodScore.homeScore : periodScore.awayScore;
      return teamScore === expectedGoals ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
    }
  }

  // Strategy B: matchState goal-minute tracking (half 1 = minutes ≤ 45, half 2 = > 45)
  const soccer = ctx.matchState?.soccer;
  if (!soccer?.initialized) return null;

  const eventCompleted = ctx.detail ? isOlimpbetEventCompleted(ctx.detail) : false;
  const halfFinalized = (ctx.detail && isMarketScopeFinalized(ctx.detail, halfScope))
    || (eventCompleted);
  if (!halfFinalized) return null;

  const goalMinutes = soccer.goalMinutes ?? {};
  const goalScorers = soccer.goalScorers ?? {};

  let teamGoalsInHalf = 0;
  for (const goalNum of Object.keys(goalScorers)) {
    const scorer = goalScorers[goalNum];
    const minute = goalMinutes[goalNum];
    if (minute == null) continue;
    const inHalf = halfNum === 1 ? minute <= 45 : minute > 45;
    if (!inHalf) continue;
    const isTeamGoal = teamHome ? scorer === 'home' : scorer === 'away';
    if (isTeamGoal) teamGoalsInHalf++;
  }

  return teamGoalsInHalf === expectedGoals ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
}

/** GOALS_TEAM1/2: «забьёт» — early WIN on Да when team scores after tracking baseline. */
export function resolveGoalsTeamBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/display_GOALS_TEAM[12]/i.test(bet.marketKey)) return null;

  const yes = parseYesNoOutcome(bet);
  if (yes == null) return null;

  const teamHome = /TEAM1/i.test(bet.marketKey);
  const soccer = ctx.matchState?.soccer;
  if (!soccer?.initialized) return null;

  const teamScored = Object.values(soccer.goalScorers ?? {}).some(
    (side) => side === (teamHome ? 'home' : 'away'),
  );

  if (teamScored && yes) return WcOddsBetStatus.WIN;
  if (teamScored && !yes) return WcOddsBetStatus.LOSE;

  return null;
}

type TimeWindowIntent = 'in_window' | 'no_goal';

function parseTimeWindowIntent(params: Record<string, string>): TimeWindowIntent | null {
  const from = params.PARAMETER_FROM;
  const to = params.PARAMETER_TO;
  if (from != null && to != null) return 'in_window';
  if (params.PARAMETER_GOAL_NUMBER != null) return 'no_goal';
  return null;
}

function parseTimeWindowTeamSide(marketKey: string): 'home' | 'away' | null {
  if (/TEAM1/i.test(marketKey)) return 'home';
  if (/TEAM2/i.test(marketKey)) return 'away';
  return null;
}

/**
 * GOAL15MIN_YES_NO: «будет ли гол в интервале FROM–TO?» (Да/Нет, любой гол).
 */
export function resolveGoalIntervalYesNoBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/GOAL15MIN/i.test(bet.marketKey)) return null;

  const yes = parseYesNoOutcome(bet);
  if (yes == null) return null;

  const params = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
  const from = Number(params.PARAMETER_FROM);
  const to = Number(params.PARAMETER_TO);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;

  const soccer = ctx.matchState?.soccer;
  if (!soccer?.initialized) return null;

  const goalMinutes = Object.values(soccer.goalMinutes ?? {})
    .map((minute) => Number(minute))
    .filter((minute) => Number.isFinite(minute));

  const goalInWindow = goalMinutes.some((minute) => minute >= from && minute <= to);
  if (goalInWindow) {
    return yes ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }

  const currentMinute = ctx.detail
    ? parseMatchMinuteFromFeed(statValue(ctx.detail, 'current_time'))
    : null;

  if (currentMinute != null && currentMinute > to) {
    return yes ? WcOddsBetStatus.LOSE : WcOddsBetStatus.WIN;
  }

  if (ctx.detail && isOlimpbetEventCompleted(ctx.detail)) {
    return yes ? WcOddsBetStatus.LOSE : WcOddsBetStatus.WIN;
  }

  return null;
}

/**
 * Goal-in-minute-window markets (NEXT_GOAL_TIME_*MIN, etc.).
 * Uses tracked goal minute + feed current_time; Olimpbet status remains fallback.
 */
export function resolveTimeWindowBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (resolveSettlementProfile(bet.marketKey) !== 'TIME_WINDOW') return null;

  const params = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
  const goalNum = parseRaceTargetFromParams(bet, ['PARAMETER_GOAL_NUMBER']);
  if (goalNum == null) return null;

  const intent = parseTimeWindowIntent(params);
  if (intent == null) return null;

  const from = intent === 'in_window' ? Number(params.PARAMETER_FROM) : null;
  const to = intent === 'in_window' ? Number(params.PARAMETER_TO) : null;
  if (intent === 'in_window' && (!Number.isFinite(from!) || !Number.isFinite(to!))) return null;

  const soccer = ctx.matchState?.soccer;
  if (!soccer?.initialized) return null;

  const teamSide = parseTimeWindowTeamSide(bet.marketKey);
  const scorer = soccer.goalScorers?.[String(goalNum)];
  const goalMinute = soccer.goalMinutes?.[String(goalNum)] ?? null;
  const currentMinute = ctx.detail
    ? parseMatchMinuteFromFeed(statValue(ctx.detail, 'current_time'))
    : null;

  if (scorer) {
    if (teamSide && scorer !== teamSide) {
      return intent === 'no_goal' ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
    }
    if (intent === 'no_goal') return WcOddsBetStatus.LOSE;
    if (goalMinute == null) return null;

    const inRange = goalMinute >= from! && goalMinute <= to!;
    return inRange ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
  }

  if (intent === 'in_window' && currentMinute != null && currentMinute > to!) {
    return WcOddsBetStatus.LOSE;
  }

  if (intent === 'no_goal') {
    if (ctx.detail && isOlimpbetEventCompleted(ctx.detail)) {
      const totalGoals = ctx.homeScore + ctx.awayScore;
      if (totalGoals < goalNum) return WcOddsBetStatus.WIN;
      return WcOddsBetStatus.LOSE;
    }
    return null;
  }

  if (ctx.detail && isOlimpbetEventCompleted(ctx.detail)) {
    const totalGoals = ctx.homeScore + ctx.awayScore;
    if (totalGoals < goalNum) return WcOddsBetStatus.LOSE;
  }

  return null;
}

/** Tennis WINNER_SET: who wins the scoped set (games within set from scores_by_periods). */
function resolveScopedSetGames(
  setNum: number,
  ctx: WcSettlementContext,
): { home: number; away: number } | null {
  if (ctx.detail) {
    const fromFeed = parsePeriodScoreList(ctx.detail)[setNum - 1];
    if (fromFeed) return fromFeed;
  }

  return inferTennisSetGamesFromMatchState(ctx.matchState, setNum);
}

function isScopedSetFinalized(
  setNum: number,
  ctx: WcSettlementContext,
  setGames: { home: number; away: number } | null,
): boolean {
  if (ctx.detail) {
    const periods = parsePeriodScoreList(ctx.detail);
    if (periods[setNum - 1]) {
      if (isTennisSetFinalized(ctx.detail, setNum)) return true;
      if (isOlimpbetEventCompleted(ctx.detail) && periods.length === setNum) return true;
    }
  }

  if (!setGames || !isValidTennisSetFinalScore(setGames.home, setGames.away)) return false;

  const tennis = ctx.matchState?.tennis;
  if (tennis?.gamesCompletedBySet[String(setNum + 1)] != null) return true;

  const setsPlayed = ctx.homeScore + ctx.awayScore;
  if (setsPlayed >= setNum) {
    if (setNum < setsPlayed) return true;
    if (setNum === setsPlayed) {
      return ctx.detail ? isOlimpbetEventCompleted(ctx.detail) : true;
    }
  }

  return false;
}

function parseScorePairFromBet(
  bet: WcBetSettlementInput,
): { home: number; away: number } | null {
  const params = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
  const paramHome = Number(params.PARAMETER_HOME_SCORE);
  const paramAway = Number(params.PARAMETER_AWAY_SCORE);
  if (Number.isFinite(paramHome) && Number.isFinite(paramAway)) {
    return { home: paramHome, away: paramAway };
  }

  const fromName = bet.outcomeName?.match(/(\d+)\s*:\s*(\d+)/);
  if (fromName) {
    const home = Number(fromName[1]);
    const away = Number(fromName[2]);
    if (Number.isFinite(home) && Number.isFinite(away)) return { home, away };
  }

  return null;
}

/** Map a winning tennis game display score (40:0, 40:15, …) to total points won in the game. */
function expectedPointTotalsFromDisplayScore(
  homeDisplay: number,
  awayDisplay: number,
): { home: number; away: number } | null {
  if (homeDisplay === 40 && awayDisplay === 40) return null;

  const awayPointsFromToken = (token: number): number | null => {
    if (token === 0) return 0;
    if (token === 15) return 1;
    if (token === 30) return 2;
    if (token === 40) return 3;
    return null;
  };

  if (homeDisplay === 50 && awayDisplay === 40) return { home: 5, away: 4 };
  if (awayDisplay === 50 && homeDisplay === 40) return { home: 4, away: 5 };

  if (homeDisplay === 40 && awayDisplay < 40) {
    const awayPts = awayPointsFromToken(awayDisplay);
    return awayPts == null ? null : { home: 4, away: awayPts };
  }

  if (awayDisplay === 40 && homeDisplay < 40) {
    const homePts = awayPointsFromToken(homeDisplay);
    return homePts == null ? null : { home: homePts, away: 4 };
  }

  return null;
}

function completedGameMatchesExactDisplayScore(
  game: WcTennisGameState,
  expected: { home: number; away: number },
): boolean {
  const expectedPoints = expectedPointTotalsFromDisplayScore(expected.home, expected.away);
  if (expectedPoints && game.pointsWon) {
    const simpleNonDeuceScore =
      (expected.home === 40 && expected.away < 40)
      || (expected.away === 40 && expected.home < 40);
    if (simpleNonDeuceScore && game.deuce) return false;

    return game.pointsWon.home === expectedPoints.home
      && game.pointsWon.away === expectedPoints.away;
  }

  const last = parseTennisGameScore(game.lastGameScore);
  return last != null && last.home === expected.home && last.away === expected.away;
}

/**
 * Tennis SCORE_WINNER / SCORE_SET: exact point score in a scoped game (e.g. 40:0 in game 10).
 */
export function resolveScoreSetGameBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/SCORE_WINNER|SCORE_SET|EXACT_POINT_GAME/i.test(bet.marketKey)) return null;

  const scope = parseTennisScopedGameParams(bet.outcomeKey);
  if (!scope) return null;

  const expected = parseScorePairFromBet(bet);
  if (!expected) return null;

  const game = ctx.matchState?.tennis?.games[tennisGameKey(scope.setNum, scope.gameNum)];
  if (!game) return null;

  const setGames = resolveScopedSetGames(scope.setNum, ctx);
  const setFinalized = setGames != null && isScopedSetFinalized(scope.setNum, ctx, setGames);
  const gameFinished = game.completed
    || (setFinalized && setGames != null && scope.gameNum <= setGames.home + setGames.away);

  if (!gameFinished) return null;

  return completedGameMatchesExactDisplayScore(game, expected)
    ? WcOddsBetStatus.WIN
    : WcOddsBetStatus.LOSE;
}

/**
 * Tennis MULTISCORE_SET: exact set score (e.g. 7:5) when the scoped set is finalized.
 */
export function resolveMultiscoreSetBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/MULTISCORE/i.test(bet.marketKey)) return null;

  const params = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
  const setNum = Number(params.PARAMETER_SET_NUMBER);
  if (!Number.isFinite(setNum) || setNum < 1) return null;

  const expected = parseScorePairFromBet(bet);
  if (!expected) return null;

  const setGames = resolveScopedSetGames(setNum, ctx);
  if (!setGames) return null;
  if (!isScopedSetFinalized(setNum, ctx, setGames)) return null;

  return setGames.home === expected.home && setGames.away === expected.away
    ? WcOddsBetStatus.WIN
    : WcOddsBetStatus.LOSE;
}

/**
 * Match exact score (sets in tennis / goals in soccer) from display_SCORE / CORRECT_SCORE.
 */
export function resolveMatchCorrectScoreBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/^display_SCORE$/i.test(bet.marketKey)
    && !/CORRECT_SCORE|SCORE_VARIANT/i.test(bet.marketKey)) {
    return null;
  }

  const expected = parseScorePairFromBet(bet);
  if (!expected) return null;

  if (ctx.detail && isOlimpbetEventCompleted(ctx.detail)) {
    return ctx.homeScore === expected.home && ctx.awayScore === expected.away
      ? WcOddsBetStatus.WIN
      : WcOddsBetStatus.LOSE;
  }

  if (ctx.homeScore > expected.home || ctx.awayScore > expected.away) {
    return WcOddsBetStatus.LOSE;
  }

  // Best-of-3 tennis: once either side reaches 2 sets, the match score is final.
  if (ctx.homeScore >= 2 || ctx.awayScore >= 2) {
    return ctx.homeScore === expected.home && ctx.awayScore === expected.away
      ? WcOddsBetStatus.WIN
      : WcOddsBetStatus.LOSE;
  }

  return null;
}

export function resolveWinnerSetBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/WINNER_SET/i.test(bet.marketKey)) return null;

  const params = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
  let setNum = Number(params.PARAMETER_SET_NUMBER);
  if (!Number.isFinite(setNum)) {
    const scope = bet.outcomeName ? parseMarketScopeFromText(bet.outcomeName) : null;
    if (scope?.kind === 'set') setNum = scope.index;
  }
  if (!Number.isFinite(setNum) || setNum < 1) return null;

  const side = parseTennisSidePick(bet);
  if (!side) return null;

  const setGames = resolveScopedSetGames(setNum, ctx);
  if (!setGames) return null;
  if (!isScopedSetFinalized(setNum, ctx, setGames)) return null;

  if (setGames.home === setGames.away) return WcOddsBetStatus.VOID;

  const setWinner = setGames.home > setGames.away ? 'home' : 'away';
  return side === setWinner ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
}

function resolveEarlyTotalsBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  const marketKey = normalizeWcMarketKey(bet.marketKey || 'h2h');
  if (!isTotalsMarketKey(marketKey)) return null;

  const line = resolveTotalsLine(bet);
  if (line == null) return null;

  const scopeTotal = scopeTotalForBet(bet, ctx);
  if (scopeTotal == null) return null;

  const isOver = bet.outcomeKey?.startsWith('OVER');
  const isUnder = bet.outcomeKey?.startsWith('UNDER');

  const scopeHint = resolveTotalsScopeHint(bet);
  const scope = scopeHint ? parseMarketScopeFromText(scopeHint) : null;
  const tennisGames = isTennisGameFeed(ctx.detail);
  const pointSetSport = isPointSetSportFeed(ctx.detail);

  // Unscoped tennis totals must never early-settle: fallback scores sum games across sets.
  if (tennisGames && !scope) return null;

  if (isOver && scopeTotal > line) {
    if (scope?.kind === 'set' || scope?.kind === 'half' || scope?.kind === 'quarter') {
      return WcOddsBetStatus.WIN;
    }
    // Soccer/basketball unscoped — early win when line is beaten in-play.
    if (!tennisGames && !pointSetSport) return WcOddsBetStatus.WIN;
    // Volleyball match total — early win only when already over the line (cannot decrease).
    if (pointSetSport && !scope) return WcOddsBetStatus.WIN;
    return null;
  }

  if (isUnder && scopeTotal > line) {
    if (scope) return WcOddsBetStatus.LOSE;
    if (pointSetSport || !tennisGames) return WcOddsBetStatus.LOSE;
    return null;
  }

  if (scope && ctx.detail && isMarketScopeFinalized(ctx.detail, scope)) {
    if (scopeTotal === line) return WcOddsBetStatus.VOID;
    if (isOver) return scopeTotal > line ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
    if (isUnder) return scopeTotal < line ? WcOddsBetStatus.WIN : WcOddsBetStatus.LOSE;
    return WcOddsBetStatus.LOSE;
  }

  return null;
}

function lastEventOutcomeTypeId(bet: WcBetSettlementInput): number | null {
  const parsed = bet.outcomeKey ? parseDisplayOutcomeKey(bet.outcomeKey) : null;
  return parsed?.marketId === LAST_EVENT_MARKET_ID ? parsed.outcomeTypeId : null;
}

function findLastEventWinnerFromSnapshots(
  matchState?: WcMatchState | null,
): number | null {
  const snaps = matchState?.probabilitySnapshots ?? {};
  for (const [key, result] of Object.entries(snaps)) {
    if (result !== 'WIN') continue;
    const match = /^1565:(\d+):/.exec(key);
    if (match) return Number(match[1]);
  }
  return null;
}

function lastTrackedGoalMinute(soccer: WcMatchStateSoccer): number | null {
  let max = -1;
  for (const minute of Object.values(soccer.goalMinutes ?? {})) {
    if (minute != null && minute > max) max = minute;
  }
  return max >= 0 ? max : null;
}

/**
 * «Последнее событие матча» (гол / офсайд / угловой …).
 * Olimpbet probabilities live on linked Spesial_bets; fallback uses snapshots or late goal feed.
 */
export function resolveLastEventBet(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  if (!/^display_LAST_EVENT$/i.test(bet.marketKey)) return null;

  const outcomeTypeId = lastEventOutcomeTypeId(bet);
  if (outcomeTypeId == null) return null;

  const eventCompleted = ctx.detail
    ? isOlimpbetEventCompleted(ctx.detail)
    : false;
  if (!eventCompleted) return null;

  const winnerFromSnapshots = findLastEventWinnerFromSnapshots(ctx.matchState);
  if (winnerFromSnapshots != null) {
    return outcomeTypeId === winnerFromSnapshots
      ? WcOddsBetStatus.WIN
      : WcOddsBetStatus.LOSE;
  }

  const soccer = ctx.matchState?.soccer;
  if (!soccer?.initialized) return null;

  const lastGoalMinute = lastTrackedGoalMinute(soccer);
  if (lastGoalMinute == null || lastGoalMinute < LAST_EVENT_LATE_GOAL_MINUTE) {
    return null;
  }

  return outcomeTypeId === LAST_EVENT_OUTCOME_GOAL
    ? WcOddsBetStatus.WIN
    : WcOddsBetStatus.LOSE;
}

/**
 * Verified settlement chain:
 * 1. Own feed math (deuce, period totals)
 * 2. Live Olimpbet probability
 * 3. Persisted probability snapshot
 * 4. null — stay PENDING (never guess)
 */
export function resolveVerifiedBetResult(
  bet: WcBetSettlementInput,
  ctx: WcSettlementContext,
): WcOddsBetStatus | null {
  const deuce = resolveDeucePointBet(bet, ctx);
  if (deuce != null) return deuce;

  const nextPoint = resolveNextPointGameBet(bet, ctx);
  if (nextPoint != null) return nextPoint;

  const racePoint = resolveRaceToPointGameBet(bet, ctx);
  if (racePoint != null) return racePoint;

  const raceGame = resolveRaceToGameBet(bet, ctx);
  if (raceGame != null) return raceGame;

  const scoreSetGame = resolveScoreSetGameBet(bet, ctx);
  if (scoreSetGame != null) return scoreSetGame;

  const multiscoreSet = resolveMultiscoreSetBet(bet, ctx);
  if (multiscoreSet != null) return multiscoreSet;

  const matchScore = resolveMatchCorrectScoreBet(bet, ctx);
  if (matchScore != null) return matchScore;

  const winnerSet = resolveWinnerSetBet(bet, ctx);
  if (winnerSet != null) return winnerSet;

  const nextGoal = resolveNextGoalBet(bet, ctx);
  if (nextGoal != null) return nextGoal;

  const goalsTeam = resolveGoalsTeamBet(bet, ctx);
  if (goalsTeam != null) return goalsTeam;

  const exactGoals = resolveExactGoalsBet(bet, ctx);
  if (exactGoals != null) return exactGoals;

  const exactGoalsTeamHalf = resolveExactGoalsTeamHalfBet(bet, ctx);
  if (exactGoalsTeamHalf != null) return exactGoalsTeamHalf;

  const goalInterval = resolveGoalIntervalYesNoBet(bet, ctx);
  if (goalInterval != null) return goalInterval;

  const timeWindow = resolveTimeWindowBet(bet, ctx);
  if (timeWindow != null) return timeWindow;

  const totals = resolveEarlyTotalsBet(bet, ctx);
  if (totals != null) return totals;

  if (ctx.detail && bet.outcomeKey?.startsWith('DISPLAY_')) {
    const live = resolveDisplayOutcomeResult(ctx.detail, bet.outcomeKey);
    if (live != null) return mapOlimpbetResult(live);
  }

  const snap = resolveFromProbabilitySnapshot(bet, ctx.matchState);
  if (snap != null) return snap;

  const lastEvent = resolveLastEventBet(bet, ctx);
  if (lastEvent != null) return lastEvent;

  if (bet.outcomeKey?.startsWith('DISPLAY_') || bet.marketKey.startsWith('display_')) {
    return null;
  }

  return null;
}

/** Early / mid-match determinable outcomes only. */
export function resolveDeterminateBetResult(
  bet: WcBetSettlementInput,
  homeScore: number,
  awayScore: number,
  detail?: OlimpbetEventDetail,
  matchState?: WcMatchState | null,
): WcOddsBetStatus | null {
  return resolveVerifiedBetResult(bet, { homeScore, awayScore, detail, matchState });
}
