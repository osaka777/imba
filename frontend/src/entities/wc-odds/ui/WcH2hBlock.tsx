"use client";

import type { WcEventDetail } from "~/entities/wc-odds/api/client";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./WcH2hBlock.module.css";

type WcH2hBlockProps = {
  event: WcEventDetail;
};

export function WcH2hBlock({ event }: WcH2hBlockProps) {
  const { t } = useLocale();
  if (!event.hasHeadToHead) return null;

  const slug = event.slug?.trim();
  if (!slug) return null;

  const iframeSrc = `/api/feed/embed/h2h/${encodeURIComponent(slug)}`;

  return (
    <section className={styles.wrap} aria-label={t("common.h2hMeetings")}>
      <div className={styles.header}>
        <span className={styles.title}>{t("common.h2hMeetings")}</span>
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
