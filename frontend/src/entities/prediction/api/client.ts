import { getSessionClient } from "~/entities/user/lib/getSessionClient";

const API = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

export type PredictionOutcomeDto = {
  id: number;
  key: string;
  label: string;
  labelEn?: string | null;
  odds: number;
  sortOrder: number;
  sharePct?: number;
  exposure?: { bets: number; stake: number; liability: number };
};

export type PredictionEventDto = {
  id: number;
  slug: string;
  title: string;
  titleEn?: string | null;
  description: string | null;
  descriptionEn?: string | null;
  category: string;
  imageUrl: string | null;
  bannerUrl: string | null;
  videoUrl?: string | null;
  resolveRule: string | null;
  resolveRuleEn?: string | null;
  status: "DRAFT" | "OPEN" | "LOCKED" | "SETTLED" | "VOID";
  closesAt: string | null;
  resolvesAt: string | null;
  winningOutcomeId: number | null;
  settledAt: string | null;
  archivedAt?: string | null;
  createdAt?: string;
  bettingOpen: boolean;
  needsSettle?: boolean;
  pool?: { totalStake: number; totalBets: number };
  outcomes: PredictionOutcomeDto[];
};

export type ChancePoint = { t: number; v: number };

export type PredictionActivityDto = {
  id: number;
  stake: number;
  currencyCode: string;
  odds: number;
  createdAt: string;
  outcomeKey: string;
  outcomeLabel: string;
  outcomeLabelEn?: string | null;
  trader: string;
};

export type PredictionCommentDto = {
  id: number;
  parentId?: number | null;
  body: string;
  gifUrl?: string | null;
  likeCount?: number;
  likedByMe?: boolean;
  createdAt: string;
  position?: {
    stake: number;
    outcomeKey: string;
    outcomeLabel: string;
    outcomeLabelEn: string | null;
  } | null;
  user: {
    id: number;
    nickname: string | null;
    name: string;
    avatarUrl: string | null;
    avatarPreset: string | null;
  };
};

export type PredictionGifItem = {
  id: string;
  url: string;
  preview: string;
  title: string;
};

/** Same-origin display URL for allowlisted GIF CDNs. */
export function predictionGifDisplaySrc(
  url: string | null | undefined,
): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/api/casino/prediction/gifs/media")) return raw;
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  return `/api/casino/prediction/gifs/media?u=${encodeURIComponent(raw)}`;
}

export type PredictionBetDto = {
  id: number;
  eventId: number;
  outcomeId: number;
  outcomeKey?: string;
  outcomeLabel?: string;
  outcomeLabelEn?: string | null;
  stake: number;
  currencyCode: string;
  odds: number;
  potentialPayout: number;
  status: "PENDING" | "WIN" | "LOSE" | "VOID";
  settledAt: string | null;
  createdAt: string;
  event?: {
    id: number;
    slug: string;
    title: string;
    titleEn?: string | null;
    status: string;
  };
};

