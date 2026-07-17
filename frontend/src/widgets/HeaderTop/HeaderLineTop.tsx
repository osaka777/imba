'use client';

import { usePathname } from "next/navigation";
import {
  AccessIcon,
  AndroidIcon,
  LiveIcon,
  TicketIcon,
} from "~/shared/assets/icons";
import { usePromoModalSettings } from "~/entities/promo-modal/lib/usePromoModalSettings";
import { Button } from "~/shared/ui";
import { LanguageSelector } from "~/widgets/Navigation/LanguageSelector";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./HeaderLineTop.module.css";
import { LazyLuckyDriveModal } from "~/shared/lib/lazyModals";
import { useState } from "react";
import { cn } from "~/shared/lib";

export const HeaderLineTop = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { settings, enabled } = usePromoModalSettings();
  const { t } = useLocale();
  const pathname = usePathname();
  const isCybersport = pathname?.startsWith("/cybersport");
  const showHeaderPromo = enabled && settings?.showInHeader !== false;

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalOpen(true);
  };

  return (
    <div className={cn(styles.headerLineTop, isCybersport && "HeaderLineTop_cyber")}>
      <div className={styles.headerLineLeft}>
        <div className={styles.levelItem}>
          <Button
            className={`${styles.Button} ${styles.miniIcon} ${styles.themeDefault} ${styles.ttn} ${styles.headerButton}`}
            disabled
          >
            <AccessIcon className={`${styles.icon} ${styles.mobileIcon}`}/>
          </Button>
          <a
            href="/imba-bet.apk"
            download
            title={t("header.downloadApk")}
            aria-label={t("header.downloadApk")}
            className={`${styles.Button} ${styles.dfAicJcc} ${styles.miniIcon} ${styles.themeDefault} ${styles.ttn} ${styles.headerButton} ${styles.appDownloadBtn}`}
          >
            <AndroidIcon className={`${styles.icon} ${styles.mobileIcon} ${styles.androidIcon}`} />
          </a>
        </div>
        <div className={styles.divider}></div>
        {showHeaderPromo ? (
        <div className={styles.FreeMoneyLink_root_sudSD} onClick={openModal}>
          <div className={styles.FreeMoneyLink_wrapper}>
            <span className={styles.FreeMoneyLink_prefix}>
              <TicketIcon />
            </span>
            <div className={styles.FreeMoneyLink_text_wrapper}>
              <span className={styles.FreeMoneyLink_text}>{settings?.bannerTitle || "World Cup"}</span>
              <span className={styles.FreeMoneyLink_liveIcon_wrapper}>
                <LiveIcon className={styles.FreeMoneyLink_liveIcon} />
              </span>
            </div>
            <span className={styles.FreeMoneyLink_description}>{settings?.bannerSubtitle || t("header.promoSubtitle")}</span>
          </div>
        </div>
        ) : null}
      </div>
      <div className={styles.headerLineRight}>
        <LanguageSelector />
      </div>
      {isModalOpen ? (
        <LazyLuckyDriveModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      ) : null}
    </div>
  );
};
