"use client";

import Link from "next/link";
import type { LandingEvent } from "../types";
import { useLocale } from "~/shared/model/useLocale";
import styles from "../landing.module.css";

function formatOdds(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function formatTime(iso: string, phase: string) {
  if (phase === "live") return "LIVE";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  event: LandingEvent;
  ctaUrl: string;
  large?: boolean;
};

export function EventCard({ event, ctaUrl, large }: Props) {
  const { t } = useLocale();
  const gameUrl = `/game/${encodeURIComponent(event.slug || event.id)}`;
  const score =
    event.phase === "live" && event.homeScore != null && event.awayScore != null
      ? `${event.homeScore}:${event.awayScore}`
      : null;

  return (
    <article className={`${styles.eventCard} ${large ? styles.eventCardLarge : ""}`}>
      <div className={styles.eventMeta}>
        <span className={event.phase === "live" ? styles.liveBadge : styles.timeBadge}>
          {score ?? formatTime(event.commenceTime, event.phase)}
        </span>
        <span className={styles.league}>{event.leagueName}</span>
      </div>
      <div className={styles.teams}>
        <div className={styles.team}>
          {event.homeTeamIcon ? (
            <img src={event.homeTeamIcon} alt="" className={styles.teamIcon} />
          ) : null}
          <span>{event.homeTeam}</span>
        </div>
        <span className={styles.vs}>vs</span>
        <div className={styles.team}>
          {event.awayTeamIcon ? (
            <img src={event.awayTeamIcon} alt="" className={styles.teamIcon} />
          ) : null}
          <span>{event.awayTeam}</span>
        </div>
      </div>
      <div className={styles.oddsRow}>
        <div className={styles.odd}>
          <span>1</span>
          <strong>{formatOdds(event.oddsHome)}</strong>
        </div>
        <div className={styles.odd}>
          <span>X</span>
          <strong>{formatOdds(event.oddsDraw)}</strong>
        </div>
        <div className={styles.odd}>
          <span>2</span>
          <strong>{formatOdds(event.oddsAway)}</strong>
        </div>
      </div>
      <div className={styles.eventActions}>
        <Link href={gameUrl} className={styles.secondaryBtn}>
          {t("partner.watchLine")}
        </Link>
        <Link href={ctaUrl} className={styles.primaryBtn}>
          {t("auth.register")}
        </Link>
      </div>
    </article>
  );
}
