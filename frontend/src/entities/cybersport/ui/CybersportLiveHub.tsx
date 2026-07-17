"use client";

import Link from "next/link";

import { resolveCyberSportLabel } from "~/entities/cybersport/lib/cyberSportsList";
import type { CyberDisciplineSlug } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { useCyberSportPreference } from "~/entities/cybersport/hooks/useCyberSportPreference";
import { CybersportFeaturedLive } from "~/entities/cybersport/ui/CybersportFeaturedLive";
import { CybersportGamesFeed } from "~/entities/cybersport/ui/CybersportGamesFeed";
import { CybersportMatchSkeleton } from "~/entities/cybersport/ui/CybersportMatchSkeleton";
import { CybersportMenu } from "~/entities/cybersport/ui/CybersportMenu";
import { KickPartnersLive } from "~/entities/kick/ui/KickPartnersLive";

import hubStyles from "./CybersportLiveHub.module.css";
import styles from "./CybersportSection.module.css";

type CybersportLiveHubProps = {
  initialSport?: string;
  disciplineSlug?: CyberDisciplineSlug;
};

export function CybersportLiveHub({ initialSport, disciplineSlug }: CybersportLiveHubProps) {
  const { sport, hydrated } = useCyberSportPreference(initialSport);
  const sportLabel = resolveCyberSportLabel(sport);
  const backHref = disciplineSlug ? `/cybersport/${disciplineSlug}` : "/cybersport";
  const lineHref = disciplineSlug ? `/cybersport/${disciplineSlug}/line` : "/cybersport/line";

  return (
    <div className={styles.wrap}>
      <header className={hubStyles.hero}>
        <div aria-hidden className={hubStyles.glow} />
        <div className={hubStyles.content}>
          <p className={hubStyles.eyebrow}>
            <span className={hubStyles.livePill}>LIVE</span>
            Streaming Hub
          </p>
          <h1 className={hubStyles.title}>Прямой эфир</h1>
          <p className={hubStyles.subtitle}>
            Все live-матчи киберспорта — смотри трансляцию и ставь в один клик.
          </p>
          <Link className={hubStyles.backLink} href={backHref}>
            ← {disciplineSlug ? sportLabel : "Киберспорт"}
          </Link>
        </div>
      </header>

      <CybersportFeaturedLive limit={8} sport={sport} title={`Live · ${sportLabel}`} />

      <KickPartnersLive />

      <div className={hubStyles.toolbar}>
        <CybersportMenu discipline={disciplineSlug} mode="live" sport={sport} />
      </div>

      <div className={hubStyles.feedCard}>
        <div className={hubStyles.feedHead}>
          <span className={hubStyles.feedPill}>LIVE</span>
          <h2 className={hubStyles.feedTitle}>{sportLabel}</h2>
        </div>
        <div className={hubStyles.feedBody}>
          {hydrated ? (
            <CybersportGamesFeed
              alternateHref={lineHref}
              sport={sport}
              sportLabel={sportLabel}
              variant="live"
            />
          ) : (
            <CybersportMatchSkeleton rows={4} />
          )}
        </div>
      </div>
    </div>
  );
}
