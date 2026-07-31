"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { traderProfileHref } from "~/entities/user/lib/nickname";
import { toIntlLocale } from "~/shared/i18n/format";
import { useLocale } from "~/shared/model/useLocale";

import {
  fetchPredictionGlobalActivity,
  fetchPredictionLeaderboard,
  formatPredictionVolumeUsd,
  predictionStakeToUsdClient,
} from "../api/client";
import { pickPredictionText } from "../lib/i18nText";
import { spectacleFlags } from "../lib/spectacleFlags";
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

export function MarketsTradeTape() {
  const { t, locale } = useLocale();
  const query = useQuery({
    enabled: spectacleFlags.globalTape,
    queryFn: () => fetchPredictionGlobalActivity(24),
    queryKey: ["prediction-global-activity"],
    refetchInterval: 6_000,
  });

  if (!spectacleFlags.globalTape) return null;
  const rows = query.data || [];
  if (!rows.length && !query.isLoading) return null;

  return (
    <section className={styles.tape} aria-label={t("prediction.liveTape")}>
      <div className={styles.tapeHead}>
        <span className={styles.tapeLive}>{t("prediction.live")}</span>
        <span className={styles.tapeTitle}>{t("prediction.liveTape")}</span>
      </div>
      <div className={styles.tapeTrack}>
        {rows.length === 0 ? (
          <span className={styles.tapeEmpty}>{t("prediction.activityEmpty")}</span>
        ) : (
          rows.map((row) => {
            const title = pickPredictionText(
              row.event.title,
              row.event.titleEn,
              locale,
            );
            const label =
              pickPredictionText(row.outcomeLabel, row.outcomeLabelEn, locale) ||
              row.outcomeKey;
            const usd = predictionStakeToUsdClient(row.stake, row.currencyCode);
            return (
              <Link
                className={styles.tapeItem}
                href={`/markets/${row.event.slug}`}
                key={row.id}
              >
                <strong>{row.trader}</strong>
                <span>
                  {t("prediction.activityBought", { label })} ·{" "}
                  {formatPredictionVolumeUsd(usd)}
                </span>
                <em>{title}</em>
                <time>{relativeTime(row.createdAt, t)}</time>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

export function MarketsLeaderboard() {
  const { t, locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const query = useQuery({
    enabled: spectacleFlags.leaderboard,
    queryFn: () => fetchPredictionLeaderboard(8),
    queryKey: ["prediction-leaderboard"],
    refetchInterval: 60_000,
  });

  if (!spectacleFlags.leaderboard) return null;
  const rows = query.data || [];
  if (!rows.length) return null;

  return (
    <section className={styles.leaders} aria-label={t("prediction.leaderboard")}>
      <div className={styles.leadersHead}>
        <h2 className={styles.leadersTitle}>{t("prediction.leaderboard")}</h2>
        <span className={styles.leadersHint}>{t("prediction.leaderboardHint")}</span>
      </div>
      <ol className={styles.leadersList}>
        {rows.map((row, i) => (
          <li key={row.userId}>
            <Link
              className={styles.leaderRow}
              href={traderProfileHref({
                nickname: row.trader.startsWith("u") && row.trader === `u${row.userId}`
                  ? null
                  : row.trader,
                userId: row.userId,
              })}
            >
              <span className={styles.leaderRank}>{i + 1}</span>
              <span className={styles.leaderName}>{row.trader}</span>
              <span className={styles.leaderMeta}>
                {row.bets} · {row.winRate != null ? `${row.winRate}%` : "—"}
              </span>
              <span
                className={
                  row.pnlUsd >= 0 ? styles.leaderPnlUp : styles.leaderPnlDown
                }
              >
                {row.pnlUsd >= 0 ? "+" : ""}
                {row.pnlUsd.toLocaleString(intlLocale, {
                  maximumFractionDigits: 0,
                })}
                $
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
