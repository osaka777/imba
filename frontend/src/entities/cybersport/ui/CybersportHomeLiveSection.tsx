"use client";

import Link from "next/link";

import { useCybersportFeaturedLive } from "~/entities/cybersport/hooks/useCybersportFeaturedLive";
import { CybersportFeaturedLive } from "~/entities/cybersport/ui/CybersportFeaturedLive";

import styles from "./CybersportHomeLiveSection.module.css";

const HOME_LIVE_LIMIT = 3;

/** Homepage-only cyber live strip — does not touch main sports line/live. */
export function CybersportHomeLiveSection() {
  const { data: games = [], isLoading } = useCybersportFeaturedLive(HOME_LIVE_LIMIT);

  if (!isLoading && games.length === 0) {
    return null;
  }

  return (
    <section aria-label="Киберспорт live" className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <span className={styles.titleAccent}>Live</span>
          {" "}
          киберспорт
        </h2>
        <Link className={styles.hubLink} href="/cybersport/live">
          Все матчи →
        </Link>
      </div>
      <div className={styles.featured}>
        <CybersportFeaturedLive limit={HOME_LIVE_LIMIT} title="Сейчас в эфире" />
      </div>
    </section>
  );
}
