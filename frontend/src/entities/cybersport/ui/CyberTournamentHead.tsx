"use client";

import {
  CYBER_SPORT_LABELS,
  cyberIconUrlForApiSport,
  isEsportsApiSport,
} from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import { CyberSportGlyph } from "~/entities/cybersport/ui/CyberSportGlyph";
import { useLocale } from "~/shared/model/useLocale";

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
  const { t } = useLocale();
  const sportLabel = CYBER_SPORT_LABELS[sport] ?? (isEsportsApiSport(sport) ? "Esports" : null);
  const useCatalogGlyph = Boolean(cyberIconUrlForApiSport(sport));

  return (
    <div className={styles.head} data-sport={sport}>
      <div className={styles.left}>
        {useCatalogGlyph ? (
          <CyberSportGlyph apiSport={sport} className={styles.icon} label={sportLabel ?? ""} />
        ) : Icon ? (
          <Icon className={styles.icon} />
        ) : null}
        <div className={styles.text}>
          <p className={styles.league}>{name}</p>
          {sportLabel ? <p className={styles.sportTag}>{sportLabel}</p> : null}
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
          {matchCount === 1
            ? t("cyber.matchWord1")
            : matchCount < 5
              ? t("cyber.matchWord2")
              : t("cyber.matchWord5")}
        </span>
      </div>
    </div>
  );
}
