"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";

import {
  fetchCybersportLine,
  fetchCybersportLive,
} from "~/entities/cybersport/api/client";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { transformApiGames } from "~/entities/game/lib/transformApiGames";
import { TournamentTable } from "~/entities/game/ui/TournamentTable";
import { LoadingSpinner } from "~/shared/ui";

import styles from "./CybersportGamesPanel.module.css";

type CybersportGamesPanelProps = {
  variant: "live" | "prematch";
  sport: string;
  href: string;
  sportLabel: string;
};

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

export function CybersportGamesPanel({
  variant,
  sport,
  href,
  sportLabel,
}: CybersportGamesPanelProps) {
  const isLive = variant === "live";

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["cybersport", variant, sport],
    queryFn: () => (isLive ? fetchCybersportLive(sport, 12) : fetchCybersportLine(sport, 12)),
    refetchOnMount: true,
    staleTime: 10_000,
    refetchInterval: isLive ? 15_000 : false,
  });

  const leagues = useMemo(
    () => transformApiGames(maskGames(data)),
    [data],
  );

  if (isLoading) {
    return (
      <div className={styles.state}>
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
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
            ? `Сейчас нет live по ${sportLabel.toLowerCase()}`
            : `Нет матчей в линии по ${sportLabel.toLowerCase()}`}
        </p>
        <p className={styles.emptyHint}>Попробуйте другую дисциплину или откройте полный список</p>
        <Link className={styles.emptyCta} href={href}>
          {isLive ? "Смотреть все live" : "Перейти в линию"}
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.leagues}>
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
    </div>
  );
}
