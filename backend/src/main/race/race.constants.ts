/**
 * "Связки" — head-to-head races between two crypto symbols. Winner = whichever
 * leg has the larger % change from round open to round close. Reuses the same
 * live Binance feed as Crypto Up/Down (BtcUpdownPriceService) — zero new
 * price infrastructure needed.
 *
 * Pairs are vol-matched peers so lines actually trade places (no BTC-vs-meme
 * blowouts where one side always dominates %).
 */
export type RaceRoundMs = 300_000 | 900_000;
export const RACE_ROUND_MS: readonly RaceRoundMs[] = [300_000, 900_000];

export type RacePairDef = {
  key: string;
  symbolA: string;
  symbolB: string;
  shortA: string;
  shortB: string;
  name: string;
  tagline: string;
};

export const RACE_PAIRS: readonly RacePairDef[] = [
  {
    key: 'ARB_OP',
    symbolA: 'ARBUSDT',
    symbolB: 'OPUSDT',
    shortA: 'ARB',
    shortB: 'OP',
    name: 'ARB vs OP',
    tagline: 'Близнецы L2 — почти одна вола, обгоны каждую минуту',
  },
  {
    key: 'WIF_BONK',
    symbolA: 'WIFUSDT',
    symbolB: 'BONKUSDT',
    shortA: 'WIF',
    shortB: 'BONK',
    name: 'WIF vs BONK',
    tagline: 'Солана-мем война: шляпа против бонка',
  },
  {
    key: 'DOGE_SHIB',
    symbolA: 'DOGEUSDT',
    symbolB: 'SHIBUSDT',
    shortA: 'DOGE',
    shortB: 'SHIB',
    name: 'DOGE vs SHIB',
    tagline: 'Классика OG-мемов — кто громче гавкнет',
  },
  {
    key: 'SUI_APT',
    symbolA: 'SUIUSDT',
    symbolB: 'APTUSDT',
    shortA: 'SUI',
    shortB: 'APT',
    name: 'SUI vs APT',
    tagline: 'Дуэль новых L1 — скорость против модульности',
  },
  {
    key: 'PEPE_FLOKI',
    symbolA: 'PEPEUSDT',
    symbolB: 'FLOKIUSDT',
    shortA: 'PEPE',
    shortB: 'FLOKI',
    name: 'PEPE vs FLOKI',
    tagline: 'Мем-лига: лягушка против викинга',
  },
] as const;

export function findRacePair(key: string): RacePairDef | null {
  const k = (key || '').toUpperCase();
  return RACE_PAIRS.find((p) => p.key === k) ?? null;
}

export function isRaceRoundMs(value: number): value is RaceRoundMs {
  return (RACE_ROUND_MS as readonly number[]).includes(value);
}

export const RACE_DEFAULT_ROUND_MS: RaceRoundMs = 300_000;

/** Same fixed-odds philosophy as Crypto Up/Down — symmetric 50/50 legs. */
export const RACE_ODDS_BY_ROUND: Record<RaceRoundMs, number> = {
  300_000: 1.8,
  900_000: 1.82,
};

export function oddsForRaceRound(roundMs: number): number {
  return isRaceRoundMs(roundMs)
    ? RACE_ODDS_BY_ROUND[roundMs]
    : RACE_ODDS_BY_ROUND[RACE_DEFAULT_ROUND_MS];
}

export function raceLockMs(roundMs: number): number {
  return roundMs <= 300_000 ? 15_000 : 30_000;
}

export const RACE_MIN_STAKE = 1;
export const RACE_MAX_STAKE = 1_000_000;

export function raceMinStakeForCurrency(currencyCode: string): number {
  const c = (currencyCode || 'KZT').toUpperCase();
  if (c === 'USD' || c === 'USDT') return 1;
  if (c === 'RUB') return 100;
  return 100;
}

export function raceMaxStakeForCurrency(currencyCode: string): number {
  const c = (currencyCode || 'KZT').toUpperCase();
  if (c === 'USD' || c === 'USDT') return 10_000;
  if (c === 'RUB') return 150_000;
  return 1_000_000;
}

/** Sum of potential payouts on one leg (PENDING) in a round. */
export const RACE_MAX_SIDE_EXPOSURE = 3_000_000;
/** Max total stake one user can have PENDING in a single round. */
export const RACE_MAX_USER_STAKE_PER_ROUND = 1_000_000;
/** Max PENDING bets one user can open in a single round. */
export const RACE_MAX_USER_BETS_PER_ROUND = 5;
/** Daily house-loss circuit breaker (same scale as Crypto Up/Down). */
export const RACE_DAILY_HOUSE_LOSS_PAUSE = 1_000_000;

export const RACE_MARKETS = RACE_PAIRS.flatMap((pair) =>
  RACE_ROUND_MS.map((roundMs) => ({ pairKey: pair.key, roundMs })),
);

export function floorRaceWindowStart(tsMs: number, roundMs: number): number {
  return Math.floor(tsMs / roundMs) * roundMs;
}
