"use client";

import { gamesList } from "~/entities/game";
import { components } from "~/shared/api";
import { Game } from "~/entities/game/types";

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
};

export const TournamentTable: React.FC<TournamentTableProps> = ({
  className,
  games,
  isLive,
  league,
  sport,
  gameLinkPrefix = "/game/",
}) => {
  const Icon = gamesList[sport]?.Icon;

  return (
    <div className={`${styles.Tournament} ${className}`}>
      <Head Icon={Icon} name={league} sport={sport} />
      <div className={styles.body}>
        {games.map((gameData) => {
          return (
            <MatchRow
              gameLinkPrefix={gameLinkPrefix}
              isLive={isLive}
              key={gameData.eventId}
              matchData={gameData}
            />
          );
        })}
      </div>
    </div>
  );
};
