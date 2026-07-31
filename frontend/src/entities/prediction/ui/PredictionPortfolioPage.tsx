"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { toIntlLocale } from "~/shared/i18n/format";
import { useLocale } from "~/shared/model/useLocale";

import {
  type PredictionBetDto,
  fetchMyPredictionBets,
} from "../api/client";
import { pickPredictionText } from "../lib/i18nText";
import { spectacleFlags } from "../lib/spectacleFlags";
import styles from "./Prediction.module.css";

function betStatusLabel(
  status: PredictionBetDto["status"],
  t: (k: string) => string,
) {
  if (status === "WIN") return t("prediction.betStatusWin");
  if (status === "LOSE") return t("prediction.betStatusLose");
  if (status === "VOID") return t("prediction.betStatusVoid");
  return t("prediction.betStatusPending");
}

export function PredictionPortfolioPage() {
  const { t, locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const isAuth = Boolean(getSessionClient());

  const query = useQuery({
    enabled: isAuth && spectacleFlags.portfolioBookmarks,
    queryFn: () => fetchMyPredictionBets(100),
    queryKey: ["prediction-my-bets"],
    refetchInterval: 15_000,
  });

  const bets = query.data || [];
  const pending = bets.filter((b) => b.status === "PENDING");
  const closed = bets.filter((b) => b.status !== "PENDING");

  if (!spectacleFlags.portfolioBookmarks) {
    return (
      <div className={styles.hub}>
        <p className={styles.empty}>{t("prediction.empty")}</p>
      </div>
    );
  }

  return (
    <div className={styles.hub}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <Link className={styles.back} href="/markets">
            <span className={styles.backArrow}>‹</span>
            {t("nav.markets")}
          </Link>
          <h1 className={styles.title}>{t("prediction.portfolioTitle")}</h1>
          <p className={styles.subtitle}>{t("prediction.portfolioSubtitle")}</p>
        </div>
      </header>

      {!isAuth ? (
        <div className={styles.empty}>{t("prediction.loginToBet")}</div>
      ) : query.isLoading ? (
        <div className={styles.empty}>{t("prediction.loading")}</div>
      ) : bets.length === 0 ? (
        <div className={styles.empty}>{t("prediction.portfolioEmpty")}</div>
      ) : (
        <>
          <h2 className={styles.pmSectionTitle}>
            {t("prediction.profileActive")} · {pending.length}
          </h2>
          <div className={styles.portfolioList}>
            {pending.length === 0 ? (
              <p className={styles.pmInfoBody}>
                {t("prediction.profilePositionsEmpty")}
              </p>
            ) : (
              pending.map((bet) => <PortfolioRow bet={bet} key={bet.id} />)
            )}
          </div>

          <h2 className={styles.pmSectionTitle} style={{ marginTop: 28 }}>
            {t("prediction.profileClosed")} · {closed.length}
          </h2>
          <div className={styles.portfolioList}>
            {closed.length === 0 ? (
              <p className={styles.pmInfoBody}>
                {t("prediction.profileClosedEmpty")}
              </p>
            ) : (
              closed.map((bet) => <PortfolioRow bet={bet} key={bet.id} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PortfolioRow({ bet }: { bet: PredictionBetDto }) {
  const { t, locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const title = bet.event
    ? pickPredictionText(bet.event.title, bet.event.titleEn, locale)
    : `#${bet.eventId}`;
  const side =
    pickPredictionText(bet.outcomeLabel, bet.outcomeLabelEn, locale) ||
    bet.outcomeKey ||
    "—";
  const href = bet.event?.slug ? `/markets/${bet.event.slug}` : "/markets";

  return (
    <Link className={styles.portfolioRow} href={href}>
      <div className={styles.portfolioMain}>
        <span className={styles.portfolioTitle}>{title}</span>
        <span className={styles.portfolioMeta}>
          {side} · {bet.stake.toLocaleString(intlLocale)} {bet.currencyCode} @{" "}
          {bet.odds.toFixed(2)}
        </span>
      </div>
      <div className={styles.portfolioSide}>
        <span
          className={
            bet.status === "WIN"
              ? styles.portfolioWin
              : bet.status === "LOSE"
                ? styles.portfolioLose
                : styles.portfolioPending
          }
        >
          {betStatusLabel(bet.status, t)}
        </span>
        <span className={styles.portfolioPayout}>
          {bet.potentialPayout.toLocaleString(intlLocale)} {bet.currencyCode}
        </span>
      </div>
    </Link>
  );
}
