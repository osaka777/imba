import { formatWcBetErrorMessage } from "~/entities/wc-odds/lib/wcBetErrorMessage";

const API = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
};

export type WcTournament = {
  tournamentId: number | null;
  leagueName: string;
  count: number;
  priorityLevel?: number;
  isPriority?: boolean;
};

export type WcEvent = {
  id: string;
  slug: string;
  sport: string;
  leagueName: string;
  tournamentId: number | null;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  totalLine: number | null;
  oddsOver: number | null;
  oddsUnder: number | null;
  bookmaker: string;
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  bettingOpen: boolean;
  phase: "prematch" | "live" | "finished";
  oddsUpdatedAt: string | null;
  marketsCount: number;
  odds1X: number | null;
  odds12: number | null;
  oddsX2: number | null;
  parsedScore?: WcParsedScore | null;
  statList?: WcStatListItem[];
  homeTeamIcon?: string | null;
  awayTeamIcon?: string | null;
  hasBroadcast?: boolean;
  hasHeadToHead?: boolean;
  priorityLevel?: number;
  isPriority?: boolean;
  feedStatus?: string | null;
};

export type WcParsedScore = {
  text?: {
    time?: string;
    liveScore?: string;
    currentScore?: string;
  };
  seconds?: number;
  period?: string | number;
  /** Stoppage/injury time minutes, e.g. 3 → "+3'" (elapsed beyond 45/90). */
  extraTime?: number | null;
  /** Referee-announced added minutes from Olimpbet feed. */
  announcedAddedTime?: number | null;
  /** Active VAR review indicator. */
  varState?: string | null;
  remainingTimeInPeriodSec?: number | null;
  currentTimeInPeriodSec?: number | null;
  overtimeNumber?: number | null;
  penaltyRisk?: boolean | null;
  /** Special phase: extra_time_1 | extra_time_2 | penalties | break */
  gamePhase?: 'extra_time_1' | 'extra_time_2' | 'penalties' | 'break' | null;
  details?: [string | number, string | number][];
  currentScore?: [string | number, string | number];
  liveScore?: {
    active?: number;
  };
};

export type WcStatListItem = {
  id: string;
  name: string;
  opp1: string;
  opp2: string;
};

export type WcMarketOutcome = {
  name: string;
  price: number;
  point?: number;
  outcomeKey: string;
  suspended?: boolean;
};

export type WcMarketGroup = {
  key: string;
  marketKey: string;
  label: string;
  outcomes: WcMarketOutcome[];
};

export type WcGroupedMarkets = Record<string, WcMarketGroup[]>;

export type WcEventDetail = WcEvent & {
  groupedMarkets: WcGroupedMarkets;
};

export type HomepageWidgetItem =
  | { kind: "wc"; event: WcEvent }
  | { kind: "cyber"; event: import("~/entities/cybersport/api/client").CyberGame; isLive: boolean };

export type WcBet = {
  id: number;
  pick?: 'HOME' | 'DRAW' | 'AWAY' | null;
  marketKey?: string;
  outcomeKey?: string | null;
  line?: string | null;
  outcomeName?: string | null;
  odds: string;
  stake: string;
  potentialPayout: string;
  cashoutAmount?: string | null;
  status: 'PENDING' | 'WIN' | 'LOSE' | 'VOID' | 'CASHED_OUT';
  currencyCode: string;
  createdAt: string;
  event: {
    id?: string;
    slug?: string;
    sport?: string;
    leagueName?: string;
    homeTeam: string;
    awayTeam: string;
    commenceTime: string;
    homeScore: number | null;
    awayScore: number | null;
    completed?: boolean;
    phase?: "prematch" | "live" | "finished";
    parsedScore?: WcParsedScore | null;
    homeTeamIcon?: string | null;
    awayTeamIcon?: string | null;
  };
};

export type WcExpressBet = {
  id: number;
  stake: string;
  combinedOdds: string;
  potentialPayout: string;
  status: WcBet['status'];
  currencyCode: string;
  createdAt: string;
  legs: WcBet[];
};

export type WcBetsGrouped = {
  ordinar: WcBet[];
  express: WcExpressBet[];
};

export async function fetchWcStatus() {
  const res = await fetch(`${API()}/api/feed/status`, { cache: 'no-store' });
  return res.json() as Promise<{ enabled: boolean }>;
}

export async function fetchHomepageWidgets(): Promise<{ items: HomepageWidgetItem[] }> {
  const res = await fetch(`${API()}/api/feed/home/widgets`, { cache: "no-store" });
  if (!res.ok) return { items: [] };
  const data = (await res.json()) as { items?: HomepageWidgetItem[] };
  return { items: Array.isArray(data.items) ? data.items : [] };
}

export async function fetchWcDates() {
  const res = await fetch(`${API()}/api/feed/dates`, { cache: 'no-store' });
  if (!res.ok) return [] as string[];
  return res.json() as Promise<string[]>;
}

