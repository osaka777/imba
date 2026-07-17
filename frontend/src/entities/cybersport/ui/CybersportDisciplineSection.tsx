"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchCybersportCounts } from "~/entities/cybersport/api/client";
import {
  type CyberDisciplineSlug,
  CYBER_DISCIPLINES,
  cyberDisciplineLineHref,
  cyberDisciplineLiveHref,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CybersportFeaturedLive } from "~/entities/cybersport/ui/CybersportFeaturedLive";
import { CybersportGamesPanel } from "~/entities/cybersport/ui/CybersportGamesPanel";
import { CybersportTopTournaments } from "~/entities/cybersport/ui/CybersportTopTournaments";
import { cn } from "~/shared/lib";

import styles from "./CybersportSection.module.css";
import cardStyles from "./CybersportDisciplineCards.module.css";

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

type CybersportDisciplineSectionProps = {
  discipline: CyberDisciplineSlug;
};

function CybersportPanel({
  variant,
  href,
  sport,
  sportLabel,
  className,
  isMobile,
  onMobilePanelToggle,
}: {
  variant: "live" | "prematch";
  href: string;
  sport: string;
  sportLabel: string;
  className?: string;
  isMobile: boolean;
  onMobilePanelToggle?: () => void;
}) {
  const isLive = variant === "live";

  const tabPrimaryContent = isLive ? (
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
        <div className={styles.topRow}>
          <div className={cn(styles.tabGroup, isMobile && styles.tabGroup_mobile)}>
            {isMobile && onMobilePanelToggle ? (
              <button
                aria-label={isLive ? "Переключить на Линию" : "Переключить на Live"}
                className={cn(styles.tabPrimary, !isLive && styles.tabPrimary_prematch)}
                onClick={onMobilePanelToggle}
                type="button"
              >
                {tabPrimaryContent}
              </button>
            ) : (
              <div className={cn(styles.tabPrimary, !isLive && styles.tabPrimary_prematch)}>
                {tabPrimaryContent}
              </div>
            )}

            <Link className={styles.tabSecondary} href={href}>
              Все
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

export function CybersportDisciplineSection({ discipline }: CybersportDisciplineSectionProps) {
  const config = CYBER_DISCIPLINES[discipline];
  const isMobile = useMobileLayout();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("live");
  const [matchCount, setMatchCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCybersportCounts()
      .then((counts) => {
        if (!cancelled) setMatchCount(counts[config.apiSport] ?? 0);
      })
      .catch(() => {
        if (!cancelled) setMatchCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [config.apiSport]);

  const handleMobilePanelToggle = useCallback(() => {
    setMobilePanel((panel) => (panel === "live" ? "prematch" : "live"));
  }, []);

  const { Icon } = config;

  return (
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>
            <Link className={cardStyles.breadcrumbLink} href="/cybersport">
              Киберспорт
            </Link>
            {" · "}
            <Icon className={cardStyles.heroIcon} />
            {config.label}
          </p>
          <h1 className={styles.heroTitle}>Ставки на {config.label}</h1>
          <p className={styles.heroSubtitle}>{config.description}</p>
          {matchCount != null && matchCount > 0 ? (
            <p className={cardStyles.countBadge}>{matchCount} матчей в линии и live</p>
          ) : null}
        </div>
      </header>

      <CybersportFeaturedLive limit={4} sport={config.apiSport} title={`Live · ${config.label}`} />

      <CybersportTopTournaments apiSport={config.apiSport} discipline={discipline} />

      <div className={cn(styles.grid, isMobile && styles.grid_mobile)}>
        <CybersportPanel
          className={
            isMobile
              ? mobilePanel === "live"
                ? styles.panel_mobileVisible
                : styles.panel_mobileHidden
              : undefined
          }
          href={cyberDisciplineLiveHref(discipline)}
          isMobile={isMobile}
          onMobilePanelToggle={isMobile ? handleMobilePanelToggle : undefined}
          sport={config.apiSport}
          sportLabel={config.label}
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
          href={cyberDisciplineLineHref(discipline)}
          isMobile={isMobile}
          onMobilePanelToggle={isMobile ? handleMobilePanelToggle : undefined}
          sport={config.apiSport}
          sportLabel={config.label}
          variant="prematch"
        />
      </div>
    </div>
  );
}
