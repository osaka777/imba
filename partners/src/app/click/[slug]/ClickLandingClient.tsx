"use client";

import { useEffect, useState } from "react";

import styles from "../click-landing.module.css";

export type ClickLandingData = {
  found: boolean;
  channelSlug: string;
  channelTitle?: string | null;
  channelAvatarUrl?: string | null;
  channelDisplayName?: string | null;
  channelBannerUrl?: string | null;
  channelDescription?: string | null;
  categoryName?: string | null;
  streamThumbnail?: string | null;
  viewerCount?: number | null;
  isLive?: boolean;
  streamTitle?: string | null;
  promoCode?: string | null;
  redirectUrl?: string;
};

type Props = {
  data: ClickLandingData;
};

const REDIRECT_OFFLINE_MS = 2800;
const REDIRECT_LIVE_MS = 5200;

function channelInitial(slug: string) {
  const clean = slug.replace(/^@/, "").trim();
  return (clean[0] ?? "?").toUpperCase();
}

function formatViewers(count: number) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  }
  return String(count);
}

export function ClickLandingClient({ data }: Props) {
  const redirectMs = data.isLive ? REDIRECT_LIVE_MS : REDIRECT_OFFLINE_MS;
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(redirectMs / 1000));

  useEffect(() => {
    if (!data.found || !data.redirectUrl) return undefined;

    const started = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((redirectMs - (Date.now() - started)) / 1000));
      setSecondsLeft(left);
    }, 200);

    const timer = window.setTimeout(() => {
      window.location.href = data.redirectUrl!;
    }, redirectMs);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(tick);
    };
  }, [data.found, data.redirectUrl, redirectMs]);

  if (!data.found || !data.redirectUrl) {
    return (
      <div className={styles.page}>
        <div className={styles.bgGrid} aria-hidden />
        <div className={styles.bgGlowA} aria-hidden />
        <div className={styles.bgGlowB} aria-hidden />

        <main className={styles.shell}>
          <div className={`${styles.card} ${styles.cardError}`}>
            <div className={styles.errorIconWrap} aria-hidden>
              <span className={styles.errorIcon}>?</span>
            </div>
            <h1 className={styles.errorTitle}>Ссылка не найдена</h1>
            <p className={styles.errorText}>
              Канал <span className={styles.channelTag}>@{data.channelSlug || "unknown"}</span> ещё
              не подключён к партнёрской программе.
            </p>
            <div className={styles.actions}>
              <a className={styles.ctaPrimary} href="https://kick.imba.bet">
                Стать партнёром
              </a>
              <a className={styles.ctaGhost} href="https://imba.bet">
                На imba.bet
              </a>
            </div>
          </div>
          <p className={styles.footerNote}>imbalance.click</p>
        </main>
      </div>
    );
  }

  const channelLabel = data.channelSlug.replace(/^@/, "");
  const displayName = data.channelDisplayName?.trim() || channelLabel;
  const isLive = Boolean(data.isLive);
  const subtitle =
    isLive && data.streamTitle
      ? data.streamTitle
      : "Ставки на киберспорт с бонусом по ссылке стримера";

  const perks = isLive && data.categoryName
    ? [data.categoryName, "Быстрая регистрация", "Бонус новичкам"]
    : ["Live CS & Dota", "Быстрая регистрация", "Бонус новичкам"];

  const bgImage = isLive ? data.streamThumbnail : data.channelBannerUrl;

  return (
    <div className={styles.page}>
      <div className={styles.bgGrid} aria-hidden />
      <div className={styles.bgGlowA} aria-hidden />
      <div className={styles.bgGlowB} aria-hidden />
      <div className={styles.bgGlowC} aria-hidden />

      <main className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            imba<span className={styles.brandDot}>.</span>bet
          </div>
          {isLive ? (
            <span className={styles.livePill}>
              <span className={styles.liveDot} aria-hidden />
              LIVE
              {typeof data.viewerCount === "number" && data.viewerCount > 0 ? (
                <span className={styles.liveViewers}>
                  {formatViewers(data.viewerCount)}
                </span>
              ) : null}
            </span>
          ) : (
            <span className={styles.kickPill}>KICK</span>
          )}
        </header>

        <div className={`${styles.card} ${isLive ? styles.cardLive : ""}`}>
          {bgImage ? (
            <div
              className={styles.cardBackdrop}
              style={{ backgroundImage: `url(${bgImage})` }}
              aria-hidden
            />
          ) : null}

          <div className={styles.cardInner}>
            <div className={`${styles.avatarRing} ${isLive ? styles.avatarRingLive : ""}`}>
              {data.channelAvatarUrl ? (
                <img
                  className={styles.avatarImg}
                  src={data.channelAvatarUrl}
                  alt={`@${channelLabel}`}
                  width={82}
                  height={82}
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div className={styles.avatar}>{channelInitial(channelLabel)}</div>
              )}
            </div>

            <p className={styles.eyebrow}>
              {isLive ? "Стример в эфире" : "Персональное приглашение"}
            </p>
            <h1 className={styles.title}>
              <span className={styles.channelName}>{displayName}</span>
              <span className={styles.titleMuted}>приглашает на imba.bet</span>
            </h1>

            <p className={styles.subtitle}>{subtitle}</p>

            {data.promoCode ? (
              <div className={styles.promoBox}>
                <span className={styles.promoLabel}>Промокод стримера</span>
                <span className={styles.promoCode}>{data.promoCode.toUpperCase()}</span>
              </div>
            ) : null}

            <ul className={styles.perks}>
              {perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>

            <div className={styles.redirectBar}>
              <div className={styles.redirectTrack}>
                <div
                  className={styles.redirectFill}
                  style={{ animationDuration: `${redirectMs}ms` }}
                />
              </div>
              <span className={styles.redirectLabel}>
                Переход через {secondsLeft} сек…
              </span>
            </div>

            <div className={styles.actions}>
              <a className={styles.ctaPrimary} href={data.redirectUrl}>
                Перейти на imba.bet
                <span className={styles.ctaArrow} aria-hidden>→</span>
              </a>
              <a className={styles.ctaGhost} href={data.redirectUrl}>
                Открыть вручную
              </a>
            </div>
          </div>
        </div>

        <p className={styles.footerNote}>
          Официальный партнёрский переход · imbalance.click
        </p>
      </main>
    </div>
  );
}
