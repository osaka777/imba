"use client";

import Link from "next/link";

import { TelegramSvgrepoIcon } from "~/shared/assets/icons";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./TelegramConnectBanner.module.css";

type TelegramConnectBannerProps = {
  onDismiss?: () => void;
  compact?: boolean;
};

export function TelegramConnectBanner({ onDismiss, compact = false }: TelegramConnectBannerProps) {
  const { t } = useLocale();

  return (
    <section className={compact ? styles.bannerCompact : styles.banner}>
      <div className={styles.iconWrap}>
        <TelegramSvgrepoIcon />
      </div>
      <div className={styles.text}>
        <p className={styles.title}>{t("profile.tgBannerTitle")}</p>
        <p className={styles.desc}>{t("profile.tgBannerDesc")}</p>
      </div>
      <div className={styles.actions}>
        <Link className={styles.linkBtn} href="/profile/settings?connectTelegram=1">
          {t("profile.tgBannerConnect")}
        </Link>
        {onDismiss ? (
          <button className={styles.dismissBtn} onClick={onDismiss} type="button">
            {t("common.later")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
