"use client";

import { FiX } from "react-icons/fi";
import type { CloseButtonProps } from "react-toastify";

import styles from "./ToastCloseButton.module.css";

export const ToastCloseButton = ({
  closeToast,
  ariaLabel,
}: CloseButtonProps) => (
  <button
    aria-label={ariaLabel ?? "Закрыть"}
    className={styles.closeBtn}
    onClick={closeToast}
    type="button"
  >
    <FiX aria-hidden />
  </button>
);
