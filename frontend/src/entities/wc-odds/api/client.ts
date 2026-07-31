import { formatWcBetErrorMessage } from "~/entities/wc-odds/lib/wcBetErrorMessage";
import { broadcastAuthHeaders } from "~/entities/wc-odds/lib/wcBroadcastAuth";
import { feedAuthHeaders } from "~/entities/wc-odds/lib/feedSession";
import { getClientLocale } from "~/shared/i18n/get-client-locale";
import { toFeedLocale, tOutside } from "~/shared/i18n";

const API = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // SSR inside Docker must hit the backend directly (private IP → feed guard allow).
  return (
    process.env.BACKEND_URL
    || process.env.NEXT_PUBLIC_HOST
    || "http://localhost:3000"
  );
};

function localeHeaders(extra?: HeadersInit): HeadersInit {
  // Feed overlays only ship ru|en — map LatAm/TR → en, CIS → ru.
  const feedLocale = toFeedLocale(getClientLocale());
  return {
    ...feedAuthHeaders(),
    ...(extra ?? {}),
    "Accept-Language": feedLocale,
    "X-Locale": feedLocale,
  };
}

async function wcFetch(path: string, init?: RequestInit) {
  return fetch(`${API()}${path}`, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers: localeHeaders(init?.headers),
  });
}

export type WcTournament = {
  count: number;
  isPriority?: boolean;
  leagueName: string;
  priorityLevel?: number;
  tournamentId: null | number;
};

export type WcEvent = {
  awayScore: null | number;
  awayTeam: string;
  awayTeamIcon?: null | string;
  bettingOpen: boolean;
  bookmaker: string;
  commenceTime: string;
  completed: boolean;
  feedStatus?: null | string;
  hasBroadcast?: boolean;
  hasHeadToHead?: boolean;
  hasLiveTracker?: boolean;
  homeScore: null | number;
  homeTeam: string;
  homeTeamIcon?: null | string;
  id: string;
  isPriority?: boolean;
  leagueName: string;
  marketsCount: number;
  odds1X: null | number;
  odds12: null | number;
  oddsAway: null | number;
  oddsDraw: null | number;
  oddsHome: null | number;
  oddsOver: null | number;
  oddsUnder: null | number;
  oddsUpdatedAt: null | string;
  oddsX2: null | number;
  parsedScore?: WcParsedScore | null;
  phase: "finished" | "live" | "prematch";
  priorityLevel?: number;
  slug: string;
  sport: string;
  statList?: WcStatListItem[];
  totalLine: null | number;
  tournamentId: null | number;
};

export type WcParsedScore = {
  /** Referee-announced added minutes from Olimpbet feed. */
  announcedAddedTime?: null | number;
  currentScore?: [number | string, number | string];
  currentTimeInPeriodSec?: null | number;
  details?: [number | string, number | string][];
  /** Stoppage/injury time minutes, e.g. 3 → "+3'" (elapsed beyond 45/90). */
  extraTime?: null | number;
  /** Special phase: extra_time_1 | extra_time_2 | penalties | break */
  gamePhase?: 'break' | 'extra_time_1' | 'extra_time_2' | 'penalties' | null;
  liveScore?: {
    active?: number;
  };
  matchPhaseRaw?: null | string;
  overtimeNumber?: null | number;
  penaltyRisk?: boolean | null;
  period?: number | string;
  remainingTimeInPeriodSec?: null | number;
  seconds?: number;
  text?: {
    currentScore?: string;
    liveScore?: string;
    time?: string;
  };
  /** Active VAR review indicator. */
  varState?: null | string;
};

export type WcStatListItem = {
  id: string;
  name: string;
  opp1: string;
  opp2: string;
};

export type WcMarketOutcome = {
  name: string;
  outcomeKey: string;
  point?: number;
  price: number;
  suspended?: boolean;
};

export type WcMarketGroup = {
  key: string;
  label: string;
  marketKey: string;
  outcomes: WcMarketOutcome[];
};

