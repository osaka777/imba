"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./OpenTab.module.css";

export type OpenBetSlipCardProps = {
  kindLabel: string;
  ticketId: string;
  placedAt: string;
  headerDate: string;
  isLive: boolean;
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
  highlight?: boolean;
  dataKey: string;
  children?: ReactNode;
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
  matchLinkText = "Перейти к матчу →",
  stakeLabel,
  winLabel,
  footerRightLabel = "Возм. выигрыш",
  footerRightValue,
  footerRightWin = true,
  highlight,
  dataKey,
  children,
}: OpenBetSlipCardProps) {
  const rightValue = footerRightValue ?? winLabel;
  return (
    <div
      className={`${styles.openBetCard} ${highlight ? styles.openBetCardFresh : ""}`}
      data-open-bet-key={dataKey}
    >
      <div className={styles.openBetHeaderBar}>
        <span className={styles.openBetHeaderDate}>{headerDate}</span>
        <span className={styles.openBetHeaderBrand}>{kindLabel}</span>
        <span className={styles.openBetHeaderId}>ID {ticketId}</span>
      </div>

      <div className={styles.openBetSlip}>
        {isLive ? (
          <span className={styles.openBetLiveRibbon}>Live</span>
        ) : (
          <span className={styles.openBetLineRibbon}>Линия</span>
        )}

        <div className={styles.openBetPickRow}>
          <div className={styles.openBetCoefPill}>{coef}</div>
          <p className={styles.openBetOutcome}>{outcome}</p>
        </div>

        {teamsLabel ? (
          <>
            <div className={styles.openBetMatchRow}>
              <div className={styles.openBetMatchTeams}>
                {SportIcon ? <SportIcon className={styles.openBetSportIcon} /> : null}
                <span className={styles.openBetTeamsText}>{teamsLabel}</span>
              </div>
              {scoreMain ? <span className={styles.openBetScoreMain}>{scoreMain}</span> : null}
            </div>

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
          <div className={styles.openBetFooterCol}>
            <span className={styles.openBetFooterLabel}>Коэф.</span>
            <span className={styles.openBetFooterValue}>{coef}</span>
          </div>
          <div className={`${styles.openBetFooterCol} ${styles.openBetFooterColRight}`}>
            <span className={styles.openBetFooterLabel}>{footerRightLabel}</span>
            <span className={footerRightWin ? styles.openBetFooterWin : styles.openBetFooterValue}>
              {rightValue}
            </span>
          </div>
        </div>

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
  return (
    <div className={styles.openBetExpressLeg}>
      <div className={styles.openBetPickRow}>
        <div className={styles.openBetCoefPill}>{coef}</div>
        <div className={styles.openBetExpressLegText}>
          {sportLabel ? <span className={styles.openBetExpressSport}>{sportLabel}</span> : null}
          <p className={styles.openBetOutcome}>{outcome}</p>
        </div>
      </div>
      <p className={styles.openBetTeamsText}>{teamsLabel}</p>
      {scoreDetail ? <p className={styles.openBetScoreDetailInline}>{scoreDetail}</p> : null}
      <Link className={styles.openBetMatchLink} href={matchHref}>
        Перейти к событию →
      </Link>
    </div>
  );
}
