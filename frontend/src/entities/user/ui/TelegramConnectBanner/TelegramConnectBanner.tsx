"use client";

import Link from "next/link";

import { TelegramSvgrepoIcon } from "~/shared/assets/icons";

import styles from "./TelegramConnectBanner.module.css";

type TelegramConnectBannerProps = {
  onDismiss?: () => void;
  compact?: boolean;
};

export function TelegramConnectBanner({ onDismiss, compact = false }: TelegramConnectBannerProps) {
  return (
    <section className={compact ? styles.bannerCompact : styles.banner}>
      <div className={styles.iconWrap}>
        <TelegramSvgrepoIcon />
      </div>
      <div className={styles.text}>
        <p className={styles.title}>Привяжите Telegram</p>
        <p className={styles.desc}>
          Сброс пароля, уведомления о расчёте ставок и голах в live — за 30 секунд.
        </p>
      </div>
      <div className={styles.actions}>
        <Link className={styles.linkBtn} href="/profile/settings?connectTelegram=1">
          Подключить
        </Link>
        {onDismiss ? (
          <button className={styles.dismissBtn} onClick={onDismiss} type="button">
            Позже
          </button>
        ) : null}
      </div>
    </section>
  );
}
