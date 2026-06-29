"use client";

import React, { useState, useMemo, useCallback } from "react";
import getSymbolFromCurrency from "currency-symbol-map";
import { useQuery } from "@tanstack/react-query";
import { useLocalStorage } from "usehooks-ts";

import { DialogContent, Dialog } from "~/shared/ui";
import styles from "./Profile.module.css";
import { Withdraw } from "./Withdraw";
import { SignOut } from "./SignOut";
import { CategoryItem } from "./CategoryItem";
import { DepositForm } from "~/entities/finance/ui/DepositForm";
import { scheduleDialogOpen, useDialogOutsideGuard } from "~/shared/lib/openDialogSafe";
import { DetailsIcon, SettingsIcon, FavoritesIcon, HistorysIcon, SupportIcon, VoucherIcon } from "~/shared/assets/icons";
import { KztImage, RubImage, UahImage, UsdImage, KgsImage, AznImage, TjsImage, UzsImage, TryImage } from "~/shared/assets/images";
import { useRouter } from "next-nprogress-bar";
import Image, { StaticImageData } from "next/image";
import { getSessionClient } from "~/entities/user/lib";
import { api } from "~/shared/api";
import { useCurrency } from "~/shared/model/useCurrency";
import { useAccountType } from "~/shared/model/useAccountType";
import { useProfileAutoRefresh } from "../../hooks/useProfileAutoRefresh";
import { languageService } from "~/shared/services/language.service";

export const PROFILE_CATEGORIES = [
  {
    id: 2,
    name: 'Ваучер',
    desc: 'Активируй ваучер и получай деньги на счет',
    inputText: 'Ваучер',
    icon: VoucherIcon,
  },
  {
    id: 3,
    name: 'Партнерская программа',
    desc: 'Приглашай друзей и получай 50% от их проигрышей',
    icon: SupportIcon,
    link: '/profile/referral'
  },
  {
    id: 4,
    name: 'История ставок',
    desc: 'Все ваши ставки, которые вы совершили за последнее время',
    icon: HistorysIcon,
    link: '/profile/betHistory'
  },
  {
    id: 5,
    name: 'Детализация',
    desc: 'Все операции, что повлияли на изменение баланса',
    icon: DetailsIcon,
    link: '/profile/financeHistory'
  },
  {
    id: 6,
    name: 'Настройки',
    desc: 'Возможность скрыть баланс и отредактировать личные данные',
    icon: SettingsIcon,
    link: '/profile/settings'
  }
];

const currencyIcons: Record<string, StaticImageData> = {
  USD: UsdImage,
  KZT: KztImage,
  RUB: RubImage,
  UAH: UahImage,
  TRY: TryImage,
  UZS: UzsImage,
};

const currencySymbols: Record<string, string> = {
  USD: '$',
  KZT: '₸',
  RUB: '₽',
  UAH: '₴',
  TRY: '₺',
  UZS: "so'm",
};

const getCurrencySymbol = (code: string) => currencySymbols[code] || code;

interface Currency {
  isoCode: string;
  name: string;
}

interface Balance {
  id: number;
  userId: number;
  currencyCode: string;
  amount: string;
}

interface BonusBalance {
  id: number;
  userId: number;
  currencyCode: string;
  amount: string;
  totalBonusReceived: string;
  totalWagered: string;
  requiredWager: string;
  minOdds: string;
  consecutiveWins: number;
  requiredConsecutiveWins: number;
  currentBetAmount: string;
  isActive: boolean;
  totalTokens: number;
  remainingTokens: number;
  tokensPerBet: number;
  isTokenBased: boolean;
}

interface User {
  id: number;
  email: string;
  balances?: Balance[];
  bonusBalances?: BonusBalance[];
}

