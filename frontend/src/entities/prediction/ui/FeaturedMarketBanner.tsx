"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useLocale } from "~/shared/model/useLocale";

import {
  type PredictionEventDto,
  fetchPredictionEvents,
  formatChanceCents,
  formatPredictionVolumeUsd,
} from "../api/client";
import { pickPredictionText } from "../lib/i18nText";
import { resolvePredictionMediaUrl } from "../lib/mediaUrl";
import styles from "./FeaturedMarketBanner.module.css";

function pickFeatured(events: PredictionEventDto[]): PredictionEventDto[] {
  return [...events]
    .filter((e) => e.status === "OPEN" || e.status === "LOCKED")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
      const score = (e: PredictionEventDto) =>
        (e.videoUrl ? 4 : 0) +
        (e.bannerUrl || e.imageUrl ? 2 : 0) +
        Math.min(1, (e.pool?.totalStake ?? 0) / 100_000);
      return score(b) - score(a);
    })
    .slice(0, 3);
}

function youtubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "");
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1` : null;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1`;
      const parts = u.pathname.split("/");
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        return `https://www.youtube.com/embed/${parts[embedIdx + 1]}?autoplay=1&mute=1&playsinline=1`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function twitchEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("twitch.tv")) return null;
    const parent =
      typeof window !== "undefined" ? window.location.hostname : "imba.bet";
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "videos" && parts[1]) {
      return `https://player.twitch.tv/?video=${parts[1]}&parent=${parent}&autoplay=true&muted=true`;
    }
    if (parts[0]) {
      return `https://player.twitch.tv/?channel=${parts[0]}&parent=${parent}&autoplay=true&muted=true`;
    }
  } catch {
    return null;
  }
  return null;
}

function kickEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("kick.com")) return null;
    const channel = u.pathname.split("/").filter(Boolean)[0];
    if (!channel) return null;
    return `https://player.kick.com/${channel}?autoplay=true&muted=true`;
  } catch {
    return null;
  }
}

function resolveEmbedSrc(raw: string): { kind: "iframe" | "video"; src: string } | null {
  const resolved = resolvePredictionMediaUrl(raw) || raw.trim();
  if (!resolved) return null;
  const yt = youtubeEmbed(resolved);
  if (yt) return { kind: "iframe", src: yt };
  const tw = twitchEmbed(resolved);
  if (tw) return { kind: "iframe", src: tw };
  const kick = kickEmbed(resolved);
  if (kick) return { kind: "iframe", src: kick };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(resolved) || resolved.includes("/uploads/")) {
    return { kind: "video", src: resolved };
  }
  if (resolved.startsWith("http")) {
    // Generic embed URL (already an embed endpoint)
    if (/embed|player\./i.test(resolved)) return { kind: "iframe", src: resolved };
    return { kind: "video", src: resolved };
  }
  return { kind: "video", src: resolved };
}

function FeaturedMedia({
  event,
}: {
  event: PredictionEventDto;
}) {
  const poster =
    resolvePredictionMediaUrl(event.bannerUrl) ||
    resolvePredictionMediaUrl(event.imageUrl);
  const embed = event.videoUrl ? resolveEmbedSrc(event.videoUrl) : null;

  if (embed?.kind === "iframe") {
    return (
      <div className={styles.media}>
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className={styles.mediaFrame}
          src={embed.src}
          title="stream"
        />
      </div>
    );
  }

  if (embed?.kind === "video") {
    return (
      <div className={styles.media}>
        <video
          autoPlay
          className={styles.mediaVideo}
          controls
          loop
          muted
          playsInline
          poster={poster || undefined}
          src={embed.src}
        />
      </div>
    );
  }

  if (poster) {
    return (
      <div className={styles.media}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className={styles.mediaImg} src={poster} />
        <div className={styles.mediaFade} />
      </div>
    );
  }

  return (
    <div className={styles.media}>
      <div aria-hidden className={styles.mediaFallback} />
    </div>
  );
}

