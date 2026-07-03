"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import getSymbolFromCurrency from "currency-symbol-map";
import { useQuery } from "@tanstack/react-query";
import { useLocalStorage } from "usehooks-ts";

import { DialogContent, Dialog } from "~/shared/ui";
import styles from "./Profile.module.css";
import { Withdraw } from "./Withdraw";
import { SignOut } from "./SignOut";
import { CategoryItem } from "./CategoryItem";
import { DepositForm } from "~/entities/finance/ui/DepositForm";
import {
  parseWelcomeDepositParams,
  WELCOME_DEPOSIT_SOURCE,
} from "~/entities/game/ui/LuckyDrive/welcomeBonusDeposit";
import { getWelcomeLimit } from "~/entities/game/ui/LuckyDrive/welcomeBonusLimits";
import { scheduleDialogOpen, useDialogOutsideGuard } from "~/shared/lib/openDialogSafe";
import { DetailsIcon, SettingsIcon, FavoritesIcon, HistorysIcon, SupportIcon, VoucherIcon } from "~/shared/assets/icons";
import { KztImage, RubImage, UahImage, KgsImage, AznImage, TjsImage, UzsImage, TryImage } from "~/shared/assets/images";
import { useRouter } from "next-nprogress-bar";
import { useSearchParams } from "next/navigation";
import Image, { StaticImageData } from "next/image";
import { getSessionClient } from "~/entities/user/lib";
import { api } from "~/shared/api";
import { useCurrency } from "~/shared/model/useCurrency";
import { useAccountType } from "~/shared/model/useAccountType";
import { useProfileAutoRefresh } from "../../hooks/useProfileAutoRefresh";
import { TelegramConnectBanner } from "~/entities/user/ui/TelegramConnectBanner/TelegramConnectBanner";
import { languageService } from "~/shared/services/language.service";
import { DEFAULT_SITE_CURRENCY, SITE_CURRENCY_CODES } from "~/shared/lib/siteCurrencies";
import { getCurrencyIconUrl } from "~/entities/user/lib/registrationCountries";

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
    desc: 'Зарабатывайте 50% RevShare — кабинет партнёра',
    icon: SupportIcon,
    link: 'https://partners.imba.bet',
    external: true,
  },
  {
    id: 4,
    name: 'История ставок',
    desc: 'Все ваши ставки, которые вы совершили за последнее время',
    icon: HistorysIcon,
    link: '/profile/betHistory'
  },
  {
    id: 7,
    name: 'Мой ЧМ-2026',
    desc: 'Статистика ставок на чемпионат мира',
    icon: FavoritesIcon,
    link: '/profile/wc'
  },
  {
    id: 5,
    name: 'Детализация',
    desc: 'Все операции, что повлияли на изменение баланса',
    icon: DetailsIcon,
    link: '/profile/financeHistory'
  },
  {
    id: 8,
    name: 'Обращения в поддержку',
    desc: 'История ваших чатов с операторами imba.bet',
    icon: SupportIcon,
    link: '/profile/support'
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
  KZT: KztImage,
  RUB: RubImage,
  UAH: UahImage,
  TRY: TryImage,
  UZS: UzsImage,
};

const currencySymbols: Record<string, string> = {
  KZT: '₸',
  RUB: '₽',
  UAH: '₴',
  TRY: '₺',
  UZS: "so'm",
  USDT: 'USDT',
};

const getCurrencySymbol = (code: string) => currencySymbols[code] || code;

function formatBonusTimeLeft(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'истёк';
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

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
  requiresDeposit?: boolean;
  depositActivated?: boolean;
  expiresAt?: string | null;
}

interface User {
  id: number;
  email: string;
  telegramLinked?: boolean;
  balances?: Balance[];
  bonusBalances?: BonusBalance[];
}

