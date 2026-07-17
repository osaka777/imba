"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { FiChevronLeft } from "react-icons/fi";
import { toast } from "react-toastify";

import { getSessionClient } from "~/entities/user/lib";
import { api } from "~/shared/api";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./VoucherStyles.module.css";

type VoucherModalProps = {
  onClose: () => void;
};

export const VoucherModal = ({ onClose }: VoucherModalProps) => {
  const { t } = useLocale();
  const [voucherCode, setVoucherCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const activateVoucher = useCallback(async () => {
    const code = voucherCode.trim();
    if (!code) {
      toast.error(t("profile.voucherEnterCode"));
      return;
    }

    setIsLoading(true);
    try {
      const token = await getSessionClient();
      const { error } = await api.POST("/api/promo/apply", {
        headers: { Authorization: `Bearer ${token}` },
        body: { code },
      });

      if (error) throw error;

      toast.success(t("profile.voucherActivated"));
      setVoucherCode("");
      onClose();
    } catch (error: unknown) {
      console.error("Voucher activation error:", error);
      const message =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : t("profile.voucherError");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [onClose, t, voucherCode]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void activateVoucher();
    }
  };

  return (
    <div
      aria-labelledby="voucher-modal-title"
      aria-modal="true"
      className={styles.voucherModal}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
    >
      <div className={styles.topBar}>
        <button className={styles.backButton} onClick={onClose} type="button">
          <FiChevronLeft aria-hidden className={styles.backIcon} />
          {t("common.back")}
        </button>
        <button
          aria-label={t("profile.closeAria")}
          className={styles.closeButton}
          onClick={onClose}
          type="button"
        >
          &#x2715;
        </button>
      </div>

      <div className={styles.body}>
        <h2 className={styles.title} id="voucher-modal-title">
          {t("profile.voucherModalTitle")}
        </h2>

        <p className={styles.description}>
          {t("profile.voucherModalDesc")}{" "}
          <Link className={styles.rulesLink} href="/info" onClick={onClose}>
            {t("profile.voucherRulesLink")}
          </Link>
        </p>

        <div className={styles.form}>
          <input
            autoComplete="off"
            className={styles.input}
            disabled={isLoading}
            onChange={(event) => setVoucherCode(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("profile.voucherCodePlaceholder")}
            value={voucherCode}
          />

          <button
            className={styles.submitButton}
            disabled={isLoading || !voucherCode.trim()}
            onClick={() => void activateVoucher()}
            type="button"
          >
            {isLoading ? t("profile.voucherActivating") : t("profile.voucherActivate")}
          </button>
        </div>
      </div>
    </div>
  );
};
