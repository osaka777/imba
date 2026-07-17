import axios from "axios";
import { cookies } from "next/headers";

import { getApiBaseUrl } from "@/shared/lib/apiBaseUrl";

async function authHeaders() {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) throw new Error("Unauthorized");
  return { Authorization: `Bearer ${token}` };
}

export type KickStatus = {
  connected: boolean;
  configured: boolean;
  channelSlug: string | null;
  channelTitle: string | null;
  connectedAt: string | null;
  isLive: boolean | null;
  viewerCount: number | null;
  streamTitle: string | null;
  hasBranding: boolean | null;
  compliantHours30d: number;
  tokenRefreshFailedAt: string | null;
  activeSessionId: string | null;
  connectBonusGranted: boolean;
  connectBonusLocked: boolean;
  referralsCount: number;
  welcomeProgress: {
    stepConnect: boolean;
    stepBonus: boolean;
    stepReferral: boolean;
    stepWithdraw: boolean;
    availableUsd: number;
    lockedUsd: number;
    minWithdrawUsd: number;
    progressToWithdrawPct: number;
  };
  onboarding: {
    linkDone: boolean;
    obsDone: boolean;
  };
};

export type KickSession = {
  id: string;
  kickChannel: string;
  startedAt: string;
  endedAt: string | null;
  peakViewers: number;
  hadBranding: boolean;
  lastStreamTitle: string | null;
  durationMinutes: number | null;
};

export async function fetchKickStatus(): Promise<KickStatus> {
  const { data } = await axios.get<KickStatus>(
    `${getApiBaseUrl()}/affiliate-program/user/kick/status`,
    { headers: await authHeaders() },
  );
  return data;
}

export async function fetchKickSessions(): Promise<KickSession[]> {
  const { data } = await axios.get<KickSession[]>(
    `${getApiBaseUrl()}/affiliate-program/user/kick/sessions`,
    { headers: await authHeaders() },
  );
  return Array.isArray(data) ? data : [];
}

export async function startKickConnect(): Promise<{ authorizeUrl: string }> {
  const { data } = await axios.get<{ authorizeUrl?: string; message?: string }>(
    `${getApiBaseUrl()}/affiliate-program/user/kick/connect`,
    { headers: await authHeaders() },
  );
  if (!data.authorizeUrl) {
    throw new Error(data.message || "Не удалось начать подключение Kick");
  }
  return { authorizeUrl: data.authorizeUrl };
}

export async function disconnectKick() {
  await axios.post(
    `${getApiBaseUrl()}/affiliate-program/user/kick/disconnect`,
    {},
    { headers: await authHeaders() },
  );
}

export async function resubscribeKickWebhooks() {
  await axios.post(
    `${getApiBaseUrl()}/affiliate-program/user/kick/resubscribe`,
    {},
    { headers: await authHeaders() },
  );
}

export type KickAnalytics = {
  periodDays: number;
  currencyCode: string;
  kickTraffic: {
    registrations: number;
    ftd: number;
    commission: number;
    connectBonus: number;
    connectBonusGranted: boolean;
    conversionPct: number;
  };
  duringLive: {
    registrations: number;
    ftd: number;
  };
  sessions30d: {
    count: number;
    compliantHours: number;
    totalPeakViewers: number;
    brandedSessions: number;
  };
  byChannel: Array<{
    channel: string;
    registrations: number;
    ftd: number;
  }>;
};

export async function fetchKickAnalytics(currency = "USD"): Promise<KickAnalytics> {
  const { data } = await axios.get<KickAnalytics>(
    `${getApiBaseUrl()}/affiliate-program/user/kick/analytics`,
    {
      headers: await authHeaders(),
      params: { currency },
    },
  );
  return data;
}

export async function updateKickOnboarding(patch: {
  linkDone?: boolean;
  obsDone?: boolean;
}) {
  const { data } = await axios.patch<{ ok: boolean; onboarding: KickStatus["onboarding"] }>(
    `${getApiBaseUrl()}/affiliate-program/user/kick/onboarding`,
    patch,
    { headers: await authHeaders() },
  );
  return data;
}