export const Profile = React.memo(() => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, setCurrency } = useCurrency();
  const [depositCurrency, setDepositCurrency] = useState<string>("");
  const [depositDefaultAmount, setDepositDefaultAmount] = useState<number | undefined>();
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [telegramBannerDismissed, setTelegramBannerDismissed] = useState(true);
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

  const [bonusTick, setBonusTick] = useState(0);
  useEffect(() => {
    if (!bonusBalance?.expiresAt) return;
    const id = setInterval(() => setBonusTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [bonusBalance?.expiresAt]);

  const bonusTimeLeft = useMemo(
    () => formatBonusTimeLeft(bonusBalance?.expiresAt),
    [bonusBalance?.expiresAt, bonusTick],
  );

  const mergedCurrencies = useMemo(() => {
    if (!currencies?.length || !user?.balances?.length) return [];
    
    const supportedCurrencies = [...SITE_CURRENCY_CODES];
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
      return { id: 0, amount: '0', currencyCode: currency || DEFAULT_SITE_CURRENCY };
    }
    
    const foundBalance = user.balances.find((balance: Balance) => balance.currencyCode === currency);
    return foundBalance || { id: 0, amount: '0', currencyCode: currency || DEFAULT_SITE_CURRENCY };
  }, [user?.balances, currency]);

  const formattedBalance = useMemo(() => {
    const amount = mainBalance?.amount || "0";
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
    }).format(Number(amount));
  }, [mainBalance?.amount]);

  const voucherCategory = useMemo(
    () => PROFILE_CATEGORIES.find((category) => category.inputText),
    [],
  );

  const serviceLinkCategories = useMemo(
    () => PROFILE_CATEGORIES.filter((category) => category.link && !category.inputText),
    [],
  );

  // Оптимизированные обработчики
  const openDepositModal = useCallback((currencyCode?: string, defaultAmount?: number) => {
    armGuard();
    setDepositCurrency(currencyCode ?? currency);
    setDepositDefaultAmount(defaultAmount);
    scheduleDialogOpen(setIsDepositOpen);
  }, [armGuard, currency]);

  const handleDepositClick = useCallback((currencyCode: string) => {
    openDepositModal(currencyCode);
  }, [openDepositModal]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setTelegramBannerDismissed(localStorage.getItem("telegramBannerDismissed") === "1");
  }, []);

  const dismissTelegramBanner = useCallback(() => {
    setTelegramBannerDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("telegramBannerDismissed", "1");
    }
  }, []);

  useEffect(() => {
    const welcome = parseWelcomeDepositParams(searchParams);
    if (!welcome) return;

    const limit = getWelcomeLimit(welcome.currency);
    const amount = Math.max(welcome.amount, limit.minDeposit);

    if (welcome.currency !== currency) {
      setCurrency(welcome.currency);
    }

    openDepositModal(welcome.currency, amount);
    router.replace("/profile", { scroll: false });
  }, [searchParams, currency, setCurrency, openDepositModal, router]);

  const handleWalletManagementClick = useCallback(() => {
    router.push('/profile/wallets');
  }, [router]);

  // Показываем загрузку если данные еще загружаются
  if (userLoading) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.loadingMessage}>Загрузка профиля...</div>
      </div>
    );
  }

  if (userError || !user) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.errorMessage}>
          Не удалось загрузить данные профиля.
          <div className={styles.errorActions}>
            <button type="button" onClick={() => window.location.reload()}>Перезагрузить страницу</button>
            <button type="button" onClick={forceRefresh}>Обновить данные</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.profileContainer}>
      <section className={styles.walletHero}>
        {isClient && (
          <div className={styles.accountTabs} role="tablist" aria-label="Тип счёта">
            <button
              type="button"
              role="tab"
              aria-selected={selectedAccountType === 'main'}
              className={`${styles.accountTab} ${selectedAccountType === 'main' ? styles.accountTabActive : ''}`}
              onClick={() => setSelectedAccountType('main')}
            >
              Основной
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedAccountType === 'bonus'}
              className={`${styles.accountTab} ${selectedAccountType === 'bonus' ? styles.accountTabActive : ''}`}
              onClick={() => setSelectedAccountType('bonus')}
            >
              Бонусный
            </button>
          </div>
        )}

        <div className={styles.heroBalance}>
          <span className={styles.heroLabel} suppressHydrationWarning>
            {selectedAccountType === 'main' ? 'Баланс' : 'Бонусный баланс'}
          </span>
          <div className={styles.heroAmountRow} suppressHydrationWarning>
            <span className={styles.heroAmount}>
              {selectedAccountType === 'main' ? formattedBalance : formattedBonusBalance}
            </span>
            <span className={styles.heroCurrency}>{getCurrencySymbol(currency)}</span>
          </div>
        </div>

        {selectedAccountType === 'main' ? (
          <div className={styles.heroActions}>
            <Withdraw />
            <button
              type="button"
              className={styles.depositBtn}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openDepositModal();
              }}
            >
              Пополнить
            </button>
          </div>
        ) : (
          <div className={styles.bonusInfo}>
            {bonusBalance?.requiresDeposit && !bonusBalance?.depositActivated ? (
              <>
                <small>
                  🎁 Бонус до {formattedBonusBalance} {currency} ждёт активации
                </small>
                <small>Пополните счёт, чтобы начать играть с бонуса</small>
                {bonusTimeLeft && (
                  <small>⏱ Сгорит через: {bonusTimeLeft}</small>
                )}
              </>
            ) : bonusBalance?.isTokenBased ? (
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
                    <small>Мин. кэф: {bonusBalance.minOdds}</small>
                    <small>
                      Прогресс:{' '}
                      {Math.round(
                        (Number(bonusBalance.totalWagered) / Number(bonusBalance.requiredWager)) * 100,
                      )}
                      %
                    </small>
                    {bonusTimeLeft && (
                      <small>⏱ Сгорит через: {bonusTimeLeft}</small>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {!user.telegramLinked && !telegramBannerDismissed ? (
        <TelegramConnectBanner onDismiss={dismissTelegramBanner} />
      ) : null}

      {selectedAccountType === 'main' && mergedCurrencies.length > 0 && (
        <section className={styles.currenciesSection}>
          <h2 className={styles.sectionTitle}>Кошельки</h2>
          <div className={styles.currencyGrid}>
            {mergedCurrencies.map((item) => {
              const isActive = item.currencyCode === currency;
              return (
                <div
                  className={`${styles.currencyCard} ${isActive ? styles.currencyCardActive : ''}`}
                  key={`${item.currencyCode}-${item.id}`}
                  onClick={() => setCurrency(item.currencyCode)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setCurrency(item.currencyCode);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.currencyCardTop}>
                    <div className={styles.currencyIconWrap}>
                      {currencyIcons[item.currencyCode] ? (
                        <Image
                          src={currencyIcons[item.currencyCode]}
                          alt={item.currencyName}
                          className={styles.currencyIcon}
                        />
                      ) : (
                        <img
                          src={getCurrencyIconUrl(item.currencyCode)}
                          alt={item.currencyName}
                          className={styles.currencyIcon}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      className={styles.currencyDepositBtn}
                      aria-label={`Пополнить ${item.currencyCode}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDepositClick(item.currencyCode);
                      }}
                    >
                      +
                    </button>
                  </div>
                  <span className={styles.currencyCode}>{item.currencyCode}</span>
                  <span className={styles.currencyAmount}>
                    {languageService.getNumberFormat().format(+item.amount)}{' '}
                    {getCurrencySymbol(item.currencyCode)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className={styles.quickLinksCard}>
        <button type="button" className={styles.quickLinkRow} onClick={handleWalletManagementClick}>
          <span className={styles.quickLinkIconWrap}>
            <img src="/settings.svg" alt="" className={styles.quickLinkIcon} />
          </span>
          <span className={styles.quickLinkLabel}>Управление счетами</span>
          <span className={styles.quickLinkArrow}>›</span>
        </button>
        <button type="button" className={styles.quickLinkRow} onClick={() => router.push('/profile/promocodes')}>
          <span className={styles.quickLinkIconWrap}>
            <img src="/ticket.svg" alt="" className={styles.quickLinkIcon} />
          </span>
          <span className={styles.quickLinkLabel}>Бонусы</span>
          <span className={styles.quickLinkArrow}>›</span>
        </button>
      </section>

      <section className={styles.servicesSection}>
        <h2 className={styles.sectionTitle}>Сервисы</h2>
        <div className={styles.servicesList}>
          {voucherCategory && (
            <CategoryItem category={voucherCategory} variant="voucher" />
          )}
          {serviceLinkCategories.length > 0 && (
            <div className={styles.servicesLinksCard}>
              {serviceLinkCategories.map((category) => (
                <CategoryItem category={category} key={category.id} variant="row" />
              ))}
            </div>
          )}
        </div>
      </section>

      <div className={styles.profileFooter}>
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
            <DepositForm
              forceCurrency={depositCurrency || undefined}
              defaultAmount={depositDefaultAmount}
              depositSource={depositDefaultAmount ? WELCOME_DEPOSIT_SOURCE : undefined}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
});