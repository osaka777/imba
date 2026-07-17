import { getSessionClient } from "~/entities/user/lib/getSessionClient";

const API = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

export type SnakeRoundDto = {
  id: number;
  stake: number;
  currencyCode: string;
  status: "PENDING" | "CASHED_OUT" | "LOST" | "VOID";
  multiplier: number | null;
  payout: number | null;
  lengthAtEnd: number | null;
  killsAtEnd: number | null;
  boostMs?: number | null;
  elapsedMs: number | null;
  startedAt: string;
  settledAt: string | null;
  serverNow?: string;
};

export type SnakeConfig = {
  minStake: number;
  maxStake: number;
  maxMultiplier: number;
  maxRoundMs?: number;
  currencyDefault: string;
};

async function authFetch(path: string, init: RequestInit = {}) {
  const token = getSessionClient();
  if (!token) throw new Error("Unauthorized");
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchSnakeConfig(): Promise<SnakeConfig> {
  const res = await fetch(`${API()}/api/casino/snake/config`);
  if (!res.ok) throw new Error("Failed to load snake config");
  return res.json();
}

export async function fetchActiveSnakeRound(): Promise<SnakeRoundDto | null> {
  const data = await authFetch("/api/casino/snake/active");
  return data ?? null;
}

export async function fetchSnakeHistory(limit = 10): Promise<SnakeRoundDto[]> {
  const data = await authFetch(`/api/casino/snake/history?limit=${limit}`);
  return Array.isArray(data) ? data : [];
}

export function placeSnakeRound(stake: number, currencyCode: string) {
  return authFetch("/api/casino/snake/rounds", {
    method: "POST",
    body: JSON.stringify({ stake, currencyCode }),
  }) as Promise<SnakeRoundDto>;
}

export function heartbeatSnakeRound(
  id: number,
  boosting: boolean,
  length: number,
  kills: number,
) {
  return authFetch(`/api/casino/snake/rounds/${id}/heartbeat`, {
    method: "POST",
    body: JSON.stringify({ boosting, length, kills }),
  }) as Promise<{ ok: boolean; boostMs: number; elapsedMs: number }>;
}

export function cashoutSnakeRound(
  id: number,
  length: number,
  kills: number,
  boostMs = 0,
) {
  return authFetch(`/api/casino/snake/rounds/${id}/cashout`, {
    method: "POST",
    body: JSON.stringify({ length, kills, boostMs }),
  }) as Promise<SnakeRoundDto>;
}

export function crashSnakeRound(
  id: number,
  length: number,
  kills: number,
  boostMs = 0,
) {
  return authFetch(`/api/casino/snake/rounds/${id}/crash`, {
    method: "POST",
    body: JSON.stringify({ length, kills, boostMs }),
  }) as Promise<SnakeRoundDto>;
}
