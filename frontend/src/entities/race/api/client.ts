import { getSessionClient } from "~/entities/user/lib/getSessionClient";

const API = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

export type RaceTick = { t: number; p: number };

export type RaceRoundDto = {
  id: number;
  pairKey: string;
  symbolA: string;
  symbolB: string;
  roundMs: number;
  startsAt: string;
  endsAt: string;
  openPriceA: number | null;
  openPriceB: number | null;
  closePriceA: number | null;
  closePriceB: number | null;
  status: "OPEN" | "LOCKED" | "SETTLED" | "VOID";
  result: "A" | "B" | null;
};

export type RacePairSummaryDto = {
  key: string;
  symbolA: string;
  symbolB: string;
  shortA: string;
  shortB: string;
  name: string;
  tagline: string;
};

export type RaceBetDto = {
  id: number;
  roundId: number;
  side: "A" | "B";
  stake: number;
  currencyCode: string;
  odds: number;
  potentialPayout: number;
  status: "PENDING" | "WIN" | "LOSE" | "VOID";
  settledAt: string | null;
  createdAt: string;
};

export type RaceConfigDto = {
  pairs: RacePairSummaryDto[];
  roundOptionsMs: number[];
  minStakeByCurrency?: Record<string, number>;
  maxStakeByCurrency?: Record<string, number>;
  maxSideExposure?: number;
  maxUserStakePerRound?: number;
  maxUserBetsPerRound?: number;
  dailyHouseLossPause?: number;
  bettingPaused?: boolean;
  houseDayNet?: number;
  currencyDefault?: string;
  source?: string;
  settleRule?: string;
  note?: string;
};

export type RaceStateDto = {
  serverNow: string;
  pair: RacePairSummaryDto;
  roundMs: number;
  lockMs: number;
  odds: number;
  priceA: number | null;
  priceB: number | null;
  openPriceA: number | null;
  openPriceB: number | null;
  changePctA: number | null;
  changePctB: number | null;
  bettingOpen: boolean;
  msToLock: number;
  msToEnd: number;
  round: RaceRoundDto;
  ticksA: RaceTick[];
  ticksB: RaceTick[];
  myBets: RaceBetDto[];
  recentRounds: RaceRoundDto[];
};

async function authFetch(path: string, init: RequestInit = {}) {
  const token = getSessionClient();
  if (!token) throw new Error("RACE_AUTH_REQUIRED");
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
    const msg = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message || body?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

export function fetchRaceConfig(): Promise<RaceConfigDto> {
  return fetch(`${API()}/api/casino/race/config`, { cache: "no-store" }).then(
    async (res) => {
      if (!res.ok) throw new Error("RACE_CONFIG_LOAD_FAILED");
      return res.json();
    },
  );
}

export async function fetchRaceState(
  pairKey: string,
  roundMs = 300_000,
): Promise<RaceStateDto> {
  const token = getSessionClient();
  const qs = new URLSearchParams({ pairKey, roundMs: String(roundMs) });
  const res = await fetch(`${API()}/api/casino/race/state?${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("RACE_MARKET_LOAD_FAILED");
  return res.json();
}

export function placeRaceBet(
  pairKey: string,
  side: "A" | "B",
  stake: number,
  currencyCode: string,
  roundMs = 300_000,
) {
  return authFetch("/api/casino/race/bets", {
    method: "POST",
    body: JSON.stringify({ pairKey, side, stake, currencyCode, roundMs }),
  }) as Promise<RaceBetDto>;
}

export function fetchRaceBetHistory(limit = 12) {
  return authFetch(
    `/api/casino/race/bets?limit=${Math.min(50, Math.max(1, limit))}`,
  ) as Promise<(RaceBetDto & { round: RaceRoundDto; pair: RacePairSummaryDto })[]>;
}
