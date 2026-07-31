"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import {
  fetchCybersportLine,
  fetchCybersportLive,
} from "~/entities/cybersport/api/client";
import { cyberGameHasVideo } from "~/entities/cybersport/lib/cyberGameHasVideo";
import { isEsportsSport } from "~/entities/cybersport/lib/isEsportsSport";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { transformApiGames } from "~/entities/game/lib/transformApiGames";
import type { League } from "~/entities/game/types";

const PAGE_SIZE = 24;

function maskGames<T extends { leagueName?: string; team1?: string; team2?: string; eventName?: string }>(
  games: T[],
): T[] {
  return games.map((game) => ({
    ...game,
    leagueName: maskCybersportLabel(game.leagueName),
    team1: maskCybersportLabel(game.team1),
    team2: maskCybersportLabel(game.team2),
    eventName: maskCybersportLabel(game.eventName),
  }));
}

export function useCybersportFeed(sport: string | undefined, mode: "live" | "line") {
  const searchParams = useSearchParams();
  const leagueFilter = searchParams.get("league");
  const tournamentFilter = searchParams.get("tournament");
  const broadcastOnly =
    searchParams.get("broadcast") === "1" || searchParams.get("broadcast") === "true";
  const tournamentId =
    tournamentFilter && Number.isFinite(Number(tournamentFilter)) && Number(tournamentFilter) > 0
      ? Number(tournamentFilter)
      : undefined;
  const isLive = mode === "live";
  const allLive = isLive && !sport;
  const enabled = allLive || Boolean(sport && isEsportsSport(sport));
  const liveLimit = allLive ? 48 : PAGE_SIZE;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: [
      "cybersport-main-feed",
      mode,
      sport || "all",
      leagueFilter,
      tournamentId ?? "all",
    ],
    queryFn: ({ pageParam = 0 }) =>
      isLive
        ? fetchCybersportLive(allLive ? undefined : sport!, liveLimit, tournamentId)
        : fetchCybersportLine(sport!, PAGE_SIZE, pageParam, tournamentId),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      if (isLive) return undefined;
      if (!lastPage.length) return undefined;
      return lastPageParam + PAGE_SIZE;
    },
    enabled,
    refetchInterval: isLive ? 15_000 : false,
    staleTime: 10_000,
  });

  const leagues: League[] = useMemo(() => {
    let flat = maskGames((data?.pages ?? []).flat());
    if (broadcastOnly) {
      flat = flat.filter((game) => cyberGameHasVideo(game));
    }
    const filtered = leagueFilter
      ? flat.filter((game) => game.leagueName === leagueFilter)
      : flat;
    return transformApiGames(filtered);
  }, [broadcastOnly, data?.pages, leagueFilter]);

  return {
    enabled,
    leagues,
    isLoading,
    isFetchingNextPage,
    hasNextPage: isLive ? false : Boolean(hasNextPage),
    fetchNextPage,
    error,
  };
}
