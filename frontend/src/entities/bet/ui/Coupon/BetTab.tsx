import { useQuery, useQueryClient } from "@tanstack/react-query";
import getSymbolFromCurrency from "currency-symbol-map";
import { useEffect, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { useLocalStorage} from "usehooks-ts";

import { useCurrency, useGamesBettingContext } from "~/app/providers";
import { getUser } from "~/entities/user/api";
import { getSessionClient } from "~/entities/user/lib/getSessionClient";
import { TrashIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { Button, Checkbox, Input } from "~/shared/ui";
import { useAccountType } from "~/shared/model/useAccountType";
import type { User } from "~/shared/types";

import { createBet } from "../../api/createBet";
import { placeWcBet } from "~/entities/wc-odds/api/client";
import {
  isWcBetOutcomeClosedError,
} from "~/entities/wc-odds/lib/wcBetErrorMessage";
import {
  buildWcRate,
  findWcOutcomeOdd,
  getWcGroupKeyFromRate,
  getWcMarketKeyFromRate,
  getWcOddForPick,
  getWcOutcomeKeyFromRate,
  getWcPickFromRate,
  isWcEventBettingOpen,
  isWcOddsRate,
  mergeWcEventIntoRate,
  normalizeWcMarketKey,
} from "~/entities/wc-odds/lib/wcRate";
import { fetchWcEvents, fetchWcEventDetail } from "~/entities/wc-odds/api/client";
import { Rate, Rates } from "../../types";
import { BetList } from "./BetList";
import styles from "./BetTab.module.css";

type BetTabProps = {
  classNameContainer?: string;
  setIsOpen: (value: React.SetStateAction<boolean | undefined>) => void;
  onBetAccepted?: () => void;
};
type Variant = "express" | "ordinar" | "series";

const STAKE_CHIPS = [500, 1000, 5000, 10000];

function getCurrencySuffix(code?: string | null): string {
  if (!code) return "";
  return getSymbolFromCurrency(code) || code;
}

function formatCouponAmount(amount: number, code?: string | null, digits = 2): string {
  return `${amount.toFixed(digits)}${getCurrencySuffix(code)}`;
}

export const BetTab: React.FC<BetTabProps> = ({
  classNameContainer,
  setIsOpen,
  onBetAccepted,
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

  const totalCoefficient = useMemo(
    () =>
      rates.reduce((acc, rate) => {
        const coef = Number(rate.coef);
        return Number.isFinite(coef) && coef > 0 ? acc * coef : acc;
      }, 1),
    [rates],
  );

  useEffect(() => {
    if (rates.length < 2) {
      setVariant("ordinar");
    } else if (rates.length > 1) {
      setVariant("express");
    }
    setKf(totalCoefficient);
  }, [rates, totalCoefficient]);

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

  useEffect(() => {
    const wcRates = rates.filter(
      (rate) => isWcOddsRate(rate) && rate.wcCommenceTime && !rate.wcCompleted,
    );
    if (wcRates.length === 0) return;

    const closeAtKickoff = () => {
      setRates((prev) => {
        let changed = false;
        const next = prev.map((rate) => {
          if (!isWcOddsRate(rate) || !rate.wcCommenceTime) return rate;
          const open = isWcEventBettingOpen({
            completed: rate.wcCompleted ?? false,
            commenceTime: rate.wcCommenceTime,
          });
          if (rate.isOpen === open && rate.isAvailable === open) return rate;
          changed = true;
          return { ...rate, isOpen: open, isAvailable: open };
        });
        return changed ? next : prev;
      });
    };

    const timerIds: number[] = [];
    for (const rate of wcRates) {
      const kickoffMs = Date.parse(rate.wcCommenceTime!);
      if (!Number.isFinite(kickoffMs)) continue;
      const msUntilClose = kickoffMs - Date.now();
      if (msUntilClose > 0) {
        timerIds.push(window.setTimeout(closeAtKickoff, msUntilClose));
      }
    }

    return () => {
      timerIds.forEach((id) => window.clearTimeout(id));
    };
  }, [rates, setRates]);

  // Проверка наличия игр в базе данных и удаление ставок с несуществующими eventId
  useEffect(() => {
    const validateRates = async () => {
      if (rates.length === 0) return;

      const wcRates = rates.filter(isWcOddsRate);
      const betApiRates = rates.filter((r) => !isWcOddsRate(r));

      if (wcRates.length > 0) {
        try {
          const detailCache = new Map<string, Awaited<ReturnType<typeof fetchWcEventDetail>>>();

          const getDetail = async (eventId: string) => {
            if (detailCache.has(eventId)) return detailCache.get(eventId)!;
            const detail = await fetchWcEventDetail(eventId);
            if (detail) detailCache.set(eventId, detail);
            return detail;
          };

          const eventMap = new Map<string, Awaited<ReturnType<typeof fetchWcEventDetail>>>();
          await Promise.all(
            [...new Set(wcRates.map((rate) => rate.eventId).filter(Boolean))].map(
              async (eventId) => {
                const detail = await getDetail(eventId!);
                if (detail) eventMap.set(eventId!, detail);
              },
            ),
          );

          if (eventMap.size > 0) {
            setRates((prev) => {
              const filtered = prev.filter((r) => {
                if (!isWcOddsRate(r)) return true;
                const event = eventMap.get(r.eventId || "");
                if (!event) return false;
                return isWcEventBettingOpen(event);
              });

              if (filtered.length !== prev.length) {
                toast.info("Приём ставок на матч закрыт");
                return filtered;
              }

              return prev;
            });
          }

          let updated = false;
          let removedUnavailable = false;
          const mappedRates = await Promise.all(
            rates.map(async (rate) => {
              if (!isWcOddsRate(rate)) return rate;

              const eventId = rate.eventId || "";
              const marketKey = getWcMarketKeyFromRate(rate);
              const outcomeKey = getWcOutcomeKeyFromRate(rate);

              if (marketKey === "h2h") {
                const pick = getWcPickFromRate(rate);
                if (!pick) return rate;
                const event = eventMap.get(eventId);
                if (!event) return rate;
                const open = isWcEventBettingOpen(event);
                const odd = getWcOddForPick(event, pick);
                if (odd == null) {
                  removedUnavailable = true;
                  return null;
                }
                const nextCoef = odd.toFixed(2);
                if (
                  rate.coef !== nextCoef
                  || rate.isOpen !== open
                  || rate.source !== "wc-odds"
                ) {
                  updated = true;
                  return { ...buildWcRate(event, pick, odd), sum: rate.sum };
                }
                return rate;
              }

              const detail = await getDetail(eventId);
              if (!detail || !outcomeKey) return rate;
              const open = isWcEventBettingOpen(detail);
              const odd = findWcOutcomeOdd(detail, marketKey, outcomeKey, rate.wcLine);
              if (odd == null) {
                removedUnavailable = true;
                return null;
              }
              const nextCoef = odd.toFixed(2);
              if (rate.coef !== nextCoef || rate.isOpen !== open) {
                updated = true;
                return mergeWcEventIntoRate(
                  {
                    ...rate,
                    coef: nextCoef,
                    isOpen: open,
                    isAvailable: open,
                  },
                  detail,
                );
              }
              return mergeWcEventIntoRate(rate, detail);
            }),
          );
          const nextRates = mappedRates.filter((rate): rate is Rates[number] => rate != null);

          if (removedUnavailable) {
            toast.info("Недоступные исходы удалены из купона");
          }

          if (updated || removedUnavailable) {
            setRates(nextRates);
          }
        } catch (error) {
          console.error("Error validating WC rates:", error);
        }
      }

      if (betApiRates.length === 0) return;

      try {
        const eventIds = betApiRates.map((rate) => rate.eventId);

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
        const invalidRates = betApiRates.filter((rate) => !validEventIds.includes(rate.eventId));

        const outdatedRates = [];
        const updatedRates = [...rates];

        for (let i = 0; i < updatedRates.length; i++) {
          const rate = updatedRates[i];
          if (isWcOddsRate(rate)) continue;
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
          setRates((prevRates) =>
            prevRates.filter(
              (rate) => isWcOddsRate(rate) || validEventIds.includes(rate.eventId),
            ),
          );
          toast.info("Некоторые ставки были удалены, так как игры больше не существуют");
        }

        if (outdatedRates.length > 0) {
          setRates(updatedRates);
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

    const wcRates = rates.filter(isWcOddsRate);
    const betApiRates = rates.filter((r) => !isWcOddsRate(r));

    if (wcRates.length > 0 && betApiRates.length > 0) {
      return toast("⚠️ Нельзя смешивать разные типы ставок в одном купоне", {
        position: "top-right",
      });
    }

    if (wcRates.length > 0) {
      if (wcRates.length > 1) {
        return toast("⚠️ Для этого события доступен только ординар", {
          position: "top-right",
        });
      }
      if (selectedAccountType !== "main") {
        return toast("⚠️ Эта ставка доступна только с основного счёта", {
          position: "top-right",
        });
      }

      const wcRate = wcRates[0];
      const marketKey = getWcMarketKeyFromRate(wcRate);
      const normalizedMarketKey = normalizeWcMarketKey(marketKey);
      const outcomeKey = getWcOutcomeKeyFromRate(wcRate);
      const wcPick = getWcPickFromRate(wcRate);

      if (!wcRate.eventId) {
        return toast("⚠️ Некорректная ставка", { position: "top-right" });
      }

      if (normalizedMarketKey === "h2h" && !wcPick) {
        return toast("⚠️ Некорректная ставка", { position: "top-right" });
      }
      if (normalizedMarketKey !== "h2h" && !outcomeKey) {
        return toast("⚠️ Некорректная ставка", { position: "top-right" });
      }

      setIsCreatingBet(true);
      const toastId = toast.loading("Создание ставки...");

      const token = getSessionClient();
      if (!token) {
        toast.dismiss(toastId);
        toast.error("Войдите в аккаунт");
        setIsCreatingBet(false);
        return;
      }

      const wcBetBody = {
        eventId: wcRate.eventId,
        pick: wcPick ?? undefined,
        marketKey,
        groupKey: getWcGroupKeyFromRate(wcRate) ?? undefined,
        outcomeKey,
        line: wcRate.wcLine,
        outcomeName: wcRate.title,
        stake: Number(sum),
        currencyCode: currency,
        acceptOddsChange: agree,
        clientOdds: agree ? undefined : Number(wcRate.coef),
      };

      const finishWcBetSuccess = async () => {
        await finishAcceptedBet(toastId);
      };

      try {
        const placed = await placeWcBet(token, wcBetBody) as { id?: number };
        await finishWcBetSuccess();
      } catch (e: unknown) {
        const err = e as Error & {
          coefficientChanged?: boolean;
          actualCoefficient?: number;
          statusCode?: number;
          rawMessage?: string;
        };
        const oddsChanged =
          err?.coefficientChanged
          || /odds have changed|коэффициент/i.test(err?.message ?? "");

        if (oddsChanged) {
          if (err.actualCoefficient != null) {
            setRates((prev) =>
              prev.map((rate) =>
                isWcOddsRate(rate) && rate.eventId === wcRate.eventId && rate.market === wcRate.market
                  ? { ...rate, coef: String(err.actualCoefficient) }
                  : rate,
              ),
            );
          }

          toast.dismiss(toastId);
          toast.info("Коэффициенты обновлены", { toastId: "wc-bet-odds-updated" });

          if (agree) {
            try {
              const placed = await placeWcBet(token, { ...wcBetBody, acceptOddsChange: true, clientOdds: undefined }) as { id?: number };
              await finishWcBetSuccess();
              setIsCreatingBet(false);
              return;
            } catch (retryErr: unknown) {
              const retry = retryErr as Error & { rawMessage?: string; statusCode?: number };
              const retryRaw = retry.rawMessage ?? (retry instanceof Error ? retry.message : "");
              if (isWcBetOutcomeClosedError(retryRaw)) {
                setRates((prev) => prev.filter((rate) => rate !== wcRate));
              }
              toast.error(retry instanceof Error ? retry.message : "Ошибка ставки");
              setIsCreatingBet(false);
              return;
            }
          }

          setIsCreatingBet(false);
          return;
        }

        const rawMessage = err.rawMessage ?? (err instanceof Error ? err.message : "");
        if (isWcBetOutcomeClosedError(rawMessage)) {
          setRates((prev) => prev.filter((rate) => rate !== wcRate));
        }

        const displayMessage = err instanceof Error ? err.message : "Ошибка ставки";
        toast.update(toastId, {
          render: displayMessage,
          type: "error",
          isLoading: false,
          autoClose: 5000,
        });
      } finally {
        setIsCreatingBet(false);
      }
      return;
    }

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

      await finishAcceptedBet(toastId);

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

  const potentialWin = useMemo(() => {
    const stake = Number(sum) || 0;
    if (stake <= 0 || rates.length === 0) return 0;
    const coef = totalCoefficient > 0 ? totalCoefficient : kf;
    return stake * coef;
  }, [sum, kf, totalCoefficient, rates.length]);

  const finishAcceptedBet = async (toastId?: string | number) => {
    if (toastId != null) toast.dismiss(toastId);
    toast.success("Ставка принята");
    setRates([]);
    setSum("");
    onBetAccepted?.();
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["bets", "pending"] }),
      queryClient.invalidateQueries({ queryKey: ["bets", "open"] }),
      queryClient.invalidateQueries({ queryKey: ["wc-bets"] }),
      queryClient.invalidateQueries({ queryKey: ["wc-bets", "pending"] }),
      queryClient.invalidateQueries({ queryKey: ["bets"] }),
      queryClient.invalidateQueries({ queryKey: ["bets-history"] }),
      queryClient.invalidateQueries({ queryKey: ["user"] }),
    ]);
  };

  const renderPotentialWinLabel = () => {
    if (selectedAccountType === "bonus") {
      const bonusBalance = userData?.bonusBalances?.find(
        ({ currencyCode }) => currencyCode === currency,
      );
      if (bonusBalance?.isTokenBased) {
        return "Возможный выигрыш (на основной счёт)";
      }
    }
    return "Возможный выигрыш";
  };

  const renderPotentialWinValue = () => {
    if (selectedAccountType === "bonus") {
      const bonusBalance = userData?.bonusBalances?.find(
        ({ currencyCode }) => currencyCode === currency,
      );
      if (bonusBalance?.isTokenBased) {
        return `${totalSum.toFixed(0)} жетонов`;
      }
    }
    return formatCouponAmount(potentialWin, currency);
  };

  const renderStakeSumValue = () => {
    if (selectedAccountType === "bonus") {
      const bonusBalance = userData?.bonusBalances?.find(
        ({ currencyCode }) => currencyCode === currency,
      );
      if (bonusBalance?.isTokenBased) {
        return `${totalSum.toFixed(0)} жетонов`;
      }
    }
    return formatCouponAmount(Number(sum) || 0, currency);
  };

  const isAllOpen = rates.every((rate) => rate.isOpen);

  return (
    <>
      <div className={`${styles.BetTab} ${classNameContainer}`}>
        <div className={styles.betTabScroll}>
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
          currencyCode={currency}
          deleteButtonOnClickHandler={deleteButtonOnClickHandler}
          rates={rates}
          stakeAmount={Number(sum) || 0}
          variant={variant}
        />

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

        {selectedAccountType === "bonus" ? (
          <div
            className={`${styles.accountTypeIndicator} ${(() => {
              const bonusBalance = userData?.bonusBalances?.find(
                ({ currencyCode }) => currencyCode === currency,
              );
              return bonusBalance?.isTokenBased ? styles.tokenBasedIndicator : "";
            })()}`}
          >
            <span className={styles.accountTypeLabel}>
              🎁 Бонусный счет
              {(() => {
                const bonusBalance = userData?.bonusBalances?.find(
                  ({ currencyCode }) => currencyCode === currency,
                );
                if (bonusBalance?.isTokenBased) {
                  return (
                    <span className={styles.tokenInfo}>
                      {" "}({bonusBalance.remainingTokens} жетонов осталось)
                    </span>
                  );
                }
                return null;
              })()}
            </span>
          </div>
        ) : null}

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
        </div>

        <div className={styles.betTabStickyFooter}>
        {rates.length === 0 && (
          <>
            <div className={styles.potentialWinHero}>
              <p className={styles.potentialWinHeroLabel}>Возможный выигрыш</p>
              <p className={styles.potentialWinHeroValue}>
                {formatCouponAmount(0, currency)}
              </p>
            </div>
            <div className={styles.totalSumRow}>
              <p className={styles.totalSumLabel}>Сумма всех ставок:</p>
              <p className={styles.totalSumValue}>
                {formatCouponAmount(totalSum, currency)}
              </p>
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
            <div className={styles.potentialWinHero}>
              <p className={styles.potentialWinHeroLabel}>{renderPotentialWinLabel()}</p>
              <p className={styles.potentialWinHeroValue}>{renderPotentialWinValue()}</p>
            </div>
            <div className={styles.totalSumRow}>
              <p className={styles.totalSumLabel}>Сумма всех ставок:</p>
              <p className={styles.totalSumValue}>{renderStakeSumValue()}</p>
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
            {selectedAccountType === "main" ? (
              <div className={styles.stakeChips}>
                {STAKE_CHIPS.map((chip) => (
                  <Button
                    key={chip}
                    className={cn(
                      styles.stakeChip,
                      Number(sum) === chip && styles.stakeChipActive,
                    )}
                    onClick={() => setSum(String(chip))}
                    type="button"
                  >
                    {chip.toLocaleString("ru-RU")}
                  </Button>
                ))}
              </div>
            ) : null}
          </>
        )}

        <Button
          className={styles.baseCouponSubmit}
          disabled={Number(sum) <= 0 || !agree || isCreatingBet || (rates.length > 0 && !isAllOpen)}
          onClick={createBetOnClick}
          type="submit"
        >
          {isCreatingBet ? "Создание..." :
            rates.length === 0 ? "Поставить" :
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
      </div>
    </>
  );
};