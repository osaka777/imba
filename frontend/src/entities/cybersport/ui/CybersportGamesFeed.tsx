"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroller";
import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import {
  fetchCybersportLine,
  fetchCybersportLive,
} from "~/entities/cybersport/api/client";
import { cyberGameHasVideo } from "~/entities/cybersport/lib/cyberGameHasVideo";
import { resolveCyberSportLabel } from "~/entities/cybersport/lib/cyberSportsList";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { transformApiGames } from "~/entities/game/lib/transformApiGames";
import { CybersportMatchSkeleton } from "~/entities/cybersport/ui/CybersportMatchSkeleton";
import { TournamentTable } from "~/entities/game/ui/TournamentTable";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./CybersportGamesFeed.module.css";

type CybersportGamesFeedProps = {
  variant: "live" | "prematch";
  /** Empty = all live disciplines. */
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
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const broadcastOnly =
    searchParams.get("broadcast") === "1" || searchParams.get("broadcast") === "true";
  const isLive = variant === "live";
  const sportKey = sport?.trim() || "";
  const label = sportLabel ?? (sportKey ? resolveCyberSportLabel(sportKey) : t("cyber.title"));
  const ctaHref = alternateHref ?? (isLive ? "/cybersport/line" : "/cybersport/live");
  const ctaLabel = isLive ? t("partner.watchLine") : t("cyber.watchLive");
  const liveLimit = sportKey ? PAGE_SIZE : 48;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ["cybersport-feed", variant, sportKey || "all"],
    queryFn: ({ pageParam = 0 }) =>
      isLive
        ? fetchCybersportLive(sportKey || undefined, liveLimit)
        : fetchCybersportLine(sportKey || "esports.cs", PAGE_SIZE, pageParam),
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
    const flat = (data?.pages ?? [])
      .flat()
      .filter((game) => !broadcastOnly || cyberGameHasVideo(game))
      .map((game) => ({
        ...game,
        leagueName: maskCybersportLabel(game.leagueName),
        team1: maskCybersportLabel(game.team1),
        team2: maskCybersportLabel(game.team2),
        eventName: maskCybersportLabel(game.eventName),
      }));
    return transformApiGames(flat);
  }, [broadcastOnly, data]);

  if (isLoading) {
    return <CybersportMatchSkeleton rows={4} />;
  }

  if (error) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>{t("cyber.loadFailed")}</p>
        <p className={styles.emptyHint}>{t("cyber.tryRefresh")}</p>
      </div>
    );
  }

  if (leagues.length === 0) {
    const emptyTitle = broadcastOnly
      ? t("cyber.noLiveBroadcastAny")
      : isLive
        ? sportKey
          ? t("cyber.noLiveSport", { sport: label.toLowerCase() })
          : t("cyber.noLiveAny")
        : t("cyber.noLineSport", { sport: label.toLowerCase() });

    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>{emptyTitle}</p>
        <p className={styles.emptyHint}>
          {broadcastOnly
            ? t("cyber.clearBroadcastFilter")
            : t("cyber.tryOtherDiscipline")}
        </p>
        {!isLive || sportKey ? (
          <Link className={styles.emptyCta} href={ctaHref}>
            {ctaLabel}
          </Link>
        ) : null}
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
          sport={sportKey || league.games[0]?.sport || "esports.cs"}
        />
      ))}
    </InfiniteScroll>
  );
}