async function authFetch(path: string, init?: RequestInit) {
  const token = getSessionClient();
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
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

export async function fetchPredictionEvents(
  status?: string,
): Promise<PredictionEventDto[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${API()}/api/casino/prediction/events${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("PREDICTION_EVENTS_LOAD_FAILED");
  return res.json();
}

function normalizePredictionSlug(slug: string): string {
  const raw = slug.trim();
  if (!raw) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function fetchPredictionEvent(slug: string): Promise<{
  event: PredictionEventDto;
  series: ChancePoint[];
  activity: PredictionActivityDto[];
  comments: PredictionCommentDto[];
  related: PredictionEventDto[];
  myBets: PredictionBetDto[];
  bookmarked: boolean;
  config: {
    minStakeByCurrency?: Record<string, number>;
    maxStakeByCurrency?: Record<string, number>;
    currencyDefault?: string;
  };
}> {
  const token = getSessionClient();
  const normalized = normalizePredictionSlug(slug);
  const res = await fetch(
    `${API()}/api/casino/prediction/events/${encodeURIComponent(normalized)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error("PREDICTION_EVENT_LOAD_FAILED");
  const data = await res.json();
  if (!data?.event?.id) {
    throw new Error("PREDICTION_EVENT_LOAD_FAILED");
  }
  return {
    event: data.event,
    series: Array.isArray(data.series) ? data.series : [],
    activity: Array.isArray(data.activity) ? data.activity : [],
    comments: Array.isArray(data.comments) ? data.comments : [],
    related: Array.isArray(data.related) ? data.related : [],
    myBets: Array.isArray(data.myBets) ? data.myBets : [],
    bookmarked: Boolean(data.bookmarked),
    config: data.config || {},
  };
}

/** Compact mark for Polymarket-style chance price (50₸ / 50₽ / 50$). */
export function chanceCurrencyMark(currencyCode?: string | null) {
  const c = (currencyCode || "KZT").toUpperCase();
  const map: Record<string, string> = {
    KZT: "₸",
    RUB: "₽",
    UAH: "₴",
    TRY: "₺",
    AZN: "₼",
    USD: "$",
    USDT: "$",
    EUR: "€",
    UZS: "с",
    KGS: "с",
    TJS: "Ѕ",
  };
  if (map[c]) return map[c]!;
  return c.charAt(0) || "?";
}

/** Chance price with user currency mark (50 → 50₸). */
export function formatChanceCents(
  sharePct?: number | null,
  currencyCode?: string | null,
) {
  return `${Math.round(sharePct ?? 50)}${chanceCurrencyMark(currencyCode)}`;
}

/** Pool volume is always USD from the API. */
export function formatPredictionVolumeUsd(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return `$${Math.round(v)}`;
}

/** Match backend predictionStakeToUsd for tape display. */
export function predictionStakeToUsdClient(stake: number, currencyCode: string) {
  const c = (currencyCode || "USD").toUpperCase();
  const rate =
    c === "KZT" ? 1 / 500 : c === "RUB" ? 1 / 100 : c === "USDT" || c === "USD" ? 1 : 1;
  if (!Number.isFinite(stake) || stake <= 0) return 0;
  return stake * rate;
}

export function placePredictionBet(
  eventId: number,
  outcomeId: number,
  stake: number,
  currencyCode: string,
) {
  return authFetch("/api/casino/prediction/bets", {
    method: "POST",
    body: JSON.stringify({ eventId, outcomeId, stake, currencyCode }),
  }) as Promise<PredictionBetDto>;
}

export function placePredictionComment(
  eventId: number,
  body: string,
  gifUrl?: string | null,
  parentId?: number | null,
) {
  return authFetch("/api/casino/prediction/comments", {
    method: "POST",
    body: JSON.stringify({
      eventId,
      body,
      ...(gifUrl ? { gifUrl } : {}),
      ...(parentId != null ? { parentId } : {}),
    }),
  }) as Promise<PredictionCommentDto>;
}

export function togglePredictionCommentLike(commentId: number) {
  return authFetch(`/api/casino/prediction/comments/${commentId}/like`, {
    method: "POST",
  }) as Promise<{ commentId: number; liked: boolean; likeCount: number }>;
}

export function togglePredictionBookmark(eventId: number) {
  return authFetch("/api/casino/prediction/bookmarks", {
    method: "POST",
    body: JSON.stringify({ eventId }),
  }) as Promise<{ eventId: number; slug: string; bookmarked: boolean }>;
}

export async function searchPredictionGifs(
  q: string,
  pos?: string | null,
): Promise<{ items: PredictionGifItem[]; next: string | null }> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (pos) params.set("pos", pos);
  const res = await fetch(`/api/casino/prediction/gifs?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return { items: [], next: null };
  const data = (await res.json()) as {
    items?: PredictionGifItem[];
    next?: string | null;
  };
  return {
    items: Array.isArray(data.items) ? data.items : [],
    next: data.next ?? null,
  };
}

export function fetchMyPredictionBets(limit = 30) {
  return authFetch(
    `/api/casino/prediction/bets?limit=${Math.min(100, Math.max(1, limit))}`,
  ) as Promise<PredictionBetDto[]>;
}

export function fetchMyPredictionBookmarks() {
  return authFetch("/api/casino/prediction/bookmarks") as Promise<
    PredictionEventDto[]
  >;
}

export type PredictionGlobalActivityDto = PredictionActivityDto & {
  event: {
    id: number;
    slug: string;
    title: string;
    titleEn: string | null;
  };
};

export async function fetchPredictionGlobalActivity(
  limit = 30,
): Promise<PredictionGlobalActivityDto[]> {
  const res = await fetch(
    `${API()}/api/casino/prediction/activity?limit=${Math.min(50, Math.max(1, limit))}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export type PredictionLeaderboardRow = {
  userId: number;
  trader: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  pnlUsd: number;
  bets: number;
  wins: number;
  winRate: number | null;
};

export async function fetchPredictionLeaderboard(
  limit = 10,
): Promise<PredictionLeaderboardRow[]> {
  const res = await fetch(
    `${API()}/api/casino/prediction/leaderboard?limit=${Math.min(25, Math.max(1, limit))}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export type PredictionPublicTraderDto = {
  user: {
    id: number;
    name: string;
    nickname?: string | null;
    avatarPreset: string | null;
    avatarUrl?: string | null;
    joinedAt: string;
  };
  range: "1d" | "1w" | "1m" | "1y" | "ytd" | "all";
  currencyCode: string;
  summary: {
    bets: number;
    wins: number;
    losses: number;
    voids: number;
    markets: number;
    stakeTotal: number;
    positionsValue: number;
    pnl: number;
    biggestWin: number;
    winRate: number | null;
  };
  series: Array<{ t: number; v: number }>;
  positions: Array<{
    eventId: number;
    outcomeId: number;
    slug: string;
    title: string;
    titleEn: string | null;
    imageUrl: string | null;
    eventStatus: string;
    outcomeKey: string;
    outcomeLabel: string;
    outcomeLabelEn: string | null;
    stake: number;
    potentialPayout: number;
    avgOdds: number;
    currentOdds: number;
    bets: number;
  }>;
  closed: Array<{
    id: number;
    eventId: number;
    slug: string;
    title: string;
    titleEn: string | null;
    imageUrl: string | null;
    outcomeKey: string;
    outcomeLabel: string;
    outcomeLabelEn: string | null;
    stake: number;
    odds: number;
    potentialPayout: number;
    pnl: number;
    status: string;
    settledAt: string | null;
    createdAt: string;
  }>;
  recent: Array<{
    id: number;
    eventId: number;
    slug: string;
    title: string;
    titleEn: string | null;
    imageUrl: string | null;
    outcomeKey: string;
    outcomeLabel: string;
    outcomeLabelEn: string | null;
    stake: number;
    odds: number;
    potentialPayout: number;
    pnl: number | null;
    status: string;
    settledAt: string | null;
    createdAt: string;
  }>;
};

export async function fetchPredictionPublicTrader(
  idOrNick: string | number,
  range: "1d" | "1w" | "1m" | "1y" | "ytd" | "all" = "all",
  currencyCode = "KZT",
): Promise<PredictionPublicTraderDto> {
  const qs = new URLSearchParams({ range, currencyCode });
  const key = encodeURIComponent(String(idOrNick));
  const res = await fetch(
    `${API()}/api/casino/prediction/traders/${key}?${qs}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("PREDICTION_TRADER_NOT_FOUND");
  return res.json();
}
