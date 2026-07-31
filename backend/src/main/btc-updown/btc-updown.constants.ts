export const CRYPTO_UPDOWN_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'DOGEUSDT',
  'PEPEUSDT',
  'WLDUSDT',
  'TIAUSDT',
] as const;
export type CryptoUpdownSymbol = (typeof CRYPTO_UPDOWN_SYMBOLS)[number];

/**
 * Extra Binance symbols used by Race (peer pairs) but not listed as
 * standalone Crypto Up/Down markets. Price service subscribes to the union.
 */
export const CRYPTO_RACE_ONLY_SYMBOLS = [
  'ARBUSDT',
  'OPUSDT',
  'WIFUSDT',
  'BONKUSDT',
  'SHIBUSDT',
  'SUIUSDT',
  'APTUSDT',
  'FLOKIUSDT',
] as const;

export const CRYPTO_PRICE_FEED_SYMBOLS = [
  ...CRYPTO_UPDOWN_SYMBOLS,
  ...CRYPTO_RACE_ONLY_SYMBOLS,
] as const;

export const CRYPTO_UPDOWN_ROUND_MS = [60_000, 300_000, 900_000] as const;
export type CryptoUpdownRoundMs = (typeof CRYPTO_UPDOWN_ROUND_MS)[number];

/**
 * BTC + DOGE keep 1m. PEPE/WLD/TIA/ETH/SOL — 5m/15m only:
 * PEPE 1m is tick/spread noise; WLD/TIA are swing markets with safer books on 5m+.
 */
export const CRYPTO_UPDOWN_ROUNDS_BY_SYMBOL: Record<
  CryptoUpdownSymbol,
  readonly CryptoUpdownRoundMs[]
> = {
  BTCUSDT: [60_000, 300_000, 900_000],
  ETHUSDT: [300_000, 900_000],
  SOLUSDT: [300_000, 900_000],
  DOGEUSDT: [60_000, 300_000, 900_000],
  PEPEUSDT: [300_000, 900_000],
  WLDUSDT: [300_000, 900_000],
  TIAUSDT: [300_000, 900_000],
};

/** Defaults keep existing BTC 5m behaviour for old clients. */
export const BTC_UPDOWN_SYMBOL: CryptoUpdownSymbol = 'BTCUSDT';
export const BTC_UPDOWN_ROUND_MS: CryptoUpdownRoundMs = 300_000;

/** @deprecated use oddsForRound — kept as 5m default */
export const BTC_UPDOWN_ODDS = 1.8;

/** Shorter rounds = more noise/bots → tighter odds. */
export const BTC_UPDOWN_ODDS_BY_ROUND: Record<CryptoUpdownRoundMs, number> = {
  60_000: 1.75,
  300_000: 1.8,
  900_000: 1.82,
};

export function oddsForRound(roundMs: number): number {
  if (isCryptoUpdownRoundMs(roundMs)) {
    return BTC_UPDOWN_ODDS_BY_ROUND[roundMs];
  }
  return BTC_UPDOWN_ODDS;
}

export const BTC_UPDOWN_MIN_STAKE = 1;
/** Absolute ceiling (KZT scale) — prefer maxStakeForCurrency per book. */
export const BTC_UPDOWN_MAX_STAKE = 1_000_000;

/** Per-currency floors so $1 / 100 ₽ / 100 ₸ presets are valid. */
export function minStakeForCurrency(currencyCode: string): number {
  const c = (currencyCode || 'KZT').toUpperCase();
  if (c === 'USD' || c === 'USDT') return 1;
  if (c === 'RUB') return 100;
  return 100;
}

/** Per-currency stake caps. */
export function maxStakeForCurrency(currencyCode: string): number {
  const c = (currencyCode || 'KZT').toUpperCase();
  if (c === 'USD' || c === 'USDT') return 10_000;
  if (c === 'RUB') return 150_000;
  return 1_000_000; // KZT
}

/** Sum of potential payouts on one side (PENDING) in a round. */
export const BTC_UPDOWN_MAX_SIDE_EXPOSURE = 5_000_000;

/** Max total stake one user can have PENDING in a single round. */
export const BTC_UPDOWN_MAX_USER_STAKE_PER_ROUND = 1_000_000;

/** Max PENDING bets one user can open in a single round. */
export const BTC_UPDOWN_MAX_USER_BETS_PER_ROUND = 5;

/**
 * If house net PnL today (losses − wins paid) drops below −this,
 * new bets are rejected until next UTC day (or restart clears cache).
 * Measured in stake currency units as booked (mixed currencies ≈ KZT scale).
 */
export const BTC_UPDOWN_DAILY_HOUSE_LOSS_PAUSE = 2_000_000;

export const BTC_UPDOWN_TICK_BUFFER = 8_000;

/** How long a quote is considered fresh (ms). */
export const CRYPTO_UPDOWN_QUOTE_VALID_MS = 3_000;
/** Max allowed move between quote and fill, in basis points (5 = 0.05%). */
export const CRYPTO_UPDOWN_SLIPPAGE_BPS = 5;

export const CRYPTO_UPDOWN_MARKETS = CRYPTO_UPDOWN_SYMBOLS.flatMap((symbol) =>
  CRYPTO_UPDOWN_ROUNDS_BY_SYMBOL[symbol].map((roundMs) => ({
    symbol,
    roundMs,
  })),
);

export function isCryptoUpdownSymbol(value: string): value is CryptoUpdownSymbol {
  return (CRYPTO_UPDOWN_SYMBOLS as readonly string[]).includes(value);
}

export function isCryptoUpdownRoundMs(value: number): value is CryptoUpdownRoundMs {
  return (CRYPTO_UPDOWN_ROUND_MS as readonly number[]).includes(value);
}

export function roundsForSymbol(
  symbol: string,
): readonly CryptoUpdownRoundMs[] {
  const key = symbol.toUpperCase();
  if (isCryptoUpdownSymbol(key)) {
    return CRYPTO_UPDOWN_ROUNDS_BY_SYMBOL[key];
  }
  return CRYPTO_UPDOWN_ROUNDS_BY_SYMBOL.BTCUSDT;
}

export function isRoundAllowedForSymbol(
  symbol: string,
  roundMs: number,
): boolean {
  return (roundsForSymbol(symbol) as readonly number[]).includes(roundMs);
}

/** Stop accepting bets this many ms before round end. */
export function lockMsForRound(roundMs: number): number {
  if (roundMs <= 60_000) return 12_000;
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

export function binanceTradeStreamUrl(symbols: readonly string[]): string {
  const streams = symbols.flatMap((s) => {
    const id = s.toLowerCase();
    return [`${id}@trade`, `${id}@bookTicker`];
  });
  return `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;
}

/** @deprecated use lockMsForRound */
export const BTC_UPDOWN_LOCK_MS = 15_000;
