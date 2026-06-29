import type { WcEvent, WcEventDetail } from "~/entities/wc-odds/api/client";

export type WcSoccerCardCounts = {
  home: { yellow: number; red: number };
  away: { yellow: number; red: number };
};

type WcEventWithStats = Pick<WcEvent | WcEventDetail, "sport" | "phase" | "statList">;

function cardCount(statList: WcEvent["statList"], id: string, side: "opp1" | "opp2"): number {
  const row = statList?.find((s) => s.id === id);
  if (!row) return 0;
  return Math.max(0, Number(row[side]) || 0);
}

/** Live soccer card counts for list/scoreboard badges. */
export function getWcSoccerCardCounts(
  event: WcEventWithStats,
  isLive = event.phase === "live",
): WcSoccerCardCounts | null {
  if (!isLive || event.sport !== "soccer") return null;

  const yellowHome = cardCount(event.statList, "yellow_cards", "opp1");
  const yellowAway = cardCount(event.statList, "yellow_cards", "opp2");
  const redHome = cardCount(event.statList, "red_cards", "opp1");
  const redAway = cardCount(event.statList, "red_cards", "opp2");

  if (yellowHome + yellowAway + redHome + redAway === 0) return null;

  return {
    home: { yellow: yellowHome, red: redHome },
    away: { yellow: yellowAway, red: redAway },
  };
}

export function teamHasCards(counts: { yellow: number; red: number }): boolean {
  return counts.yellow > 0 || counts.red > 0;
}
