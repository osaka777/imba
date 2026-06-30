import { cookies } from "next/headers";
import { api } from "@/shared/api/api";

export type ReferredClient = {
  id: number;
  email: string;
  registeredAt: string;
  totalBets: number;
  totalWins: number;
  totalLosses: number;
  totalStake: number;
  recentBets: Array<{
    id: number;
    stake: string;
    status: string;
    currencyCode: string;
    createdAt: string;
  }>;
};

export async function getReferredClients(): Promise<ReferredClient[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return [];

  try {
    const { data } = await api.get<ReferredClient[]>("/affiliate-program/user/clients", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data ?? [];
  } catch {
    return [];
  }
}
