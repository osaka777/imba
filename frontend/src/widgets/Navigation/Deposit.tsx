"use client";

import { useLocalStorage } from "usehooks-ts";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type MouseEvent } from "react";

import { getUser } from "~/entities/user/api";
import { useAccountType } from "~/shared/model/useAccountType";
import { useCurrency } from "~/shared/model/useCurrency";
import { useLocale } from "~/shared/model/useLocale";
import { AnimatedBalance } from "~/shared/ui/AnimatedBalance";
import { HiddenBalance } from "~/shared/ui/HiddenBalance/HiddenBalance";
import { scheduleDialogOpen, useDialogOutsideGuard } from "~/shared/lib/openDialogSafe";

import { BalanceModal } from "./BalanceModal";

import styles from "./Deposit.module.css";

type DepositProps = {
  onOpenDeposit: (currencyCode?: string) => void;
};

function EyeIcon({ crossed }: { crossed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={styles.eyeSvg}>
      <path
        d="M2.5 12S6.2 5.5 12 5.5 21.5 12 21.5 12 17.8 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      {crossed ? (
        <path
          d="M4.2 4.2 19.8 19.8"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

export const Deposit = ({ onOpenDeposit }: DepositProps) => {
  const { t } = useLocale();
  const { currency, setCurrency } = useCurrency();
  const [hideBalance, setHideBalance] = useLocalStorage<boolean>("hideBalance", false, {
    initializeWithValue: false,
  });
  const { selectedAccountType } = useAccountType();
  const [balanceOpen, setBalanceOpen] = useState(false);
  const { armGuard } = useDialogOutsideGuard();

  useEffect(() => {
    const handleHideBalanceChange = () => {
      const newValue = localStorage.getItem("hideBalance") === "true";
      setHideBalance(newValue);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("hideBalanceChanged", handleHideBalanceChange);
      return () => window.removeEventListener("hideBalanceChanged", handleHideBalanceChange);
    }
  }, [setHideBalance]);

  const toggleHideBalance = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      const next = !hideBalance;
      setHideBalance(next);
      if (typeof window !== "undefined") {
        localStorage.setItem("hideBalance", next.toString());
        window.dispatchEvent(new Event("hideBalanceChanged"));
      }
    },
    [hideBalance, setHideBalance],
  );

  const openBalanceModal = useCallback(() => {
    armGuard();
    scheduleDialogOpen(setBalanceOpen);
  }, [armGuard]);

  const { data } = useQuery({
    queryKey: ["user", currency],
    queryFn: getUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: typeof window !== "undefined",
    placeholderData: (previousData) => previousData,
  });

  const balance =
    data?.balances?.find(({ currencyCode }: { currencyCode: string }) => currencyCode === currency)
      ?.amount ?? "0";

  const bonusBalanceData = (data as any)?.bonusBalances?.find(
    ({ currencyCode }: { currencyCode: string }) => currencyCode === currency,
  );
  const bonusBalance = bonusBalanceData?.amount ?? "0";

  const displayBalanceValue =
    selectedAccountType === "main" ? Number(balance) : Number(bonusBalance);

  const accountIcon = selectedAccountType === "main" ? "" : "🎁";

  const hasTokens =
    selectedAccountType === "bonus" &&
    bonusBalanceData?.isTokenBased &&
    bonusBalanceData.remainingTokens > 0;
  const tokenCount = bonusBalanceData?.remainingTokens || 0;
  const currencySymbols: Record<string, string> = {
    KZT: "₸",
    UAH: "₴",
    RUB: "₽",
    TRY: "₺",
    UZS: "so'm",
    AZN: "₼",
    KGS: "с̲",
    TJS: "ЅМ",
    USDT: "USDT",
  };
  const getCurrencySymbol = (code: string) => currencySymbols[code] || code;

  return (
    <div className={styles.depositWrapper}>
      <button
        type="button"
        className={styles.balanceBlock}
        onClick={openBalanceModal}
        aria-label={t("profile.balance")}
      >
        <span className={styles.balanceLabel}>{t("deposit.balanceLabel")}</span>
        <span className={styles.balanceAmount}>
          {hideBalance ? (
            <span className={styles.balance} suppressHydrationWarning>
              <span className={styles.balanceTitle}>
                <HiddenBalance className={styles.hiddenBalance} />
              </span>
              <span className={styles.currencyText}>{getCurrencySymbol(currency)}</span>
            </span>
          ) : (
            <span className={styles.balance} suppressHydrationWarning>
              <span className={styles.balanceTitle}>
                {accountIcon}{" "}
                <AnimatedBalance
                  key={`${currency}-${selectedAccountType}`}
                  className={styles.balanceAnimated}
                  value={displayBalanceValue}
                />
                {hasTokens && <span className={styles.tokenInfo}>{tokenCount}</span>}
              </span>
              <span className={styles.currencyText}>{getCurrencySymbol(currency)}</span>
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        className={styles.eyeBtn}
        onClick={toggleHideBalance}
        aria-pressed={hideBalance}
        aria-label={hideBalance ? t("profile.showBalanceAria") : t("profile.hideBalanceAria")}
        title={hideBalance ? t("profile.showBalanceAria") : t("profile.hideBalanceAria")}
      >
        <EyeIcon crossed={hideBalance} />
      </button>
      <button
        className={styles.Deposit}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenDeposit();
        }}
      >
        {t("deposit.depositCta")}
      </button>

      <BalanceModal
        open={balanceOpen}
        onOpenChange={setBalanceOpen}
        currency={currency}
        setCurrency={setCurrency}
        onDeposit={(code) => {
          setBalanceOpen(false);
          window.setTimeout(() => onOpenDeposit(code), 80);
        }}
      />
    </div>
  );
};
