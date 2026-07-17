"use client";

import { useEffect, useState } from "react";

import styles from "./KickStreamLiveEarnings.module.css";

type SessionLiveStats = {
  active: boolean;
  sessionId: string | null;
  startedAt: string | null;
  clicks: number;
  registrations: number;
  ftd: number;
  commissionUsd: number;
  streamTitle: string | null;
  peakViewers: number;
  streamRace: {
    goal: number;
    current: number;
    bonusUsd: number;
    granted: boolean;
    active: boolean;
  } | null;
  streak: {
    goal: number;
    current: number;
    bonusUsd: number;
  } | null;
  guessContest: {
    active: boolean;
    matchLabel: string | null;
    currentScore: string | null;
    guessCount: number;
    recentGuesses: Array<{
      username: string;
      home: number;
      away: number;
    }>;
  } | null;
};

function formatDuration(startedAt: string | null) {
  if (!startedAt) return "—";
  const ms = Date.now() - Date.parse(startedAt);
  if (Number.isNaN(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

export function KickStreamLiveEarnings() {
  const [stats, setStats] = useState<SessionLiveStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/kick/session-live", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as SessionLiveStats;
        if (!cancelled) setStats(json);
      } catch {
        if (!cancelled) setStats(null);
      }
    };

    void load();
    const timer = window.setInterval(load, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!stats) return null;

  if (!stats.active) {
    if (!stats.streak || stats.streak.current === 0) return null;
    return (
      <section className={styles.streakCard}>
        <span className={styles.streakFlame} aria-hidden>🔥</span>
        <div>
          <p className={styles.streakTitle}>
            Серия брендированных эфиров: {stats.streak.current}/{stats.streak.goal}
          </p>
          <p className={styles.streakText}>
            Ещё {Math.max(0, stats.streak.goal - stats.streak.current)} эфир(а) с imba.bet в
            заголовке — и +${stats.streak.bonusUsd} на баланс. Серия рвётся, если эфир пройдёт
            без брендинга.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.liveBadge}>В эфире</span>
          <h2 className={styles.title}>Заработок за текущий эфир</h2>
          {stats.streamTitle ? (
            <p className={styles.subtitle}>{stats.streamTitle}</p>
          ) : null}
        </div>
        <span className={styles.duration}>{formatDuration(stats.startedAt)}</span>
      </div>

      <div className={styles.grid}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Клики</span>
          <span className={styles.statValue}>{stats.clicks}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Регистрации</span>
          <span className={styles.statValue}>{stats.registrations}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>FTD</span>
          <span className={styles.statValue}>{stats.ftd}</span>
        </div>
        <div className={`${styles.stat} ${styles.statHighlight}`}>
          <span className={styles.statLabel}>Комиссия</span>
          <span className={styles.statValue}>${stats.commissionUsd.toFixed(2)}</span>
        </div>
      </div>

      {stats.peakViewers > 0 ? (
        <p className={styles.footer}>Пик зрителей: {stats.peakViewers}</p>
      ) : null}

      {stats.streamRace?.active && !stats.streamRace.granted ? (
        <div className={styles.race}>
          <p className={styles.raceTitle}>
            Гонка эфира: {stats.streamRace.current}/{stats.streamRace.goal} рег → +$
            {stats.streamRace.bonusUsd}
          </p>
          <div className={styles.raceBar}>
            <div
              className={styles.raceFill}
              style={{
                width: `${Math.min(100, (stats.streamRace.current / stats.streamRace.goal) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {stats.streak && stats.streak.current > 0 ? (
        <p className={styles.streakInline}>
          🔥 Серия брендированных эфиров: {stats.streak.current}/{stats.streak.goal} → +$
          {stats.streak.bonusUsd}
        </p>
      ) : null}

      {stats.guessContest?.active ? (
        <div className={styles.guess}>
          <p className={styles.guessTitle}>
            Угадай счёт: {stats.guessContest.matchLabel ?? "live-матч"}
            {stats.guessContest.currentScore
              ? ` · сейчас ${stats.guessContest.currentScore}`
              : ""}
          </p>
          <p className={styles.guessMeta}>
            {stats.guessContest.guessCount} ответов в чате · зрители пишут !счёт 2-1
          </p>
          {stats.guessContest.recentGuesses.length > 0 ? (
            <ul className={styles.guessList}>
              {stats.guessContest.recentGuesses.map((g) => (
                <li key={`${g.username}-${g.home}-${g.away}`}>
                  @{g.username}: {g.home}:{g.away}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
