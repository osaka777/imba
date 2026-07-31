"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";

import {
  fetchCybersportLine,
  fetchCybersportLive,
  type CyberGame,
} from "~/entities/cybersport/api/client";
import {
  cyberGameHasVideo,
} from "~/entities/cybersport/lib/cyberGameHasVideo";
import {
  cyberGameHomeHref,
  cyberGameToHomeWcEvent,
} from "~/entities/cybersport/lib/cyberGameToWcEvent";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { WcHomeMatchRow } from "~/entities/wc-odds/ui/WcHomeMatchRow";
import { WcHomeSkeleton } from "~/entities/wc-odds/ui/WcHomeSkeleton";
import {
  getHomeTableColumnsForSport,
  isHomeSportTwoWay,
} from "~/entities/wc-odds/ui/homeSectionUtils";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

import homeStyles from "~/entities/wc-odds/ui/WcHomeSection.module.css";
import styles from "./CybersportGamesPanel.module.css";

type CybersportGamesPanelProps = {
  variant: "live" | "prematch";
  sport: string;
  href: string;
  sportLabel: string;
  tournamentId?: number;
  isMobile?: boolean;
  broadcastOnly?: boolean;
};

function maskGame(game: CyberGame): CyberGame {
  return {
    ...game,
    leagueName: maskCybersportLabel(game.leagueName),
    team1: maskCybersportLabel(game.team1),
    team2: maskCybersportLabel(game.team2),
    eventName: maskCybersportLabel(game.eventName),
  };
}

function HomeTableHead({ sport, isMobile }: { sport: string; isMobile: boolean }) {
  const isTwoWay = isHomeSportTwoWay(sport);
  const gridColumns = getHomeTableColumnsForSport(sport);
  const { t } = useLocale();

  if (isMobile) {
    return (
      <div
        className={cn(
          homeStyles.tableHeadMobile,
          isTwoWay && homeStyles.tableHeadMobile_twoWay,
        )}
      >
        <span className={homeStyles.colTime}>{t("home.colTime")}</span>
        <span className={homeStyles.colTeams}>{t("home.colTeams")}</span>
        <span className={homeStyles.colOdd}>1</span>
        {!isTwoWay && <span className={homeStyles.colOdd}>X</span>}
        <span className={homeStyles.colOdd}>2</span>
      </div>
    );
  }

  return (
    <div className={homeStyles.tableHead} style={{ gridTemplateColumns: gridColumns }}>
      <span className={homeStyles.colTime}>{t("home.colTime")}</span>
      <span className={homeStyles.colTeams}>{t("home.colTeams")}</span>
      <span className={homeStyles.colOdd}>1</span>
      {!isTwoWay && <span className={homeStyles.colOdd}>X</span>}
      <span className={homeStyles.colOdd}>2</span>
    </div>
  );
}

export function CybersportGamesPanel({
  variant,
  sport,
  href,
  sportLabel,
  tournamentId,
  isMobile = false,
  broadcastOnly = false,
}: CybersportGamesPanelProps) {
  const { t } = useLocale();
  const isLive = variant === "live";
  const gridColumns = getHomeTableColumnsForSport(sport);
  const isTwoWay = isHomeSportTwoWay(sport);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["cybersport", "home", variant, sport, tournamentId ?? "all"],
    queryFn: () =>
      isLive
        ? fetchCybersportLive(sport, 12, tournamentId)
        : fetchCybersportLine(sport, 12, 0, tournamentId),
    refetchOnMount: true,
    staleTime: 10_000,
    refetchInterval: isLive ? 15_000 : false,
  });

  const rows = useMemo(() => {
    const games = maskGames(data).filter(
      (game) => !broadcastOnly || cyberGameHasVideo(game),
    );
    return games.map((game) => ({
      event: cyberGameToHomeWcEvent(game),
      href: cyberGameHomeHref(game),
      key: game.eventId,
    }));
  }, [broadcastOnly, data]);

  if (isLoading && rows.length === 0) {
    return (
      <>
        <HomeTableHead isMobile={isMobile} sport={sport} />
        <div className={homeStyles.tableBody}>
          <WcHomeSkeleton isTwoWay={isTwoWay} rows={5} sport={sport} />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>{t("cyber.loadFailed")}</p>
        <p className={styles.emptyHint}>{t("cyber.tryRefresh")}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>
          {broadcastOnly
            ? isLive
              ? t("cyber.noLiveBroadcastSport", { sport: sportLabel.toLowerCase() })
              : t("cyber.noBroadcastSport", { sport: sportLabel.toLowerCase() })
            : isLive
              ? t("cyber.noLiveSport", { sport: sportLabel.toLowerCase() })
              : t("cyber.noLineSport", { sport: sportLabel.toLowerCase() })}
        </p>
        <p className={styles.emptyHint}>
          {broadcastOnly
            ? t("cyber.clearBroadcastFilter")
            : t("cyber.tryOtherDiscipline")}
        </p>
        <Link className={styles.emptyCta} href={href}>
          {isLive ? t("cyber.watchAllLive") : t("cyber.goToLine")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <HomeTableHead isMobile={isMobile} sport={sport} />
      <div className={homeStyles.tableBody}>
        {rows.map((row, index) => (
          <WcHomeMatchRow
            event={row.event}
            gridColumns={gridColumns}
            hrefOverride={row.href}
            key={row.key}
            rowIndex={index}
            variant={variant}
          />
        ))}
      </div>
    </>
  );
}

function maskGames(games: CyberGame[]): CyberGame[] {
  return games.map(maskGame);
}
