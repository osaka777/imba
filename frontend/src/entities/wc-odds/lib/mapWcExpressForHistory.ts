import type { WcExpressBet } from "~/entities/wc-odds/api/client";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { getWcBetLabel } from "~/entities/wc-odds/lib/wcRate";

export type WcHistoryExpressBet = {
  id: string;
  wcExpressId: number;
  isWcExpress: true;
  betVariant: "EXPRESS";
  status: "PENDING" | "WIN" | "LOSE" | "RETURN";
  createdAt: string;
  cf: string;
  amount: string;
  payout: string;
  currencyCode: string;
  bets: Array<{
    id: number;
    cf: string;
    eventName: string;
    betInfo: string;
    wcGameHref?: string;
    sport?: string;
    leagueName?: string;
    score?: string;
  }>;
};

export function mapWcExpressForHistory(
  expressBets: WcExpressBet[],
): WcHistoryExpressBet[] {
  return expressBets.map((parent) => ({
    id: `wc-express-${parent.id}`,
    wcExpressId: parent.id,
    isWcExpress: true,
    betVariant: "EXPRESS",
    status: parent.status === "VOID" ? "RETURN" : parent.status,
    createdAt: parent.createdAt,
    cf: Number(parent.combinedOdds).toFixed(2),
    amount: Number(parent.stake).toFixed(0),
    payout: Number(parent.potentialPayout).toFixed(0),
    currencyCode: parent.currencyCode,
    bets: parent.legs.map((leg) => {
      const label = getWcBetLabel(leg);
      const hasScore =
        leg.event.homeScore != null && leg.event.awayScore != null;
      return {
        id: leg.id,
        cf: Number(leg.odds).toFixed(2),
        eventName: `${leg.event.homeTeam} — ${leg.event.awayTeam}`,
        betInfo: label,
        wcGameHref: leg.event.slug
          ? buildWcGameHref({
              slug: leg.event.slug,
              id: leg.event.id || "",
              homeTeam: leg.event.homeTeam,
              awayTeam: leg.event.awayTeam,
            })
          : undefined,
        sport: leg.event.sport,
        leagueName: leg.event.leagueName,
        score: hasScore
          ? `${leg.event.homeScore}:${leg.event.awayScore}`
          : undefined,
        eventCompleted: Boolean(leg.event.completed),
      };
    }),
  }));
}
