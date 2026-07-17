"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroller";
import Link from "next/link";
import { useMemo } from "react";

import {
  fetchCybersportLine,
  fetchCybersportLive,
} from "~/entities/cybersport/api/client";
import { resolveCyberSportLabel } from "~/entities/cybersport/lib/cyberSportsList";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { transformApiGames } from "~/entities/game/lib/transformApiGames";
import { CybersportMatchSkeleton } from "~/entities/cybersport/ui/CybersportMatchSkeleton";
import { TournamentTable } from "~/entities/game/ui/TournamentTable";

import styles from "./CybersportGamesFeed.module.css";

type CybersportGamesFeedProps = {
  variant: "live" | "prematch";
  sport: string;
  sportLabel?: string;
  alternateHref?: string;
};

const PAGE_SIZE = 20;

export function CybersportGamesFeed({
  variant,
  sport,
  sportLabel,
  alternateHref,
}: CybersportGamesFeedProps) {
  const isLive = variant === "live";
  const label = sportLabel ?? resolveCyberSportLabel(sport);
  const ctaHref = alternateHref ?? (isLive ? "/cybersport/line" : "/cybersport/live");
  const ctaLabel = isLive ? "Смотреть линию" : "Смотреть live";

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
    return <CybersportMatchSkeleton rows={4} />;
  }

  if (error) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>Не удалось загрузить матчи</p>
        <p className={styles.emptyHint}>Попробуйте обновить страницу</p>
      </div>
    );
  }

  if (leagues.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>
          {isLive
            ? `Сейчас нет live по ${label.toLowerCase()}`
            : `Нет матчей в линии по ${label.toLowerCase()}`}
        </p>
        <p className={styles.emptyHint}>Попробуйте другую дисциплину или откройте полный список</p>
        <Link className={styles.emptyCta} href={ctaHref}>
          {ctaLabel}
        </Link>
        <Link className={styles.emptyLink} href="/cybersport">
          Все дисциплины →
        </Link>
      </div>
    );
  }

  return (
    <InfiniteScroll
      className={styles.feed}
      hasMore={Boolean(hasNextPage)}
      loadMore={() => {
        if (!isFetchingNextPage) void fetchNextPage();
      }}
      loader={<CybersportMatchSkeleton key="loader" rows={2} />}
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
          variant="cyber"
        />
      ))}
    </InfiniteScroll>
  );
}
