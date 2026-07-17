"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import React, { useMemo } from "react";

import { useSportFilter } from "~/entities/game/lib/useSportFilter";
import {
  lineAllHref,
  lineLeagueHref,
  liveAllHref,
  liveLeagueHref,
  lineSportHref,
  liveSportHref,
} from "~/entities/game/lib/sportPagePaths";
import { visibleGamesList } from "~/entities/game";
import {
  fetchWcLineTournaments,
  fetchWcLiveTournaments,
  type WcTournament,
} from "~/entities/wc-odds/api/client";
import { ArrowIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";
import { Button } from "~/shared/ui";

import styles from "~/entities/game/ui/SubcategoryMenu/SubcategoryMenu.module.css";

function tournamentKey(tournament: WcTournament): string {
  return tournament.tournamentId != null
    ? `t:${tournament.tournamentId}`
    : `l:${tournament.leagueName}`;
}

function buildLeagueHref(
  type: "live" | "prematch",
  sport: string,
  tournament?: WcTournament | null,
): string {
  if (type === "live") return liveLeagueHref(sport, tournament);
  return lineLeagueHref(sport, tournament);
}

function buildSportAllHref(type: "live" | "prematch", sport: string): string {
  return type === "live" ? liveSportHref(sport) : lineSportHref(sport);
}

function isTournamentActive(
  tournament: WcTournament,
  activeTournament: string | null,
  activeLeague: string | null,
): boolean {
  if (tournament.tournamentId != null) {
    return activeTournament === String(tournament.tournamentId);
  }
  return activeLeague === tournament.leagueName;
}

type WcLeagueMenuProps = {
  type: "live" | "prematch";
  layout?: "horizontal" | "sidebar";
};

export const WcLeagueMenu = React.memo(function WcLeagueMenu({
  type,
  layout = "horizontal",
}: WcLeagueMenuProps) {
  const sport = useSportFilter();
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const activeTournament = searchParams.get("tournament");
  const activeLeague = searchParams.get("league");

  const backPath = type === "live" ? liveAllHref() : lineAllHref();

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ["wcTournaments", type, sport, locale],
    queryFn: () =>
      type === "live"
        ? fetchWcLiveTournaments(sport)
        : fetchWcLineTournaments(sport),
    enabled: !!sport,
    staleTime: 10000,
    gcTime: 1000 * 60 * 5,
  });

  const sportDef = useMemo(
    () => visibleGamesList().find((item) => item.name === sport),
    [sport],
  );

  const SportIcon = sportDef?.Icon;

  const totalCount = useMemo(
    () => tournaments.reduce((sum, item) => sum + item.count, 0),
    [tournaments],
  );

  const isAllActive = !activeTournament && !activeLeague;

  if (!sport) return null;

  if (isLoading) {
    return (
      <div className={cn(styles.menu, layout === "sidebar" && styles.menu_sidebar)}>
        <div className={styles.wrapper}>
          <div className={styles.loading}>{t("common.loadingLeagues")}</div>
        </div>
      </div>
    );
  }

  const isSidebar = layout === "sidebar";

  return (
    <div className={cn(styles.menu, isSidebar && styles.menu_sidebar)}>
      <div className={styles.wrapper}>
        {/* Back button + current sport header — hidden in sidebar via CSS */}
        <Button className={styles.backButton} elementType="link" href={backPath}>
          <ArrowIcon className={styles.backIcon} />
          <span>{t("common.back")}</span>
        </Button>

        {SportIcon ? (
          <div className={styles.currentSport}>
            <SportIcon className={styles.sportIcon} />
            <span className={styles.sportName}>{sportDef?.label}</span>
          </div>
        ) : null}

        {/* Section label "Турниры" — only shown in sidebar */}
        {isSidebar && <span className={styles.sectionLabel}>{t("common.tournaments")}</span>}

        <Button
          className={cn(styles.item, isAllActive && styles.item_active)}
          elementType="link"
          href={buildSportAllHref(type, sport)}
          scroll={isSidebar ? false : undefined}
        >
          <p className={styles.text}>
            Все
            {totalCount > 0 ? <span className={styles.count}>{totalCount}</span> : null}
          </p>
        </Button>

        {tournaments.map((tournament) => (
          <Button
            key={tournamentKey(tournament)}
            className={cn(
              styles.item,
              isTournamentActive(tournament, activeTournament, activeLeague) && styles.item_active,
            )}
            elementType="link"
            href={buildLeagueHref(type, sport, tournament)}
            scroll={isSidebar ? false : undefined}
            title={tournament.leagueName}
          >
            <p className={styles.text}>
              {tournament.leagueName}
              <span className={styles.count}>{tournament.count}</span>
            </p>
          </Button>
        ))}
      </div>
    </div>
  );
});
