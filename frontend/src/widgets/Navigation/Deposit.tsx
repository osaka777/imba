"use client";

import { useLocalStorage } from "usehooks-ts";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { getUser } from "~/entities/user/api";
import { useAccountType } from "~/shared/model/useAccountType";
import { useCurrency } from "~/shared/model/useCurrency";

import { CurrencySelector } from "./CurrencySelector";

import styles from "./Deposit.module.css";

type DepositProps = {
  onOpenDeposit: () => void;
};

export const Deposit = ({ onOpenDeposit }: DepositProps) => {
  const { currency, setCurrency } = useCurrency();
  const [hideBalance, setHideBalance] = useLocalStorage<boolean>("hideBalance", false);
  const { selectedAccountType } = useAccountType();

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

  const { data } = useQuery({
    queryKey: ["user", currency],
    queryFn: getUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: typeof window !== 'undefined',
    placeholderData: (previousData) => previousData,
  });

  const balance =
    data?.balances?.find(({ currencyCode }: { currencyCode: string }) => currencyCode === currency)
      ?.amount ?? "0";
  const formattedBalance = Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
  }).format(Number(balance));

  const bonusBalanceData = (data as any)?.bonusBalances?.find(({ currencyCode }: { currencyCode: string }) => currencyCode === currency);
  const bonusBalance = bonusBalanceData?.amount ?? "0";
  const formattedBonusBalance = Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
  }).format(Number(bonusBalance));

  const displayBalance = selectedAccountType === 'main' ? formattedBalance : formattedBonusBalance;
  const accountIcon = selectedAccountType === 'main' ? '' : '🎁';
  
  const hasTokens = selectedAccountType === 'bonus' && bonusBalanceData?.isTokenBased && bonusBalanceData.remainingTokens > 0;
  const tokenCount = bonusBalanceData?.remainingTokens || 0;
  const currencySymbols: Record<string, string> = {
    USD: '$',
    KZT: '₸',
    UAH: '₴',
    RUB: '₽',
    TRY: '₺',
    UZS: "so'm",
  };
  const getCurrencySymbol = (code: string) => currencySymbols[code] || code;

  return (
    <div className={styles.depositWrapper}>
      <div className={styles.balanceBlock}>
        <CurrencySelector currency={'Баланс'} setCurrency={setCurrency} />
        <div className={styles.balanceAmount}>
          {hideBalance ? (
            <div className={styles.balanceTitle}>
              <span>{data?.email}</span>
            </div>
          ) : (
            <span className={styles.balance} suppressHydrationWarning>
              <span className={styles.balanceTitle}>
                {accountIcon} {displayBalance}
                {hasTokens && (
                  <span className={styles.tokenInfo}>
                    {tokenCount}
                  </span>
                )}
              </span>
              <span className={styles.currencyText}>{getCurrencySymbol(currency)}</span>
            </span>
          )}
        </div>
      </div>
      <button
        className={styles.Deposit}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenDeposit();
        }}
      >
        Пополнить
      </button>
    </div>
  );
};
