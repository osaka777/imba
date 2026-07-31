"use client";

import Link from "next/link";

import { useCybersportFeaturedLive } from "~/entities/cybersport/hooks/useCybersportFeaturedLive";
import { CybersportFeaturedLive } from "~/entities/cybersport/ui/CybersportFeaturedLive";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./CybersportHomeLiveSection.module.css";

const HOME_LIVE_LIMIT = 8;

/** Homepage-only cyber live strip — does not touch main sports line/live. */
export function CybersportHomeLiveSection() {
  const { t } = useLocale();
  const { data: games = [], isLoading } = useCybersportFeaturedLive(HOME_LIVE_LIMIT);

  if (!isLoading && games.length === 0) {
    return null;
  }

  return (
    <section aria-label={t("cyber.liveAria")} className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <span className={styles.titleAccent}>Live</span>
          {" "}
          {t("cyber.titleLower")}
        </h2>
        <Link className={styles.hubLink} href="/cybersport/live">
          {t("cyber.allMatches")}
        </Link>
      </div>
      <div className={styles.featured}>
        <CybersportFeaturedLive limit={HOME_LIVE_LIMIT} title={t("cyber.nowLive")} />
      </div>
    </section>
  );
}
