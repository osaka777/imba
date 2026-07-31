"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { LiveIcon } from "~/shared/assets";
import { usePromoModalSettings } from "~/entities/promo-modal/lib/usePromoModalSettings";
import { cn } from "~/shared/lib";
import { LazyUsdtPromoModal } from "~/shared/lib/lazyModals";
import { Button } from "~/shared/ui";

import {
  IMBA_GAMES_PROMO_TITLE,
  IMBA_MARKETS_HREF,
  LUCKY_DRIVE_IMAGE,
} from "./luckyDriveImage";
import {
  USDT_PROMO_GRADIENT_FROM,
  USDT_PROMO_GRADIENT_TO,
  USDT_PROMO_HIGHLIGHT,
  USDT_PROMO_IMAGE,
  USDT_PROMO_TITLE,
} from "./usdtPromoCopy";
import {
  WIMBLEDON_PROMO_GRADIENT_FROM,
  WIMBLEDON_PROMO_GRADIENT_TO,
  WIMBLEDON_PROMO_HIGHLIGHT,
  WIMBLEDON_PROMO_HREF,
  WIMBLEDON_PROMO_IMAGE,
  WIMBLEDON_PROMO_TITLE,
} from "./wimbledonPromoCopy";
import { useLocale } from "~/shared/model/useLocale";
import { PromoMiniBanner } from "./PromoMiniBanner";
import styles from "./LuckyDriveBanner.module.css";

type LuckyDriveBannerProps = {
  compact?: boolean;
  placement?: 'home' | 'live' | 'line';
};

export const LuckyDriveBanner = ({ compact = false, placement = 'home' }: LuckyDriveBannerProps) => {
  const { t } = useLocale();
  const router = useRouter();
  const [isUsdtModalOpen, setIsUsdtModalOpen] = useState(false);
  const { settings, enabled } = usePromoModalSettings();

  const placementEnabled =
    placement === 'home'
      ? settings?.showOnHome !== false
      : placement === 'live'
        ? settings?.showOnLive !== false
        : settings?.showOnLine !== false;

  if (!enabled || !placementEnabled) return null;

  const title = settings?.bannerTitle || IMBA_GAMES_PROMO_TITLE;
  // Always localize — admin settings store Russian copy and would break other locales.
  const subtitle = t("promo.gameBannerSubtitle");
  const image = settings?.bannerImageUrl || LUCKY_DRIVE_IMAGE;
  const highlight = settings?.bonusHighlight?.trim() || "";
  const gradientStyle = settings
    ? {
        backgroundImage: `linear-gradient(143deg, ${settings.gradientFrom} 0.74%, ${settings.gradientTo} 141.93%)`,
      }
    : undefined;

  const goToMarkets = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(settings?.wcRedirectPath || IMBA_MARKETS_HREF);
  };

  return (
    <>
      <div className={cn(styles.bannerGroup, compact && styles.bannerGroupCompact)}>
        <Button
          className={cn(styles.root, compact && styles.rootCompact)}
          onClick={goToMarkets}
          style={gradientStyle}
        >
          <div className={styles.content}>
            <div className={styles.titleContainer}>
              <p className={styles.title}>{title}</p>
              <div className={styles.titleBadge}>
                <LiveIcon className={styles.icon} />
              </div>
            </div>
            <div className={styles.subtitleRow}>
              <p className={styles.subtitle}>{subtitle}</p>
              {highlight ? (
                <span className={styles.bonusTag}>{highlight}</span>
              ) : null}
            </div>
            <Image src={image} alt={title} className={styles.image} loading="lazy" width={240} height={120} />
          </div>
        </Button>

        <div className={styles.promoRow}>
          <PromoMiniBanner
            title={USDT_PROMO_TITLE}
            subtitle={t("promo.usdtBannerSubtitle")}
            highlight={USDT_PROMO_HIGHLIGHT}
            onClick={(e) => {
              e.preventDefault();
              setIsUsdtModalOpen(true);
            }}
            gradientFrom={USDT_PROMO_GRADIENT_FROM}
            gradientTo={USDT_PROMO_GRADIENT_TO}
            imageSrc={USDT_PROMO_IMAGE}
          />
          <PromoMiniBanner
            title={WIMBLEDON_PROMO_TITLE}
            subtitle={t("promo.wimbledonSubtitle")}
            highlight={WIMBLEDON_PROMO_HIGHLIGHT}
            href={WIMBLEDON_PROMO_HREF}
            gradientFrom={WIMBLEDON_PROMO_GRADIENT_FROM}
            gradientTo={WIMBLEDON_PROMO_GRADIENT_TO}
            imageSrc={WIMBLEDON_PROMO_IMAGE}
            largeImage
            showLiveBadge
          />
        </div>
      </div>
      {isUsdtModalOpen ? (
        <LazyUsdtPromoModal isOpen={isUsdtModalOpen} onClose={() => setIsUsdtModalOpen(false)} />
      ) : null}
    </>
  );
};
