"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "~/app/providers/AuthProvider";
import { LiveIcon } from "~/shared/assets";

import { usePartnerKickAttribution } from "~/entities/kick/lib/usePartnerKickAttribution";

import { kickPromoGradientStyle } from "./kickPromoTheme";
import styles from "./PartnerKickUrlBanner.module.css";

function buildRegisterUrl(betUrl: string, promoCode: string | null) {
  try {
    const url = new URL(betUrl);
    if (promoCode) {
      url.searchParams.set("promo", promoCode.toUpperCase());
    }
    return url.toString();
  } catch {
    return betUrl;
  }
}

function channelInitial(slug: string) {
  return (slug.replace(/^@/, "").trim()[0] ?? "?").toUpperCase();
}

export function PartnerKickUrlBanner() {
  const { isAuth } = useAuth();
  const { partner, isKickTraffic } = usePartnerKickAttribution(false);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const registerUrl = useMemo(
    () => (partner ? buildRegisterUrl(partner.betUrl, partner.promoCode) : ""),
    [partner],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const visible = Boolean(
    mounted && !dismissed && isKickTraffic && partner?.found && partner.channelSlug,
  );

  if (!visible || !partner) return null;

  const slug = partner.channelSlug!.replace(/^@/, "");
  const displayName =
    partner.channelDisplayName?.trim()
    || slug;

  if (isAuth) {
    return createPortal(
      <div className={styles.hostCompact}>
        <div className={`${styles.root} ${styles.rootCompact}`} style={kickPromoGradientStyle}>
          <button
            type="button"
            className={styles.close}
            aria-label="Скрыть"
            onClick={() => setDismissed(true)}
          >
            ×
          </button>

          <div className={`${styles.avatarWrap} ${styles.avatarWrapCompact}`} aria-hidden>
            {partner.channelAvatarUrl ? (
              <img
                className={styles.avatar}
                src={partner.channelAvatarUrl}
                alt=""
                width={28}
                height={28}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className={styles.avatarFallback}>{channelInitial(slug)}</span>
            )}
          </div>

          <div className={styles.content}>
            <div className={styles.titleRow}>
              <p className={styles.titleCompact}>
                Вы по ссылке {displayName}
              </p>
              {partner.isLive ? (
                <span className={styles.liveBadge}>
                  <LiveIcon className={styles.liveIcon} />
                </span>
              ) : (
                <span className={styles.partnerBadge}>партнёр</span>
              )}
            </div>
            {partner.promoCode ? (
              <p className={styles.subtitleCompact}>
                Промокод стримера · {partner.promoCode.toUpperCase()}
              </p>
            ) : null}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className={styles.host}>
      <div className={styles.root} style={kickPromoGradientStyle}>
        <button
          type="button"
          className={styles.close}
          aria-label="Скрыть"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>

        <div className={styles.avatarWrap} aria-hidden>
          {partner.channelAvatarUrl ? (
            <img
              className={styles.avatar}
              src={partner.channelAvatarUrl}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className={styles.avatarFallback}>{channelInitial(slug)}</span>
          )}
        </div>

        <div className={styles.content}>
          <div className={styles.titleRow}>
            <p className={styles.title}>
              От стримера {displayName}
            </p>
            {partner.isLive ? (
              <span className={styles.liveBadge}>
                <LiveIcon className={styles.liveIcon} />
              </span>
            ) : null}
          </div>
          <div className={styles.subtitleRow}>
            <p className={styles.subtitle}>
              {partner.isLive ? "Сейчас в эфире на Kick" : "Партнёрская ссылка imba.bet"}
            </p>
            {partner.promoCode ? (
              <span className={styles.bonusTag}>{partner.promoCode.toUpperCase()}</span>
            ) : null}
          </div>
        </div>

        <div className={styles.actions}>
          <a className={styles.ctaSecondary} href={registerUrl}>
            Регистрация
          </a>
          <a className={styles.ctaPrimary} href={partner.shortUrlImba ?? partner.betUrl}>
            Ставить
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
