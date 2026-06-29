"use client";

import type { WcEventDetail } from "~/entities/wc-odds/api/client";

import styles from "./WcH2hBlock.module.css";

type WcH2hBlockProps = {
  event: WcEventDetail;
};

export function WcH2hBlock({ event }: WcH2hBlockProps) {
  if (!event.hasHeadToHead) return null;

  const slug = event.slug?.trim();
  if (!slug) return null;

  const iframeSrc = `/api/feed/embed/h2h/${encodeURIComponent(slug)}`;

  return (
    <section className={styles.wrap} aria-label="Личные встречи">
      <div className={styles.header}>
        <span className={styles.title}>Личные встречи</span>
        <span className={styles.subtitle}>
          {event.homeTeam} — {event.awayTeam}
        </span>
      </div>
      <div className={styles.viewport}>
        <iframe
          title={`H2H ${event.homeTeam} — ${event.awayTeam}`}
          className={styles.frame}
          src={iframeSrc}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
    </section>
  );
}
