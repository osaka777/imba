"use server";

import { revalidatePath } from "next/cache";

import {
  disconnectKick,
  fetchKickAnalytics,
  fetchKickSessions,
  fetchKickStatus,
  resubscribeKickWebhooks,
  startKickConnect,
  updateKickOnboarding,
} from "@/entities/kick/api";

export async function getKickStatusAction() {
  return fetchKickStatus();
}

export async function getKickSessionsAction() {
  return fetchKickSessions();
}

export async function getKickAnalyticsAction() {
  return fetchKickAnalytics();
}

export async function startKickConnectAction() {
  return startKickConnect();
}

export async function disconnectKickAction() {
  await disconnectKick();
  revalidatePath("/profile/stream");
  return { ok: true };
}

export async function resubscribeKickWebhooksAction() {
  await resubscribeKickWebhooks();
  return { ok: true };
}

export async function updateKickOnboardingAction(patch: {
  linkDone?: boolean;
  obsDone?: boolean;
}) {
  const result = await updateKickOnboarding(patch);
  revalidatePath("/profile/stream");
  return result;
}
