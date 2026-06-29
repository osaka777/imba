"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_CYBER_SPORT,
  resolveCyberSportLabel,
} from "~/entities/cybersport/lib/cyberSportsList";
import { CybersportGamesPanel } from "~/entities/cybersport/ui/CybersportGamesPanel";
import { CybersportSportFilter } from "~/entities/cybersport/ui/CybersportSportFilter";
import { cn } from "~/shared/lib";

import styles from "./CybersportSection.module.css";

const MOBILE_HOME_MQ = "(max-width: 1024px)";

function useMobileLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_HOME_MQ);
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
  onSportChange: (sport: string) => void;
  className?: string;
  isMobile: boolean;
  onMobilePanelToggle?: () => void;
};

function resolveSportLabel(sport: string): string {
  return resolveCyberSportLabel(sport);
}

function CybersportPanel({
  variant,
  href,
  sport,
  onSportChange,
  className,
  isMobile,
  onMobilePanelToggle,
}: CybersportPanelProps) {
  const isLive = variant === "live";
  const sportLabel = resolveSportLabel(sport);

  const tabPrimaryContent = isLive ? (
    <>
      <span className={styles.liveDot} />
      Live
    </>
  ) : (
    <>Prematch</>
  );

  return (
    <section className={cn(styles.panel, className)}>
      <div className={cn(styles.panelStack, isMobile && styles.panelStack_mobile)}>
        <div className={styles.topRow}>
          <div className={cn(styles.tabGroup, isMobile && styles.tabGroup_mobile)}>
            {isMobile && onMobilePanelToggle ? (
              <button
                aria-label={isLive ? "Переключить на Prematch" : "Переключить на Live"}
                className={styles.tabPrimary}
                onClick={onMobilePanelToggle}
                type="button"
              >
                {tabPrimaryContent}
              </button>
            ) : (
              <div className={styles.tabPrimary}>{tabPrimaryContent}</div>
            )}

            <Link className={styles.tabSecondary} href={href}>
              Все
            </Link>
          </div>

          <div className={cn(styles.panelToolbar, isMobile && styles.panelToolbar_mobile)}>
            <CybersportSportFilter onChange={onSportChange} sport={sport} />
          </div>
        </div>

        <div className={cn(styles.card, isMobile && styles.card_mobile)}>
          <div className={cn(styles.cyberScope, styles.tableBody)}>
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
  const [liveSport, setLiveSport] = useState(DEFAULT_CYBER_SPORT);
  const [lineSport, setLineSport] = useState(DEFAULT_CYBER_SPORT);

  const handleLiveSportChange = useCallback((sport: string) => {
    setLiveSport(sport);
  }, []);

  const handleLineSportChange = useCallback((sport: string) => {
    setLineSport(sport);
  }, []);

  return (
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Imba.bet</p>
          <h1 className={styles.heroTitle}>Киберспорт</h1>
          <p className={styles.heroSubtitle}>
            CS2, Dota 2 и другие дисциплины — live и линия в одном месте
          </p>
        </div>
      </header>

      <div className={cn(styles.grid, isMobile && styles.grid_mobile)}>
        <CybersportPanel
          className={
            isMobile
              ? mobilePanel === "live"
                ? styles.panel_mobileVisible
                : styles.panel_mobileHidden
              : undefined
          }
          href={`/cybersport/live?sport=${encodeURIComponent(liveSport)}`}
          isMobile={isMobile}
          onMobilePanelToggle={
            isMobile
              ? () => setMobilePanel((panel) => (panel === "live" ? "prematch" : "live"))
              : undefined
          }
          onSportChange={handleLiveSportChange}
          sport={liveSport}
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
          href={`/cybersport/line/${lineSport}`}
          isMobile={isMobile}
          onMobilePanelToggle={
            isMobile
              ? () => setMobilePanel((panel) => (panel === "live" ? "prematch" : "live"))
              : undefined
          }
          onSportChange={handleLineSportChange}
          sport={lineSport}
          variant="prematch"
        />
      </div>
    </div>
  );
}
