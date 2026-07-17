import { getSessionClient } from "~/entities/user/lib/getSessionClient";

const API = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

export type BtcTick = { t: number; p: number };

export type BtcRoundDto = {
  id: number;
  symbol: string;
  roundMs?: number;
  startsAt: string;
  endsAt: string;
  openPrice: number | null;
  closePrice: number | null;
  status: "OPEN" | "LOCKED" | "SETTLED" | "VOID";
  result: "UP" | "DOWN" | null;
};

export type BtcBetAudit = {
  source: string;
  symbol: string;
  roundMs: number;
  entryPrice: number | null;
  openPrice: number | null;
  closePrice: number | null;
  rule: string;
  reason: string;
  settledAt: string | null;
};

export type BtcQuoteDto = {
  symbol: string;
  roundMs: number;
  roundId: number;
  price: number;
  priceAt: string;
  quotedAt: string;
  validUntil: string;
  validMs: number;
  slippageBps: number;
  openPrice: number | null;
  bettingOpen: boolean;
  source: string;
  settleRule: string;
};

export type BtcBetDto = {
  id: number;
  roundId: number;
  side: "UP" | "DOWN";
  stake: number;
  currencyCode: string;
  odds: number;
  potentialPayout: number;
  entryPrice: number | null;
  status: "PENDING" | "WIN" | "LOSE" | "VOID";
  settledAt: string | null;
  createdAt: string;
  audit?: BtcBetAudit;
};

export type BtcBetHistoryDto = BtcBetDto & {
  round: BtcRoundDto;
  audit?: BtcBetAudit;
};

export type BtcDailyStatsDto = {
  day: string;
  currencyCode: string;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  pending: number;
  stakeTotal: number;
  pnl: number;
  winRate: number | null;
};

export type BtcStateDto = {
  serverNow: string;
  config: {
    symbol: string;
    roundMs: number;
    lockMs: number;
    odds: number;
    minStake: number;
    maxStake: number;
    currencyDefault: string;
    quoteValidMs?: number;
    slippageBps?: number;
    settleRule?: string;
    symbols?: string[];
    roundOptionsMs?: number[];
    markets?: Array<{
      symbol: string;
      roundMs: number;
      lockMs: number;
      label: string;
    }>;
  };
  market?: {
    symbol: string;
    roundMs: number;
    lockMs: number;
    label: string;
  };
  price: number | null;
  priceAt: string | null;
  openPrice: number | null;
  changePct: number | null;
  bettingOpen: boolean;
  msToLock: number;
  msToEnd: number;
  round: BtcRoundDto;
  ticks: BtcTick[];
  myBets: BtcBetDto[];
  recentRounds: BtcRoundDto[];
};

async function authFetch(path: string, init: RequestInit = {}) {
  const token = getSessionClient();
  if (!token) throw new Error("Войдите, чтобы сделать ставку");
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

export async function fetchBtcState(
  symbol = "BTCUSDT",
  roundMs = 300_000,
): Promise<BtcStateDto> {
  const token = getSessionClient();
  const qs = new URLSearchParams({
    symbol,
    roundMs: String(roundMs),
  });
  const res = await fetch(`${API()}/api/casino/btc-updown/state?${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Не удалось загрузить рынок");
  return res.json();
}

export function placeBtcBet(
  side: "UP" | "DOWN",
  stake: number,
  currencyCode: string,
  symbol = "BTCUSDT",
  roundMs = 300_000,
  expectedPrice?: number,
) {
  return authFetch("/api/casino/btc-updown/bets", {
    method: "POST",
    body: JSON.stringify({
      side,
      stake,
      currencyCode,
      symbol,
      roundMs,
      ...(expectedPrice != null ? { expectedPrice } : {}),
    }),
  }) as Promise<BtcBetDto>;
}

export function fetchBtcQuote(symbol = "BTCUSDT", roundMs = 300_000) {
  const qs = new URLSearchParams({
    symbol,
    roundMs: String(roundMs),
  });
  return fetch(`${API()}/api/casino/btc-updown/quote?${qs}`, {
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error("Не удалось получить котировку");
    return res.json() as Promise<BtcQuoteDto>;
  });
}

export function fetchBtcBetHistory(limit = 12) {
  return authFetch(
    `/api/casino/btc-updown/bets?limit=${Math.min(50, Math.max(1, limit))}`,
  ) as Promise<BtcBetHistoryDto[]>;
}

export function fetchBtcDailyStats(currencyCode = "KZT") {
  return authFetch(
    `/api/casino/btc-updown/stats/daily?currencyCode=${encodeURIComponent(currencyCode)}`,
  ) as Promise<BtcDailyStatsDto>;
}
