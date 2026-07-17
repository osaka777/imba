"use client";

import { useEffect, useState } from "react";

import { getKickShortClickDomain } from "@/shared/lib/kickShortUrl";

import styles from "./widget.module.css";

type WidgetData = {
  found: boolean;
  partnerTag: string;
  channelSlug: string | null;
  isLive: boolean;
  betUrl: string;
  promoCode: string | null;
  streamTitle: string | null;
  shortUrlImba: string | null;
  liveStats: {
    sessionClicks: number;
    sessionRegistrations: number;
    todayClicks: number;
  } | null;
  streamRace: {
    goal: number;
    current: number;
    bonusUsd: number;
    granted: boolean;
    active: boolean;
  } | null;
  guessContest: {
    active: boolean;
    matchLabel: string | null;
    currentScore: string | null;
    guessCount: number;
  } | null;
};

const WIDGET_API =
  (process.env.NEXT_PUBLIC_MAIN_SITE || "https://imba.bet").replace(/\/$/, "");

export function StreamWidget({ tag }: { tag: string }) {
  const [data, setData] = useState<WidgetData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `${WIDGET_API}/api/kick/partners/widget/${encodeURIComponent(tag)}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as WidgetData;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      }
    };

    void load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tag]);

  if (!data?.found) {
    return (
      <div className={styles.root}>
        <div className={styles.bar}>
          <span className={styles.empty}>Партнёр не найден</span>
        </div>
      </div>
    );
  }

  const promoLine = data.promoCode ? `Промокод ${data.promoCode}` : "Ставки на imba.bet";
  const subLine = data.isLive
    ? data.streamTitle || `@${data.channelSlug ?? "kick"}`
    : "Подключите Kick в кабинете партнёра";
  const ctaHref = data.shortUrlImba ?? data.betUrl;
  const stats = data.liveStats;
  const race = data.streamRace;
  const guess = data.guessContest;

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        {data.isLive ? <span aria-hidden className={styles.liveDot} /> : null}
        <div className={styles.brand}>
          imba<span className={styles.brandAccent}>.bet</span>
        </div>
        <div className={styles.meta}>
          <p className={styles.promo}>{promoLine}</p>
          <p className={styles.sub}>{subLine}</p>
          {stats ? (
            <p className={styles.stats}>
              Эфир: {stats.sessionClicks} кликов · {stats.sessionRegistrations} рег.
              {stats.todayClicks > 0 ? ` · сегодня ${stats.todayClicks}` : ""}
            </p>
          ) : null}
          {race?.active && !race.granted ? (
            <div className={styles.race}>
              <span className={styles.raceLabel}>
                Гонка: {race.current}/{race.goal} рег → +${race.bonusUsd}
              </span>
              <div className={styles.raceBar}>
                <div
                  className={styles.raceFill}
                  style={{ width: `${Math.min(100, (race.current / race.goal) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
          {race?.granted ? (
            <p className={styles.raceDone}>Гонка эфира выполнена — +${race.bonusUsd}</p>
          ) : null}
          {guess?.active ? (
            <p className={styles.guessLine}>
              Угадай счёт: {guess.matchLabel ?? "live"}
              {guess.currentScore ? ` (${guess.currentScore})` : ""} · {guess.guessCount} ответов ·
              !счёт 2-1
            </p>
          ) : null}
        </div>
        <a className={styles.cta} href={ctaHref} rel="noreferrer" target="_blank">
          {data.shortUrlImba ? getKickShortClickDomain() : "Перейти"}
        </a>
      </div>
    </div>
  );
}
