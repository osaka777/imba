"use client";

import { useState } from "react";
import styles from "./VoucherStyles.module.css";
import { toast } from "react-toastify";
import { FiX } from "react-icons/fi";
export const VoucherModal = ({ onClose }: { onClose: () => void }) => {
  const [voucherCode, setVoucherCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const activateVoucher = async () => {
    if (!voucherCode.trim()) {
      toast.error("Пожалуйста, введите код ваучера");
      return;
    }

    setIsLoading(true);
    try {
      // Promo functionality has been disabled
      toast.error("Функция ваучеров временно недоступна");
      onClose();
    } catch (error) {
      console.error("Ошибка при активации ваучера:", error);
      toast.error("Ошибка при активации ваучера");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.voucherModal} onClick={(e) => e.stopPropagation()}>
      <div className={styles.header}>
        <h2>Ваучер</h2>
        <button className={styles.closeButton} onClick={onClose}>
          &#x2715;
        </button>
      </div>
      <div className={styles.content}>
        <div className={styles.description}>
          Активируй ваучер и получай деньги на счет
        </div>
        <div className={styles.promocodeForm}>
          <div className={styles.promocodeFormRow}>
            <div className={styles.inputWrapper}>
              <input
                className={styles.input}
                placeholder=""
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
              />
              <span className={styles.fieldLabel}>Ваучер</span>
            </div>
            <button
              className={styles.submitButton}
              onClick={activateVoucher}
              disabled={isLoading || !voucherCode.trim()}
            >
              {isLoading ? "Активация..." : "Активировать"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};