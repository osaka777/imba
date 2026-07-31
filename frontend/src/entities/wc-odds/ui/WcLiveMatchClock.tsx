"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { WcEventDetail } from "~/entities/wc-odds/api/client";
import {
  isWcLiveClockRunning,
  resolveLiveClockSource,
  WC_CLOCK_EXTRAPOLATE_MAX_SEC,
} from "~/entities/wc-odds/lib/wcLiveClock";
import {
  wcAddedMinutesIsAnnounced,
  wcDisplayAddedMinutes,
} from "~/entities/wc-odds/lib/wcLiveScore";

import styles from "~/entities/wc-odds/ui/WcScoreBoard.module.css";
import { useLocale } from "~/shared/model/useLocale";

function secondsToTime(totalSec: number, sport?: string): string {
  const clamped = Math.max(0, totalSec);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  if (sport === "soccer" || sport === "cyber-football") {
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function pickClockParsedScore(event: WcEventDetail) {
  const ps = event.parsedScore;
  if (!ps) return undefined;
  return {
    seconds: ps.seconds,
    period: ps.period,
    remainingTimeInPeriodSec: ps.remainingTimeInPeriodSec,
    currentTimeInPeriodSec: ps.currentTimeInPeriodSec,
    text: ps.text?.time ? { time: ps.text.time } : undefined,
    gamePhase: ps.gamePhase,
  };
}

export function useLiveMatchClock(event: WcEventDetail): string {
  const clockParsedScore = useMemo(
    () => pickClockParsedScore(event),
    [
      event.parsedScore?.seconds,
      event.parsedScore?.period,
      event.parsedScore?.remainingTimeInPeriodSec,
      event.parsedScore?.currentTimeInPeriodSec,
      event.parsedScore?.text?.time,
      event.parsedScore?.gamePhase,
    ],
  );

  const source = useMemo(
    () => resolveLiveClockSource({ sport: event.sport, parsedScore: clockParsedScore }),
    [event.sport, clockParsedScore],
  );

  const shouldRun = useMemo(
    () => isWcLiveClockRunning({
      sport: event.sport,
      phase: event.phase,
      completed: event.completed,
      feedStatus: event.feedStatus,
      parsedScore: clockParsedScore,
    }),
    [
      event.sport,
      event.phase,
      event.completed,
      event.feedStatus,
      clockParsedScore,
    ],
  );
  const [time, setTime] = useState(() => secondsToTime(source.baseSeconds, event.sport));
  const lastUpdateRef = useRef(Date.now());
  const lastSecsRef = useRef(source.baseSeconds);

  useEffect(() => {
    lastSecsRef.current = source.baseSeconds;
    lastUpdateRef.current = Date.now();
    setTime(secondsToTime(source.baseSeconds, event.sport));
  }, [source.baseSeconds, source.countdown, event.sport]);

  useEffect(() => {
    if (!shouldRun) return;
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 1000);
      if (elapsed > WC_CLOCK_EXTRAPOLATE_MAX_SEC) return;
      const next = source.countdown
        ? lastSecsRef.current - elapsed
        : lastSecsRef.current + elapsed;
      setTime(secondsToTime(next, event.sport));
    }, 500);
    return () => window.clearInterval(id);
  }, [shouldRun, source.countdown, event.sport]);

  return time;
}

type WcLiveMatchClockBarProps = {
  event: WcEventDetail;
  periodLabel: string | null;
};

export function WcLiveMatchClockBar({
  event,
  periodLabel,
}: WcLiveMatchClockBarProps) {
  const { t } = useLocale();
  const time = useLiveMatchClock(event);
  const score = event.parsedScore;
  const showAddedTime = event.sport === "soccer";
  const addedMinutes = showAddedTime ? wcDisplayAddedMinutes(score) : null;

  return (
    <div className={styles.liveClockBar}>
      <span className={styles.matchClockPill}>
        <span className={styles.timerDot} aria-hidden />
        {periodLabel ? (
          <>
            <span className={styles.matchClockPeriod}>{periodLabel}</span>
            <span className={styles.matchClockSep} aria-hidden />
          </>
        ) : null}
        <span className={styles.matchClockTime}>{time}</span>
        {addedMinutes != null ? (
          <span
            className={styles.matchClockExtra}
            title={
              wcAddedMinutesIsAnnounced(score)
                ? t("wc.addedAnnounced")
                : t("wc.addedInjury")
            }
          >
            +{addedMinutes}&apos;
          </span>
        ) : null}
      </span>
    </div>
  );
}