function FeaturedSlide({ event }: { event: PredictionEventDto }) {
  const { t, locale } = useLocale();
  const title = pickPredictionText(event.title, event.titleEn, locale);
  const a = event.outcomes[0];
  const b = event.outcomes[1];
  const labelA =
    pickPredictionText(a?.label, a?.labelEn, locale) || t("prediction.yes");
  const labelB =
    pickPredictionText(b?.label, b?.labelEn, locale) || t("prediction.no");
  const shareA = a?.sharePct ?? 50;
  const shareB = Math.max(0, 100 - shareA);
  const total = event.pool?.totalStake ?? 0;
  const category =
    !event.category || event.category === "other"
      ? t("prediction.categoryDefault")
      : event.category;

  return (
    <article className={styles.card}>
      <FeaturedMedia event={event} />

      <div className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.meta}>
            <span>
              {formatPredictionVolumeUsd(total)} {t("prediction.volume")}
            </span>
            <span className={styles.metaSep}>·</span>
            <span>{category}</span>
          </div>

          <h2 className={styles.title}>
            <Link className={styles.titleLink} href={`/markets/${event.slug}`}>
              {title}
            </Link>
          </h2>

          <div className={styles.outcomes}>
            <Link
              className={styles.outcomeRow}
              href={`/markets/${event.slug}`}
            >
              <div className={styles.outcomeLeft}>
                <span className={styles.outcomeName}>{labelA}</span>
                <div className={styles.outcomeBarTrack}>
                  <div
                    className={`${styles.outcomeBarFill} ${styles.outcomeBarYes}`}
                    style={{ width: `${Math.max(shareA, 4)}%` }}
                  />
                </div>
              </div>
              <span className={styles.outcomeOdds}>
                {a ? `${a.odds.toFixed(2)}x` : "—"}
              </span>
              <span className={`${styles.outcomePct} ${styles.outcomePctYes}`}>
                {formatChanceCents(shareA)}
              </span>
            </Link>

            <Link
              className={styles.outcomeRow}
              href={`/markets/${event.slug}`}
            >
              <div className={styles.outcomeLeft}>
                <span className={styles.outcomeName}>{labelB}</span>
                <div className={styles.outcomeBarTrack}>
                  <div
                    className={`${styles.outcomeBarFill} ${styles.outcomeBarNo}`}
                    style={{ width: `${Math.max(shareB, 4)}%` }}
                  />
                </div>
              </div>
              <span className={styles.outcomeOdds}>
                {b ? `${b.odds.toFixed(2)}x` : "—"}
              </span>
              <span className={`${styles.outcomePct} ${styles.outcomePctNo}`}>
                {formatChanceCents(shareB)}
              </span>
            </Link>
          </div>

          <Link className={styles.cta} href={`/markets/${event.slug}`}>
            {t("prediction.tradeNow")}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function FeaturedMarketBanner({
  variant = "home",
}: {
  /** `hub` = embedded on /markets (no “browse all” link, auto-rotate). */
  variant?: "home" | "hub";
}) {
  const { t } = useLocale();
  const [index, setIndex] = useState(0);

  const query = useQuery({
    queryFn: () => fetchPredictionEvents(),
    queryKey: ["prediction-events", "home-featured"],
    refetchInterval: 12_000,
    staleTime: 8_000,
  });

  const featured = useMemo(
    () => pickFeatured(query.data || []),
    [query.data],
  );

  useEffect(() => {
    setIndex(0);
  }, [featured.length]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (featured.length < 2) return;
      setIndex((i) => (i + dir + featured.length) % featured.length);
    },
    [featured.length],
  );

  useEffect(() => {
    if (variant !== "hub" || featured.length < 2) return;
    const id = window.setInterval(() => go(1), 9_000);
    return () => window.clearInterval(id);
  }, [variant, featured.length, go]);

  if (query.isLoading || featured.length === 0) return null;

  const current = featured[Math.min(index, featured.length - 1)]!;

  return (
    <section className={styles.wrap} aria-label={t("prediction.featured")}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <p className={styles.brand}>{t("prediction.featured")}</p>
          {variant === "home" ? (
            <Link className={styles.browse} href="/markets">
              {t("prediction.browseAll")}
            </Link>
          ) : null}
        </div>
        {featured.length > 1 ? (
          <div className={styles.nav}>
            <button
              aria-label="prev"
              className={styles.navBtn}
              onClick={() => go(-1)}
              type="button"
            >
              ‹
            </button>
            <button
              aria-label="next"
              className={styles.navBtn}
              onClick={() => go(1)}
              type="button"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.stage}>
        <FeaturedSlide event={current} key={current.id} />
        {featured.length > 1 ? (
          <div className={styles.dots} role="tablist">
            {featured.map((e, i) => (
              <button
                aria-label={String(i + 1)}
                aria-selected={i === index}
                className={i === index ? styles.dotOn : styles.dot}
                key={e.id}
                onClick={() => setIndex(i)}
                type="button"
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
