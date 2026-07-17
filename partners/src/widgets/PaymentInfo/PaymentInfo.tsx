"use client";

import { useEffect, useState } from "react";
import styles from "@/app/profile/withdrawal/withdrawal.module.css";
import { getWithdrawalSummary, WithdrawalSummaryItem } from "@/entities/user/api/getWithdrawalSummary";
import { formatMoney } from "@/shared/lib/formatCurrencySymbol";

export const PaymentInfo = () => {
  const [summary, setSummary] = useState<WithdrawalSummaryItem[]>([]);

  useEffect(() => {
    getWithdrawalSummary().then(setSummary).catch(() => setSummary([]));
  }, []);

  const primary = summary[0];

  return (
    <div className={styles.stats}>
      <div className={styles.stats_header}>Условия вывода</div>
      <hr className={styles.stats_hr} />
      <div className={styles.stats_info}>
        {primary ? (
          <>
            <div className={styles.stats_item}>
              <div className={styles.stats_item_name}>Доступно к выводу:</div>
              <div className={styles.stats_item_value}>
                {formatMoney(primary.available, primary.currencyCode)}
              </div>
            </div>
            <div className={styles.stats_item}>
              <div className={styles.stats_item_name}>На hold ({primary.holdDays} дн.):</div>
              <div className={styles.stats_item_value}>
                {formatMoney(primary.held, primary.currencyCode)}
              </div>
            </div>
            {(primary.lockedConnectBonus ?? 0) > 0 ? (
              <div className={styles.stats_item}>
                <div className={styles.stats_item_name}>Заблокировано (welcome Kick):</div>
                <div className={styles.stats_item_value}>
                  {formatMoney(primary.lockedConnectBonus ?? 0, primary.currencyCode)}
                </div>
              </div>
            ) : null}
            <div className={styles.stats_item}>
              <div className={styles.stats_item_name}>Минимальный вывод:</div>
              <div className={styles.stats_item_value}>
                {formatMoney(primary.minWithdraw, primary.currencyCode)}
              </div>
            </div>
            <div className={styles.stats_item}>
              <div className={styles.stats_item_name}>Приведено регистраций:</div>
              <div className={styles.stats_item_value}>{primary.referralsCount ?? 0}</div>
            </div>
          </>
        ) : (
          <div className={styles.stats_item}>
            <div className={styles.stats_item_name}>Hold period: 7 дней после начисления комиссии</div>
          </div>
        )}
      </div>
    </div>
  );
};
