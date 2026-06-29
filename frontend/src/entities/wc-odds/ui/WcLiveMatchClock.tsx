"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { WcEventDetail } from "~/entities/wc-odds/api/client";
import {
  isWcLiveClockRunning,
  WC_CLOCK_EXTRAPOLATE_MAX_SEC,
} from "~/entities/wc-odds/lib/wcLiveClock";
import {
  wcAddedMinutesIsAnnounced,
  wcDisplayAddedMinutes,
} from "~/entities/wc-odds/lib/wcLiveScore";
import { isCountdownClockSport } from "~/entities/wc-odds/lib/wcSportKinds";

import styles from "~/entities/wc-odds/ui/WcScoreBoard.module.css";

function timeToSeconds(raw: string | undefined): number {
  if (!raw) return 0;
  const [m, sec] = raw.split(":").map(Number);
  return (m || 0) * 60 + (sec || 0);
}

function secondsToTime(totalSec: number): string {
  const clamped = Math.max(0, totalSec);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type ClockSource = {
  baseSeconds: number;
  countdown: boolean;
};

function resolveClockSource(event: WcEventDetail): ClockSource {
  const score = event.parsedScore;
  const remaining = score?.remainingTimeInPeriodSec;

  if (
    isCountdownClockSport(event.sport)
    && remaining != null
    && remaining > 0
  ) {
    return { baseSeconds: remaining, countdown: true };
  }

  const fromFeed = score?.currentTimeInPeriodSec;
  if (fromFeed != null && fromFeed > 0 && isCountdownClockSport(event.sport)) {
    // Some feeds only ship elapsed in-period seconds for NA sports.
    return { baseSeconds: fromFeed, countdown: false };
  }

  return {
    baseSeconds: timeToSeconds(score?.text?.time),
    countdown: false,
  };
}

export function useLiveMatchClock(event: WcEventDetail): string {
  const source = useMemo(() => resolveClockSource(event), [event]);
  const shouldRun = useMemo(() => isWcLiveClockRunning(event), [event]);
  const [time, setTime] = useState(() => secondsToTime(source.baseSeconds));
  const lastUpdateRef = useRef(Date.now());
  const lastSecsRef = useRef(source.baseSeconds);

  useEffect(() => {
    lastSecsRef.current = source.baseSeconds;
    lastUpdateRef.current = Date.now();
    setTime(secondsToTime(source.baseSeconds));
  }, [source.baseSeconds, source.countdown]);

  useEffect(() => {
    if (!shouldRun) return;
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 1000);
      if (elapsed > WC_CLOCK_EXTRAPOLATE_MAX_SEC) return;
      const next = source.countdown
        ? lastSecsRef.current - elapsed
        : lastSecsRef.current + elapsed;
      setTime(secondsToTime(next));
    }, 500);
    return () => window.clearInterval(id);
  }, [shouldRun, source.countdown]);

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
            title={wcAddedMinutesIsAnnounced(score) ? "Объявлено судьёй" : "Компенсация"}
          >
            +{addedMinutes}&apos;
          </span>
        ) : null}
      </span>
    </div>
  );
}
