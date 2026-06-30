import type { WcBet } from "~/entities/wc-odds/api/client";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { getWcBetLabel } from "~/entities/wc-odds/lib/wcRate";

export type WcHistoryOrdinarBet = {
  id: string;
  wcBetId: number;
  isWcBet: true;
  status: "PENDING" | "WIN" | "LOSE" | "RETURN";
  createdAt: string;
  cf: string;
  amount: string;
  payout: string;
  currencyCode: string;
  eventName: string;
  betInfo: string;
  wcGameHref?: string;
  betVariant: "ORDINAR";
  score?: string;
  eventCompleted: boolean;
  sport?: string;
  leagueName?: string;
};

/**
 * Period-scoped bets (1-й тайм, четверть, сет, период) settle by the period
 * score, not the full-time score. Showing the match total next to them is
 * misleading, so we omit it for these markets.
 */
function isPeriodScopedBet(bet: WcBet, label: string): boolean {
  const haystack = `${label} ${bet.outcomeName ?? ""} ${bet.marketKey ?? ""}`;
  return /тайм|четверт|период|\bсет\b|half|quarter|period|set/i.test(haystack);
}

export function mapWcBetsForHistory(wcBets: WcBet[]): WcHistoryOrdinarBet[] {
  return wcBets.map((bet) => {
    const label = getWcBetLabel(bet);
    const hasMatchScore =
      bet.event.homeScore != null && bet.event.awayScore != null;
    const showMatchScore = hasMatchScore && !isPeriodScopedBet(bet, label);

    return {
      id: `wc-${bet.id}`,
      wcBetId: bet.id,
      isWcBet: true,
      status: bet.status === "VOID" ? "RETURN" : bet.status,
      createdAt: bet.createdAt,
      cf: Number(bet.odds).toFixed(2),
      amount: Number(bet.stake).toFixed(0),
      payout: Number(bet.potentialPayout).toFixed(0),
      currencyCode: bet.currencyCode,
      eventName: `${bet.event.homeTeam} — ${bet.event.awayTeam}`,
      betInfo: label,
      wcGameHref: bet.event.slug
        ? buildWcGameHref({
            slug: bet.event.slug,
            id: bet.event.id || "",
            homeTeam: bet.event.homeTeam,
            awayTeam: bet.event.awayTeam,
          })
        : undefined,
      betVariant: "ORDINAR",
      score: showMatchScore
        ? `${bet.event.homeScore}:${bet.event.awayScore}`
        : undefined,
      eventCompleted: Boolean(bet.event.completed),
      sport: bet.event.sport,
      leagueName: bet.event.leagueName,
    };
  });
}
