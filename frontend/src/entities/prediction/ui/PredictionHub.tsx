"use client";

import type { CSSProperties } from "react";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { toIntlLocale } from "~/shared/i18n/format";
import { useCurrency } from "~/shared/model/useCurrency";
import { useLocale } from "~/shared/model/useLocale";

import {
  type PredictionEventDto,
  fetchPredictionEvents,
  formatChanceCents,
  formatPredictionVolumeUsd,
} from "../api/client";
import { pickPredictionText } from "../lib/i18nText";
import { resolvePredictionMediaUrl } from "../lib/mediaUrl";
import { spectacleFlags } from "../lib/spectacleFlags";
import { ChanceSparkline, useChanceSparkline } from "./ChanceSparkline";
import { FeaturedMarketBanner } from "./FeaturedMarketBanner";
import {
  MarketsLeaderboard,
  MarketsTradeTape,
} from "./MarketsSpectacleRail";
import styles from "./Prediction.module.css";

type SortKey = "volume" | "closing" | "chance";

function formatCloses(closesAt: null | string, intlLocale: string) {
  if (!closesAt) return null;
  return new Date(closesAt).toLocaleString(intlLocale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function isClosingSoon(closesAt: string | null) {
  if (!closesAt) return false;
  const ms = new Date(closesAt).getTime() - Date.now();
  return ms > 0 && ms <= 24 * 60 * 60 * 1000;
}

function isHot(event: PredictionEventDto) {
  const vol = event.pool?.totalStake ?? 0;
  const share = event.outcomes[0]?.sharePct ?? 50;
  return vol >= 500 || share >= 75 || share <= 25;
}

function isNew(event: PredictionEventDto) {
  if (!event.createdAt) return false;
  const created = new Date(event.createdAt).getTime();
  return Date.now() - created < 3 * 24 * 60 * 60 * 1000;
}

function EventCard({
  event,
  index,
}: {
  event: PredictionEventDto;
  index: number;
}) {
  const { t, locale } = useLocale();
  const { currency } = useCurrency();
  const currencyCode = (currency || "KZT").toUpperCase();
  const intlLocale = toIntlLocale(locale);
  const title = pickPredictionText(event.title, event.titleEn, locale);
  const a = event.outcomes[0];
  const b = event.outcomes[1];
  const labelA =
    pickPredictionText(a?.label, a?.labelEn, locale) || t("prediction.yes");
  const labelB =
    pickPredictionText(b?.label, b?.labelEn, locale) || t("prediction.no");
  const chanceA = a?.sharePct ?? 50;
  const chanceB = Math.max(0, 100 - chanceA);
  const chance = Math.round(chanceA);
  const total = event.pool?.totalStake ?? 0;
  const closes = formatCloses(event.closesAt, intlLocale);

  const sparkPoints = useChanceSparkline(event.id, chanceA);
  const prevChance = useRef(chanceA);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!spectacleFlags.priceFlash) return;
    const prev = prevChance.current;
    if (chanceA === prev) return;
    setFlash(chanceA > prev ? "up" : "down");
    prevChance.current = chanceA;
    const id = window.setTimeout(() => setFlash(null), 700);
    return () => window.clearTimeout(id);
  }, [chanceA]);

  const initial = (title.trim()[0] || "?").toUpperCase();
  const imageSrc = resolvePredictionMediaUrl(event.imageUrl);
  const category =
    !event.category || event.category === "other"
      ? t("prediction.categoryDefault")
      : event.category;

  const tags: string[] = [];
  if (spectacleFlags.urgencyTags) {
    if (event.status === "OPEN" && isClosingSoon(event.closesAt)) {
      tags.push("closing");
    }
    if (event.status === "OPEN" && isHot(event)) tags.push("hot");
    if (event.status === "OPEN" && isNew(event)) tags.push("new");
  }

  const flashClass =
    flash === "up"
      ? styles.cardFlashUp
      : flash === "down"
        ? styles.cardFlashDown
        : "";

  return (
    <Link
      className={`${styles.card} ${flashClass}`}
      href={`/markets/${event.slug}`}
      style={{ "--i": index } as CSSProperties}
    >
      {tags.length > 0 ? (
        <div className={styles.cardTags}>
          {tags.includes("hot") ? (
            <span className={styles.tagHot}>{t("prediction.tagHot")}</span>
          ) : null}
          {tags.includes("closing") ? (
            <span className={styles.tagClosing}>
              {t("prediction.tagClosing")}
            </span>
          ) : null}
          {tags.includes("new") ? (
            <span className={styles.tagNew}>{t("prediction.tagNew")}</span>
          ) : null}
        </div>
      ) : null}

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
            <span>{category}</span>
            {closes ? (
              <>
                <span className={styles.dot} />
                <span>{closes}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className={styles.chanceBlock}>
          <div className={styles.chancePct}>{chance}%</div>
          <div className={styles.chanceLabel}>{t("prediction.chance")}</div>
          {spectacleFlags.sparklines ? (
            <ChanceSparkline
              points={sparkPoints}
              up={sparkPoints[sparkPoints.length - 1]! >= sparkPoints[0]!}
            />
          ) : null}
        </div>
      </div>

      <div className={styles.outcomeRow}>
        <div className={`${styles.outcomeBtn} ${styles.outcomeYes}`}>
          <span>{labelA}</span>
          <span className={styles.outcomePriceStack}>
            <span className={styles.outcomePrice}>
              {formatChanceCents(chanceA, currencyCode)}
            </span>
            <span className={styles.outcomeOdds}>
              {a ? a.odds.toFixed(2) : "—"}
            </span>
          </span>
        </div>
        <div className={`${styles.outcomeBtn} ${styles.outcomeNo}`}>
          <span>{labelB}</span>
          <span className={styles.outcomePriceStack}>
            <span className={styles.outcomePrice}>
              {formatChanceCents(chanceB, currencyCode)}
            </span>
            <span className={styles.outcomeOdds}>
              {b ? b.odds.toFixed(2) : "—"}
            </span>
          </span>
        </div>
      </div>

      <div className={styles.cardFoot}>
        <span className={styles.vol}>
          {formatPredictionVolumeUsd(total)} {t("prediction.volume")}
        </span>
      </div>
    </Link>
  );
}

export function PredictionHub() {
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<"all" | "open" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("volume");

  const query = useQuery({
    queryFn: () => fetchPredictionEvents(),
    queryKey: ["prediction-events"],
    refetchInterval: 8_000,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of query.data || []) {
      if (e.status === "DRAFT") continue;
      const c = e.category?.trim();
      if (c && c !== "other") set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [query.data]);

  const events = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = (query.data || [])
      .filter((e) => e.status !== "DRAFT")
      .filter((e) => {
        if (tab === "open")
          return e.status === "OPEN" || e.status === "LOCKED";
        if (tab === "resolved")
          return e.status === "SETTLED" || e.status === "VOID";
        return true;
      })
      .filter((e) => {
        if (category === "all") return true;
        return (e.category || "other") === category;
      })
      .filter((e) => {
        if (!q) return true;
        const title = pickPredictionText(e.title, e.titleEn, locale).toLowerCase();
        const cat = (e.category || "").toLowerCase();
        return title.includes(q) || cat.includes(q);
      });

    rows.sort((a, b) => {
      if (sort === "volume") {
        return (b.pool?.totalStake ?? 0) - (a.pool?.totalStake ?? 0);
      }
      if (sort === "chance") {
        return (b.outcomes[0]?.sharePct ?? 50) - (a.outcomes[0]?.sharePct ?? 50);
      }
      const ta = a.closesAt ? new Date(a.closesAt).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.closesAt ? new Date(b.closesAt).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
    return rows;
  }, [query.data, tab, search, category, sort, locale]);

  const tabs = [
    ["all", t("prediction.tabAll")],
    ["open", t("prediction.tabOpen")],
    ["resolved", t("prediction.tabResolved")],
  ] as const;

  const sorts: { id: SortKey; label: string }[] = [
    { id: "volume", label: t("prediction.sortVolume") },
    { id: "closing", label: t("prediction.sortClosing") },
    { id: "chance", label: t("prediction.sortChance") },
  ];

  return (
    <div className={styles.hub}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <p className={styles.brand}>{t("prediction.brand")}</p>
          <h1 className={styles.title}>{t("nav.markets")}</h1>
          <p className={styles.subtitle}>{t("prediction.subtitle")}</p>
        </div>
        {spectacleFlags.portfolioBookmarks ? (
          <nav className={styles.hubNav}>
            <Link className={styles.hubNavLink} href="/markets/portfolio">
              {t("prediction.portfolioTitle")}
            </Link>
            <Link className={styles.hubNavLink} href="/markets/bookmarks">
              {t("prediction.bookmarksTitle")}
            </Link>
          </nav>
        ) : null}
      </header>

      {spectacleFlags.featuredBanner ? (
        <FeaturedMarketBanner variant="hub" />
      ) : null}

      <MarketsTradeTape />

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("prediction.searchPlaceholder")}
          type="search"
          value={search}
        />
        <div className={styles.sortRow} role="group">
          {sorts.map((s) => (
            <button
              className={`${styles.chip} ${sort === s.id ? styles.chipActive : ""}`}
              key={s.id}
              onClick={() => setSort(s.id)}
              type="button"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filters}>
        {tabs.map(([key, label]) => (
          <button
            className={`${styles.chip} ${tab === key ? styles.chipActive : ""}`}
            key={key}
            onClick={() => setTab(key)}
            type="button"
          >
            {label}
          </button>
        ))}
        {categories.length > 0 ? (
          <>
            <span className={styles.filterSep} aria-hidden />
            <button
              className={`${styles.chip} ${category === "all" ? styles.chipActive : ""}`}
              onClick={() => setCategory("all")}
              type="button"
            >
              {t("prediction.allCategories")}
            </button>
            {categories.map((c) => (
              <button
                className={`${styles.chip} ${category === c ? styles.chipActive : ""}`}
                key={c}
                onClick={() => setCategory(c)}
                type="button"
              >
                {c}
              </button>
            ))}
          </>
        ) : null}
      </div>

      <div className={styles.hubBody}>
        <div className={styles.hubMain}>
          {query.isLoading ? (
            <div className={styles.empty}>{t("prediction.loading")}</div>
          ) : events.length === 0 ? (
            <div className={styles.empty}>
              {search.trim() || category !== "all"
                ? t("prediction.noResults")
                : t("prediction.empty")}
            </div>
          ) : (
            <div className={styles.grid}>
              {events.map((event, index) => (
                <EventCard event={event} index={index} key={event.id} />
              ))}
            </div>
          )}
        </div>
        <aside className={styles.hubAside}>
          <MarketsLeaderboard />
        </aside>
      </div>
    </div>
  );
}
