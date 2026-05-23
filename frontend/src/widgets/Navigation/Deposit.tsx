import { useLocalStorage } from "usehooks-ts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DepositForm } from "~/entities/finance";
import { getUser } from "~/entities/user/api";
import { Dialog, DialogContent, DialogTrigger } from "~/shared/ui/Dialog";
import { useAccountType } from "~/shared/model/useAccountType";
import { useCurrency } from "~/shared/model/useCurrency";

import { CurrencySelector } from "./CurrencySelector";

import styles from "./Deposit.module.css";

export const Deposit = () => {
  const { currency, setCurrency } = useCurrency();
  const [hideBalance, setHideBalance] = useLocalStorage<boolean>("hideBalance", false);
  const { selectedAccountType } = useAccountType();
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    const handleHideBalanceChange = () => {
      const newValue = localStorage.getItem("hideBalance") === "true";
      setHideBalance(newValue);
      setForceUpdate(prev => prev + 1);
    };
    
    if (typeof window !== "undefined") {
      window.addEventListener("hideBalanceChanged", handleHideBalanceChange);
      return () => window.removeEventListener("hideBalanceChanged", handleHideBalanceChange);
    }
  }, [setHideBalance]);

  const { data } = useQuery({
    queryKey: ["user", currency],
    queryFn: getUser,
    staleTime: 5 * 60 * 1000, // 5 минут кэширования
    gcTime: 10 * 60 * 1000, // 10 минут в памяти
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // Отложенная загрузка - запрос выполняется только когда компонент действительно нужен
    enabled: typeof window !== 'undefined',
    // Агрессивное кэширование для предотвращения лишних запросов
    placeholderData: (previousData) => previousData,
  });

  const balance =
    data?.balances?.find(({ currencyCode }: { currencyCode: string }) => currencyCode === currency)
      ?.amount ?? "0";
  const formattedBalance = Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
  }).format(Number(balance));

  // Получаем бонусный баланс
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
      <div className="flex flex-col items-center">
        <CurrencySelector currency={'Баланс'} setCurrency={setCurrency} />
        <div className="flex flex-col items-center">
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
      <Dialog>
        <DialogTrigger className={styles.Deposit}>{`Пополнить`}</DialogTrigger>
        <DialogContent className={styles.dialog} title="Пополнение счета">
          <DepositForm />
        </DialogContent>
      </Dialog>
    </div>
  );
};
