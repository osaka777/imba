"use client";

import type { WcListStatCol } from "~/entities/wc-odds/lib/wcListStatCols";
import { cn } from "~/shared/lib";

import styles from "~/entities/wc-odds/ui/WcHomeInlineStats.module.css";

const YELLOW_CARD_SRC = "/yellow.png";
const RED_CARD_SRC = "/Red_card.svg";

type WcHomeInlineStatsProps = {
  cols: WcListStatCol[];
};

function StatIcon({ col }: { col: WcListStatCol }) {
  if (col.id === "yellow_cards") {
    return <img alt="" className={styles.icon} src={YELLOW_CARD_SRC} />;
  }
  if (col.id === "red_cards" || col.id === "yellow_red_cards") {
    return <img alt="" className={styles.icon} src={RED_CARD_SRC} />;
  }

  return (
    <span
      className={cn(
        styles.iconText,
        col.id === "fouls" && styles.iconText_yellow,
        col.id === "corners" && styles.iconText_yellow,
      )}
    >
      {col.label}
    </span>
  );
}

export function WcHomeInlineStats({ cols }: WcHomeInlineStatsProps) {
  if (cols.length === 0) return null;

  return (
    <div className={styles.wrap}>
      {cols.map((col) => (
        <div className={styles.col} key={col.id} title={col.label}>
          <StatIcon col={col} />
          <div className={styles.vals}>
            <span
              className={cn(
                styles.val,
                col.id === "red_cards" && styles.val_red,
                col.id === "yellow_cards" && styles.val_yellow,
              )}
            >
              {col.home}
            </span>
            <span
              className={cn(
                styles.val,
                col.id === "red_cards" && styles.val_red,
                col.id === "yellow_cards" && styles.val_yellow,
              )}
            >
              {col.away}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
