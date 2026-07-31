"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchCybersportLive, type CyberGame } from "~/entities/cybersport/api/client";
import { cyberGameHasVideo } from "~/entities/cybersport/lib/cyberGameHasVideo";

function pickFeaturedGames(games: CyberGame[], limit: number): CyberGame[] {
  const withStream = games.filter(cyberGameHasVideo);
  const without = games.filter((g) => !cyberGameHasVideo(g));
  // Prefer matches with real video, then remaining live.
  const ordered = [...withStream, ...without];

  const seen = new Set<string>();
  const unique: CyberGame[] = [];
  for (const game of ordered) {
    if (seen.has(game.eventId)) continue;
    seen.add(game.eventId);
    unique.push(game);
    if (unique.length >= limit) break;
  }
  return unique;
}

async function fetchFeaturedLive(limit: number, sport?: string): Promise<CyberGame[]> {
  // No sport → all disciplines from 1win (not CS2-only / not top-5 batch).
  const games = await fetchCybersportLive(sport, Math.max(limit * 4, 24)).catch(
    () => [] as CyberGame[],
  );
  games.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return pickFeaturedGames(games, limit);
}

export function useCybersportFeaturedLive(limit = 4, sport?: string) {
  return useQuery({
    queryKey: ["cybersport-featured-live", limit, sport ?? "all"],
    queryFn: () => fetchFeaturedLive(limit, sport),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
