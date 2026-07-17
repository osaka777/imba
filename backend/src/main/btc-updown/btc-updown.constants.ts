export const CRYPTO_UPDOWN_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const;
export type CryptoUpdownSymbol = (typeof CRYPTO_UPDOWN_SYMBOLS)[number];

export const CRYPTO_UPDOWN_ROUND_MS = [60_000, 300_000, 900_000] as const;
export type CryptoUpdownRoundMs = (typeof CRYPTO_UPDOWN_ROUND_MS)[number];

/** Defaults keep existing BTC 5m behaviour for old clients. */
export const BTC_UPDOWN_SYMBOL: CryptoUpdownSymbol = 'BTCUSDT';
export const BTC_UPDOWN_ROUND_MS: CryptoUpdownRoundMs = 300_000;

export const BTC_UPDOWN_ODDS = 1.85;
export const BTC_UPDOWN_MIN_STAKE = 100;
export const BTC_UPDOWN_MAX_STAKE = 500_000;
export const BTC_UPDOWN_TICK_BUFFER = 1_200;

/** How long a quote is considered fresh (ms). */
export const CRYPTO_UPDOWN_QUOTE_VALID_MS = 3_000;
/** Max allowed move between quote and fill, in basis points (5 = 0.05%). */
export const CRYPTO_UPDOWN_SLIPPAGE_BPS = 5;

export const CRYPTO_UPDOWN_MARKETS = CRYPTO_UPDOWN_SYMBOLS.flatMap((symbol) =>
  CRYPTO_UPDOWN_ROUND_MS.map((roundMs) => ({ symbol, roundMs })),
);

export function isCryptoUpdownSymbol(value: string): value is CryptoUpdownSymbol {
  return (CRYPTO_UPDOWN_SYMBOLS as readonly string[]).includes(value);
}

export function isCryptoUpdownRoundMs(value: number): value is CryptoUpdownRoundMs {
  return (CRYPTO_UPDOWN_ROUND_MS as readonly number[]).includes(value);
}

/** Stop accepting bets this many ms before round end. */
export function lockMsForRound(roundMs: number): number {
  if (roundMs <= 60_000) return 10_000;
  if (roundMs <= 300_000) return 15_000;
  return 30_000;
}

export function floorWindowStart(tsMs: number, roundMs: number): number {
  return Math.floor(tsMs / roundMs) * roundMs;
}

export function binancePriceUrl(symbol: string): string {
  return `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
}

export function binanceKlinesUrl(symbol: string, limit = 300): string {
  return `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1s&limit=${limit}`;
}

/** @deprecated use lockMsForRound */
export const BTC_UPDOWN_LOCK_MS = 15_000;
