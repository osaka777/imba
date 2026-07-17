"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_CYBER_SPORT,
  resolveCyberSportLabel,
} from "~/entities/cybersport/lib/cyberSportsList";
import { useCyberSportPreference } from "~/entities/cybersport/hooks/useCyberSportPreference";
import {
  liveHrefForApiSport,
  lineHrefForApiSport,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CybersportDisciplineCards } from "~/entities/cybersport/ui/CybersportDisciplineCards";
import { CybersportFeaturedLive } from "~/entities/cybersport/ui/CybersportFeaturedLive";
import { CybersportGamesPanel } from "~/entities/cybersport/ui/CybersportGamesPanel";
import { CybersportHubHero } from "~/entities/cybersport/ui/CybersportHubHero";
import { CybersportSportFilter } from "~/entities/cybersport/ui/CybersportSportFilter";
import { cn } from "~/shared/lib";

import styles from "./CybersportSection.module.css";

import { MQ_PHONE } from "~/shared/lib/layoutBreakpoints";

function useMobileLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MQ_PHONE);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

type MobilePanel = "live" | "prematch";

type CybersportPanelProps = {
  variant: "live" | "prematch";
  href: string;
  sport: string;
  className?: string;
  isMobile: boolean;
};

function CybersportPanel({
  variant,
  href,
  sport,
  className,
  isMobile,
}: CybersportPanelProps) {
  const isLive = variant === "live";
  const sportLabel = resolveCyberSportLabel(sport);

  const tabLabel = isLive ? (
    <>
      <span className={styles.liveDot} />
      Live
    </>
  ) : (
    <>Линия</>
  );

  return (
    <section className={cn(styles.panel, className)}>
      <div className={cn(styles.panelStack, isMobile && styles.panelStack_mobile)}>
        <div className={styles.panelHeader}>
          <div className={styles.tabRail}>
            <div
              className={cn(styles.tabPrimary, !isLive && styles.tabPrimary_prematch)}
            >
              {tabLabel}
            </div>
            <Link className={styles.tabSecondary} href={href}>
              Все →
            </Link>
          </div>
        </div>

        <div className={cn(styles.card, isMobile && styles.card_mobile)}>
          <div className={styles.tableBody}>
            <CybersportGamesPanel
              href={href}
              sport={sport}
              sportLabel={sportLabel}
              variant={variant}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function CybersportSection() {
  const isMobile = useMobileLayout();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("live");
  const { sport: preferredSport, setSport: persistSport } = useCyberSportPreference();
  const [sport, setSport] = useState(DEFAULT_CYBER_SPORT);

  useEffect(() => {
    setSport(preferredSport);
  }, [preferredSport]);

  const handleSportChange = useCallback(
    (nextSport: string) => {
      setSport(nextSport);
      persistSport(nextSport);
    },
    [persistSport],
  );

  return (
    <div className={styles.wrap}>
      <CybersportHubHero />
      <CybersportFeaturedLive />
      <CybersportDisciplineCards />

      <div className={styles.feedToolbar}>
        {isMobile ? (
          <div className={styles.mobileFeedTabs} role="tablist">
            <button
              aria-selected={mobilePanel === "live"}
              className={cn(
                styles.mobileFeedTab,
                mobilePanel === "live" && styles.mobileFeedTab_active,
              )}
              onClick={() => setMobilePanel("live")}
              role="tab"
              type="button"
            >
              <span className={styles.liveDot} />
              Live
            </button>
            <button
              aria-selected={mobilePanel === "prematch"}
              className={cn(
                styles.mobileFeedTab,
                mobilePanel === "prematch" && styles.mobileFeedTab_active,
              )}
              onClick={() => setMobilePanel("prematch")}
              role="tab"
              type="button"
            >
              Линия
            </button>
          </div>
        ) : null}
        <div className={styles.sharedSportFilter}>
          <CybersportSportFilter onChange={handleSportChange} sport={sport} />
        </div>
      </div>

      <div className={cn(styles.grid, isMobile && styles.grid_mobile)}>
        <CybersportPanel
          className={
            isMobile
              ? mobilePanel === "live"
                ? styles.panel_mobileVisible
                : styles.panel_mobileHidden
              : undefined
          }
          href={liveHrefForApiSport(sport)}
          isMobile={isMobile}
          sport={sport}
          variant="live"
        />
        <CybersportPanel
          className={
            isMobile
              ? mobilePanel === "prematch"
                ? styles.panel_mobileVisible
                : styles.panel_mobileHidden
              : undefined
          }
          href={lineHrefForApiSport(sport)}
          isMobile={isMobile}
          sport={sport}
          variant="prematch"
        />
      </div>
    </div>
  );
}
