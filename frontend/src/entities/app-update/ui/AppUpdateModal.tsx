"use client";

import Image from "next/image";

import { APP_BRAND_LOGO_ALT, APP_BRAND_LOGO_SRC } from "~/shared/lib/appBrandLogo";
import type { AndroidAppManifest } from "~/entities/app-update/lib/androidManifest";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./AppUpdateModal.module.css";

type AppUpdateModalProps = {
  manifest: AndroidAppManifest;
  installedVersion: string;
  onUpdate: () => void;
  onLater: () => void;
};

export function AppUpdateModal({
  manifest,
  installedVersion,
  onUpdate,
  onLater,
}: AppUpdateModalProps) {
  const { t } = useLocale();
  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
    >
      <div className={styles.card}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.top}>
          <div className={styles.logoWrap}>
            <Image
              alt={APP_BRAND_LOGO_ALT}
              className={styles.logo}
              height={36}
              src={APP_BRAND_LOGO_SRC}
              width={72}
              unoptimized
            />
          </div>
          <div className={styles.headText}>
            <span className={styles.badge}>
              NEW · v{manifest.version}
            </span>
            <h2 className={styles.title} id="app-update-title">
              {manifest.title}
            </h2>
            <p className={styles.subtitle}>{manifest.subtitle}</p>
          </div>
        </div>

        <div className={styles.meta}>
          <span className={styles.metaItem}>
            {t("common.youHave")}
            {" "}
            <strong>v{installedVersion}</strong>
          </span>
          <span className={styles.metaSep} aria-hidden />
          <span className={styles.metaItem}>
            {t("common.currentVersion")}
            {" "}
            <strong>v{manifest.version}</strong>
          </span>
        </div>

        {manifest.highlights?.length ? (
          <ul className={styles.list}>
            {manifest.highlights.map((item) => (
              <li className={styles.item} key={item}>
                <span className={styles.dot} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        ) : null}

        <div className={styles.actions}>
          <button className={styles.primary} onClick={onUpdate} type="button">
            {manifest.cta || t("common.updateNow")}
          </button>
          <button className={styles.secondary} onClick={onLater} type="button">
            {manifest.later || t("common.later")}
          </button>
        </div>
      </div>
    </div>
  );
}
