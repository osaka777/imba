"use client";

import { useState } from "react";

import { useLocale } from "~/shared/model/useLocale";

import styles from "./AppPushOptInModal.module.css";

type AppPushOptInModalProps = {
  onEnable: () => Promise<void>;
  onDismiss: () => void;
};

function BellIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2Zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S12 2.67 12 3.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Z"
        fill="#F59E0B"
      />
    </svg>
  );
}

export function AppPushOptInModal({ onEnable, onDismiss }: AppPushOptInModalProps) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      await onEnable();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pushOverlay} role="dialog" aria-modal="true" aria-labelledby="push-optin-title">
      <div className={styles.pushCard}>
        <div className={styles.pushTop}>
          <div className={styles.pushIconWrap}>
            <BellIcon />
          </div>
          <div>
            <h2 className={styles.pushTitle} id="push-optin-title">
              {t("notify.pushOptInTitle")}
            </h2>
            <p className={styles.pushSubtitle}>{t("notify.pushOptInLead")}</p>
          </div>
        </div>

        <div className={styles.pushList}>
          <div className={styles.pushItem}>
            <span className={styles.pushDot} />
            {t("notify.pushOptInGoals")}
          </div>
          <div className={styles.pushItem}>
            <span className={styles.pushDot} />
            {t("notify.pushOptInSettle")}
          </div>
          <div className={styles.pushItem}>
            <span className={styles.pushDot} />
            {t("notify.pushOptInFinance")}
          </div>
        </div>

        <div className={styles.pushActions}>
          <button
            className={styles.pushPrimary}
            disabled={loading}
            onClick={() => void handleEnable()}
            type="button"
          >
            {loading ? t("notify.pushOptInConnecting") : t("notify.pushOptInEnable")}
          </button>
          <button
            className={styles.pushSecondary}
            disabled={loading}
            onClick={onDismiss}
            type="button"
          >
            {t("notify.pushOptInLater")}
          </button>
        </div>
      </div>
    </div>
  );
}
