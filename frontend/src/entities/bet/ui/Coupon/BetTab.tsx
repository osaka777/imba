import { useQuery, useQueryClient } from "@tanstack/react-query";
import getSymbolFromCurrency from "currency-symbol-map";
import { useEffect, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { useLocalStorage} from "usehooks-ts";

import { useCurrency, useGamesBettingContext } from "~/app/providers";
import { getUser } from "~/entities/user/api";
import { TrashIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { Button, Checkbox, Input } from "~/shared/ui";
import { useAccountType } from "~/shared/model/useAccountType";
import type { User } from "~/shared/types";

import { createBet } from "../../api/createBet";
import { Rate, Rates } from "../../types";
import { BetList } from "./BetList";
import styles from "./BetTab.module.css";

type BetTabProps = {
  classNameContainer?: string;
  setIsOpen: (value: React.SetStateAction<boolean | undefined>) => void;
};
type Variant = "express" | "ordinar" | "series";

export const BetTab: React.FC<BetTabProps> = ({
  classNameContainer,
  setIsOpen,
}) => {
  const { currency } = useCurrency();
  const { isAuth } = useGamesBettingContext();
  const { selectedAccountType } = useAccountType();
  const queryClient = useQueryClient();
  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });

  const [variant, setVariant] = useState<Variant>("ordinar");
  const [agree, setAgree] = useState<boolean>(true);
  const [sum, setSum] = useState("");
  const [kf, setKf] = useState(0);
  const [isCreatingBet, setIsCreatingBet] = useState(false);

  const { data, refetch } = useQuery({
    queryFn: getUser,
    queryKey: ["user"],
  });

  const userData = data as User | null;

  useEffect(() => {
    if (rates.length < 2) {
      setVariant("ordinar");
    } else if (rates.length > 1) {
      setVariant("express");
    }
    setKf(
      rates
        .map((rate) => +(rate.coef || 0))
        .reduce((partialProduct, a) => partialProduct * a, 1),
    );
  }, [rates]);

  // Автоматически корректируем сумму при переключении на бонусный счет
  useEffect(() => {
    if (selectedAccountType === 'bonus' && sum) {
      const bonusBalance = userData?.bonusBalances?.find(
        ({ currencyCode }) => currencyCode === currency,
      );

      if (bonusBalance?.isTokenBased) {
        const currentSum = parseFloat(sum);
        const maxTokens = bonusBalance.tokensPerBet;

        if (currentSum > maxTokens) {
          setSum(maxTokens.toString());
          toast(`⚠️ Сумма скорректирована до ${maxTokens} жетона`, { position: "top-right" });
        }
      }
    }
  }, [selectedAccountType, userData, currency, sum]);

  // Проверка наличия игр в базе данных и удаление ставок с несуществующими eventId
  useEffect(() => {
    const validateRates = async () => {
      if (rates.length === 0) return;

      try {
        const eventIds = rates.map(rate => rate.eventId);

        const params = new URLSearchParams();
        eventIds.forEach(id => params.append('ids[]', id || ''));

        const getApiUrl = () => {
          if (typeof window !== 'undefined') {
            return window.location.origin;
          }
          return process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';
        };
        const API_URL = getApiUrl();
        const url = `${API_URL}/api/gamesByIds?${params.toString()}`;

        const response = await fetch(url);

        if (!response.ok) {
          console.error(`API error: ${response.status} - ${response.statusText}`);
          throw new Error(`API error: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");

        if (!contentType || !contentType.includes("application/json")) {
          const responseText = await response.text();

          if (responseText.includes('<!DOCTYPE html>')) {
            console.warn("Backend seems to be down, skipping rate validation");
            return;
          }

          throw new Error("API did not return JSON");
        }

        const games = await response.json();

        const validEventIds = games.map((game: { eventId: string }) => game.eventId);
        const invalidRates = rates.filter(rate => !validEventIds.includes(rate.eventId));

        const outdatedRates = [];
        const updatedRates = [...rates];

        for (let i = 0; i < updatedRates.length; i++) {
          const rate = updatedRates[i];
          const game = games.find((g: any) => g.eventId === rate.eventId);

          if (game && game.groupedMarkets) {
            let currentCf = null;
            for (const [groupKey, markets] of Object.entries(game.groupedMarkets)) {
              if (Array.isArray(markets)) {
                const market = markets.find((m: any) => m.market === rate.market);
                if (market) {
                  currentCf = market.cf;
                  break;
                }
              }
            }

            if (currentCf !== null) {
              const cfDiff = Math.abs(Number(currentCf) - Number(rate.coef));
              if (cfDiff >= 0.01) {
                outdatedRates.push(rate);
                updatedRates[i] = {
                  ...rate,
                  coef: String(currentCf)
                };
              }
            }
          }
        }

        if (invalidRates.length > 0) {
          setRates(prevRates => prevRates.filter(rate => validEventIds.includes(rate.eventId)));
          toast.info("Некоторые ставки были удалены, так как игры больше не существуют");
        }

        if (outdatedRates.length > 0) {
          setRates(updatedRates);
          toast.info(`Коэффициенты в ${outdatedRates.length} ставках были обновлены`);
        }
      } catch (error: any) {
        console.error("Error validating rates:", error);
      }
    };

    validateRates();
    const intervalId = setInterval(validateRates, 120000);
    return () => clearInterval(intervalId);
  }, [rates.length]);

  const inputOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    if (selectedAccountType === 'bonus') {
      const bonusBalance = userData?.bonusBalances?.find(
        ({ currencyCode }) => currencyCode === currency,
      );

      if (bonusBalance?.isTokenBased) {
        const numValue = parseFloat(value);
        const maxTokens = bonusBalance.tokensPerBet;

        if (numValue > maxTokens) {
          setSum(maxTokens.toString());
          toast(`⚠️ Максимальная сумма для жетонного бонуса: ${maxTokens} жетон`, { position: "top-right" });
          return;
        }
      }
    }

    setSum(value);
  };

  const checkBoxOnChangeHandler = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setVariant(event.target.value as Variant);
  };

  const agreeOnChangeHandler = () => {
    setAgree(!agree);
  };

  const trashButtonOnClickHandler = () => {
    setRates([]);
  };

  const deleteButtonOnClickHandler = (item: Rate) => {
    setRates(rates.filter((rate) => rate !== item));
  };

  const createBetOnClick = async () => {
    if (isCreatingBet) return;

    if (!rates.length) return;
    if (!isAllOpen) {
      return toast("⚠️ Нельзя поставить на закрытое событие", {
        position: "top-right",
      });
    }
    if (!isAuth) {
      return toast("⚠️ Войдите или зарегистрируйтесь для создания ставки", {
        position: "top-right",
      });
    }
    if (!agree) {
      return toast("⚠️ Подтвердите соглашение для создания ставки", {
        position: "top-right",
      });
    }
    if (!currency) return;

    if (selectedAccountType === 'main') {
      const userBalance = userData?.balances?.find(
        ({ currencyCode }) => currencyCode === currency,
      )?.amount;
      if (userBalance == null || Number(userBalance) < Number(sum)) {
        toast("⚠️ На вашем основном счету недостаточно средств", { position: "top-right" });
        refetch();
        return;
      }
    } else if (selectedAccountType === 'bonus') {
      const bonusBalance = userData?.bonusBalances?.find(
        ({ currencyCode }) => currencyCode === currency,
      );

      if (!bonusBalance) {
        toast("⚠️ У вас нет активного бонусного счета", { position: "top-right" });
        refetch();
        return;
      }

      // Проверяем минимальный коэффициент для бонусных ставок
      const minOdds = Number(bonusBalance.minOdds) || 1.8;
      const hasLowOdds = rates.some(rate => Number(rate.coef) < minOdds);

      if (hasLowOdds) {
        toast(`⚠️ Для бонусных ставок минимальный коэффициент: ${minOdds}`, { position: "top-right" });
        return;
      }

      if (bonusBalance.isTokenBased) {
        if (bonusBalance.remainingTokens < bonusBalance.tokensPerBet) {
          toast("⚠️ Недостаточно жетонов для ставки", { position: "top-right" });
          refetch();
          return;
        }
        if (Number(sum) !== Number(bonusBalance.tokensPerBet)) {
          toast(`⚠️ Для бонусного счета нужно ставить всю сумму: ${bonusBalance.tokensPerBet} жетонов`, { position: "top-right" });
          return;
        }
      } else {
        if (Number(bonusBalance.amount) < Number(sum)) {
          toast("⚠️ На вашем бонусном счету недостаточно средств", { position: "top-right" });
          refetch();
          return;
        }
      }
    }

    setIsCreatingBet(true);
    const toastId = toast.loading("Создание ставки...");

    try {
      if (rates.length === 0) {
        toast("⚠️ Добавьте исход для ставки", { position: "top-right" });
        setIsCreatingBet(false);
        return;
      }

      // Маппинг вариантов ставки к enum backend
      const betVariant = ((): "ORDINAR" | "EXPRESS" => {
        if (variant === "ordinar") return "ORDINAR";
        return "EXPRESS"; // для "express" и "series" используем EXPRESS
      })();

      const betType: "EXPRESS" | "ORDINAR" = rates.length > 1 ? "EXPRESS" : "ORDINAR";

      // For express bets, send all games
      if (betVariant === "EXPRESS" && rates.length > 1) {
        const expressBets = rates.map(selectedRate => {
          // Извлекаем значения из выбранного исхода
          const marketId = selectedRate.market || (selectedRate as any)?.groupedMarket?.market;
          const outcomeId = (selectedRate as any)?.groupedMarket?.plr
            || (selectedRate as any)?.groupedMarket?.oc_name
            || selectedRate.title;

          // Добавляем вычисление числовых кодов из oc_pointer/market
          const pointerStr = (selectedRate as any)?.groupedMarket?.oc_pointer
            || (selectedRate as any)?.groupedMarket?.market
            || selectedRate.market;

          let groupNumber: string | null = null;
          let outcomeNumber: string | null = null;
          let numericOutcome: number | string | null = null;

          if (pointerStr && typeof pointerStr === 'string' && pointerStr.includes('|')) {
            const parts = pointerStr.split('|');
            groupNumber = parts[1] ?? null;
            outcomeNumber = parts[2] ?? null;
            const raw = parts[3] ?? null;
            if (raw !== null) {
              const n = Number(raw);
              numericOutcome = isNaN(n) ? raw : n;
            }
          }

          // Fallback: пробуем взять из дополнительных полей, если указатель не дал значения
          if (numericOutcome === null) {
            const fallback = (selectedRate as any)?.groupedMarket?.oc_result
              ?? (selectedRate as any)?.groupedMarket?.size
              ?? null;
            if (fallback !== null && fallback !== undefined) {
              const n = Number(fallback);
              numericOutcome = isNaN(n) ? fallback : n;
            }
          }

          return {
            eventId: String(selectedRate.eventId || ""),
            marketId: String(marketId || ""),
            outcomeId: String(outcomeId || ""),
            odds: Number(selectedRate.coef ?? 0),
            betInfo: selectedRate.title,
            // Новые поля для бэка
            groupNumber: groupNumber ?? undefined,
            outcomeNumber: outcomeNumber ?? undefined,
            numericOutcome: numericOutcome ?? undefined,
            // Передаём live/prematch флаг для корректного префикса на бэке
            isLive: !!selectedRate.isLive,
            // Поддержка sub_games
            subGameId: selectedRate.subGameId ? String(selectedRate.subGameId) : undefined,
            subGameName: selectedRate.subGameName ?? undefined,
          };
        });

        const createBetDto = {
          betType,
          betVariant,
          stake: Number(sum),
          currency: currency,
          bets: expressBets,
          accountType: selectedAccountType
        };

        // Валидация перед отправкой
        const hasInvalidBet = expressBets.some(bet => 
          !bet.eventId || !bet.marketId || !bet.outcomeId || !bet.odds
        );
        
        if (hasInvalidBet || !createBetDto.stake) {
          toast("⚠️ Некорректные данные ставки. Обновите страницу и попробуйте снова", { position: "top-right" });
          setIsCreatingBet(false);
          return;
        }

        // Детальное логирование перед отправкой
        const betData = {
          originalSum: sum,
          parsedAmount: Number(sum),
          currency: currency,
          variant: variant,
          accountType: selectedAccountType,
          betsCount: expressBets.length,
          fullDto: JSON.stringify(createBetDto, null, 2)
        };

        await createBet(createBetDto);
      } else {
        // Для обычной ставки используем старую логику
        const selectedRate = rates[0];

        // Извлекаем значения из выбранного исхода
        const marketId = selectedRate.market || (selectedRate as any)?.groupedMarket?.market;
        const outcomeId = (selectedRate as any)?.groupedMarket?.plr
          || (selectedRate as any)?.groupedMarket?.oc_name
          || selectedRate.title;

        // Добавляем вычисление числовых кодов из oc_pointer/market
        const pointerStr = (selectedRate as any)?.groupedMarket?.oc_pointer
          || (selectedRate as any)?.groupedMarket?.market
          || selectedRate.market;

        let groupNumber: string | null = null;
        let outcomeNumber: string | null = null;
        let numericOutcome: number | string | null = null;

        if (pointerStr && typeof pointerStr === 'string' && pointerStr.includes('|')) {
          const parts = pointerStr.split('|');
          groupNumber = parts[1] ?? null;
          outcomeNumber = parts[2] ?? null;
          const raw = parts[3] ?? null;
          if (raw !== null) {
            const n = Number(raw);
            numericOutcome = isNaN(n) ? raw : n;
          }
        }

        // Fallback: пробуем взять из дополнительных полей, если указатель не дал значения
        if (numericOutcome === null) {
          const fallback = (selectedRate as any)?.groupedMarket?.oc_result
            ?? (selectedRate as any)?.groupedMarket?.size
            ?? null;
          if (fallback !== null && fallback !== undefined) {
            const n = Number(fallback);
            numericOutcome = isNaN(n) ? fallback : n;
          }
        }

        const createBetDto = {
          eventId: String(selectedRate.eventId || ""),
          marketId: String(marketId || ""),
          outcomeId: String(outcomeId || ""),
          odds: Number(selectedRate.coef ?? 0),
          stake: Number(sum),
          currency: currency,
          betType,
          betVariant,
          betInfo: selectedRate.title,
          // Новые поля для бэка
          groupNumber: groupNumber ?? undefined,
          outcomeNumber: outcomeNumber ?? undefined,
          numericOutcome: numericOutcome ?? undefined,
          // Передаём live/prematch флаг для корректного префикса на бэке
          isLive: !!selectedRate.isLive,
          // Поддержка sub_games
          subGameId: selectedRate.subGameId ? String(selectedRate.subGameId) : undefined,
          subGameName: selectedRate.subGameName ?? undefined,
          accountType: selectedAccountType
        };

        // Валидация перед отправкой
        if (!createBetDto.eventId || !createBetDto.marketId || !createBetDto.outcomeId || !createBetDto.odds || !createBetDto.stake) {
          toast("⚠️ Некорректные данные ставки. Обновите страницу и попробуйте снова", { position: "top-right" });
          setIsCreatingBet(false);
          return;
        }

        // Детальное логирование перед отправкой
        const betData = {
          originalSum: sum,
          parsedAmount: Number(sum),
          currency: currency,
          variant: variant,
          accountType: selectedAccountType,
          fullDto: JSON.stringify(createBetDto, null, 2)
        };

        // Специальное логирование для тоталов
        if (selectedRate.market && (selectedRate.market.includes('тотал') || selectedRate.market.includes('Тотал') || selectedRate.market.includes('TOTAL'))) {
          console.log('🎯 TOTALS BET DATA:', {
            selectedRate: selectedRate,
            groupedMarket: selectedRate.groupedMarket,
            pointerStr: (selectedRate as any)?.groupedMarket?.oc_pointer || (selectedRate as any)?.groupedMarket?.market || selectedRate.market,
            extractedData: {
              groupNumber,
              outcomeNumber,
              numericOutcome
            },
            createBetDto: createBetDto
          });
        }

        await createBet(createBetDto);
      }

      toast.dismiss(toastId);

      setTimeout(() => {
        setIsOpen(false);
        setRates([]);
      }, 500);

      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["bets", "pending"] }),
        queryClient.invalidateQueries({ queryKey: ["user"] })
      ]);

    } catch (e: any) {
      let errorMessage = "Произошла ошибка при создании ставки";
      let toastType: "error" | "warning" = "error";

      // Check if this is a structured error response from our backend
      const errorData = e?.data;
      
      if (errorData?.errorCode !== undefined) {
        // Handle structured error responses with errorCode
        switch (errorData.errorCode) {
          case 1:
            errorMessage = "Недостаточно средств на счету или превышен лимит ставки";
            break;
          case 3:
            if (errorData.coefficientChanged && errorData.originalCoefficient && errorData.actualCoefficient) {
              errorMessage = `Коэффициент изменился с ${errorData.originalCoefficient} на ${errorData.actualCoefficient}. Попробуйте снова с новым коэффициентом`;
              toastType = "warning";
              // Update the coefficient in the UI
              if (rates.length === 1) {
                setRates(prev => prev.map(rate => ({
                  ...rate,
                  coef: errorData.actualCoefficient
                })));
              }
            } else {
              errorMessage = "Коэффициент изменился. Обновите страницу и попробуйте снова";
              setRates([]);
            }
            break;
          case 4:
            errorMessage = "Ставка недоступна. Маркет закрыт";
            setRates([]);
            break;
          case 5:
            errorMessage = "Событие недоступно или завершено";
            setRates([]);
            break;
          case 'error_repeat_bet_data':
            errorMessage = errorData.message || "Нельзя создать экспресс-ставку из разных событий одного матча";
            toastType = "warning";
            break;
          default:
            errorMessage = errorData.details || `Ошибка ${errorData.errorCode}: Ставка отклонена`;
        }
      } else {
        // Fallback to legacy error handling
        // Детальный разбор ошибок валидации от backend (ValidationPipe)
        const validationErrors = e?.data?.errors as Array<{
          property: string;
          value?: unknown;
          constraints?: Record<string, string>;
        }> | undefined;

        if (validationErrors && validationErrors.length) {
          const msgs: string[] = [];
          for (const ve of validationErrors) {
            const constraints = ve.constraints ? Object.values(ve.constraints) : [];
            if (constraints.length) {
              msgs.push(...constraints);
            } else if (ve.property) {
              msgs.push(`Поле ${ve.property} не прошло валидацию`);
            }
          }
          if (msgs.length) {
            errorMessage = msgs.join("; ");
          }
        } else if (e?.message?.includes("market with provided betName not found")) {
          errorMessage = "Ставка устарела. Коэффициенты изменились, обновите страницу";
          setRates([]);
        } else if (e?.message?.includes("insufficient funds")) {
          errorMessage = "Недостаточно средств на счету";
        } else if (e?.message?.includes("game not found")) {
          errorMessage = "Игра не найдена или завершена";
          setRates([]);
        } else if (e?.message?.includes("market is closed")) {
          errorMessage = "Ставка недоступна. Маркет закрыт";
          setRates([]);
        } else if (e?.message?.includes("coefficient changed")) {
          errorMessage = "Коэффициент изменился. Ставка обновлена автоматически";
        } else if (e?.message) {
          errorMessage = e.message;
        }
      }

      toast.update(toastId, {
        render: `${toastType === "warning" ? "⚠️" : "❌"} ${errorMessage}`,
        type: toastType,
        isLoading: false,
        autoClose: toastType === "warning" ? 7000 : 5000,
      });
    } finally {
      setIsCreatingBet(false);
    }
  };

  const betAllMoney = () => {
    let balance = "0";

    if (selectedAccountType === 'main') {
      balance = userData?.balances?.find(({ currencyCode }) => currencyCode === currency)
        ?.amount ?? "0";
    } else if (selectedAccountType === 'bonus') {
      const bonusBalance = userData?.bonusBalances?.find(({ currencyCode }) => currencyCode === currency);

      if (bonusBalance?.isTokenBased) {
        balance = bonusBalance.tokensPerBet.toString();
      } else {
        balance = bonusBalance?.amount ?? "0";
      }
    }

    setSum(balance);
  };

  const totalSum = useMemo(
    () => rates.reduce((acc, rate) => acc + (Number(rate.sum) || 0), 0),
    [rates]
  );

  const isAllOpen = rates.every((rate) => rate.isOpen);

  return (
    <>
      <div className={`${styles.BetTab} ${classNameContainer}`}>
        <div className={styles.couponTypeRadiogroup}>
          <Checkbox
            checked={variant === "ordinar"}
            classNames={{
              Checkbox: styles.checkbox,
              icon: styles.icon,
              iconBox: styles.iconBox,
              text: styles.checkboxText,
            }}
            disabled={rates.length > 1}
            onChange={checkBoxOnChangeHandler}
            value="ordinar"
          >{`Ординар`}</Checkbox>
          <Checkbox
            checked={variant === "express"}
            classNames={{
              Checkbox: styles.checkbox,
              icon: styles.icon,
              iconBox: styles.iconBox,
              text: styles.checkboxText,
            }}
            disabled={rates.length < 2}
            onChange={checkBoxOnChangeHandler}
            value="express"
          >{`Экспресс`}</Checkbox>
        </div>

        <BetList
          deleteButtonOnClickHandler={deleteButtonOnClickHandler}
          rates={rates}
          variant={variant}
        />

        {rates.length === 0 && (
          <>
            <div className={styles.totalWin}>
              <p className={styles.totalWinText}>{`Возможный выигрыш`}</p>
              <p className={styles.totalWinText}>
                {currency && `0.00${getSymbolFromCurrency(currency)}`}
              </p>
            </div>
            <div className={styles.totalSumRow}>
              <p className={styles.totalSumLabel}>Сумма всех ставок:</p>
              <p className={styles.totalSumValue}>{totalSum.toFixed(2)}{currency && getSymbolFromCurrency(currency)}</p>
            </div>
            <div className={styles.baseCouponBetForm}>
              <div className={styles.couponStakeField}>
                <Input
                  disabled
                  placeholder="Сумма ставки"
                />
              </div>
              <Button className={cn(styles.allInButton, styles.allIn)} disabled>
                Поставить все
              </Button>
            </div>
          </>
        )}

        {rates.length > 0 && (
          <>
            <div className={styles.totalWin}>
              <p className={styles.totalWinText}>
                {selectedAccountType === 'bonus' && (() => {
                  const bonusBalance = userData?.bonusBalances?.find(
                    ({ currencyCode }) => currencyCode === currency,
                  );
                  if (bonusBalance?.isTokenBased) {
                    return 'Возможный выигрыш (на основной счет)';
                  }
                  return 'Возможный выигрыш';
                })() || 'Возможный выигрыш'}
              </p>
              <p className={styles.totalWinText}>
                {(() => {
                  if (selectedAccountType === 'bonus') {
                    const bonusBalance = userData?.bonusBalances?.find(
                      ({ currencyCode }) => currencyCode === currency,
                    );
                    if (bonusBalance?.isTokenBased) {
                      return `${totalSum.toFixed(0)} жетонов`;
                    }
                  }
                  return `${totalSum.toFixed(2)}${currency && getSymbolFromCurrency(currency)}`;
                })()}
              </p>
            </div>
            <div className={styles.totalSumRow}>
              <p className={styles.totalSumLabel}>Сумма всех ставок:</p>
              <p className={styles.totalSumValue}>
                {(() => {
                  if (selectedAccountType === 'bonus') {
                    const bonusBalance = userData?.bonusBalances?.find(
                      ({ currencyCode }) => currencyCode === currency,
                    );
                    if (bonusBalance?.isTokenBased) {
                      return `${totalSum.toFixed(0)} жетонов`;
                    }
                  }
                  return `${totalSum.toFixed(2)}${currency && getSymbolFromCurrency(currency)}`;
                })()}
              </p>
            </div>
            <div className={styles.baseCouponBetForm}>
              <div className={styles.couponStakeField}>
                <Input
                  max={(() => {
                    if (selectedAccountType === 'bonus') {
                      const bonusBalance = userData?.bonusBalances?.find(
                        ({ currencyCode }) => currencyCode === currency,
                      );
                      if (bonusBalance?.isTokenBased) {
                        return bonusBalance.tokensPerBet;
                      }
                    }
                    return undefined;
                  })()}
                  onChange={inputOnChange}
                  placeholder={(() => {
                    if (selectedAccountType === 'bonus') {
                      const bonusBalance = userData?.bonusBalances?.find(
                        ({ currencyCode }) => currencyCode === currency,
                      );
                      if (bonusBalance?.isTokenBased) {
                        return `Макс: ${bonusBalance.tokensPerBet} жетон`;
                      }
                    }
                    return `Сумма ставки`;
                  })()}
                  type="number"
                  value={(() => {
                    if (selectedAccountType === 'bonus') {
                      const bonusBalance = userData?.bonusBalances?.find(
                        ({ currencyCode }) => currencyCode === currency,
                      );
                      if (bonusBalance?.isTokenBased) {
                        return sum;
                      }
                    }
                    return sum;
                  })()}
                />
              </div>
              <Button
                className={`${styles.allInButton} ${styles.allIn}`}
                onClick={betAllMoney}
              >
                {selectedAccountType === 'bonus' && (() => {
                  const bonusBalance = userData?.bonusBalances?.find(
                    ({ currencyCode }) => currencyCode === currency,
                  );
                  if (bonusBalance?.isTokenBased) {
                    return `Поставить ${bonusBalance.tokensPerBet} жетон`;
                  }
                  return 'Поставить все';
                })() || 'Поставить все'}
              </Button>
            </div>
            {selectedAccountType === 'bonus' && (() => {
              const bonusBalance = userData?.bonusBalances?.find(
                ({ currencyCode }) => currencyCode === currency,
              );
              if (bonusBalance?.isTokenBased) {
                return (
                  <div className={styles.tokenHint}>
                    <small>💡 Жетоны - это не деньги! Вы ставите жетоны, а выигрыш получаете в реальных деньгах на основной счет</small>
                    <br />
                    <small>🎯 Можно ставить только {bonusBalance.tokensPerBet} жетон за раз</small>
                  </div>
                );
              }
              return null;
            })()}
          </>
        )}

        <div className={styles.agree}>
          <Checkbox
            checked={agree}
            classNames={{
              Checkbox: styles.agreeCheckbox,
              text: styles.agreeText,
            }}
            onChange={agreeOnChangeHandler}
          >{`Всегда соглашаться с изменением коэффициента`}</Checkbox>
          <Button className={styles.remove} onClick={trashButtonOnClickHandler}>
            <TrashIcon className={styles.removeIcon} />
          </Button>
        </div>

        <div className={`${styles.accountTypeIndicator} ${selectedAccountType === 'bonus' && (() => {
            const bonusBalance = userData?.bonusBalances?.find(
              ({ currencyCode }) => currencyCode === currency,
            );
            return bonusBalance?.isTokenBased ? styles.tokenBasedIndicator : '';
          })() || ''
          }`}>
          <span className={styles.accountTypeLabel}>
            {selectedAccountType === 'main' ? (
              '💰 Основной счет'
            ) : (
              <>
                🎁 Бонусный счет
                {(() => {
                  const bonusBalance = userData?.bonusBalances?.find(
                    ({ currencyCode }) => currencyCode === currency,
                  );
                  if (bonusBalance?.isTokenBased) {
                    return (
                      <span className={styles.tokenInfo}>
                        {' '}({bonusBalance.remainingTokens} жетонов осталось)
                      </span>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </span>
        </div>

        <Button
          className={styles.baseCouponSubmit}
          disabled={Number(sum) <= 0 || !agree || isCreatingBet}
          onClick={createBetOnClick}
          type="submit"
        >
          {isCreatingBet ? "Создание..." :
            selectedAccountType === 'bonus' ?
              (() => {
                const bonusBalance = userData?.bonusBalances?.find(
                  ({ currencyCode }) => currencyCode === currency,
                );
                if (bonusBalance?.isTokenBased) {
                  return `Поставить ${bonusBalance.tokensPerBet} жетон`;
                }
                return 'Поставить бонус';
              })() :
              'Поставить'
          }
        </Button>
      </div>
    </>
  );
};