"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";

import { formatCouponMoney } from "~/entities/bet/lib/formatCouponMoney";
import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import {
  executeWcCashout,
  type WcBet,
  type WcCashoutQuote,
} from "~/entities/wc-odds/api/client";
import { cn } from "~/shared/lib";

import styles from "~/entities/bet/ui/Coupon/OpenTab.module.css";

type AvailableQuote = Extract<WcCashoutQuote, { available: true }>;

type WcCashoutButtonProps = {
  bet: WcBet;
  quote?: WcCashoutQuote;
  quotesLoading?: boolean;
};

function isAvailableQuote(quote?: WcCashoutQuote): quote is AvailableQuote {
  return Boolean(quote?.available);
}

function amountsDiffer(a: string, b: string): boolean {
  return Math.abs(Number(a) - Number(b)) > 0.009;
}

export function WcCashoutButton({ bet, quote, quotesLoading }: WcCashoutButtonProps) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [snapshotQuote, setSnapshotQuote] = useState<AvailableQuote | null>(null);

  const liveQuote = quote;

  const closeConfirm = useCallback(() => {
    setConfirming(false);
    setSnapshotQuote(null);
  }, []);

  const cashoutMutation = useMutation({
    mutationFn: async (expectedAmount: string) => {
      const token = getSessionClient();
      if (!token) throw new Error("Unauthorized");
      return executeWcCashout(token, bet.id, expectedAmount);
    },
    onSuccess: (result) => {
      closeConfirm();
      toast.success(`Ставка продана: +${formatCouponMoney(result.amount, bet.currencyCode)}`, {
        autoClose: 5000,
      });
      void queryClient.invalidateQueries({ queryKey: ["wc-bets"] });
      void queryClient.invalidateQueries({ queryKey: ["wc-cashout-quotes"] });
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: ["bets", "open"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось продать ставку");
      void queryClient.invalidateQueries({ queryKey: ["wc-cashout-quotes"] });
    },
  });

  const openConfirm = () => {
    if (!isAvailableQuote(quote)) return;
    setSnapshotQuote(quote);
    setConfirming(true);
  };

  if (bet.status !== "PENDING") return null;

  if (!quote && quotesLoading) {
    return (
      <div className={styles.cashoutBlock}>
        <button className={cn(styles.cashoutBtn, styles.cashoutBtnLoading)} disabled type="button">
          <span className={styles.cashoutBtnLabel}>Продажа</span>
          <span className={styles.cashoutBtnAmount}>…</span>
        </button>
      </div>
    );
  }

  if (!quote?.available) {
    if (!quote || quote.code === "odds_unavailable") return null;
    return (
      <div className={styles.cashoutBlock}>
        <p className={styles.cashoutMuted}>{quote.reason}</p>
      </div>
    );
  }

  const selling = cashoutMutation.isPending;
  const amountLabel = formatCouponMoney(quote.amount, bet.currencyCode);
  const priceChanged = confirming
    && snapshotQuote
    && isAvailableQuote(liveQuote)
    && (amountsDiffer(snapshotQuote.amount, liveQuote.amount)
      || snapshotQuote.currentOdds !== liveQuote.currentOdds);

  if (confirming) {
    if (!isAvailableQuote(liveQuote)) {
      return (
        <div className={styles.cashoutBlock}>
          <p className={styles.cashoutConfirmLead}>
            {liveQuote && !liveQuote.available
              ? liveQuote.reason
              : "Котировка недоступна"}
          </p>
          <button className={styles.cashoutGhostBtn} onClick={closeConfirm} type="button">
            Закрыть
          </button>
        </div>
      );
    }

    const confirmAmountLabel = formatCouponMoney(liveQuote.amount, bet.currencyCode);

    return (
      <div className={styles.cashoutBlock}>
        <p className={cn(styles.cashoutConfirmLead, priceChanged && styles.cashoutConfirmLeadWarn)}>
          {priceChanged
            ? "Сумма изменилась — подтвердите продажу"
            : `Продать за ${confirmAmountLabel}?`}
        </p>
        <p className={styles.cashoutConfirmMeta}>
          Кф. {liveQuote.currentOdds} · при приёме {liveQuote.placedOdds}
        </p>
        <div className={styles.cashoutConfirmRow}>
          <button
            className={styles.cashoutGhostBtn}
            disabled={selling}
            onClick={closeConfirm}
            type="button"
          >
            Отмена
          </button>
          <button
            className={cn(styles.cashoutBtn, styles.cashoutBtnConfirm)}
            disabled={selling}
            onClick={() => cashoutMutation.mutate(liveQuote.amount)}
            type="button"
          >
            <span className={styles.cashoutBtnLabel}>
              {selling ? "Обработка…" : "Подтвердить"}
            </span>
            <span className={styles.cashoutBtnAmount}>{confirmAmountLabel}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cashoutBlock}>
      <button
        className={styles.cashoutBtn}
        disabled={selling}
        onClick={openConfirm}
        type="button"
      >
        <span className={styles.cashoutBtnText}>
          <span className={styles.cashoutBtnLabel}>Продать</span>
          <span className={styles.cashoutBtnHint}>кф. {quote.currentOdds}</span>
        </span>
        <span className={styles.cashoutBtnAmount}>{amountLabel}</span>
      </button>
    </div>
  );
}
