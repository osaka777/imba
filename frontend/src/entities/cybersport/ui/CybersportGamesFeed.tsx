"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroller";
import { useMemo } from "react";

import {
  fetchCybersportLine,
  fetchCybersportLive,
} from "~/entities/cybersport/api/client";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { transformApiGames } from "~/entities/game/lib/transformApiGames";
import { TournamentTable } from "~/entities/game/ui/TournamentTable";
import { LoadingSpinner } from "~/shared/ui";

import styles from "./CybersportGamesFeed.module.css";

type CybersportGamesFeedProps = {
  variant: "live" | "prematch";
  sport: string;
};

const PAGE_SIZE = 20;

export function CybersportGamesFeed({ variant, sport }: CybersportGamesFeedProps) {
  const isLive = variant === "live";

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ["cybersport-feed", variant, sport],
    queryFn: ({ pageParam = 0 }) =>
      isLive
        ? fetchCybersportLive(sport, PAGE_SIZE)
        : fetchCybersportLine(sport, PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      if (isLive) return undefined;
      if (!lastPage.length) return undefined;
      return lastPageParam + PAGE_SIZE;
    },
    refetchInterval: isLive ? 15_000 : false,
    staleTime: 10_000,
  });

  const leagues = useMemo(() => {
    const flat = (data?.pages ?? []).flat().map((game) => ({
      ...game,
      leagueName: maskCybersportLabel(game.leagueName),
      team1: maskCybersportLabel(game.team1),
      team2: maskCybersportLabel(game.team2),
      eventName: maskCybersportLabel(game.eventName),
    }));
    return transformApiGames(flat);
  }, [data]);

  if (isLoading) {
    return (
      <div className={styles.state}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return <p className={styles.error}>Не удалось загрузить матчи</p>;
  }

  if (leagues.length === 0) {
    return <p className={styles.empty}>Матчей пока нет</p>;
  }

  return (
    <InfiniteScroll
      className={styles.feed}
      hasMore={Boolean(hasNextPage)}
      loadMore={() => {
        if (!isFetchingNextPage) void fetchNextPage();
      }}
      loader={<LoadingSpinner className={styles.loader} key="loader" />}
      pageStart={0}
    >
      {leagues.map((league) => (
        <TournamentTable
          gameLinkPrefix="/cybersport/game/"
          games={league.games}
          isLive={isLive}
          key={league.leagueName}
          league={league.leagueName}
          sport={sport}
        />
      ))}
    </InfiniteScroll>
  );
}
