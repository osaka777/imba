"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  fetchCybersportTournaments,
  type CyberTournament,
} from "~/entities/cybersport/api/client";
import type { CyberDisciplineSlug } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { cyberTournamentPageHref } from "~/entities/cybersport/lib/cyberTournamentPaths";

import styles from "./CybersportDisciplineCards.module.css";

type CybersportTopTournamentsProps = {
  discipline: CyberDisciplineSlug;
  apiSport: string;
};

const TOP_LIMIT = 8;

export function CybersportTopTournaments({
  discipline,
  apiSport,
}: CybersportTopTournamentsProps) {
  const [tournaments, setTournaments] = useState<CyberTournament[]>([]);

  useEffect(() => {
    let cancelled = false;

    void fetchCybersportTournaments(apiSport)
      .then((rows) => {
        if (!cancelled) setTournaments(rows.slice(0, TOP_LIMIT));
      })
      .catch(() => {
        if (!cancelled) setTournaments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [apiSport]);

  if (!tournaments.length) return null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Топ турниры</h2>
        <span className={styles.sectionMeta}>{tournaments.length} активных</span>
      </div>

      <ul className={styles.tournamentList}>
        {tournaments.map((tournament) => {
          const total = tournament.liveCount + tournament.lineCount;
          return (
            <li key={tournament.id}>
              <Link
                className={styles.tournamentRow}
                href={cyberTournamentPageHref(discipline, tournament.slug)}
              >
                <span className={styles.tournamentName}>{tournament.name}</span>
                <span className={styles.tournamentCounts}>
                  {tournament.liveCount > 0 ? (
                    <span className={styles.tournamentLive}>{tournament.liveCount} live</span>
                  ) : null}
                  {total > 0 ? (
                    <span className={styles.tournamentTotal}>{total} матч.</span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
