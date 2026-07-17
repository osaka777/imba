"use client";

import { CyberTournamentHead } from "~/entities/cybersport/ui/CyberTournamentHead";
import { CyberMatchRow } from "~/entities/cybersport/ui/CyberMatchRow";
import { gamesList } from "~/entities/game";
import { components } from "~/shared/api";
import { Game } from "~/entities/game/types";
import { cn } from "~/shared/lib";

import { Head } from "./Head";
import { MatchRow } from "./MatchRow";
import styles from "./TournamentTable.module.css";

type TournamentTableProps = {
  className?: string;
  games: (components["schemas"]["GameDtoWithGroupedMarkets"] | Game)[];
  isLive: boolean;
  league: string;
  sport: string;
  gameLinkPrefix?: string;
  /** Cyber card layout for /cybersport; default keeps classic MatchRow for line/live sports. */
  variant?: "default" | "cyber";
};

export const TournamentTable: React.FC<TournamentTableProps> = ({
  className,
  games,
  isLive,
  league,
  sport,
  gameLinkPrefix = "/game/",
  variant = "default",
}) => {
  const Icon = gamesList[sport]?.Icon;
  const isCyber = variant === "cyber";
  const Row = isCyber ? CyberMatchRow : MatchRow;

  return (
    <div className={cn(styles.Tournament, isCyber && styles.Tournament_cyber, className)}>
      {isCyber ? (
        <CyberTournamentHead
          Icon={Icon}
          isLive={isLive}
          matchCount={games.length}
          name={league}
          sport={sport}
        />
      ) : (
        <Head Icon={Icon} name={league} sport={sport} />
      )}
      <div className={cn(styles.body, isCyber && styles.body_cyber)}>
        {games.map((gameData) => (
          <Row
            gameLinkPrefix={gameLinkPrefix}
            isLive={isLive}
            key={gameData.eventId}
            matchData={gameData}
          />
        ))}
      </div>
    </div>
  );
};
