"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "~/shared/lib";
import { useFlashOnChange } from "~/shared/lib/useFlashOnChange";

import styles from "./OpenTab.module.css";

const ORDINAR_BRAND_LOGO = "/imbalogo.png";

export type SlipRibbonVariant =
  | "live"
  | "line"
  | "win"
  | "lose"
  | "pending"
  | "return"
  | "settling";

export type SlipRibbon = {
  label: string;
  variant: SlipRibbonVariant;
  pulse?: boolean;
};

export type OpenBetSlipCardProps = {
  kindLabel: string;
  ticketId: string;
  placedAt: string;
  headerDate: string;
  isLive: boolean;
  ribbon?: SlipRibbon;
  coef: string;
  outcome: string;
  sportIcon?: React.ComponentType<{ className?: string }>;
  teamsLabel: string;
  scoreMain?: string | null;
  scoreDetail?: string | null;
  league?: string | null;
  kickoffLabel?: string | null;
  matchHref: string;
  matchLinkText?: string;
  stakeLabel: string;
  winLabel: string;
  footerRightLabel?: string;
  footerRightValue?: string;
  footerRightWin?: boolean;
  footerRightDanger?: boolean;
  highlight?: boolean;
  dataKey: string;
  children?: ReactNode;
  postFooter?: ReactNode;
};

export function OpenBetSlipCard({
  kindLabel,
  ticketId,
  placedAt,
  headerDate,
  isLive,
  coef,
  outcome,
  sportIcon: SportIcon,
  teamsLabel,
  scoreMain,
  scoreDetail,
  league,
  kickoffLabel,
  matchHref,
  stakeLabel,
  winLabel,
  footerRightLabel = "Возм. выигрыш",
  footerRightValue,
  footerRightWin = true,
  footerRightDanger = false,
  ribbon,
  highlight,
  dataKey,
  children,
  postFooter,
}: OpenBetSlipCardProps) {
  const rightValue = footerRightValue ?? winLabel;
  const coefFlash = useFlashOnChange(coef);
  const scoreFlash = useFlashOnChange(scoreMain);
  const effectiveRibbon: SlipRibbon =
    ribbon ?? (isLive
      ? { label: "Live", variant: "live", pulse: true }
      : { label: "Линия", variant: "line" });

  return (
    <div
      className={`${styles.openBetCard} ${highlight ? styles.openBetCardFresh : ""}`}
      data-open-bet-key={dataKey}
    >
      <div className={styles.openBetHeaderBar}>
        <span className={styles.openBetHeaderDate}>{headerDate}</span>
        <div className={styles.openBetHeaderCenter}>
          {kindLabel === "Ординар" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Imba.bet"
              className={styles.openBetHeaderBrandLogo}
              height={18}
              src={ORDINAR_BRAND_LOGO}
              width={72}
            />
          ) : (
            <span className={styles.openBetHeaderBrand}>{kindLabel}</span>
          )}
        </div>
        <span className={styles.openBetHeaderId}>ID {ticketId}</span>
      </div>

      <div className={styles.openBetSlip}>
        <span
          className={cn(
            styles.openBetRibbon,
            styles[`openBetRibbon_${effectiveRibbon.variant}`],
          )}
        >
          {effectiveRibbon.pulse ? (
            <span className={styles.openBetLiveDot} aria-hidden />
          ) : null}
          {effectiveRibbon.label}
        </span>

        <div className={styles.openBetPickRow}>
          <div
            className={cn(
              styles.openBetCoefPill,
              coefFlash === "up" && styles.openBetCoefPillUp,
              coefFlash === "down" && styles.openBetCoefPillDown,
            )}
          >
            {coef}
          </div>
          <p className={styles.openBetOutcome}>{outcome}</p>
        </div>

        {teamsLabel ? (
          <>
            <Link className={styles.openBetMatchRowLink} href={matchHref}>
              <div className={styles.openBetMatchRow}>
                <div className={styles.openBetMatchTeams}>
                  {SportIcon ? <SportIcon className={styles.openBetSportIcon} /> : null}
                  <span className={styles.openBetTeamsText}>{teamsLabel}</span>
                </div>
                {scoreMain ? (
                  <span
                    className={cn(
                      styles.openBetScoreMain,
                      scoreFlash && styles.openBetScoreFlash,
                    )}
                  >
                    {scoreMain}
                  </span>
                ) : null}
              </div>
            </Link>

            {(scoreDetail || league || kickoffLabel) ? (
              <div className={styles.openBetMetaRow}>
                <span className={styles.openBetLeague}>
                  {[scoreDetail, league].filter(Boolean).join(" · ")}
                </span>
                {kickoffLabel ? (
                  <span className={styles.openBetKickoff}>{kickoffLabel}</span>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className={styles.openBetPlacedHint}>Поставлена {placedAt}</p>
        )}

        {children}

        <div className={styles.openBetDivider} />

        <div className={styles.openBetFooterGrid}>
          <div className={styles.openBetFooterCol}>
            <span className={styles.openBetFooterLabel}>Ставка</span>
            <span className={styles.openBetFooterValue}>{stakeLabel}</span>
          </div>
          <div className={`${styles.openBetFooterCol} ${styles.openBetFooterColRight}`}>
            <span className={styles.openBetFooterLabel}>{footerRightLabel}</span>
            <span
              className={cn(
                footerRightWin
                  ? styles.openBetFooterWin
                  : footerRightDanger
                    ? styles.openBetFooterDanger
                    : styles.openBetFooterValue,
              )}
            >
              {rightValue}
            </span>
          </div>
        </div>

        {postFooter}

        <div aria-hidden className={styles.openBetScallops} />
      </div>
    </div>
  );
}

export function OpenBetSlipExpressLeg({
  coef,
  outcome,
  sportLabel,
  teamsLabel,
  scoreDetail,
  matchHref,
}: {
  coef: string;
  outcome: string;
  sportLabel?: string;
  teamsLabel: string;
  scoreDetail?: string | null;
  matchHref: string;
}) {
  const coefFlash = useFlashOnChange(coef);

  return (
    <div className={styles.openBetExpressLeg}>
      <div className={styles.openBetPickRow}>
        <div
          className={cn(
            styles.openBetCoefPill,
            coefFlash === "up" && styles.openBetCoefPillUp,
            coefFlash === "down" && styles.openBetCoefPillDown,
          )}
        >
          {coef}
        </div>
        <div className={styles.openBetExpressLegText}>
          {sportLabel ? <span className={styles.openBetExpressSport}>{sportLabel}</span> : null}
          <p className={styles.openBetOutcome}>{outcome}</p>
        </div>
      </div>
      <Link className={styles.openBetMatchRowLink} href={matchHref}>
        <p className={styles.openBetTeamsText}>{teamsLabel}</p>
      </Link>
      {scoreDetail ? <p className={styles.openBetScoreDetailInline}>{scoreDetail}</p> : null}
    </div>
  );
}
