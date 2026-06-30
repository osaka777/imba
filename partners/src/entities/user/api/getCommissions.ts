"use server";

import { cookies } from "next/headers";
import { api } from "@/shared/api/api";

export type CommissionItem = {
  id: number;
  type: "INCOME" | "OUTCOME";
  amount: number;
  currencyCode: string;
  createdAt: string;
  onHold: boolean;
  holdUntil: string | null;
  playerId: number | null;
  betId: number | null;
  bonusType: string;
};

export async function getCommissions(limit = 50): Promise<CommissionItem[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return [];

  try {
    const { data } = await api.get<CommissionItem[]>(
      `/affiliate-program/user/commissions?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return data ?? [];
  } catch {
    return [];
  }
}
