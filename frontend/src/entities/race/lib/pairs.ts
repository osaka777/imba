import { themeForSymbol } from "~/entities/btc-updown/lib/assetTheme";

export type RacePairMeta = {
  key: string;
  slug: string;
  symbolA: string;
  symbolB: string;
  shortA: string;
  shortB: string;
  name: string;
  tagline: string;
  logoA: string;
  logoB: string;
  colorA: string;
  colorB: string;
  colorRgbA: string;
  colorRgbB: string;
};

/** Mirrors backend RACE_PAIRS (race.constants.ts) — keep in sync. */
export const RACE_PAIRS: RacePairMeta[] = [
  {
    key: "ARB_OP",
    slug: "arb-op",
    symbolA: "ARBUSDT",
    symbolB: "OPUSDT",
    shortA: "ARB",
    shortB: "OP",
    name: "ARB vs OP",
    tagline: "Близнецы L2 — почти одна вола, обгоны каждую минуту",
    ...pairTheme("ARBUSDT", "OPUSDT"),
  },
  {
    key: "WIF_BONK",
    slug: "wif-bonk",
    symbolA: "WIFUSDT",
    symbolB: "BONKUSDT",
    shortA: "WIF",
    shortB: "BONK",
    name: "WIF vs BONK",
    tagline: "Солана-мем война: шляпа против бонка",
    ...pairTheme("WIFUSDT", "BONKUSDT"),
  },
  {
    key: "DOGE_SHIB",
    slug: "doge-shib",
    symbolA: "DOGEUSDT",
    symbolB: "SHIBUSDT",
    shortA: "DOGE",
    shortB: "SHIB",
    name: "DOGE vs SHIB",
    tagline: "Классика OG-мемов — кто громче гавкнет",
    ...pairTheme("DOGEUSDT", "SHIBUSDT"),
  },
  {
    key: "SUI_APT",
    slug: "sui-apt",
    symbolA: "SUIUSDT",
    symbolB: "APTUSDT",
    shortA: "SUI",
    shortB: "APT",
    name: "SUI vs APT",
    tagline: "Дуэль новых L1 — скорость против модульности",
    ...pairTheme("SUIUSDT", "APTUSDT"),
  },
  {
    key: "PEPE_FLOKI",
    slug: "pepe-floki",
    symbolA: "PEPEUSDT",
    symbolB: "FLOKIUSDT",
    shortA: "PEPE",
    shortB: "FLOKI",
    name: "PEPE vs FLOKI",
    tagline: "Мем-лига: лягушка против викинга",
    ...pairTheme("PEPEUSDT", "FLOKIUSDT"),
  },
];

function pairTheme(symbolA: string, symbolB: string) {
  const a = themeForSymbol(symbolA);
  const b = themeForSymbol(symbolB);
  return {
    logoA: a.logo,
    logoB: b.logo,
    colorA: a.accent,
    colorB: b.accent,
    colorRgbA: a.accentRgb,
    colorRgbB: b.accentRgb,
  };
}

export function racePairFromKey(key: string): RacePairMeta | null {
  const k = (key || "").toUpperCase();
  return RACE_PAIRS.find((p) => p.key === k) ?? null;
}

export function racePairFromSlug(slug: string): RacePairMeta | null {
  const s = (slug || "").toLowerCase();
  return RACE_PAIRS.find((p) => p.slug === s) ?? null;
}
