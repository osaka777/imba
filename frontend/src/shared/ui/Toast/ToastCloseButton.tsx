"use client";

import { useContext } from "react";
import { FiX } from "react-icons/fi";
import type { CloseButtonProps } from "react-toastify";

import { LocaleContext } from "~/app/providers/LocaleProvider";

import styles from "./ToastCloseButton.module.css";

export const ToastCloseButton = ({
  closeToast,
  ariaLabel,
}: CloseButtonProps) => {
  const locale = useContext(LocaleContext);
  const label = ariaLabel ?? locale?.t("common.close") ?? "Close";
  return (
    <button
      aria-label={label}
      className={styles.closeBtn}
      onClick={closeToast}
      type="button"
    >
      <FiX aria-hidden />
    </button>
  );
};
