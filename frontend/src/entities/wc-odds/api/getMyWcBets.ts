import { getSessionClient } from "~/entities/user/lib/getSessionClient";

import {
  fetchMyWcBets,
  type WcBet,
  type WcBetsGrouped,
  type WcExpressBet,
} from "./client";

export async function getMyWcBetsGrouped(
  status?: WcBet["status"],
): Promise<WcBetsGrouped> {
  const token = getSessionClient();
  if (!token) return { ordinar: [], express: [] };

  const grouped = await fetchMyWcBets(token);
  if (!status) return grouped;

  return {
    ordinar: grouped.ordinar.filter((b) => b.status === status),
    express: grouped.express.filter((b) => b.status === status),
  };
}

export async function getMyWcBets(status?: WcBet["status"]): Promise<WcBet[]> {
  const { ordinar } = await getMyWcBetsGrouped(status);
  return ordinar;
}

export async function getMyWcExpressBets(
  status?: WcBet["status"],
): Promise<WcExpressBet[]> {
  const { express } = await getMyWcBetsGrouped(status);
  return express;
}

export function countPendingWcBets(grouped: WcBetsGrouped): number {
  return (
    grouped.ordinar.filter((b) => b.status === "PENDING").length
    + grouped.express.filter((b) => b.status === "PENDING").length
  );
}
