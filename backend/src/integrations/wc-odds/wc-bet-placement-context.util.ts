import {
  parseDisplayOutcomeKey,
  parseDisplayOutcomeParameters,
} from '../olimpbet-wc/olimpbet-probability-settlement.util';
import { statValue } from '../olimpbet-wc/olimpbet-event-result.util';
import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';

import { parseTennisScopedGameParams } from './tennis-market-params.util';
import { parseMatchState, tennisGameKey, type WcMatchState } from './wc-match-state.types';
import {
  isPlainNextGoalMarket,
  resolveSettlementProfile,
  type SettlementProfile,
} from './wc-settlement-profile.util';

export type WcBetOutcomeFingerprint = {
  marketId: number;
  outcomeTypeId: number;
  parameters: Record<string, string>;
  tradingStatus?: string | null;
};

export type WcBetPlacementContext = {
  v: 1;
  homeScore: number;
  awayScore: number;
  totalGoals: number;
  /** Match goal index (1-based) for «следующий гол» without explicit param. */
  expectedGoalIndex?: number;
  gameScoreAtBet?: string;
  settlementProfile?: SettlementProfile;
  fingerprint?: WcBetOutcomeFingerprint;
  /** Original market group label (tennis set scope for totals). */
  totalsGroupLabel?: string;
  tennis?: {
    setNum: number;
    gameNum: number;
    pointsInGameAtBet: number;
    pointsWonAtBet?: { home: number; away: number };
    trackedFromStart: boolean;
  };
  capturedAt: string;
};

function parametersMatch(
  expected: Record<string, string>,
  actual: Array<{ type: string; value: string }> | null | undefined,
): boolean {
  const keys = Object.keys(expected);
  if (keys.length === 0) return true;
  if (!actual?.length) return false;
  const actualMap = Object.fromEntries(actual.map((p) => [p.type, p.value]));
  return keys.every((key) => actualMap[key] === expected[key]);
}

export function findOlimpbetOutcomeTradingStatus(
  detail: OlimpbetEventDetail | null | undefined,
  marketId: number,
  outcomeTypeId: number,
  parameters: Record<string, string>,
): string | null {
  if (!detail?.probabilities?.markets?.length) return null;

  for (const market of detail.probabilities.markets) {
    if (market.marketId !== marketId) continue;
    for (const prob of market.probabilities ?? []) {
      if (prob.outcomeTypeId !== outcomeTypeId) continue;
      if (!parametersMatch(parameters, prob.parameters)) continue;
      return prob.tradingStatus ?? null;
    }
  }

  return null;
}

export function buildOutcomeFingerprint(
  outcomeKey: string | null,
  detail?: OlimpbetEventDetail | null,
): WcBetOutcomeFingerprint | null {
  if (!outcomeKey) return null;
  const parsed = parseDisplayOutcomeKey(outcomeKey);
  if (!parsed) return null;

  const parameters = parseDisplayOutcomeParameters(outcomeKey);
  const tradingStatus = findOlimpbetOutcomeTradingStatus(
    detail,
    parsed.marketId,
    parsed.outcomeTypeId,
    parameters,
  );

  return {
    marketId: parsed.marketId,
    outcomeTypeId: parsed.outcomeTypeId,
    parameters,
    tradingStatus,
  };
}

export function parseBetPlacementContext(raw: unknown): WcBetPlacementContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<WcBetPlacementContext>;
  if (obj.v !== 1 || typeof obj.capturedAt !== 'string') return null;
  if (!Number.isFinite(obj.homeScore) || !Number.isFinite(obj.awayScore)) return null;
  return obj as WcBetPlacementContext;
}

export function buildBetPlacementContext(params: {
  marketKey: string;
  outcomeKey: string | null;
  homeScore: number;
  awayScore: number;
  detail?: OlimpbetEventDetail | null;
  matchState?: WcMatchState | null;
  totalsGroupLabel?: string | null;
}): WcBetPlacementContext {
  const homeScore = params.homeScore;
  const awayScore = params.awayScore;
  const totalGoals = homeScore + awayScore;
  const settlementProfile = resolveSettlementProfile(params.marketKey);

  const ctx: WcBetPlacementContext = {
    v: 1,
    homeScore,
    awayScore,
    totalGoals,
    settlementProfile,
    capturedAt: new Date().toISOString(),
  };

  const fingerprint = buildOutcomeFingerprint(params.outcomeKey, params.detail);
  if (fingerprint) ctx.fingerprint = fingerprint;

  if (isPlainNextGoalMarket(params.marketKey)) {
    ctx.expectedGoalIndex = totalGoals + 1;
  }

  const gameScoreAtBet = statValue(params.detail ?? { statistics: null }, 'game_score');
  if (gameScoreAtBet) ctx.gameScoreAtBet = gameScoreAtBet;

  if (params.totalsGroupLabel?.trim()) {
    ctx.totalsGroupLabel = params.totalsGroupLabel.trim();
  }

  const scope = parseTennisScopedGameParams(params.outcomeKey);
  if (scope && params.matchState?.tennis) {
    const game = params.matchState.tennis.games[tennisGameKey(scope.setNum, scope.gameNum)];
    ctx.tennis = {
      setNum: scope.setNum,
      gameNum: scope.gameNum,
      pointsInGameAtBet: Object.keys(game?.pointWinners ?? {}).length,
      pointsWonAtBet: game?.pointsWon ? { ...game.pointsWon } : undefined,
      trackedFromStart: game?.trackedFromStart === true,
    };
  }

  return ctx;
}
