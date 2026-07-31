"use client";

import { useMemo } from "react";

import { useCybersportCounts } from "~/entities/cybersport/hooks/useCybersportCounts";
import { countActiveCyberDisciplines } from "~/entities/cybersport/lib/cyberDisciplineSort";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./CybersportHubHero.module.css";

export function CybersportHubHero() {
  const { t } = useLocale();
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
        <h1 className={styles.title}>{t("cyber.hubTitle")}</h1>
        <p className={styles.subtitle}>{t("cyber.hubLead")}</p>
        <div className={styles.stats}>
          {totalMatches > 0 ? (
            <span className={styles.stat}>
              <strong>{totalMatches}</strong>
              {" "}
              {t("cyber.hubMatchesInLine")}
            </span>
          ) : null}
          {activeDisciplines > 0 ? (
            <span className={styles.stat}>
              <strong>{activeDisciplines}</strong>
              {" "}
              {t("cyber.hubDisciplinesActive")}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
