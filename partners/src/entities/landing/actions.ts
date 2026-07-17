"use server";

import { revalidatePath } from "next/cache";
import {
  createPartnerLanding,
  deletePartnerLanding,
} from "@/entities/landing/api";
import type { CreateLandingPayload } from "@/entities/landing/types";

export async function createLandingAction(payload: CreateLandingPayload) {
  const landing = await createPartnerLanding(payload);
  revalidatePath("/profile/landings");
  return landing;
}

export async function deleteLandingAction(id: string) {
  await deletePartnerLanding(id);
  revalidatePath("/profile/landings");
  return { ok: true };
}
