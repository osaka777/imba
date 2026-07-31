"use client";

import {
  formatKickoffCountdownHuman,
  padCountdownUnit,
  shouldShowKickoffTicker,
} from "~/entities/wc-odds/lib/wcKickoffCountdown";
import { formatWcCompactTime } from "~/entities/wc-odds/lib/wcCompactFormat";
import { useLocale } from "~/shared/model/useLocale";
import { useKickoffCountdown } from "~/entities/wc-odds/lib/useKickoffCountdown";

import styles from "~/entities/wc-odds/ui/WcPrematchKickoffCountdown.module.css";

type WcPrematchKickoffCountdownProps = {
  commenceTime: string;
};

export function WcPrematchKickoffCountdown({ commenceTime }: WcPrematchKickoffCountdownProps) {
  const { locale, t } = useLocale();
  const countdown = useKickoffCountdown(commenceTime);
  const { date, time } = formatWcCompactTime(commenceTime, locale);
  const showTicker = shouldShowKickoffTicker(countdown.totalMs);
  const humanHint = formatKickoffCountdownHuman(countdown.totalMs);
  const startAt = t("wc.kickoffDateAt", { date, time });

  if (countdown.totalMs <= 0) {
    return (
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t("wc.kickoffTitle")}</p>
        <p className={styles.startAt}>{startAt}</p>
      </div>
    );
  }

  if (!showTicker) {
    return (
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t("wc.kickoffTitle")}</p>
        <p className={styles.startAt}>{startAt}</p>
        {humanHint && <p className={styles.soonHint}>{humanHint}</p>}
      </div>
    );
  }

  return (
    <div aria-live="polite" className={styles.wrap}>
      <p className={styles.eyebrow}>{t("wc.kickoffIn")}</p>
      <div className={styles.timerRow}>
        <div className={styles.unit}>
          <span className={styles.value}>{padCountdownUnit(countdown.hours)}</span>
          <span className={styles.label}>{t("wc.hours")}</span>
        </div>
        <span aria-hidden className={styles.separator}>:</span>
        <div className={styles.unit}>
          <span className={styles.value}>{padCountdownUnit(countdown.minutes)}</span>
          <span className={styles.label}>{t("wc.minutes")}</span>
        </div>
        <span aria-hidden className={styles.separator}>:</span>
        <div className={styles.unit}>
          <span className={styles.value}>{padCountdownUnit(countdown.seconds)}</span>
          <span className={styles.label}>{t("wc.seconds")}</span>
        </div>
      </div>
      <p className={styles.startHint}>{startAt}</p>
    </div>
  );
}