export type WcGroupedMarkets = Record<string, WcMarketGroup[]>;

export type WcEventDetail = {
  groupedMarkets: WcGroupedMarkets;
} & WcEvent;

export type HomepageWidgetItem =
  | { event: WcEvent; kind: "wc" }
  | { event: import("~/entities/cybersport/api/client").CyberGame; isLive: boolean; kind: "cyber" };

export type WcBet = {
  cashoutAmount?: null | string;
  createdAt: string;
  currencyCode: string;
  event: {
    awayScore: null | number;
    awayTeam: string;
    awayTeamIcon?: null | string;
    commenceTime: string;
    completed?: boolean;
    homeScore: null | number;
    homeTeam: string;
    homeTeamIcon?: null | string;
    id?: string;
    leagueName?: string;
    parsedScore?: WcParsedScore | null;
    phase?: "finished" | "live" | "prematch";
    slug?: string;
    sport?: string;
  };
  id: number;
  line?: null | string;
  marketKey?: string;
  odds: string;
  outcomeKey?: null | string;
  outcomeName?: null | string;
  pick?: 'AWAY' | 'DRAW' | 'HOME' | null;
  potentialPayout: string;
  stake: string;
  status: 'CASHED_OUT' | 'LOSE' | 'PENDING' | 'VOID' | 'WIN';
};

export type WcExpressBet = {
  combinedOdds: string;
  createdAt: string;
  currencyCode: string;
  id: number;
  legs: WcBet[];
  potentialPayout: string;
  stake: string;
  status: WcBet['status'];
};

export type WcBetsGrouped = {
  express: WcExpressBet[];
  ordinar: WcBet[];
};

export async function fetchWcStatus() {
  const res = await wcFetch('/api/feed/status', { cache: 'no-store' });
  return res.json() as Promise<{ enabled: boolean }>;
}

export async function fetchHomepageWidgets(): Promise<{ items: HomepageWidgetItem[] }> {
  const res = await wcFetch('/api/feed/home/widgets', { cache: 'no-store' });
  if (!res.ok) return { items: [] };
  const data = (await res.json()) as { items?: HomepageWidgetItem[] };
  return { items: Array.isArray(data.items) ? data.items : [] };
}

export async function fetchWcDates() {
  const res = await wcFetch('/api/feed/dates', { cache: 'no-store' });
  if (!res.ok) return [] as string[];
  return res.json() as Promise<string[]>;
}

