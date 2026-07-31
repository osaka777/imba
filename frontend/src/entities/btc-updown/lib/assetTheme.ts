export type AssetTheme = {
  id: string;
  logo: string;
  /** Brand accent for snake, timer, borders. */
  accent: string;
  accentRgb: string;
};

const THEMES: Record<string, AssetTheme> = {
  BTC: {
    id: "BTC",
    logo: "/images/btc-logo.png",
    accent: "#F7931A",
    accentRgb: "247, 147, 26",
  },
  ETH: {
    id: "ETH",
    logo: "/images/eth-logo.png",
    accent: "#627EEA",
    accentRgb: "98, 126, 234",
  },
  SOL: {
    id: "SOL",
    logo: "/images/sol-logo.png",
    accent: "#9945FF",
    accentRgb: "153, 69, 255",
  },
  DOGE: {
    id: "DOGE",
    logo: "/images/doge-logo.png",
    accent: "#C2A633",
    accentRgb: "194, 166, 51",
  },
  PEPE: {
    id: "PEPE",
    logo: "/images/pepe-logo.png",
    accent: "#3D9A3B",
    accentRgb: "61, 154, 59",
  },
  WLD: {
    id: "WLD",
    logo: "/images/wld-logo.png",
    accent: "#00C389",
    accentRgb: "0, 195, 137",
  },
  TIA: {
    id: "TIA",
    logo: "/images/tia-logo.png",
    accent: "#7B2BF9",
    accentRgb: "123, 43, 249",
  },
  ARB: {
    id: "ARB",
    logo: "/images/arb-logo.png",
    accent: "#28A0F0",
    accentRgb: "40, 160, 240",
  },
  OP: {
    id: "OP",
    logo: "/images/op-logo.png",
    accent: "#FF0420",
    accentRgb: "255, 4, 32",
  },
  WIF: {
    id: "WIF",
    logo: "/images/wif-logo.png",
    accent: "#D4A017",
    accentRgb: "212, 160, 23",
  },
  BONK: {
    id: "BONK",
    logo: "/images/bonk-logo.png",
    accent: "#F7A61C",
    accentRgb: "247, 166, 28",
  },
  SHIB: {
    id: "SHIB",
    logo: "/images/shib-logo.png",
    accent: "#FFA409",
    accentRgb: "255, 164, 9",
  },
  SUI: {
    id: "SUI",
    logo: "/images/sui-logo.png",
    accent: "#4DA2FF",
    accentRgb: "77, 162, 255",
  },
  APT: {
    id: "APT",
    logo: "/images/apt-logo.png",
    accent: "#2DD8A5",
    accentRgb: "45, 216, 165",
  },
  FLOKI: {
    id: "FLOKI",
    logo: "/images/floki-logo.png",
    accent: "#F6851B",
    accentRgb: "246, 133, 27",
  },
};

export function themeForSymbol(symbol: string): AssetTheme {
  const base = symbol.replace(/USDT$/i, "").toUpperCase();
  return THEMES[base] ?? THEMES.BTC!;
}