export async function fetchWcSearchEvents(q: string, sport?: string) {
  const params = new URLSearchParams();
  params.set("q", q);
  if (sport) params.set("sport", sport);
  const res = await fetch(`${API()}/api/feed/search?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) return [] as WcEvent[];
  return res.json() as Promise<WcEvent[]>;
}

export async function fetchWcLineEvents(
  sport?: string,
  hours?: string,
  date?: string,
  limit?: number,
  offset?: number,
  tournament?: string | null,
  league?: string | null,
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
  const res = await fetch(`${API()}/api/feed/line/events${q}`, { cache: "no-store" });
  if (!res.ok) return [] as WcEvent[];
  return res.json() as Promise<WcEvent[]>;
}

export async function fetchWcLineTimeCounts(sport?: string) {
  const q = sport ? `?sport=${encodeURIComponent(sport)}` : "";
  const res = await fetch(`${API()}/api/feed/line/time-counts${q}`, { cache: "no-store" });
  if (!res.ok) return { all: 0 } as Record<string, number>;
  return res.json() as Promise<Record<string, number>>;
}

export async function fetchWcLineCounts() {
  const res = await fetch(`${API()}/api/feed/line/counts`, { cache: 'no-store' });
  if (!res.ok) return {} as Record<string, number>;
  return res.json() as Promise<Record<string, number>>;
}

export async function fetchWcLineTournaments(sport?: string) {
  const q = sport ? `?sport=${encodeURIComponent(sport)}` : "";
  const res = await fetch(`${API()}/api/feed/line/tournaments${q}`, { cache: "no-store" });
  if (!res.ok) return [] as WcTournament[];
  return res.json() as Promise<WcTournament[]>;
}

export async function fetchWcLiveTournaments(sport?: string) {
  const q = sport ? `?sport=${encodeURIComponent(sport)}` : "";
  const res = await fetch(`${API()}/api/feed/live/tournaments${q}`, { cache: "no-store" });
  if (!res.ok) return [] as WcTournament[];
  return res.json() as Promise<WcTournament[]>;
}

export async function fetchWcLiveEvents(
  sport?: string,
  limit?: number,
  offset?: number,
  tournament?: string | null,
  league?: string | null,
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
  const res = await fetch(`${API()}/api/feed/live/events${q}`, { cache: "no-store" });
  if (!res.ok) return [] as WcEvent[];
  return res.json() as Promise<WcEvent[]>;
}

export async function fetchWcLiveCounts(broadcastOnly?: boolean) {
  const q = broadcastOnly ? "?broadcast=1" : "";
  const res = await fetch(`${API()}/api/feed/live/counts${q}`, { cache: "no-store" });
  if (!res.ok) return {} as Record<string, number>;
  return res.json() as Promise<Record<string, number>>;
}

export async function fetchWcEvents(date?: string) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${API()}/api/feed/events${q}`, { cache: 'no-store' });
  if (!res.ok) return [] as WcEvent[];
  return res.json() as Promise<WcEvent[]>;
}

