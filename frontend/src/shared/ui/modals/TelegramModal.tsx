"use client";

import { FiChevronLeft } from "react-icons/fi";
import { TelegramLinkBlock } from "~/entities/user/ui/TelegramLinkBlock/TelegramLinkBlock";
import { useLocale } from "~/shared/model/useLocale";
import styles from "./TelegramStyles.module.css";

type TelegramModalProps = {
  onClose: () => void;
  linked?: boolean;
  username?: string | null;
  onLinkedChange?: (linked: boolean, username?: string | null) => void;
};

export function TelegramModal({ onClose, linked, username, onLinkedChange }: TelegramModalProps) {
  const { t } = useLocale();
  return (
    <div
      className={styles.modal}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onClose} type="button">
          <FiChevronLeft className={styles.backIcon} />
          {t("profile.settingsTitle")}
        </button>
        <button className={styles.closeBtn} onClick={onClose} type="button" aria-label={t("common.close")}>
          &#x2715;
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.header}>
          <div className={styles.tgIcon}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 13.593l-2.963-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.891.966z"/>
            </svg>
          </div>
          <div>
            <h2 className={styles.title}>Telegram</h2>
            <p className={styles.subtitle}>{t("profile.tgModalSubtitle")}</p>
          </div>
        </div>

        <TelegramLinkBlock
          linked={linked}
          username={username}
          onLinkedChange={onLinkedChange}
          headClassName={styles.tgHead}
          labelClassName={styles.tgLabel}
          descClassName={styles.tgDesc}
          prefsClassName={styles.tgPrefs}
          prefRowClassName={styles.tgPrefRow}
          toggleClassName={styles.tgToggle}
          toggleSliderClassName={styles.tgToggleSlider}
          actionsClassName={styles.tgActions}
          buttonClassName={styles.tgLinkBtn}
          unlinkButtonClassName={styles.tgUnlinkBtn}
        />
      </div>
    </div>
  );
}
