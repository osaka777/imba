"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StarIcon } from "@/shared/assets";

import { KickLogoMark } from "./KickLogoMark";
import styles from "./KickPartnersScoreboard.module.css";

type TabloStream = {
  partnerTag: string;
  channelSlug: string;
  streamTitle: string | null;
  viewerCount: number | null;
  isLive: boolean;
  hasBranding: boolean;
  kickUrl: string;
  betUrl: string;
  shortUrl: string | null;
};

type TopWeekItem = {
  rank: number;
  channelSlug: string;
  partnerTag: string;
  kickRegistrations: number;
  kickFtd: number;
  earningsUsd: number;
  isLive: boolean;
  viewerCount: number | null;
};

type Scoreboard = {
  connectedCount: number;
  liveCount: number;
  streams: TabloStream[];
  topWeek: TopWeekItem[];
  weeklyChallenge: {
    goal: number;
    bonusUsd: number;
    weekEndsAt: string;
    topProgress: number;
  };
  channelOfWeek: TopWeekItem | null;
  monthPayoutsUsd: number;
  weekKickRegistrations: number;
  monthSprint: {
    monthKey: string;
    endsAt: string;
    bonusUsd: number;
    minRegs: number;
    leader: {
      channelSlug: string;
      kickRegistrations: number;
    } | null;
  } | null;
  liveCollab: {
    active: boolean;
    count: number;
    hint: string;
    partners: Array<{
      channelSlug: string;
      partnerTag: string;
      kickUrl: string;
    }>;
  } | null;
};

const MONTH_NAMES = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

function sprintMonthLabel(monthKey: string) {
  const month = Number(monthKey.split("-")[1]);
  return MONTH_NAMES[month - 1] ?? monthKey;
}

