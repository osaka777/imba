'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  AccessIcon,
  LiveIcon,
  TicketIcon,
} from "~/shared/assets/icons";
import { usePromoModalSettings } from "~/entities/promo-modal/lib/usePromoModalSettings";
import {
  IMBA_GAMES_PROMO_TITLE,
  IMBA_MARKETS_HREF,
} from "~/entities/game/ui/LuckyDrive/luckyDriveImage";
import { Button } from "~/shared/ui";
import { LanguageSelector } from "~/widgets/Navigation/LanguageSelector";
import { useLocale } from "~/shared/model/useLocale";
import { cn } from "~/shared/lib";

import styles from "./HeaderLineTop.module.css";

function WindowsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="currentColor"
      height="22"
      viewBox="0 0 24 24"
      width="22"
    >
      <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm8.2-1.3L21 2.8v8.7h-9.8V4.2ZM3 13.5h7.5v7.1L3 19.5v-6Zm8.2 0H21v8.7l-9.8-1.4v-7.3Z" />
    </svg>
  );
}

/**
 * Top header line — 1win HeaderTop:
 * left: access + promo; right: Windows app + language.
 */
export const HeaderLineTop = () => {
  const { settings, enabled } = usePromoModalSettings();
  const { t } = useLocale();
  const pathname = usePathname();
  const isCybersport = pathname?.startsWith("/cybersport");
  const showHeaderPromo = enabled && settings?.showInHeader !== false;
  const marketsHref = settings?.wcRedirectPath || IMBA_MARKETS_HREF;

  return (
    <div className={cn(styles.headerLineTop, isCybersport && "HeaderLineTop_cyber")}>
      <div className={styles.headerLineLeft}>
        <div className={styles.levelItem}>
          <Button
            className={`${styles.Button} ${styles.miniIcon} ${styles.themeDefault} ${styles.ttn} ${styles.headerButton}`}
            disabled
          >
            <AccessIcon className={`${styles.icon} ${styles.mobileIcon}`} />
          </Button>
        </div>
        <div className={styles.divider} />
        {showHeaderPromo ? (
          <Link className={styles.FreeMoneyLink_root_sudSD} href={marketsHref}>
            <div className={styles.FreeMoneyLink_wrapper}>
              <span className={styles.FreeMoneyLink_prefix}>
                <TicketIcon />
              </span>
              <div className={styles.FreeMoneyLink_text_wrapper}>
                <span className={styles.FreeMoneyLink_text}>
                  {settings?.bannerTitle || IMBA_GAMES_PROMO_TITLE}
                </span>
                <span className={styles.FreeMoneyLink_liveIcon_wrapper}>
                  <LiveIcon className={styles.FreeMoneyLink_liveIcon} />
                </span>
              </div>
              <span className={styles.FreeMoneyLink_description}>
                {t("promo.gameBannerSubtitle")}
              </span>
            </div>
          </Link>
        ) : null}
      </div>

      <div className={styles.headerLineRight}>
        <div className={styles.headerLineRightItem}>
          <Link
            href="/windows"
            className={styles.headerDesktopApps}
            title={t("header.downloadWindows")}
            aria-label={t("header.downloadWindows")}
          >
            <div className={styles.desktopAppsText}>
              <div className={styles.desktopAppsBold}>{t("header.appLabel")}</div>
              <div className={styles.desktopAppsSub}>{t("header.appWindows")}</div>
            </div>
            <WindowsAppIcon className={styles.desktopAppsIcon} />
          </Link>
        </div>

        <div className={styles.headerLineRightItem}>
          <div className={styles.langWrap}>
            <LanguageSelector />
          </div>
        </div>
      </div>
    </div>
  );
};
