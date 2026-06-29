"use client";

import React, { useState } from "react";
import Image from "next/image";

import { LiveIcon } from "~/shared/assets";
import { usePromoModalSettings } from "~/entities/promo-modal/lib/usePromoModalSettings";
import { cn } from "~/shared/lib";
import { LazyLuckyDriveModal, LazyUsdtPromoModal } from "~/shared/lib/lazyModals";
import { Button } from "~/shared/ui";

import { LUCKY_DRIVE_IMAGE } from "./luckyDriveImage";
import {
  USDT_PROMO_GRADIENT_FROM,
  USDT_PROMO_GRADIENT_TO,
  USDT_PROMO_HIGHLIGHT,
  USDT_PROMO_IMAGE,
  USDT_PROMO_SUBTITLE,
  USDT_PROMO_TITLE,
} from "./usdtPromoCopy";
import { PromoMiniBanner } from "./PromoMiniBanner";
import styles from "./LuckyDriveBanner.module.css";

type LuckyDriveBannerProps = {
  compact?: boolean;
  placement?: 'home' | 'live' | 'line';
};

export const LuckyDriveBanner = ({ compact = false, placement = 'home' }: LuckyDriveBannerProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUsdtModalOpen, setIsUsdtModalOpen] = useState(false);
  const { settings, enabled } = usePromoModalSettings();

  const placementEnabled =
    placement === 'home'
      ? settings?.showOnHome !== false
      : placement === 'live'
        ? settings?.showOnLive !== false
        : settings?.showOnLine !== false;

  if (!enabled || !placementEnabled) return null;

  const title = settings?.bannerTitle || "World Cup";
  const subtitle = settings?.bannerSubtitle || "Бонус на первый депозит";
  const image = settings?.bannerImageUrl || LUCKY_DRIVE_IMAGE;
  const gradientStyle = settings
    ? {
        backgroundImage: `linear-gradient(143deg, ${settings.gradientFrom} 0.74%, ${settings.gradientTo} 141.93%)`,
      }
    : undefined;

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalOpen(true);
  };

  return (
    <>
      <div className={cn(styles.bannerGroup, compact && styles.bannerGroupCompact)}>
        <Button
          className={cn(styles.root, compact && styles.rootCompact)}
          onClick={openModal}
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
              {settings?.bonusHighlight ? (
                <span className={styles.bonusTag}>{settings.bonusHighlight}</span>
              ) : null}
            </div>
            <Image src={image} alt={title} className={styles.image} loading="lazy" width={160} height={80} />
          </div>
        </Button>

        <div className={styles.promoRow}>
          <PromoMiniBanner
            title={USDT_PROMO_TITLE}
            subtitle={USDT_PROMO_SUBTITLE}
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
            title="Free Money"
            subtitle="Бонусы и розыгрыши"
            highlight="NEW"
            href="/profile/promocodes"
            gradientFrom="#C084FC"
            gradientTo="#7C3AED"
            imageSrc="/bonus.png"
          />
        </div>
      </div>
      {isModalOpen ? (
        <LazyLuckyDriveModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      ) : null}
      {isUsdtModalOpen ? (
        <LazyUsdtPromoModal isOpen={isUsdtModalOpen} onClose={() => setIsUsdtModalOpen(false)} />
      ) : null}
    </>
  );
};
