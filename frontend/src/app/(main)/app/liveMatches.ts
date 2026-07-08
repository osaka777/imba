const API_HOST = process.env.NEXT_PUBLIC_HOST || "https://imba.bet";

type FeedEvent = {
  id: string;
  sport: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  homeTeamIcon?: string | null;
  awayTeamIcon?: string | null;
  phase: string;
  parsedScore?: { text?: { time?: string } } | null;
};

export type PhoneMatch = {
  id: string;
  league: string;
  time: string | null;
  isLive: boolean;
  home: { name: string; icon: string | null; score: number | null };
  away: { name: string; icon: string | null; score: number | null };
  odds: { label: string; value: string }[];
};

const FALLBACK_MATCHES: PhoneMatch[] = [
  {
    id: "fallback-1",
    league: "Премьер-лига Казахстана",
    time: "67'",
    isLive: true,
    home: { name: "Кайрат", icon: null, score: 2 },
    away: { name: "Астана", icon: null, score: 1 },
    odds: [
      { label: "П1", value: "1.85" },
      { label: "X", value: "3.40" },
      { label: "П2", value: "4.20" },
    ],
  },
  {
    id: "fallback-2",
    league: "Чемпионат мира 2026",
    time: "12'",
    isLive: true,
    home: { name: "Испания", icon: null, score: 0 },
    away: { name: "Норвегия", icon: null, score: 0 },
    odds: [
      { label: "П1", value: "1.55" },
      { label: "X", value: "3.90" },
      { label: "П2", value: "6.50" },
    ],
  },
];

function formatMinute(raw?: string | null): string | null {
  if (!raw) return null;
  const minutes = raw.split(":")[0];
  if (!minutes || Number.isNaN(Number(minutes))) return null;
  return `${minutes}'`;
}

function formatOdd(value: number | null): string | null {
  if (value == null || value <= 1) return null;
  return value.toFixed(2);
}

function toPhoneMatch(event: FeedEvent): PhoneMatch | null {
  const odds: PhoneMatch["odds"] = [];
  const home = formatOdd(event.oddsHome);
  const draw = formatOdd(event.oddsDraw);
  const away = formatOdd(event.oddsAway);
  if (home) odds.push({ label: "П1", value: home });
  if (draw) odds.push({ label: "X", value: draw });
  if (away) odds.push({ label: "П2", value: away });
  if (odds.length < 2) return null;

  return {
    id: event.id,
    league: event.leagueName,
    time: formatMinute(event.parsedScore?.text?.time),
    isLive: event.phase === "live",
    home: {
      name: event.homeTeam,
      icon: event.homeTeamIcon?.trim() || null,
      score: event.homeScore,
    },
    away: {
      name: event.awayTeam,
      icon: event.awayTeamIcon?.trim() || null,
      score: event.awayScore,
    },
    odds,
  };
}

function rankMatch(event: FeedEvent): number {
  let score = 0;
  if (event.homeTeamIcon && event.awayTeamIcon) score += 4;
  if (event.sport === "soccer") score += 2;
  if (event.oddsDraw != null) score += 1;
  return score;
}

export async function getPhoneMatches(): Promise<PhoneMatch[]> {
  try {
    const res = await fetch(`${API_HOST}/api/feed/live/events?limit=24`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return FALLBACK_MATCHES;

    const events = (await res.json()) as FeedEvent[];
    if (!Array.isArray(events) || events.length === 0) return FALLBACK_MATCHES;

    const matches = events
      .slice()
      .sort((a, b) => rankMatch(b) - rankMatch(a))
      .map(toPhoneMatch)
      .filter((m): m is PhoneMatch => m !== null)
      .slice(0, 2);

    return matches.length > 0 ? matches : FALLBACK_MATCHES;
  } catch {
    return FALLBACK_MATCHES;
  }
}
