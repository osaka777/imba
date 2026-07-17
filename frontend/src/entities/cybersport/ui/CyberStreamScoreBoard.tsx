"use client";

import { useMemo } from "react";

import type { WcEventDetail } from "~/entities/wc-odds/api/client";
import { isWcMatchEffectivelyFinished } from "~/entities/wc-odds/lib/wcLiveClock";
import { WcPrematchKickoffCountdown } from "~/entities/wc-odds/ui/WcPrematchKickoffCountdown";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import { BroadcastIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";

import styles from "./CyberStreamScoreBoard.module.css";

type CyberStreamScoreBoardProps = {
  event: WcEventDetail;
  showBroadcastLink?: boolean;
  onBroadcastOpen?: () => void;
};

export function CyberStreamScoreBoard({
  event,
  showBroadcastLink,
  onBroadcastOpen,
}: CyberStreamScoreBoardProps) {
  const score = event.parsedScore;
  const isFinished = event.phase === "finished" || isWcMatchEffectivelyFinished(event);
  const isLive = event.phase === "live" && !isFinished;
  const isPrematch = event.phase === "prematch";

  const details = useMemo<[number, number][]>(() => {
    const raw = score?.details ?? [];
    return raw.map((row) => [Number(row?.[0]) || 0, Number(row?.[1]) || 0]);
  }, [score?.details]);

  const currentIdx = details.length > 0 ? details.length - 1 : -1;

  const seriesHome = Number(event.homeScore ?? score?.currentScore?.[0] ?? 0);
  const seriesAway = Number(event.awayScore ?? score?.currentScore?.[1] ?? 0);

  const currentMapLabel = details.length > 0 ? `Карта ${details.length}` : "Live";
  const currentRound =
    currentIdx >= 0 && details[currentIdx]
      ? `${details[currentIdx][0]}:${details[currentIdx][1]}`
      : null;

  const showBroadcast = Boolean(showBroadcastLink && onBroadcastOpen);

  return (
    <section className={styles.board}>
      <header className={styles.meta}>
        <span className={styles.league}>{event.leagueName || "Киберспорт"}</span>
        <div className={styles.metaRight}>
          {isLive ? (
            <span className={styles.liveBadge}>
              <span aria-hidden className={styles.liveDot} />
              LIVE
            </span>
          ) : null}
          {isFinished ? <span className={styles.finishedBadge}>Окончена</span> : null}
          {showBroadcast ? (
            <button
              className={styles.broadcastBtn}
              onClick={onBroadcastOpen}
              type="button"
            >
              <BroadcastIcon className={styles.broadcastIcon} />
              Трансляция
            </button>
          ) : null}
        </div>
      </header>

      {isLive && (currentRound || details.length > 0) ? (
        <div className={styles.mapBar}>
          <span className={styles.mapPill}>
            <span aria-hidden className={styles.mapPulse} />
            <span className={styles.mapPillLabel}>{currentMapLabel}</span>
            {currentRound ? (
              <span className={styles.mapPillRound}>{currentRound}</span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className={styles.hero}>
        <div className={cn(styles.team, styles.teamHome)}>
          <span className={styles.teamLogo}>
            <WcTeamImage
              iconUrl={event.homeTeamIcon}
              rounded
              size={44}
              teamName={event.homeTeam ?? ""}
            />
          </span>
          <span className={styles.teamName}>{event.homeTeam}</span>
        </div>

        <div className={styles.center}>
          {isPrematch ? (
            <WcPrematchKickoffCountdown commenceTime={event.commenceTime} />
          ) : (
            <>
              <div className={styles.scoreRow}>
                <span
                  className={cn(
                    styles.scoreNum,
                    seriesHome > seriesAway && styles.scoreNum_lead,
                  )}
                >
                  {seriesHome}
                </span>
                <span className={styles.scoreSep}>:</span>
                <span
                  className={cn(
                    styles.scoreNum,
                    seriesAway > seriesHome && styles.scoreNum_lead,
                  )}
                >
                  {seriesAway}
                </span>
              </div>
              <span className={styles.scoreCaption}>
                {isFinished ? "итог по картам" : "счёт по картам"}
              </span>
            </>
          )}
        </div>

        <div className={cn(styles.team, styles.teamAway)}>
          <span className={styles.teamLogo}>
            <WcTeamImage
              iconUrl={event.awayTeamIcon}
              rounded
              size={44}
              teamName={event.awayTeam ?? ""}
            />
          </span>
          <span className={styles.teamName}>{event.awayTeam}</span>
        </div>
      </div>

      {details.length > 0 ? (
        <div className={styles.maps}>
          {details.map(([home, away], index) => {
            const isCurrent = isLive && index === currentIdx;
            const isDone = index < currentIdx || (isFinished && index <= currentIdx);
            return (
              <div
                className={cn(
                  styles.mapChip,
                  isCurrent && styles.mapChip_active,
                  isDone && styles.mapChip_done,
                )}
                key={`map-${index}`}
              >
                <span className={styles.mapChipLabel}>К{index + 1}</span>
                <span className={styles.mapChipScore}>
                  <span className={cn(home > away && styles.mapWin)}>{home}</span>
                  <span className={styles.mapChipColon}>:</span>
                  <span className={cn(away > home && styles.mapWin)}>{away}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
