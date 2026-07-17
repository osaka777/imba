"use client";

import { useMemo } from "react";

import { useCybersportCounts } from "~/entities/cybersport/hooks/useCybersportCounts";
import { countActiveCyberDisciplines } from "~/entities/cybersport/lib/cyberDisciplineSort";

import styles from "./CybersportHubHero.module.css";

export function CybersportHubHero() {
  const { data: counts = {} } = useCybersportCounts();

  const totalMatches = useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0),
    [counts],
  );
  const activeDisciplines = useMemo(
    () => countActiveCyberDisciplines(counts),
    [counts],
  );

  return (
    <header className={styles.hero}>
      <div aria-hidden="true" className={styles.glow} />
      <div className={styles.content}>
        <p className={styles.eyebrow}>Esports Hub</p>
        <h1 className={styles.title}>Киберспорт</h1>
        <p className={styles.subtitle}>
          Live-трансляции, линия и ставки — CS2, Dota 2, Valorant и 40+ дисциплин.
        </p>
        <div className={styles.stats}>
          {totalMatches > 0 ? (
            <span className={styles.stat}>
              <strong>{totalMatches}</strong>
              {" "}
              матчей в линии
            </span>
          ) : null}
          {activeDisciplines > 0 ? (
            <span className={styles.stat}>
              <strong>{activeDisciplines}</strong>
              {" "}
              дисциплин активны
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
