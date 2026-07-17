"use server";

import { cookies } from "next/headers";
import { api } from "@/shared/api/api";

export type PartnerPromoCode = {
  id: number;
  code: string;
  type: string;
  validUntil: string;
  available: number;
  used: number;
  remaining: number;
  partnerPercentage: number;
  partnerCreated?: boolean;
  redeemable?: boolean;
  currencyCode: string | null;
};

export type ReferralLinkData = {
  referralLink: string;
  uid: string;
  percent: string;
  promoCodes?: PartnerPromoCode[];
};

export async function getReferralLink(): Promise<ReferralLinkData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;

  try {
    const { data } = await api.get<ReferralLinkData>("/affiliate-program/user/referral-link", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch {
    return null;
  }
}
