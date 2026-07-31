import { themeForSymbol, type AssetTheme } from "./assetTheme";

export type TradingMarket = {
  slug: "btc" | "eth" | "sol" | "doge" | "pepe" | "wld" | "tia";
  symbol: string;
  short: string;
  name: string;
  blurbKey: "trading.marketBlurb" | "trading.marketBlurbSlow";
  roundsKey: "trading.roundsShort" | "trading.roundsShortSlow";
  theme: AssetTheme;
};

/**
 * BTC + DOGE keep 1m; PEPE/WLD/TIA/ETH/SOL — 5m/15m only.
 */
export const ROUNDS_BY_SYMBOL: Record<string, readonly number[]> = {
  BTCUSDT: [60_000, 300_000, 900_000],
  ETHUSDT: [300_000, 900_000],
  SOLUSDT: [300_000, 900_000],
  DOGEUSDT: [60_000, 300_000, 900_000],
  PEPEUSDT: [300_000, 900_000],
  WLDUSDT: [300_000, 900_000],
  TIAUSDT: [300_000, 900_000],
};

export function roundsForSymbol(symbol: string): readonly number[] {
  return ROUNDS_BY_SYMBOL[symbol.toUpperCase()] ?? ROUNDS_BY_SYMBOL.BTCUSDT;
}

/** Adaptive USD price digits — PEPE needs more than 2 dp. */
export function priceFractionDigits(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 2;
  const abs = Math.abs(n);
  if (abs >= 1000) return 2;
  if (abs >= 1) return 2;
  if (abs >= 0.01) return 4;
  if (abs >= 0.0001) return 6;
  return 8;
}

export function formatAssetPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const digits = priceFractionDigits(n);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export const TRADING_MARKETS: TradingMarket[] = [
  {
    slug: "btc",
    symbol: "BTCUSDT",
    short: "BTC",
    name: "Bitcoin",
    blurbKey: "trading.marketBlurb",
    roundsKey: "trading.roundsShort",
    theme: themeForSymbol("BTCUSDT"),
  },
  {
    slug: "eth",
    symbol: "ETHUSDT",
    short: "ETH",
    name: "Ethereum",
    blurbKey: "trading.marketBlurbSlow",
    roundsKey: "trading.roundsShortSlow",
    theme: themeForSymbol("ETHUSDT"),
  },
  {
    slug: "sol",
    symbol: "SOLUSDT",
    short: "SOL",
    name: "Solana",
    blurbKey: "trading.marketBlurbSlow",
    roundsKey: "trading.roundsShortSlow",
    theme: themeForSymbol("SOLUSDT"),
  },
  {
    slug: "doge",
    symbol: "DOGEUSDT",
    short: "DOGE",
    name: "Dogecoin",
    blurbKey: "trading.marketBlurb",
    roundsKey: "trading.roundsShort",
    theme: themeForSymbol("DOGEUSDT"),
  },
  {
    slug: "pepe",
    symbol: "PEPEUSDT",
    short: "PEPE",
    name: "Pepe",
    blurbKey: "trading.marketBlurbSlow",
    roundsKey: "trading.roundsShortSlow",
    theme: themeForSymbol("PEPEUSDT"),
  },
  {
    slug: "wld",
    symbol: "WLDUSDT",
    short: "WLD",
    name: "Worldcoin",
    blurbKey: "trading.marketBlurbSlow",
    roundsKey: "trading.roundsShortSlow",
    theme: themeForSymbol("WLDUSDT"),
  },
  {
    slug: "tia",
    symbol: "TIAUSDT",
    short: "TIA",
    name: "Celestia",
    blurbKey: "trading.marketBlurbSlow",
    roundsKey: "trading.roundsShortSlow",
    theme: themeForSymbol("TIAUSDT"),
  },
];

export function marketFromSlug(slug: string): TradingMarket | null {
  const key = slug.trim().toLowerCase();
  return TRADING_MARKETS.find((m) => m.slug === key) ?? null;
}

export function slugFromSymbol(symbol: string): string {
  const base = symbol.replace(/USDT$/i, "").toLowerCase();
  return TRADING_MARKETS.find((m) => m.slug === base)?.slug ?? "btc";
}
