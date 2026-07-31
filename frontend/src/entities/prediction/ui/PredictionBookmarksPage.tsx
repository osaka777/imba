"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { useCurrency } from "~/shared/model/useCurrency";
import { useLocale } from "~/shared/model/useLocale";

import {
  type PredictionEventDto,
  fetchMyPredictionBookmarks,
  formatChanceCents,
  formatPredictionVolumeUsd,
} from "../api/client";
import { pickPredictionText } from "../lib/i18nText";
import { resolvePredictionMediaUrl } from "../lib/mediaUrl";
import { spectacleFlags } from "../lib/spectacleFlags";
import styles from "./Prediction.module.css";

export function PredictionBookmarksPage() {
  const { t, locale } = useLocale();
  const { currency } = useCurrency();
  const currencyCode = (currency || "KZT").toUpperCase();
  const isAuth = Boolean(getSessionClient());

  const query = useQuery({
    enabled: isAuth && spectacleFlags.portfolioBookmarks,
    queryFn: () => fetchMyPredictionBookmarks(),
    queryKey: ["prediction-bookmarks"],
    refetchInterval: 20_000,
  });

  const events = query.data || [];

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
          <h1 className={styles.title}>{t("prediction.bookmarksTitle")}</h1>
          <p className={styles.subtitle}>{t("prediction.bookmarksSubtitle")}</p>
        </div>
      </header>

      {!isAuth ? (
        <div className={styles.empty}>{t("prediction.loginToBet")}</div>
      ) : query.isLoading ? (
        <div className={styles.empty}>{t("prediction.loading")}</div>
      ) : events.length === 0 ? (
        <div className={styles.empty}>{t("prediction.bookmarksEmpty")}</div>
      ) : (
        <div className={styles.grid}>
          {events.map((event, index) => (
            <BookmarkCard
              currencyCode={currencyCode}
              event={event}
              index={index}
              key={event.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookmarkCard({
  event,
  index,
  currencyCode,
}: {
  event: PredictionEventDto;
  index: number;
  currencyCode: string;
}) {
  const { t, locale } = useLocale();
  const title = pickPredictionText(event.title, event.titleEn, locale);
  const chance = Math.round(event.outcomes[0]?.sharePct ?? 50);
  const imageSrc = resolvePredictionMediaUrl(event.imageUrl);
  const initial = (title.trim()[0] || "?").toUpperCase();

  return (
    <Link
      className={styles.card}
      href={`/markets/${event.slug}`}
      style={{ ["--i" as string]: index }}
    >
      <div className={styles.cardTop}>
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className={styles.avatarImg} src={imageSrc} />
        ) : (
          <div aria-hidden className={styles.avatar}>
            {initial}
          </div>
        )}
        <div className={styles.cardBody}>
          <h2 className={styles.marketTitle}>{title}</h2>
          <p className={styles.meta}>
            <span>
              {formatPredictionVolumeUsd(event.pool?.totalStake ?? 0)}{" "}
              {t("prediction.volume")}
            </span>
          </p>
        </div>
        <div className={styles.chanceBlock}>
          <div className={styles.chancePct}>{chance}%</div>
          <div className={styles.chanceLabel}>
            {formatChanceCents(chance, currencyCode)}
          </div>
        </div>
      </div>
    </Link>
  );
}