export async function fetchWcSearchEvents(q: string, sport?: string) {
  const params = new URLSearchParams();
  params.set("q", q);
  if (sport) params.set("sport", sport);
  const res = await wcFetch(`/api/feed/search?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) return [] as WcEvent[];
  return res.json() as Promise<WcEvent[]>;
}

export async function fetchWcLineEvents(
  sport?: string,
  hours?: string,
  date?: string,
  limit?: number,
  offset?: number,
  tournament?: null | string,
  league?: null | string,
) {
  const params = new URLSearchParams();
  if (sport) params.set("sport", sport);
  if (hours && hours !== "all") params.set("hours", hours);
  if (date) params.set("date", date);
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));
  if (tournament) params.set("tournament", tournament);
  if (league) params.set("league", league);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await wcFetch(`/api/feed/line/events${q}`, { cache: "no-store" });
  if (!res.ok) return [] as WcEvent[];
  return res.json() as Promise<WcEvent[]>;
}

export async function fetchWcLineTimeCounts(sport?: string) {
  const q = sport ? `?sport=${encodeURIComponent(sport)}` : "";
  const res = await wcFetch(`/api/feed/line/time-counts${q}`, { cache: "no-store" });
  if (!res.ok) return { all: 0 } as Record<string, number>;
  return res.json() as Promise<Record<string, number>>;
}

export async function fetchWcLineCounts() {
  const res = await wcFetch('/api/feed/line/counts', { cache: 'no-store' });
  if (!res.ok) return {} as Record<string, number>;
  return res.json() as Promise<Record<string, number>>;
}

export async function fetchWcLineTournaments(sport?: string) {
  const q = sport ? `?sport=${encodeURIComponent(sport)}` : "";
  const res = await wcFetch(`/api/feed/line/tournaments${q}`, { cache: "no-store" });
  if (!res.ok) return [] as WcTournament[];
  return res.json() as Promise<WcTournament[]>;
}

export async function fetchWcLiveTournaments(sport?: string) {
  const q = sport ? `?sport=${encodeURIComponent(sport)}` : "";
  const res = await wcFetch(`/api/feed/live/tournaments${q}`, { cache: "no-store" });
  if (!res.ok) return [] as WcTournament[];
  return res.json() as Promise<WcTournament[]>;
}

export async function fetchWcLiveEvents(
  sport?: string,
  limit?: number,
  offset?: number,
  tournament?: null | string,
  league?: null | string,
  broadcastOnly?: boolean,
) {
  const params = new URLSearchParams();
  if (sport) params.set("sport", sport);
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));
  if (tournament) params.set("tournament", tournament);
  if (league) params.set("league", league);
  if (broadcastOnly) params.set("broadcast", "1");
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await wcFetch(`/api/feed/live/events${q}`, { cache: "no-store" });
  if (!res.ok) return [] as WcEvent[];
  return res.json() as Promise<WcEvent[]>;
}

export async function fetchWcLiveCounts(broadcastOnly?: boolean) {
  const q = broadcastOnly ? "?broadcast=1" : "";
  const res = await wcFetch(`/api/feed/live/counts${q}`, { cache: "no-store" });
  if (!res.ok) return {} as Record<string, number>;
  return res.json() as Promise<Record<string, number>>;
}

export async function fetchWcEvents(date?: string) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await wcFetch(`/api/feed/events${q}`, { cache: 'no-store' });
  if (!res.ok) return [] as WcEvent[];
  return res.json() as Promise<WcEvent[]>;
}

export async function fetchWcEventDetail(
  ref: string,
  options?: { sync?: boolean },
): Promise<({ syncOk?: boolean } & WcEventDetail) | null> {
  const q = options?.sync ? '?sync=1' : '';
  const res = await wcFetch(`/api/feed/events/${encodeURIComponent(ref)}${q}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json() as WcEventDetail;
  if (!options?.sync) return data;
  const synced = res.headers.get('X-WC-Synced');
  return {
    ...data,
    syncOk: synced !== '0',
  };
}

export type WcEventBroadcast = {
  available: boolean;
  kickChannel?: null | string;
  provider?: null | string;
  requiresAuth?: boolean;
  streamFallback?: boolean;
  streamType: null | string;
  streamUrl: null | string;
  twitchChannel?: null | string;
};

export async function fetchWcEventBroadcast(ref: string): Promise<WcEventBroadcast> {
  const res = await fetch(`${API()}/api/feed/events/${encodeURIComponent(ref)}/play`, {
    cache: "no-store",
    credentials: "include",
    headers: broadcastAuthHeaders(),
  });
  if (res.status === 401) {
    return {
      available: false,
      requiresAuth: true,
      streamType: null,
      streamUrl: null,
    };
  }
  if (!res.ok) {
    return { available: false, streamType: null, streamUrl: null };
  }
  return res.json() as Promise<WcEventBroadcast>;
}

export type WcLiveTracker = {
  available: boolean;
  trackerUrl: null | string;
};

export async function fetchWcLiveTracker(ref: string): Promise<WcLiveTracker> {
  const res = await fetch(`${API()}/api/feed/events/${encodeURIComponent(ref)}/tracker`, {
    cache: "no-store",
    credentials: "include",
    headers: broadcastAuthHeaders(),
  });
  if (!res.ok) {
    return { available: false, trackerUrl: null };
  }
  return res.json() as Promise<WcLiveTracker>;
}

export async function fetchMyWcBets(token: string): Promise<WcBetsGrouped> {
  const res = await fetch(`${API()}/api/feed/bets/my`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { express: [], ordinar: [] };
  const data = await res.json() as WcBet[] | WcBetsGrouped;
  if (Array.isArray(data)) {
    return { express: [], ordinar: data };
  }
  return {
    express: Array.isArray(data.express) ? data.express : [],
    ordinar: Array.isArray(data.ordinar) ? data.ordinar : [],
  };
}

export type PlaceWcExpressLegBody = {
  clientOdds?: number;
  eventId: string;
  groupKey?: string;
  line?: string;
  marketKey?: string;
  outcomeKey?: string;
  outcomeName?: string;
  pick?: 'AWAY' | 'DRAW' | 'HOME';
};

export type PlaceWcExpressBetBody = {
  acceptOddsChange?: boolean;
  currencyCode: string;
  legs: PlaceWcExpressLegBody[];
  stake: number;
};

export async function placeWcExpressBet(token: string, body: PlaceWcExpressBetBody) {
  const res = await fetch(`${API()}/api/feed/bets/express`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as {
      actualCoefficient?: number;
      coefficientChanged?: boolean;
      message?: {
        actualCoefficient?: number;
        coefficientChanged?: boolean;
        message?: string;
        originalCoefficient?: number;
      } | string;
      originalCoefficient?: number;
      statusCode?: number;
    };
    const nested =
      typeof err?.message === 'object' && err.message !== null ? err.message : null;
    const payload = nested ?? err;
    const rawMessage =
      typeof err?.message === 'string'
        ? err.message
        : nested?.message || payload?.message || '';
    const message = formatWcBetErrorMessage(rawMessage || '', getClientLocale());
    const coefficientChanged =
      payload?.coefficientChanged === true
      || rawMessage === 'Odds have changed';
    const actualCoefficient = payload?.actualCoefficient;
    const error = new Error(message) as {
      actualCoefficient?: number;
      coefficientChanged?: boolean;
      rawMessage?: string;
      statusCode?: number;
    } & Error;
    error.statusCode = err.statusCode;
    error.rawMessage = rawMessage;
    if (coefficientChanged) {
      error.coefficientChanged = true;
      error.actualCoefficient = actualCoefficient;
    }
    throw error;
  }
  return res.json();
}

export type PlaceWcBetBody = {
  acceptOddsChange?: boolean;
  accountType?: 'bonus' | 'main';
  clientOdds?: number;
  currencyCode: string;
  eventId: string;
  groupKey?: string;
  line?: string;
  marketKey?: string;
  outcomeKey?: string;
  outcomeName?: string;
  pick?: 'AWAY' | 'DRAW' | 'HOME';
  stake: number;
};

export async function placeWcBet(token: string, body: PlaceWcBetBody) {
  const res = await fetch(`${API()}/api/feed/bets`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as {
      actualCoefficient?: number;
      coefficientChanged?: boolean;
      message?: {
        actualCoefficient?: number;
        coefficientChanged?: boolean;
        message?: string;
        originalCoefficient?: number;
      } | string;
      originalCoefficient?: number;
      statusCode?: number;
    };
    const nested =
      typeof err?.message === 'object' && err.message !== null ? err.message : null;
    const payload = nested ?? err;
    const rawMessage =
      typeof err?.message === 'string'
        ? err.message
        : nested?.message || payload?.message || '';
    const message = formatWcBetErrorMessage(rawMessage || '', getClientLocale());
    const coefficientChanged =
      payload?.coefficientChanged === true
      || rawMessage === 'Odds have changed';
    const actualCoefficient = payload?.actualCoefficient;
    const error = new Error(message) as {
      actualCoefficient?: number;
      coefficientChanged?: boolean;
      rawMessage?: string;
      statusCode?: number;
    } & Error;
    error.statusCode = err.statusCode;
    error.rawMessage = rawMessage;
    if (coefficientChanged) {
      error.coefficientChanged = true;
      error.actualCoefficient = actualCoefficient;
    }
    throw error;
  }
  return res.json();
}

export type WcBetShare = {
  svg: string;
  text: string;
  url: string;
};

export type WcMyTournament = {
  favoriteTeam: { betCount: number; name: string } | null;
  openBets: WcBet[];
  recentSettled: WcBet[];
  summary: {
    losses: number;
    pending: number;
    roiPercent: null | number;
    totalBets: number;
    totalStaked: number;
    totalWon: number;
    wins: number;
  };
};

export type WcEventSubscriptionState = {
  eventId: string;
  notifyGoals: boolean;
  notifyStart: boolean;
  subscribed: boolean;
};

export async function fetchWcBetShare(token: string, betId: number): Promise<WcBetShare> {
  const res = await fetch(`${API()}/api/feed/bets/${betId}/share`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(tOutside("common.errGetBetCard"));
  return res.json();
}

export async function fetchWcMyTournament(token: string): Promise<WcMyTournament> {
  const res = await fetch(`${API()}/api/feed/my-tournament`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(tOutside("common.errLoadStats"));
  return res.json();
}

export async function fetchWcEventSubscription(
  token: string,
  eventRef: string,
): Promise<WcEventSubscriptionState> {
  const res = await fetch(`${API()}/api/feed/events/${encodeURIComponent(eventRef)}/subscription`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(tOutside("common.errCheckSubscription"));
  return res.json();
}

export async function subscribeWcEvent(
  token: string,
  eventRef: string,
  opts?: { notifyGoals?: boolean; notifyStart?: boolean },
): Promise<void> {
  const res = await fetch(`${API()}/api/feed/events/${encodeURIComponent(eventRef)}/subscribe`, {
    body: JSON.stringify(opts ?? {}),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || tOutside("common.errSubscribe"));
  }
}

export async function unsubscribeWcEvent(token: string, eventRef: string): Promise<void> {
  const res = await fetch(`${API()}/api/feed/events/${encodeURIComponent(eventRef)}/subscribe`, {
    headers: { Authorization: `Bearer ${token}` },
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(tOutside("common.errUnsubscribe"));
}

export type WcCashoutQuote =
  | {
      amount: string;
      available: true;
      currentOdds: string;
      expiresAt: string;
      mode: 'determinate_void' | 'determinate_win' | 'live_odds';
      placedOdds: string;
    }
  | { available: false; code: string; reason: string };

export async function fetchWcCashoutQuotes(
  token: string,
  betIds?: number[],
): Promise<Record<number, WcCashoutQuote>> {
  const params = betIds?.length
    ? `?ids=${betIds.join(",")}`
    : "";
  const res = await fetch(`${API()}/api/feed/bets/cashout-quotes${params}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || tOutside("common.errGetQuotes"));
  }
  return res.json() as Promise<Record<number, WcCashoutQuote>>;
}

export async function fetchWcCashoutQuote(token: string, betId: number): Promise<WcCashoutQuote> {
  const res = await fetch(`${API()}/api/feed/bets/${betId}/cashout-quote`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || tOutside("common.errGetQuote"));
  }
  return res.json() as Promise<WcCashoutQuote>;
}

export async function executeWcCashout(
  token: string,
  betId: number,
  expectedAmount?: string,
): Promise<{ amount: string; betId: number; ok: true }> {
  const res = await fetch(`${API()}/api/feed/bets/${betId}/cashout`, {
    body: JSON.stringify(
      expectedAmount != null ? { expectedAmount: Number(expectedAmount) } : {},
    ),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string | string[] };
    const msg = Array.isArray(err.message) ? err.message[0] : err.message;
    throw new Error(msg || tOutside("common.errSellBet"));
  }
  return res.json() as Promise<{ amount: string; betId: number; ok: true }>;
}
