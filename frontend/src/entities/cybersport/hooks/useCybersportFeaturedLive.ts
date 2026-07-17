"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchCybersportLive, type CyberGame } from "~/entities/cybersport/api/client";
import { CYBER_TOP_API_SPORTS } from "~/entities/cybersport/lib/cyberDisciplineSort";

const FEATURED_SPORTS = CYBER_TOP_API_SPORTS.slice(0, 5);

/** Live games with Kick/Twitch audio — skip silent Olimpbet HLS-only feeds. */
function hasAudioCapableBroadcast(game: CyberGame): boolean {
  const meta = (game.meta ?? {}) as Record<string, unknown>;
  return Boolean(
    meta.hasBroadcast
    || meta.wcHasBroadcast
    || meta.kickChannel
    || meta.twitchChannel
    || meta.streamProvider === "kick"
    || meta.streamProvider === "twitch",
  );
}

function pickFeaturedGames(games: CyberGame[], limit: number): CyberGame[] {
  const withAudio = games.filter(hasAudioCapableBroadcast);
  const pool = withAudio.length > 0 ? withAudio : games;

  const seen = new Set<string>();
  const unique: CyberGame[] = [];
  for (const game of pool) {
    if (seen.has(game.eventId)) continue;
    seen.add(game.eventId);
    unique.push(game);
    if (unique.length >= limit) break;
  }
  return unique;
}

async function fetchFeaturedLive(limit: number, sport?: string): Promise<CyberGame[]> {
  if (sport) {
    const games = await fetchCybersportLive(sport, limit * 3).catch(() => [] as CyberGame[]);
    return pickFeaturedGames(games, limit);
  }

  const batches = await Promise.all(
    FEATURED_SPORTS.map((s) =>
      fetchCybersportLive(s, 12).catch(() => [] as CyberGame[]),
    ),
  );

  const merged = batches.flat();
  merged.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  return pickFeaturedGames(merged, limit);
}

export function useCybersportFeaturedLive(limit = 4, sport?: string) {
  return useQuery({
    queryKey: ["cybersport-featured-live", limit, sport ?? "all"],
    queryFn: () => fetchFeaturedLive(limit, sport),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
