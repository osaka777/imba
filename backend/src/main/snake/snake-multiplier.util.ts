/**
 * Shared Snake casino multiplier curve.
 * Survival time is authoritative (server uses wall-clock from startedAt).
 * Length/kills are soft bonuses with anti-cheat caps tied to elapsed time.
 * Boost burns a share of stake from the cashout payout.
 */

export const SNAKE_MAX_MULTIPLIER = 25;
export const SNAKE_MIN_STAKE = 100;
export const SNAKE_MAX_STAKE = 1_000_000;
/** Share of stake burned per second of boost (must match frontend). */
export const SNAKE_BOOST_BURN_PER_SEC = 0.08;
export const SNAKE_MAX_BURN_FRACTION = 0.85;

export function clampSnakeStats(
  elapsedMs: number,
  length: number,
  kills: number,
): { length: number; kills: number; elapsedMs: number } {
  const ms = Math.max(0, Math.min(elapsedMs, 15 * 60_000));
  const seconds = ms / 1000;
  const maxLength = Math.floor(5 + seconds * 2.5);
  const maxKills = Math.floor(seconds / 2.5);
  return {
    elapsedMs: ms,
    length: Math.max(3, Math.min(Math.floor(length), maxLength)),
    kills: Math.max(0, Math.min(Math.floor(kills), maxKills)),
  };
}

/** Multiplier from elapsed time + bonuses. Always >= 1. */
export function computeSnakeMultiplier(
  elapsedMs: number,
  length: number,
  kills: number,
): number {
  const clamped = clampSnakeStats(elapsedMs, length, kills);
  const seconds = clamped.elapsedMs / 1000;

  const fromTime = Math.pow(1.016, seconds);
  const fromLength = Math.min(2, Math.max(0, (clamped.length - 5) * 0.025));
  const fromKills = Math.min(1.5, clamped.kills * 0.12);

  const raw = fromTime + fromLength + fromKills;
  const capped = Math.min(SNAKE_MAX_MULTIPLIER, Math.max(1, raw));
  return Math.round(capped * 100) / 100;
}

export function computeBoostBurnFraction(boostMs: number, elapsedMs: number): number {
  const cappedBoost = Math.max(0, Math.min(boostMs, elapsedMs, 15 * 60_000));
  const fraction = (cappedBoost / 1000) * SNAKE_BOOST_BURN_PER_SEC;
  return Math.min(SNAKE_MAX_BURN_FRACTION, fraction);
}

export function computeSnakePayout(
  stake: number,
  multiplier: number,
  boostMs = 0,
  elapsedMs = 0,
): number {
  if (!Number.isFinite(stake) || !Number.isFinite(multiplier) || stake <= 0) return 0;
  const gross = stake * multiplier;
  const burn = stake * computeBoostBurnFraction(boostMs, elapsedMs || boostMs);
  return Math.max(0, Math.round((gross - burn) * 100) / 100);
}
