"use client";

import { TbActivity } from "react-icons/tb";

import styles from "~/entities/wc-odds/ui/WcLiveTrackerPanel.module.css";
import { cn } from "~/shared/lib";

type WcLiveTrackerPanelProps = {
  meta?: { awayTeam: string; homeTeam: string; leagueName?: null | string } | null;
  url: string;
  variant?: "inline" | "sidebar";
};

export function WcLiveTrackerPanel({ meta, url, variant = "inline" }: WcLiveTrackerPanelProps) {
  if (variant === "sidebar") {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.headerIconWrap}>
            <TbActivity className={styles.headerIcon} />
          </span>
          <div className={styles.headerText}>
            {meta?.leagueName ? <p className={styles.league}>{meta.leagueName}</p> : null}
            <p className={styles.match}>
              {meta ? `${meta.homeTeam} – ${meta.awayTeam}` : "Live Tracker"}
            </p>
          </div>
        </div>
        <div className={styles.body}>
          <iframe
            allow="autoplay"
            className={styles.frame}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={url}
            title="Live Tracker"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(styles.wrap, styles.wrapInline)}>
      <iframe
        allow="autoplay"
        className={styles.frame}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={url}
        title="Live Tracker"
      />
    </div>
  );
}
