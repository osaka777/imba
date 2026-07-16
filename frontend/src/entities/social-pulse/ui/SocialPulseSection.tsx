"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiActivity, FiChevronRight, FiUsers } from "react-icons/fi";

import {
  fetchSocialPulse,
  type SocialPulseItem,
  type SocialPulsePick,
  type SocialPulseResponse,
} from "~/entities/social-pulse/api/client";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./SocialPulseSection.module.css";

const POLL_MS = 30_000;
const PICK_ORDER: SocialPulsePick[] = ["HOME", "DRAW", "AWAY"];

const copy = {
  ru: {
    title: "Пульс Imba",
    subtitle: (hours: number) => `Выбор игроков за ${hours} ч`,
    live: "LIVE",
    bets: (count: number) => `${count} ${count % 10 === 1 && count % 100 !== 11 ? "ставка" : "ставок"}`,
    draw: "Ничья",
    open: "Открыть матч",
  },
  en: {
    title: "Imba Pulse",
    subtitle: (hours: number) => `Players' picks over ${hours}h`,
    live: "LIVE",
    bets: (count: number) => `${count} ${count === 1 ? "bet" : "bets"}`,
    draw: "Draw",
    open: "Open match",
  },
} as const;

export function SocialPulseSection() {
  const [data, setData] = useState<SocialPulseResponse | null>(null);
  const { locale } = useLocale();
  const text = copy[locale];

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setData(await fetchSocialPulse(signal));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setData(null);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  if (!data?.enabled || data.items.length === 0) return null;

  return (
    <section aria-labelledby="social-pulse-title" className={styles.section}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <span aria-hidden className={styles.iconWrap}>
            <FiActivity />
          </span>
          <div>
            <h2 className={styles.title} id="social-pulse-title">
              {text.title}
              <span className={styles.liveDot} />
            </h2>
            <p className={styles.subtitle}>{text.subtitle(data.windowHours)}</p>
          </div>
        </div>
        <span className={styles.privacyNote}>
          <FiUsers aria-hidden />
          {text.bets(data.items.reduce((sum, item) => sum + item.betCount, 0))}
        </span>
      </header>

      <div className={styles.track}>
        {data.items.map((item) => (
          <PulseCard item={item} key={item.event.id} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function PulseCard({
  item,
  locale,
}: {
  item: SocialPulseItem;
  locale: "ru" | "en";
}) {
  const text = copy[locale];
  const href = buildWcGameHref(item.event);
  const outcomeByPick = new Map(item.outcomes.map((outcome) => [outcome.pick, outcome]));

  const labelFor = (pick: SocialPulsePick) => {
    if (pick === "HOME") return item.event.homeTeam;
    if (pick === "AWAY") return item.event.awayTeam;
    return text.draw;
  };

  return (
    <Link
      aria-label={`${item.event.homeTeam} — ${item.event.awayTeam}. ${text.open}`}
      className={styles.card}
      href={href}
      prefetch={false}
    >
      <div className={styles.cardMeta}>
        <span className={styles.league}>{item.event.leagueName}</span>
        <span className={item.event.phase === "live" ? styles.liveBadge : styles.betCount}>
          {item.event.phase === "live" ? text.live : text.bets(item.betCount)}
        </span>
      </div>

      <div className={styles.match}>
        <strong>{item.event.homeTeam}</strong>
        <span>—</span>
        <strong>{item.event.awayTeam}</strong>
      </div>

      <div aria-label={text.bets(item.betCount)} className={styles.sentimentBar}>
        {PICK_ORDER.map((pick) => {
          const outcome = outcomeByPick.get(pick);
          if (!outcome?.percent) return null;
          return (
            <span
              className={styles[`bar_${pick.toLowerCase()}`]}
              key={pick}
              style={{ width: `${outcome.percent}%` }}
              title={`${labelFor(pick)}: ${outcome.percent}%`}
            />
          );
        })}
      </div>

      <div className={styles.outcomes}>
        {PICK_ORDER.map((pick) => {
          const outcome = outcomeByPick.get(pick);
          if (!outcome || (pick === "DRAW" && outcome.betCount === 0)) return null;
          return (
            <div className={styles.outcome} key={pick}>
              <span title={labelFor(pick)}>{labelFor(pick)}</span>
              <strong>{outcome.percent}%</strong>
            </div>
          );
        })}
      </div>

      <div className={styles.cardFooter}>
        <span>{text.bets(item.betCount)}</span>
        <FiChevronRight aria-hidden />
      </div>
    </Link>
  );
}
