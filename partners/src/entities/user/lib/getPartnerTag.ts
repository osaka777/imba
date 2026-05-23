"use server";

import { cookies } from "next/headers";

export async function getPartnerTag() {
  const partnerTag = cookies().get("partnerTag");
  if (!partnerTag) {
    return;
  }

  return partnerTag.value;
}
