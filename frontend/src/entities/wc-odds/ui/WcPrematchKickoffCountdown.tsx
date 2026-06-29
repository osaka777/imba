"use client";

import {
  formatKickoffCountdownHuman,
  padCountdownUnit,
  shouldShowKickoffTicker,
} from "~/entities/wc-odds/lib/wcKickoffCountdown";
import { formatWcCompactTime } from "~/entities/wc-odds/lib/wcCompactFormat";
import { useKickoffCountdown } from "~/entities/wc-odds/lib/useKickoffCountdown";

import styles from "~/entities/wc-odds/ui/WcPrematchKickoffCountdown.module.css";

type WcPrematchKickoffCountdownProps = {
  commenceTime: string;
};

export function WcPrematchKickoffCountdown({ commenceTime }: WcPrematchKickoffCountdownProps) {
  const countdown = useKickoffCountdown(commenceTime);
  const { date, time } = formatWcCompactTime(commenceTime);
  const showTicker = shouldShowKickoffTicker(countdown.totalMs);
  const humanHint = formatKickoffCountdownHuman(countdown.totalMs);

  if (countdown.totalMs <= 0) {
    return (
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Начало события</p>
        <p className={styles.startAt}>
          {date} в {time}
        </p>
      </div>
    );
  }

  if (!showTicker) {
    return (
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Начало события</p>
        <p className={styles.startAt}>
          {date} в {time}
        </p>
        {humanHint && <p className={styles.soonHint}>{humanHint}</p>}
      </div>
    );
  }

  return (
    <div aria-live="polite" className={styles.wrap}>
      <p className={styles.eyebrow}>Начало события через</p>
      <div className={styles.timerRow}>
        <div className={styles.unit}>
          <span className={styles.value}>{padCountdownUnit(countdown.hours)}</span>
          <span className={styles.label}>часов</span>
        </div>
        <span aria-hidden className={styles.separator}>:</span>
        <div className={styles.unit}>
          <span className={styles.value}>{padCountdownUnit(countdown.minutes)}</span>
          <span className={styles.label}>мин</span>
        </div>
        <span aria-hidden className={styles.separator}>:</span>
        <div className={styles.unit}>
          <span className={styles.value}>{padCountdownUnit(countdown.seconds)}</span>
          <span className={styles.label}>сек</span>
        </div>
      </div>
      <p className={styles.startHint}>
        {date} в {time}
      </p>
    </div>
  );
}
