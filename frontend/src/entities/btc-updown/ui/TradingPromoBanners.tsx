"use client";

import Image from "next/image";
import Link from "next/link";

import { LiveIcon } from "~/shared/assets";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./TradingPromoBanners.module.css";

const HERO_IMG = "/images/trading-hero-banner.png";

export function TradingPromoBanners() {
  const { t } = useLocale();

  return (
    <div className={styles.group}>
      <Link href="/trading/btc?round=300000" className={styles.hero}>
        <Image
          src={HERO_IMG}
          alt=""
          fill
          sizes="(max-width: 767px) 100vw, 960px"
          className={styles.heroImg}
          priority
        />
        <div className={styles.heroScrim} aria-hidden />
        <div className={styles.heroContent}>
          <div className={styles.heroTitleRow}>
            <p className={styles.heroTitle}>{t("trading.promoHeroTitle")}</p>
            <span className={styles.liveBadge}>
              <LiveIcon className={styles.liveIcon} />
            </span>
          </div>
          <p className={styles.heroSub}>{t("trading.promoHeroSub")}</p>
          <span className={styles.heroCta}>{t("trading.promoHeroCta")}</span>
        </div>
      </Link>

      <div className={styles.promoRow}>
        <Link
          href="/trading/eth?round=300000"
          className={`${styles.mini} ${styles.miniEth}`}
        >
          <div className={styles.miniContent}>
            <div className={styles.miniTitleRow}>
              <p className={styles.miniTitle}>{t("trading.promoEthTitle")}</p>
              <span className={styles.miniTag}>ETH</span>
            </div>
            <p className={styles.miniSub}>{t("trading.promoEthSub")}</p>
          </div>
          <div className={styles.miniArt}>
            <Image
              src="/images/eth-logo.png"
              alt=""
              width={72}
              height={72}
              className={styles.miniLogo}
            />
            <span className={`${styles.dirChip} ${styles.dirUp}`}>↑</span>
            <span className={`${styles.dirChip} ${styles.dirDown}`}>↓</span>
          </div>
        </Link>

        <Link
          href="/trading/sol?round=300000"
          className={`${styles.mini} ${styles.miniSol}`}
        >
          <div className={styles.miniContent}>
            <div className={styles.miniTitleRow}>
              <p className={styles.miniTitle}>{t("trading.promoSolTitle")}</p>
              <span className={styles.miniTag}>×1.80</span>
            </div>
            <p className={styles.miniSub}>{t("trading.promoSolSub")}</p>
          </div>
          <div className={styles.miniArt}>
            <Image
              src="/images/sol-logo.png"
              alt=""
              width={72}
              height={72}
              className={styles.miniLogo}
            />
            <span className={styles.spark} aria-hidden />
          </div>
        </Link>
      </div>
    </div>
  );
}
