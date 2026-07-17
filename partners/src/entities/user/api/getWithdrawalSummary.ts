"use server";

import { cookies } from "next/headers";
import { api } from "@/shared/api/api";

export type WithdrawalSummaryItem = {
  currencyCode: string;
  total: number;
  available: number;
  held: number;
  lockedConnectBonus?: number;
  referralsCount?: number;
  minWithdraw: number;
  holdDays: number;
};

export async function getWithdrawalSummary(): Promise<WithdrawalSummaryItem[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return [];

  try {
    const { data } = await api.get<WithdrawalSummaryItem[]>("/affiliate-program/user/withdrawal-summary", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data ?? [];
  } catch {
    return [];
  }
}
