import { isBasketballLikeSport } from "~/entities/wc-odds/lib/wcSportKinds";

const BASKETBALL_HALF_LABEL: Record<"1" | "2", string> = {
  "1": "1-я половина",
  "2": "2-я половина",
};

const BASKETBALL_HALF_TAB_LABEL: Record<"1" | "2", string> = {
  "1": "1-я половина (1–2 ч.)",
  "2": "2-я половина (3–4 ч.)",
};

/** Tab label shown in the market filter row (basketball halves include quarter hint). */
export function formatPeriodTabLabel(tabKey: string, sport?: string): string {
  if (!isBasketballLikeSport(sport)) return tabKey;
  if (tabKey === "1-й тайм") return BASKETBALL_HALF_TAB_LABEL["1"];
  if (tabKey === "2-й тайм") return BASKETBALL_HALF_TAB_LABEL["2"];
  return tabKey;
}

/** Rename football-style half scopes for basketball UI and bet titles. */
export function applySportPeriodScopeLabels(text: string, sport?: string): string {
  if (!isBasketballLikeSport(sport) || !text) return text;

  return text
    .replace(/\b1-й\s+тайм\b/gi, BASKETBALL_HALF_LABEL["1"])
    .replace(/\b2-й\s+тайм\b/gi, BASKETBALL_HALF_LABEL["2"])
    .replace(/\b1-го\s+тайма\b/gi, "1-й половины")
    .replace(/\b2-го\s+тайма\b/gi, "2-й половины")
    .replace(/\b1-м\s+тайме\b/gi, "1-й половине")
    .replace(/\b2-м\s+тайме\b/gi, "2-й половине");
}