export async function fetchWcEventDetail(ref: string) {
  const res = await fetch(`${API()}/api/feed/events/${encodeURIComponent(ref)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json() as Promise<WcEventDetail>;
}

export type WcEventBroadcast = {
  available: boolean;
  streamUrl: string | null;
  streamType: string | null;
};

export async function fetchWcEventBroadcast(ref: string): Promise<WcEventBroadcast> {
  const res = await fetch(`${API()}/api/feed/events/${encodeURIComponent(ref)}/play`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return { available: false, streamUrl: null, streamType: null };
  }
  return res.json() as Promise<WcEventBroadcast>;
}

export async function fetchMyWcBets(token: string): Promise<WcBetsGrouped> {
  const res = await fetch(`${API()}/api/feed/bets/my`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return { ordinar: [], express: [] };
  const data = await res.json() as WcBetsGrouped | WcBet[];
  if (Array.isArray(data)) {
    return { ordinar: data, express: [] };
  }
  return {
    ordinar: Array.isArray(data.ordinar) ? data.ordinar : [],
    express: Array.isArray(data.express) ? data.express : [],
  };
}

export type PlaceWcExpressLegBody = {
  eventId: string;
  pick?: 'HOME' | 'DRAW' | 'AWAY';
  marketKey?: string;
  groupKey?: string;
  outcomeKey?: string;
  line?: string;
  outcomeName?: string;
  clientOdds?: number;
};

export type PlaceWcExpressBetBody = {
  stake: number;
  currencyCode: string;
  acceptOddsChange?: boolean;
  legs: PlaceWcExpressLegBody[];
};

export async function placeWcExpressBet(token: string, body: PlaceWcExpressBetBody) {
  const res = await fetch(`${API()}/api/feed/bets/express`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as {
      statusCode?: number;
      message?: string | {
        message?: string;
        coefficientChanged?: boolean;
        actualCoefficient?: number;
        originalCoefficient?: number;
      };
      coefficientChanged?: boolean;
      actualCoefficient?: number;
      originalCoefficient?: number;
    };
    const nested =
      typeof err?.message === 'object' && err.message !== null ? err.message : null;
    const payload = nested ?? err;
    const rawMessage =
      typeof err?.message === 'string'
        ? err.message
        : nested?.message || payload?.message || '';
    const message = formatWcBetErrorMessage(rawMessage || 'Не удалось принять ставку');
    const coefficientChanged =
      payload?.coefficientChanged === true
      || rawMessage === 'Odds have changed';
    const actualCoefficient = payload?.actualCoefficient;
    const error = new Error(message) as Error & {
      coefficientChanged?: boolean;
      actualCoefficient?: number;
      statusCode?: number;
      rawMessage?: string;
    };
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
  eventId: string;
  stake: number;
  currencyCode: string;
  pick?: 'HOME' | 'DRAW' | 'AWAY';
  marketKey?: string;
  groupKey?: string;
  outcomeKey?: string;
  line?: string;
  outcomeName?: string;
  clientOdds?: number;
  acceptOddsChange?: boolean;
};

export async function placeWcBet(token: string, body: PlaceWcBetBody) {
  const res = await fetch(`${API()}/api/feed/bets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as {
      statusCode?: number;
      message?: string | {
        message?: string;
        coefficientChanged?: boolean;
        actualCoefficient?: number;
        originalCoefficient?: number;
      };
      coefficientChanged?: boolean;
      actualCoefficient?: number;
      originalCoefficient?: number;
    };
    const nested =
      typeof err?.message === 'object' && err.message !== null ? err.message : null;
    const payload = nested ?? err;
    const rawMessage =
      typeof err?.message === 'string'
        ? err.message
        : nested?.message || payload?.message || '';
    const message = formatWcBetErrorMessage(rawMessage || 'Не удалось принять ставку');
    const coefficientChanged =
      payload?.coefficientChanged === true
      || rawMessage === 'Odds have changed';
    const actualCoefficient = payload?.actualCoefficient;
    const error = new Error(message) as Error & {
      coefficientChanged?: boolean;
      actualCoefficient?: number;
      statusCode?: number;
      rawMessage?: string;
    };
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
  text: string;
  svg: string;
  url: string;
};

export type WcMyTournament = {
  summary: {
    totalBets: number;
    wins: number;
    losses: number;
    pending: number;
    totalStaked: number;
    totalWon: number;
    roiPercent: number | null;
  };
  favoriteTeam: { name: string; betCount: number } | null;
  openBets: WcBet[];
  recentSettled: WcBet[];
};

export type WcEventSubscriptionState = {
  subscribed: boolean;
  notifyGoals: boolean;
  notifyStart: boolean;
  eventId: string;
};

export async function fetchWcBetShare(token: string, betId: number): Promise<WcBetShare> {
  const res = await fetch(`${API()}/api/feed/bets/${betId}/share`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Не удалось получить карточку ставки');
  return res.json();
}

export async function fetchWcMyTournament(token: string): Promise<WcMyTournament> {
  const res = await fetch(`${API()}/api/feed/my-tournament`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Не удалось загрузить статистику');
  return res.json();
}

export async function fetchWcEventSubscription(
  token: string,
  eventRef: string,
): Promise<WcEventSubscriptionState> {
  const res = await fetch(`${API()}/api/feed/events/${encodeURIComponent(eventRef)}/subscription`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Не удалось проверить подписку');
  return res.json();
}

export async function subscribeWcEvent(
  token: string,
  eventRef: string,
  opts?: { notifyGoals?: boolean; notifyStart?: boolean },
): Promise<void> {
  const res = await fetch(`${API()}/api/feed/events/${encodeURIComponent(eventRef)}/subscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts ?? {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || 'Не удалось подписаться');
  }
}

export async function unsubscribeWcEvent(token: string, eventRef: string): Promise<void> {
  const res = await fetch(`${API()}/api/feed/events/${encodeURIComponent(eventRef)}/subscribe`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Не удалось отписаться');
}

export type WcCashoutQuote =
  | { available: false; reason: string; code: string }
  | {
      available: true;
      amount: string;
      currentOdds: string;
      placedOdds: string;
      mode: 'determinate_win' | 'determinate_void' | 'live_odds';
      expiresAt: string;
    };

export async function fetchWcCashoutQuote(token: string, betId: number): Promise<WcCashoutQuote> {
  const res = await fetch(`${API()}/api/feed/bets/${betId}/cashout-quote`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || 'Не удалось получить котировку');
  }
  return res.json() as Promise<WcCashoutQuote>;
}

export async function executeWcCashout(
  token: string,
  betId: number,
  expectedAmount?: string,
): Promise<{ ok: true; amount: string; betId: number }> {
  const res = await fetch(`${API()}/api/feed/bets/${betId}/cashout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      expectedAmount != null ? { expectedAmount: Number(expectedAmount) } : {},
    ),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string | string[] };
    const msg = Array.isArray(err.message) ? err.message[0] : err.message;
    throw new Error(msg || 'Не удалось продать ставку');
  }
  return res.json() as Promise<{ ok: true; amount: string; betId: number }>;
}
