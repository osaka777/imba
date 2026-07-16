export type SocialPulsePick = "HOME" | "DRAW" | "AWAY";

export type SocialPulseItem = {
  event: {
    id: string;
    slug?: string | null;
    sport: string;
    leagueName: string;
    homeTeam: string;
    awayTeam: string;
    commenceTime: string;
    phase: "prematch" | "live" | "finished";
  };
  betCount: number;
  bettorCount?: number;
  outcomes: Array<{
    pick: SocialPulsePick;
    betCount: number;
    percent: number;
  }>;
};

export type SocialPulseResponse = {
  enabled: boolean;
  windowHours: number;
  updatedAt?: string;
  items: SocialPulseItem[];
};

export async function fetchSocialPulse(signal?: AbortSignal): Promise<SocialPulseResponse> {
  const response = await fetch("/api/feed/social/pulse", {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error("Social pulse is unavailable");
  }
  return response.json() as Promise<SocialPulseResponse>;
}
