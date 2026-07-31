"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import { FireIcon, StatsIcon } from "~/shared/assets";
import { useLocale } from "~/shared/model/useLocale";

import compactStyles from "~/entities/wc-odds/ui/WcCompactTeamsRow.module.css";

export type WcCompactTeamsBlockProps = {
  gameHref: string;
  homeTeam: string;
  awayTeam: string;
  marketsCount?: number;
  isPriority?: boolean;
  hasStats?: boolean;
  isLive?: boolean;
  scoreMain?: string;
  /** @deprecated list rows no longer render period breakdown */
  scorePeriods?: string | null;
  liveTimeLabel?: string | null;
  homeExtras?: ReactNode;
  awayExtras?: ReactNode;
  onMarketsClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  /** Homepage mobile layout — same score column as default */
  layout?: "default" | "home";
};

export function WcCompactTeamsBlock({
  gameHref,
  homeTeam,
  awayTeam,
  marketsCount = 0,
  isPriority = false,
  hasStats = false,
  isLive = false,
  scoreMain = "",
  scorePeriods = null,
  liveTimeLabel = null,
  homeExtras,
  awayExtras,
  onMarketsClick,
  layout = "default",
}: WcCompactTeamsBlockProps) {
  const { t } = useLocale();
  const showMarkets = marketsCount > 0;
  const showScore = isLive && Boolean(scoreMain);
  // Feed sends RU "Перерыв" — keep as match ID, do not localize this comparison.
  const isBreak = liveTimeLabel === "Перерыв";
  const showStats = hasStats && !isBreak;
  const showTeamIndicators = showStats || isPriority;
  const showTrailing = showMarkets || showScore;
  const rowClass = [
    compactStyles.teamsRow,
    !showTrailing && compactStyles.teamsRow_solo,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={rowClass}>
        <div className={compactStyles.teamsMain}>
          <div className={compactStyles.teams}>
            <div className={compactStyles.teamRow}>
              <span className={compactStyles.teamName}>{homeTeam}</span>
              {homeExtras}
            </div>
            <div className={compactStyles.teamRow}>
              <span className={compactStyles.teamName}>{awayTeam}</span>
              {awayExtras}
            </div>
          </div>
          {showTeamIndicators && (
            <div className={compactStyles.teamIndicators}>
              {showStats && (
                <span className={compactStyles.statsBadge} title={t("wc.stats")}>
                  <StatsIcon className={compactStyles.statsIcon} />
                </span>
              )}
              {isPriority && (
                <span
                  aria-label={t("wc.priorityMatch")}
                  className={compactStyles.priorityBadge}
                  title={t("wc.topMatch")}
                >
                  <FireIcon className={compactStyles.priorityIcon} />
                </span>
              )}
            </div>
          )}
        </div>

        {showTrailing && (
          <div className={compactStyles.rowTrailing}>
            {showMarkets && (
              <Link
                className={compactStyles.marketsPill}
                data-markets-pill=""
                href={gameHref}
                onClick={onMarketsClick}
                prefetch={false}
              >
                +{marketsCount}
              </Link>
            )}

            {showScore && (
              <div className={compactStyles.scoreCenter}>
                <span className={compactStyles.scoreMain}>{scoreMain}</span>
                {liveTimeLabel && (
                  <span className={compactStyles.scoreTimeMobile}>{liveTimeLabel}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
