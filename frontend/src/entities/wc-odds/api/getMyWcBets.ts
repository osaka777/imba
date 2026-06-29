import { getSessionClient } from "~/entities/user/lib/getSessionClient";

import { fetchMyWcBets, type WcBet } from "./client";

export async function getMyWcBets(status?: WcBet["status"]): Promise<WcBet[]> {
  const token = getSessionClient();
  if (!token) return [];

  const bets = await fetchMyWcBets(token);
  if (!status) return bets;
  return bets.filter((b) => b.status === status);
}

export function countPendingWcBets(bets: WcBet[]): number {
  return bets.filter((b) => b.status === "PENDING").length;
}
