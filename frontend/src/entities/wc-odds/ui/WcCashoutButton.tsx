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
import { useLocale } from "~/shared/model/useLocale";

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
  const { t } = useLocale();
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
      toast.success(
        t("wc.cashoutSold", {
          amount: formatCouponMoney(result.amount, bet.currencyCode),
        }),
        { autoClose: 5000 },
      );
      void queryClient.invalidateQueries({ queryKey: ["wc-bets"] });
      void queryClient.invalidateQueries({ queryKey: ["wc-cashout-quotes"] });
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: ["bets", "open"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || t("wc.cashoutFailed"));
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
          <span className={styles.cashoutBtnLabel}>{t("wc.cashoutSelling")}</span>
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
              : t("wc.cashoutUnavailable")}
          </p>
          <button className={styles.cashoutGhostBtn} onClick={closeConfirm} type="button">
            {t("wc.cashoutClose")}
          </button>
        </div>
      );
    }

    const confirmAmountLabel = formatCouponMoney(liveQuote.amount, bet.currencyCode);

    return (
      <div className={styles.cashoutBlock}>
        <p className={cn(styles.cashoutConfirmLead, priceChanged && styles.cashoutConfirmLeadWarn)}>
          {priceChanged
            ? t("wc.cashoutPriceChanged")
            : t("wc.cashoutConfirmAmount", { amount: confirmAmountLabel })}
        </p>
        <p className={styles.cashoutConfirmMeta}>
          {t("wc.cashoutOddsLine", {
            current: liveQuote.currentOdds,
            placed: liveQuote.placedOdds,
          })}
        </p>
        <div className={styles.cashoutConfirmRow}>
          <button
            className={styles.cashoutGhostBtn}
            disabled={selling}
            onClick={closeConfirm}
            type="button"
          >
            {t("wc.cashoutCancel")}
          </button>
          <button
            className={cn(styles.cashoutBtn, styles.cashoutBtnConfirm)}
            disabled={selling}
            onClick={() => cashoutMutation.mutate(liveQuote.amount)}
            type="button"
          >
            <span className={styles.cashoutBtnLabel}>
              {selling ? t("wc.cashoutProcessing") : t("wc.cashoutConfirm")}
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
          <span className={styles.cashoutBtnLabel}>{t("wc.cashoutSell")}</span>
          <span className={styles.cashoutBtnHint}>
            {t("wc.cashoutOddsHint", { odds: quote.currentOdds })}
          </span>
        </span>
        <span className={styles.cashoutBtnAmount}>{amountLabel}</span>
      </button>
    </div>
  );
}
