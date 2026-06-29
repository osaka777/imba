import { parseDisplayOutcomeParameters } from '../olimpbet-wc/olimpbet-probability-settlement.util';

import type { WcBetSettlementInput } from './wc-odds-settlement.util';

export type TennisScopedGameParams = {
  setNum: number;
  gameNum: number;
  pointNum?: number;
};

/** Parse set / game / optional point scope from DISPLAY outcomeKey. */
export function parseTennisScopedGameParams(
  outcomeKey: string | null | undefined,
): TennisScopedGameParams | null {
  const params = parseDisplayOutcomeParameters(outcomeKey ?? '');
  const setNum = Number(params.PARAMETER_SET_NUMBER);
  const gameNum = Number(params.PARAMETER_GAME_NUMBER);
  if (!Number.isFinite(setNum) || !Number.isFinite(gameNum)) return null;

  const pointRaw = params.PARAMETER_POINT_NUMBER;
  const pointNum = pointRaw != null ? Number(pointRaw) : undefined;

  return {
    setNum,
    gameNum,
    pointNum: pointNum != null && Number.isFinite(pointNum) ? pointNum : undefined,
  };
}

export function parseRaceTargetFromParams(
  bet: WcBetSettlementInput,
  preferKeys: string[],
): number | null {
  const params = parseDisplayOutcomeParameters(bet.outcomeKey ?? '');
  for (const key of preferKeys) {
    const raw = params[key];
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
