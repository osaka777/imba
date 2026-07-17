"use server";

import { cookies } from "next/headers";
import { api } from "@/shared/api/api";

export type SubIdStatRow = {
  value: string;
  registrations: number;
  ftd: number;
  commission: number;
  conversionPct: number;
};

export type SubIdStatsResponse = {
  dimension: string;
  currencyCode: string | null;
  rows: SubIdStatRow[];
};

export async function getSubStats(
  dimension: "sub1" | "sub2" | "sub3" | "sub4" | "sub5",
  currency = "KZT",
): Promise<SubIdStatsResponse | null> {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return null;

  try {
    const { data } = await api.get<SubIdStatsResponse>(
      `/affiliate-program/user/sub-stats?dimension=${dimension}&currency=${currency}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return data;
  } catch {
    return null;
  }
}