export function KickPartnersScoreboard() {
  const [data, setData] = useState<Scoreboard | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/kick/partners/scoreboard", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as Scoreboard;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      }
    };

    void load();
    const timer = window.setInterval(load, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!data) return null;

  const liveStreams = data.streams.filter((item) => item.isLive);
  const displayStreams = liveStreams.length > 0 ? liveStreams : data.streams;

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.card}>
          <div className={styles.cardGlow} aria-hidden />

          <div className={styles.header}>
            <div className={styles.titleWrap}>
              <span className={styles.eyebrow}>
                {data.liveCount > 0 ? <span className={styles.liveDot} aria-hidden /> : null}
                Streaming
              </span>
              <h2 className={styles.title}>
                {data.liveCount > 0 ? "Партнёры в эфире" : "Партнёры на Kick"}
              </h2>
              <p className={styles.subtitle}>
                {data.liveCount > 0
                  ? "Топ эфиров наших партнёров прямо сейчас — заходи на стрим или на imba"
                  : "Подключённые Kick-каналы партнёрской программы"}
              </p>
            </div>

            <div className={styles.headerActions}>
              <div className={styles.kickLogoWrap}>
                <KickLogoMark />
              </div>
              <Link className={styles.cta} href="https://kick.imba.bet">
                Подключить канал
              </Link>
            </div>
          </div>

          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span className={`${styles.metricValue} ${styles.metricValueLive}`}>
                {data.liveCount}
              </span>
              <span className={styles.metricLabel}>В эфире сейчас</span>
            </div>
            <span className={styles.divider}>
              <StarIcon />
            </span>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{data.connectedCount}</span>
              <span className={styles.metricLabel}>Каналов подключено</span>
            </div>
          </div>

          <div className={styles.promoRow}>
            <div className={styles.promoCard}>
              <span className={styles.promoLabel}>Челлендж недели</span>
              <p className={styles.promoText}>
                {data.weeklyChallenge.goal} рег. с Kick → +${data.weeklyChallenge.bonusUsd}
              </p>
              <div className={styles.promoProgress}>
                <div
                  className={styles.promoProgressFill}
                  style={{
                    width: `${Math.min(100, (data.weeklyChallenge.topProgress / data.weeklyChallenge.goal) * 100)}%`,
                  }}
                />
              </div>
              <span className={styles.promoMeta}>
                Лидер: {data.weeklyChallenge.topProgress}/{data.weeklyChallenge.goal}
              </span>
            </div>
            {data.channelOfWeek ? (
              <div className={styles.promoCard}>
                <span className={styles.promoLabel}>Канал недели</span>
                <p className={styles.promoChannel}>@{data.channelOfWeek.channelSlug}</p>
                <span className={styles.promoMeta}>
                  ${data.channelOfWeek.earningsUsd.toFixed(2)} · {data.channelOfWeek.kickRegistrations} рег.
                </span>
              </div>
            ) : null}
            {data.monthPayoutsUsd > 0 ? (
              <div className={styles.promoCard}>
                <span className={styles.promoLabel}>Выплачено Kick-партнёрам</span>
                <p className={styles.promoPayout}>${data.monthPayoutsUsd.toFixed(0)}</p>
                <span className={styles.promoMeta}>за последние 30 дней</span>
              </div>
            ) : null}
            {data.monthSprint ? (
              <div className={styles.promoCard}>
                <span className={styles.promoLabel}>
                  Спринт: {sprintMonthLabel(data.monthSprint.monthKey)}
                </span>
                <p className={styles.promoText}>
                  Лучший канал месяца → +${data.monthSprint.bonusUsd}
                </p>
                <span className={styles.promoMeta}>
                  {data.monthSprint.leader
                    ? `Лидер: @${data.monthSprint.leader.channelSlug} · ${data.monthSprint.leader.kickRegistrations} рег.`
                    : `От ${data.monthSprint.minRegs} рег. с Kick — стань первым`}
                </span>
              </div>
            ) : null}
          </div>

          {data.liveCollab?.active ? (
            <div className={styles.collabBanner}>
              <span className={styles.collabBadge}>Коллаб</span>
              <p className={styles.collabText}>{data.liveCollab.hint}</p>
              <div className={styles.collabChannels}>
                {data.liveCollab.partners.map((p) => (
                  <a
                    key={p.channelSlug}
                    className={styles.collabLink}
                    href={p.kickUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    @{p.channelSlug}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {displayStreams.length > 0 ? (
            <div className={styles.streamGrid}>
              {displayStreams.map((item) => (
                <article key={item.partnerTag} className={styles.streamCard}>
                  <div className={styles.streamTop}>
                    <span
                      className={[
                        styles.streamStatus,
                        item.isLive ? styles.streamStatusLive : styles.streamStatusOff,
                      ].join(" ")}
                    >
                      {item.isLive ? "LIVE" : "офлайн"}
                    </span>
                    {item.viewerCount != null && item.isLive ? (
                      <span className={styles.streamViewers}>{item.viewerCount} зрит.</span>
                    ) : null}
                  </div>

                  <h3 className={styles.streamChannel}>@{item.channelSlug}</h3>
                  <p className={styles.streamTitle}>
                    {item.streamTitle || (item.isLive ? "Прямой эфир" : "Канал партнёра imba")}
                  </p>

                  <div className={styles.streamActions}>
                    <a
                      className={styles.streamBtnPrimary}
                      href={item.kickUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Смотреть на Kick
                    </a>
                    <a
                      className={styles.streamBtnSecondary}
                      href={item.shortUrl ?? item.betUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Ставить на imba
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyWrap}>
              <p className={styles.emptyTitle}>Пока нет подключённых каналов</p>
              <p className={styles.empty}>
                Станьте первым в табло — подключите Kick и получите welcome $10
              </p>
              <Link className={styles.cta} href="https://kick.imba.bet">
                Подключить Kick
              </Link>
            </div>
          )}

          {data.topWeek?.length > 0 ? (
            <div className={styles.topWeek}>
              <h3 className={styles.topWeekTitle}>Топ недели по заработку</h3>
              <div className={styles.topWeekList}>
                {data.topWeek.map((item) => (
                  <div key={item.partnerTag} className={styles.topWeekRow}>
                    <span className={styles.topWeekRank}>#{item.rank}</span>
                    <div className={styles.topWeekMeta}>
                      <span className={styles.topWeekChannel}>
                        @{item.channelSlug}
                        {item.isLive ? (
                          <span className={styles.topWeekLive}>LIVE</span>
                        ) : null}
                      </span>
                      <span className={styles.topWeekStats}>
                        {item.kickRegistrations} рег. · {item.kickFtd} FTD
                      </span>
                    </div>
                    <span className={styles.topWeekEarnings}>
                      ${item.earningsUsd.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
