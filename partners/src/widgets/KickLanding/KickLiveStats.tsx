"use client";

import { useEffect, useState } from "react";

import styles from "./KickLiveStats.module.css";

type Stats = {
  connectedCount: number;
  liveCount: number;
  liveChannels: string[];
  weekKickRegistrations?: number;
  monthPayoutsUsd?: number;
  channelOfWeek?: string | null;
};

export function KickLiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/kick/partners/stats", { cache: "no-store" })
      .then((res) => res.json() as Promise<Stats>)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setStats({ connectedCount: 0, liveCount: 0, liveChannels: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return null;

  const hasActivity =
    stats.connectedCount > 0
    || stats.liveCount > 0
    || (stats.weekKickRegistrations ?? 0) > 0
    || (stats.monthPayoutsUsd ?? 0) > 0;

  if (!hasActivity) return null;

  return (
    <div className={styles.wrap}>
      {stats.liveCount > 0 ? (
        <span className={styles.live}>
          <span className={styles.dot} aria-hidden />
          Сейчас в эфире: {stats.liveCount}
        </span>
      ) : null}
      {stats.connectedCount > 0 ? (
        <span className={styles.connected}>
          Подключено Kick-каналов: {stats.connectedCount}
        </span>
      ) : null}
      {(stats.weekKickRegistrations ?? 0) > 0 ? (
        <span className={styles.connected}>
          Регистраций с Kick за неделю: {stats.weekKickRegistrations}
        </span>
      ) : null}
      {(stats.monthPayoutsUsd ?? 0) > 0 ? (
        <span className={styles.payouts}>
          Выплачено партнёрам: ${stats.monthPayoutsUsd?.toFixed(0)}
        </span>
      ) : null}
      {stats.channelOfWeek ? (
        <span className={styles.channelWeek}>
          Канал недели: @{stats.channelOfWeek}
        </span>
      ) : null}
    </div>
  );
}
