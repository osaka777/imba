"use server";

import { cookies } from "next/headers";

export async function getPartnerTag() {
  const cookieStore = await cookies();
  const partnerTag = cookieStore.get("partnerTag");
  if (!partnerTag) {
    return;
  }

  return partnerTag.value;
}
