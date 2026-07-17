"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import {
  fetchCybersportLine,
  fetchCybersportLive,
} from "~/entities/cybersport/api/client";
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
  const tournamentId =
    tournamentFilter && Number.isFinite(Number(tournamentFilter)) && Number(tournamentFilter) > 0
      ? Number(tournamentFilter)
      : undefined;
  const isLive = mode === "live";
  const enabled = Boolean(sport && isEsportsSport(sport));

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ["cybersport-main-feed", mode, sport, leagueFilter, tournamentId ?? "all"],
    queryFn: ({ pageParam = 0 }) =>
      isLive
        ? fetchCybersportLive(sport!, PAGE_SIZE, tournamentId)
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
    const flat = maskGames((data?.pages ?? []).flat());
    const filtered = leagueFilter
      ? flat.filter((game) => game.leagueName === leagueFilter)
      : flat;
    return transformApiGames(filtered);
  }, [data?.pages, leagueFilter]);

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