export const Profile = React.memo(() => {
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const [depositCurrency, setDepositCurrency] = useState<string>("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const { armGuard, blockIfArmed } = useDialogOutsideGuard();
  const { selectedAccountType, setSelectedAccountType, isClient } = useAccountType();

  // Автоматическое обновление данных профиля
  const { forceRefresh } = useProfileAutoRefresh();

  // Получаем токен один раз
  const token = getSessionClient();

  // Запрос валют
  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/currencies");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Запрос пользователя с балансами
  const { data: user, error: userError, isLoading: userLoading } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      if (!token) {
        throw new Error("No authentication token");
      }
      const { data, error } = await api.GET("/api/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      return data as User;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: !!token, // Запрос только если есть токен
  });

  // Обработка ошибок
  if (userError) {
    console.error("Error loading user data:", userError);
    // Можно показать уведомление об ошибке или редирект на логин
  }

  // Мемоизированные вычисления
  const bonusBalance = useMemo(() => {
    if (!user?.bonusBalances) return null;
    return user.bonusBalances.find(
      (balance) => balance.currencyCode === currency
    );
  }, [user?.bonusBalances, currency]);

  const formattedBonusBalance = useMemo(() => {
    const amount = bonusBalance?.amount || "0";
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
    }).format(Number(amount));
  }, [bonusBalance?.amount]);

  const mergedCurrencies = useMemo(() => {
    if (!currencies?.length || !user?.balances?.length) return [];
    
    const supportedCurrencies = ['USD', 'KZT', 'UAH', 'RUB', 'TRY', 'UZS', 'USDT'];
    const balanceMap = new Map(user.balances.map(b => [b.currencyCode, b]));
    
    return currencies
      .filter((curr: Currency) => supportedCurrencies.includes(curr.isoCode))
      .map((curr: Currency) => {
        const foundBalance = balanceMap.get(curr.isoCode);
        return {
          currencyCode: curr.isoCode,
          currencyName: curr.name,
          amount: foundBalance?.amount || "0",
          id: foundBalance?.id || 0
        };
      });
  }, [currencies, user?.balances]);

  const mainBalance = useMemo(() => {
    if (!user?.balances?.length) {
      return { id: 0, amount: '0', currencyCode: currency || 'USD' };
    }
    
    const foundBalance = user.balances.find((balance: Balance) => balance.currencyCode === currency);
    return foundBalance || { id: 0, amount: '0', currencyCode: currency || 'USD' };
  }, [user?.balances, currency]);

  const formattedBalance = useMemo(() => {
    const amount = mainBalance?.amount || "0";
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
    }).format(Number(amount));
  }, [mainBalance?.amount]);

  // Мемоизируем категории профиля на верхнем уровне
  const profileCategories = useMemo(() => 
    PROFILE_CATEGORIES.map((category) => (
      <CategoryItem category={category} key={category.id} />
    )), []
  );

  // Оптимизированные обработчики
  const openDepositModal = useCallback((currencyCode?: string) => {
    armGuard();
    setDepositCurrency(currencyCode ?? currency);
    scheduleDialogOpen(setIsDepositOpen);
  }, [armGuard, currency]);

  const handleDepositClick = useCallback((currencyCode: string) => {
    openDepositModal(currencyCode);
  }, [openDepositModal]);

  const handleWalletManagementClick = useCallback(() => {
    router.push('/profile/wallets');
  }, [router]);

  // Показываем загрузку если данные еще загружаются
  if (userLoading) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.walletsList}>
          <div className={styles.mainInfo}>
            <div className={styles.loadingMessage}>Загрузка профиля...</div>
          </div>
        </div>
      </div>
    );
  }

  // Показываем ошибку если не удалось загрузить данные
  if (userError || !user) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.walletsList}>
          <div className={styles.mainInfo}>
                          <div className={styles.errorMessage}>
                Не удалось загрузить данные профиля.
                <div className={styles.errorActions}>
                  <button onClick={() => window.location.reload()}>Перезагрузить страницу</button>
                  <button onClick={forceRefresh}>Обновить данные</button>
                </div>
              </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.profileContainer}>
      <div className={styles.walletsList}>
        <div className={styles.mainInfo}>
          {/* Переключатель счетов */}
          {isClient && (
            <div className={styles.accountTypeSelector}>
              <button
                className={`${styles.accountTypeButton} ${selectedAccountType === 'main' ? styles.active : ''}`}
                onClick={() => setSelectedAccountType('main')}
              >
                💰 Основной счет
              </button>
              <button
                className={`${styles.accountTypeButton} ${selectedAccountType === 'bonus' ? styles.active : ''}`}
                onClick={() => setSelectedAccountType('bonus')}
              >
                🎁 Бонусный счет
              </button>
            </div>
          )}

          <div className={styles.mainBalanceSection}>
            <div className={styles.balanceHeaderContainer}>
              <div className={styles.balanceHeader} suppressHydrationWarning>
                {selectedAccountType === 'main' ? 'Основной счет' : '🎁 Бонусный счет'}
              </div>
              <div className={styles.balanceAmount} suppressHydrationWarning>
                {selectedAccountType === 'main' 
                  ? `${formattedBalance} ${getCurrencySymbol(currency)}`
                  : `${formattedBonusBalance} ${getCurrencySymbol(currency)}`
                }
              </div>
            </div>
            <div className={styles.balanceActions}>
              {selectedAccountType === 'main' ? (
                <>
                  <Withdraw />
                  <button
                    type="button"
                    className={styles.Deposit}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openDepositModal();
                    }}
                  >
                    Пополнить
                  </button>
                </>
              ) : (
                <div className={styles.bonusInfo}>
                  {bonusBalance?.isTokenBased ? (
                    <>
                      <small>
                        Жетоны: {bonusBalance.remainingTokens || 0} / {bonusBalance.totalTokens || 0}
                      </small>
                      <small>
                        Победы подряд: {bonusBalance.consecutiveWins || 0} / {bonusBalance.requiredConsecutiveWins || 0}
                      </small>
                      <small>
                        Жетонов за ставку: {bonusBalance.tokensPerBet || 1}
                      </small>
                    </>
                  ) : (
                    <>
                      <small>
                        Отыграно: {bonusBalance?.totalWagered || 0} / {bonusBalance?.requiredWager || 0}
                      </small>
                      {bonusBalance && (
                        <div className={styles.bonusDetails}>
                          <small>Мин. кэф: {bonusBalance.minOdds} (макс. из всех бонусов)</small>
                          <small>Прогресс: {Math.round((Number(bonusBalance.totalWagered) / Number(bonusBalance.requiredWager)) * 100)}%</small>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.moneyList}>
            {mergedCurrencies?.map((currency) => (
              <div className={styles.moneyItem} key={`${currency.currencyCode}-${currency.id}`}>
                <div className={styles.moneyInfo}>
                  <div className={styles.moneyIconContainer}>
                    <Image
                      src={currencyIcons[currency.currencyCode] ?? UsdImage}
                      alt={currency.currencyName}
                      className={styles.moneyIcon}
                    />
                  </div>
                  <span className={styles.moneyName}>{currency.currencyCode}</span>
                </div>
                <div className={styles.moneyBalance}>
                  {languageService.getNumberFormat().format(+currency.amount)} {getCurrencySymbol(currency.currencyCode)}
                  <button
                    className={styles.addButton}
                    onClick={() => handleDepositClick(currency.currencyCode)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.accountManagement} onClick={handleWalletManagementClick}>
            <div className={styles.sectionSettings}>
              <div className={styles.sectionSettingsIcon}>
                <img src="/settings.svg" alt="settings" className={styles.sectionSettingsIconImg} />
              </div>
              <span>Управление счетами</span>
            </div>
            <span className={styles.arrowIcon}>›</span>
          </div>

          <div className={styles.accountManagement} onClick={() => router.push('/profile/promocodes')}>
            <div className={styles.sectionSettings}>
              <div className={styles.sectionSettingsIcon}>
                <img src="/ticket.svg" alt="bonuses" className={styles.sectionSettingsIconImg} />
              </div>
              <span>Бонусы</span>
            </div>
            <span className={styles.arrowIcon}>›</span>
          </div>
        </div>

        {profileCategories}

        <hr className={styles.divider} />
        <SignOut />
      </div>

      <Dialog
        open={isDepositOpen}
        onOpenChange={setIsDepositOpen}
      >
        <DialogContent
          className={styles.dialog}
          title="Пополнение счета"
          onInteractOutside={blockIfArmed}
          onPointerDownOutside={blockIfArmed}
        >
          {isDepositOpen ? (
            <DepositForm forceCurrency={depositCurrency || undefined} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
});