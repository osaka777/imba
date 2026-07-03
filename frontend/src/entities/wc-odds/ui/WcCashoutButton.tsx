"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { formatCouponMoney } from "~/entities/bet/lib/formatCouponMoney";
import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import {
  executeWcCashout,
  fetchWcCashoutQuote,
  type WcBet,
} from "~/entities/wc-odds/api/client";
import { cn } from "~/shared/lib";
import { useFlashOnChange } from "~/shared/lib/useFlashOnChange";

import styles from "~/entities/bet/ui/Coupon/OpenTab.module.css";

type WcCashoutButtonProps = {
  bet: WcBet;
};

export function WcCashoutButton({ bet }: WcCashoutButtonProps) {
  const queryClient = useQueryClient();

  const { data: quote, isLoading } = useQuery({
    queryKey: ["wc-cashout-quote", bet.id],
    queryFn: async () => {
      const token = getSessionClient();
      if (!token) throw new Error("Unauthorized");
      return fetchWcCashoutQuote(token, bet.id);
    },
    enabled: bet.status === "PENDING",
    refetchInterval: 4_000,
    staleTime: 0,
    placeholderData: (prev) => prev,
  });

  const cashoutMutation = useMutation({
    mutationFn: async () => {
      const token = getSessionClient();
      if (!token) throw new Error("Unauthorized");
      const expectedAmount =
        quote && quote.available ? quote.amount : undefined;
      return executeWcCashout(token, bet.id, expectedAmount);
    },
    onSuccess: (result) => {
      toast.success(`Ставка продана: +${formatCouponMoney(result.amount, bet.currencyCode)}`, {
        autoClose: 5000,
      });
      void queryClient.invalidateQueries({ queryKey: ["wc-bets"] });
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: ["bets", "open"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось продать ставку");
      void queryClient.invalidateQueries({ queryKey: ["wc-cashout-quote", bet.id] });
    },
  });

  const quoteAmount = quote && quote.available ? quote.amount : null;
  const amountFlash = useFlashOnChange(quoteAmount);

  if (bet.status !== "PENDING") return null;

  if (isLoading && !quote) return null;

  if (!quote?.available) {
    if (!quote || quote.code === "odds_unavailable") return null;
    return (
      <div className={styles.openBetCashoutWrap}>
        <span className={styles.openBetCashoutUnavailable}>{quote.reason}</span>
      </div>
    );
  }

  const amountLabel = formatCouponMoney(quote.amount, bet.currencyCode);
  const selling = cashoutMutation.isPending;

  return (
    <div className={styles.openBetCashoutWrap}>
      <button
        className={cn(
          styles.openBetCashoutBtn,
          amountFlash === "up" && styles.openBetCashoutBtnUp,
          amountFlash === "down" && styles.openBetCashoutBtnDown,
        )}
        disabled={selling}
        onClick={() => cashoutMutation.mutate()}
        type="button"
      >
        {selling ? "Обработка…" : `Продать за ${amountLabel}`}
      </button>
    </div>
  );
}
