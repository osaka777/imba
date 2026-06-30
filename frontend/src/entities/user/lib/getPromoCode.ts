"use server";

import { cookies } from "next/headers";

export async function getPromoCode() {
  const cookieStore = await cookies();
  const promo = cookieStore.get("promoCode");
  if (!promo?.value) {
    return;
  }
  return promo.value;
}
