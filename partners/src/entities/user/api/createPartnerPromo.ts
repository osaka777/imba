"use server";

import { cookies } from "next/headers";
import { api } from "@/shared/api/api";

export type CreatePartnerPromoInput = {
  code: string;
  bonusType: "DIRECT_BONUS" | "DEPOSIT_BONUS";
  amount?: number;
  percentage?: number;
  minDeposit?: number;
  available?: number;
  currencyCode?: string;
};

export async function createPartnerPromo(input: CreatePartnerPromoInput) {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) throw new Error("Unauthorized");

  const { data } = await api.post("/affiliate-program/user/promo-codes", input, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
