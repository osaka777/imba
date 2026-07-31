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
import { useLocale } from "~/shared/model/useLocale";

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
  t,
}: {
  variant: "live" | "prematch";
  href: string;
  sport: string;
  sportLabel: string;
  tournamentId: number;
  className?: string;
  isMobile: boolean;
  onMobilePanelToggle?: () => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const isLive = variant === "live";

  const tabPrimaryContent = isLive ? (
    <>
      <span className={styles.liveDot} />
      Live
    </>
  ) : (
    <>{t("cyber.line")}</>
  );

  return (
    <section className={cn(styles.panel, className)}>
      <div className={cn(styles.panelStack, isMobile && styles.panelStack_mobile)}>
        <div className={styles.topRow}>
          <div className={cn(styles.tabGroup, isMobile && styles.tabGroup_mobile)}>
            {isMobile && onMobilePanelToggle ? (
              <button
                aria-label={isLive ? t("cyber.switchToLine") : t("cyber.switchToLive")}
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
              {t("cyber.all")}
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
  const { t } = useLocale();
  const config = CYBER_DISCIPLINES[discipline];
  const isMobile = useMobileLayout();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("live");

  const handleMobilePanelToggle = useCallback(() => {
    setMobilePanel((panel) => (panel === "live" ? "prematch" : "live"));
  }, []);

  const liveHref = `${cyberDisciplineLiveHref(discipline)}?tournament=${tournament.id}`;
  const lineHref = `${cyberDisciplineLineHref(discipline)}?tournament=${tournament.id}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.disciplineTitleRow}>
        <h1 className={styles.disciplineTitle}>{tournament.name}</h1>
        <Link className={styles.tabSecondary} href={`/cybersport/${discipline}`}>
          {config.label}
        </Link>
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
          href={liveHref}
          isMobile={isMobile}
          onMobilePanelToggle={isMobile ? handleMobilePanelToggle : undefined}
          sport={config.apiSport}
          sportLabel={config.label}
          t={t}
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
          t={t}
          tournamentId={tournament.id}
          variant="prematch"
        />
      </div>
    </div>
  );
}

export { cyberTournamentPageHref };
