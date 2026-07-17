"use client";

import { isEsportsApiSport } from "~/entities/cybersport/lib/cyberDisciplineCatalog";

import styles from "./CyberTournamentHead.module.css";

type CyberTournamentHeadProps = {
  Icon?: React.FC<{ className?: string }>;
  name: string;
  sport: string;
  matchCount: number;
  isLive?: boolean;
};

export function CyberTournamentHead({
  Icon,
  name,
  sport,
  matchCount,
  isLive = false,
}: CyberTournamentHeadProps) {
  return (
    <div className={styles.head} data-sport={sport}>
      <div className={styles.left}>
        {Icon ? <Icon className={styles.icon} /> : null}
        <div className={styles.text}>
          <p className={styles.league}>{name}</p>
          {isEsportsApiSport(sport) ? (
            <p className={styles.sportTag}>Esports</p>
          ) : null}
        </div>
      </div>
      <div className={styles.right}>
        {isLive ? (
          <span className={styles.liveTag}>
            <span aria-hidden="true" className={styles.liveDot} />
            LIVE
          </span>
        ) : null}
        <span className={styles.countTag}>
          {matchCount}
          {" "}
          {matchCount === 1 ? "матч" : matchCount < 5 ? "матча" : "матчей"}
        </span>
      </div>
    </div>
  );
}
