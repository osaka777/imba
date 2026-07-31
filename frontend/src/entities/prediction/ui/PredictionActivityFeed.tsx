"use client";

import { useLocale } from "~/shared/model/useLocale";
import { toIntlLocale } from "~/shared/i18n/format";

import type { PredictionActivityDto } from "../api/client";
import { pickPredictionText } from "../lib/i18nText";
import styles from "./Prediction.module.css";

function relativeTime(
  iso: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return t("prediction.commentJustNow");
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return t("prediction.commentMinutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 48) return t("prediction.commentHoursAgo", { n: hours });
  return t("prediction.commentDaysAgo", { n: Math.floor(hours / 24) });
}

export function PredictionActivityFeed({
  activity,
}: {
  activity: PredictionActivityDto[];
}) {
  const { t, locale } = useLocale();
  const intlLocale = toIntlLocale(locale);

  return (
    <div className={styles.pmInfoSection}>
      <h2 className={styles.pmSectionTitle}>{t("prediction.activity")}</h2>
      {activity.length === 0 ? (
        <p className={styles.pmInfoBody}>{t("prediction.activityEmpty")}</p>
      ) : (
        <div className={styles.activityList}>
          {activity.map((row) => {
            const label =
              pickPredictionText(
                row.outcomeLabel,
                row.outcomeLabelEn,
                locale,
              ) || row.outcomeKey;
            const sideClass =
              row.outcomeKey.toLowerCase() === "yes" ||
              row.outcomeKey.toLowerCase() === "a"
                ? styles.activitySideYes
                : styles.activitySideNo;
            return (
              <div className={styles.activityRow} key={row.id}>
                <div className={styles.activityMain}>
                  <span className={styles.activityTrader}>{row.trader}</span>
                  <span className={styles.activityAction}>
                    {t("prediction.activityBought", { label })}
                  </span>
                  <span className={sideClass}>
                    {Number(row.odds).toFixed(2)}x
                  </span>
                </div>
                <div className={styles.activityMeta}>
                  <span>
                    {Number(row.stake).toLocaleString(intlLocale)}{" "}
                    {row.currencyCode}
                  </span>
                  <span>{relativeTime(row.createdAt, t)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
