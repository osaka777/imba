"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { CyberTournament } from "~/entities/cybersport/api/client";
import {
  type CyberDisciplineSlug,
  CYBER_DISCIPLINES,
  cyberDisciplineLineHref,
  cyberDisciplineLiveHref,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { cyberTournamentPageHref } from "~/entities/cybersport/lib/cyberTournamentPaths";
import { CybersportGamesPanel } from "~/entities/cybersport/ui/CybersportGamesPanel";
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

type Props = {
  discipline: CyberDisciplineSlug;
  tournament: CyberTournament;
};

function CybersportPanel({
  variant,
  href,
  sport,
  sportLabel,
  tournamentId,
  className,
  isMobile,
  onMobilePanelToggle,
}: {
  variant: "live" | "prematch";
  href: string;
  sport: string;
  sportLabel: string;
  tournamentId: number;
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
        </div>

        <div className={cn(styles.card, isMobile && styles.card_mobile)}>
          <div className={styles.tableBody}>
            <CybersportGamesPanel
              href={href}
              sport={sport}
              sportLabel={sportLabel}
              tournamentId={tournamentId}
              variant={variant}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function CybersportTournamentSection({ discipline, tournament }: Props) {
  const config = CYBER_DISCIPLINES[discipline];
  const isMobile = useMobileLayout();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("live");

  const handleMobilePanelToggle = useCallback(() => {
    setMobilePanel((panel) => (panel === "live" ? "prematch" : "live"));
  }, []);

  const liveHref = `${cyberDisciplineLiveHref(discipline)}?tournament=${tournament.id}`;
  const lineHref = `${cyberDisciplineLineHref(discipline)}?tournament=${tournament.id}`;
  const { Icon } = config;
  const matchCount = tournament.liveCount + tournament.lineCount;

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
            <Link className={cardStyles.breadcrumbLink} href={`/cybersport/${discipline}`}>
              <Icon className={cardStyles.heroIcon} />
              {config.label}
            </Link>
          </p>
          <h1 className={styles.heroTitle}>{tournament.name}</h1>
          <p className={styles.heroSubtitle}>
            Ставки на {config.label} · {tournament.name}
          </p>
          {matchCount > 0 ? (
            <p className={cardStyles.countBadge}>
              {matchCount} матчей · live {tournament.liveCount} · prematch {tournament.lineCount}
            </p>
          ) : null}
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
          href={liveHref}
          isMobile={isMobile}
          onMobilePanelToggle={isMobile ? handleMobilePanelToggle : undefined}
          sport={config.apiSport}
          sportLabel={config.label}
          tournamentId={tournament.id}
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
          href={lineHref}
          isMobile={isMobile}
          onMobilePanelToggle={isMobile ? handleMobilePanelToggle : undefined}
          sport={config.apiSport}
          sportLabel={config.label}
          tournamentId={tournament.id}
          variant="prematch"
        />
      </div>
    </div>
  );
}

export { cyberTournamentPageHref };
