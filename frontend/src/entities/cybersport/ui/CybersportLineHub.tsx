"use client";

import Link from "next/link";

import { resolveCyberSportLabel } from "~/entities/cybersport/lib/cyberSportsList";
import type { CyberDisciplineSlug } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { useCyberSportPreference } from "~/entities/cybersport/hooks/useCyberSportPreference";
import { CybersportGamesFeed } from "~/entities/cybersport/ui/CybersportGamesFeed";
import { CybersportMatchSkeleton } from "~/entities/cybersport/ui/CybersportMatchSkeleton";
import { CybersportMenu } from "~/entities/cybersport/ui/CybersportMenu";

import hubStyles from "./CybersportLiveHub.module.css";
import styles from "./CybersportSection.module.css";

type CybersportLineHubProps = {
  initialSport?: string;
  disciplineSlug?: CyberDisciplineSlug;
};

export function CybersportLineHub({ initialSport, disciplineSlug }: CybersportLineHubProps) {
  const { sport, hydrated } = useCyberSportPreference(initialSport);
  const sportLabel = resolveCyberSportLabel(sport);
  const backHref = disciplineSlug ? `/cybersport/${disciplineSlug}` : "/cybersport";
  const liveHref = disciplineSlug ? `/cybersport/${disciplineSlug}/live` : "/cybersport/live";

  return (
    <div className={styles.wrap}>
      <header className={`${hubStyles.hero} ${hubStyles.hero_line}`}>
        <div aria-hidden className={hubStyles.glow} />
        <div className={hubStyles.content}>
          <p className={hubStyles.eyebrow}>
            <span className={hubStyles.linePill}>LINE</span>
            Prematch Hub
          </p>
          <h1 className={hubStyles.title}>Линия</h1>
          <p className={hubStyles.subtitle}>
            Prematch-матчи киберспорта — коэффициенты и ставки до начала игры.
          </p>
          <Link className={hubStyles.backLink} href={backHref}>
            ← {disciplineSlug ? sportLabel : "Киберспорт"}
          </Link>
        </div>
      </header>

      <div className={hubStyles.toolbar}>
        <CybersportMenu discipline={disciplineSlug} mode="line" sport={sport} />
      </div>

      <div className={hubStyles.feedCard}>
        <div className={hubStyles.feedHead}>
          <span className={hubStyles.linePill}>LINE</span>
          <h2 className={hubStyles.feedTitle}>{sportLabel}</h2>
        </div>
        <div className={hubStyles.feedBody}>
          {hydrated ? (
            <CybersportGamesFeed
              alternateHref={liveHref}
              sport={sport}
              sportLabel={sportLabel}
              variant="prematch"
            />
          ) : (
            <CybersportMatchSkeleton rows={4} />
          )}
        </div>
      </div>
    </div>
  );
}
