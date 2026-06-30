"use server";

import { cookies } from "next/headers";

import { parseAffiliateSubsCookie, type AffiliateSubs } from "./affiliateSubs";

export async function getAffiliateSubs(): Promise<AffiliateSubs> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("affiliateSubs")?.value;
  return parseAffiliateSubsCookie(raw);
}
