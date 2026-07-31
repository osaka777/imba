import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Rates } from "~/entities/bet";
import { createTitleForBet } from "~/entities/bet/lib";
import { components } from "~/shared/api";
import { AccessIcon } from "~/shared/assets";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { usePrevious } from "~/shared/model";
import { useLocale } from "~/shared/model/useLocale";
import { Button } from "~/shared/ui";

import styles from "./MatchRow.module.css";

type MatchFieldsCellProps = {
  className?: string;
  eventId: string;
  eventName: string;
  groupedMarket: components["schemas"]["MarketDto"];
  isOpen: boolean;
  market: string;
  value: string;
  isLive: boolean;
};

export const MatchFieldsCell: React.FC<MatchFieldsCellProps> = ({
  className,
  eventId,
  eventName,
  groupedMarket,
  isOpen,
  market,
  value,
  isLive,
}) => {
  const { t } = useLocale();
  const { prevState } = usePrevious(value);
  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });
  const [isRateAdded, setIsRateAdded] = useState(false);

  // Убрали неиспользуемые функции для оптимизации

  // Оптимизированная функция переключения ставки
  const toggleRate = useCallback((market: string, coef: string) => () => {
    if (!isRateAdded) {
      setRates((prev) => {
        const isAnyMatchRateAdded = prev.findIndex((rate) => rate.eventId === eventId);
        if (isAnyMatchRateAdded !== -1) {
          const newRates = [...prev];
          newRates[isAnyMatchRateAdded] = {
            coef,
            eventId: eventId,
            eventName,
            groupedMarket,
            isOpen,
            market,
            title: createTitleForBet(groupedMarket, undefined, t) || (groupedMarket as any)?.oc_name || (groupedMarket as any)?.name || market,
            isAvailable: isOpen && !(groupedMarket as any)?.oc_block,
            isLive,
            oc_block: (groupedMarket as any)?.oc_block,
            blocked: (groupedMarket as any)?.blocked,
            available: (groupedMarket as any)?.available,
          };
          return newRates;
        }
        return [
          ...prev,
          {
            coef,
            eventId: eventId,
            eventName,
            groupedMarket,
            isOpen,
            market,
            title: createTitleForBet(groupedMarket, undefined, t) || (groupedMarket as any)?.oc_name || (groupedMarket as any)?.name || market,
            isAvailable: isOpen && !(groupedMarket as any)?.oc_block,
            isLive,
            oc_block: (groupedMarket as any)?.oc_block,
            blocked: (groupedMarket as any)?.blocked,
            available: (groupedMarket as any)?.available,
          },
        ];
      });
      setIsRateAdded(true);
    } else {
      setRates((prev) => {
        const index = prev.findIndex(
          (rate) => rate.market === market && rate.eventId === eventId
        );
        if (index === -1) return prev;

        const newRates = [...prev];
        newRates.splice(index, 1);
        return newRates;
      });
      setIsRateAdded(false);
    }
  }, [isRateAdded, eventId, eventName, groupedMarket, isOpen, market, isLive]); // Убрали лишние зависимости

  // Объединенный useEffect для синхронизации состояния
  useEffect(() => {
    const rateIndex = rates.findIndex(
      (rate) => rate.market === market && rate.eventId === eventId
    );
    const isCurrentlyAdded = rateIndex !== -1;

    // Синхронизируем состояние isRateAdded с фактическим наличием ставки
    if (isRateAdded !== isCurrentlyAdded) {
      setIsRateAdded(isCurrentlyAdded);
    }
  }, [rates, market, eventId, isRateAdded]); // Упростили зависимости

  // Отдельный useEffect для обновления коэффициента
  useEffect(() => {
    if (!isRateAdded) return; // Если ставка не добавлена, не обновляем

    const rateIndex = rates.findIndex(
      (rate) => rate.market === market && rate.eventId === eventId
    );
    
    if (rateIndex !== -1) {
      setRates((prev) =>
        prev.map((rate) =>
          rate.market === market && rate.eventId === eventId
            ? { 
                coef: value, 
                eventId, 
                eventName, 
                groupedMarket, 
                isOpen, 
                market,
                isAvailable: isOpen && !(groupedMarket as any)?.oc_block,
                isLive,
                oc_block: (groupedMarket as any)?.oc_block,
                blocked: (groupedMarket as any)?.blocked,
                available: (groupedMarket as any)?.available,
              }
            : rate,
        ),
      );
    }
  }, [value, market, eventId, eventName, isOpen, groupedMarket, isRateAdded, isLive]); // Убрали rates из зависимостей

  // Мемоизированные классы статуса
  const statusClassNames = useMemo(
    () =>
      wcOddsFlashClasses(value, prevState, {
        oddFlash_up: styles.oddCell_up,
        oddFlash_down: styles.oddCell_down,
        oddCoefficient_up: styles.oddCoefficient_up,
        oddCoefficient_down: styles.oddCoefficient_down,
      }),
    [value, prevState],
  );

  // Мемоизированный текст для отображения
  const displayText = useMemo(() => {
    // Используем createTitleForBet для всех типов ставок
    if (groupedMarket) {
      return createTitleForBet(groupedMarket, market, t);
    }
    
    // Fallback для старых типов ставок
    if (market === "WIN__P1" || market === "WIN_RT__P1" || market === "WIN_OT__P1") {
      return "П1";
    }
    if (market === "WIN__P2" || market === "WIN_RT__P2" || market === "WIN_OT__P2") {
      return "П2";
    }
    if (market === "WIN__PX" || market === "WIN_RT__PX" || market === "WIN_OT__PX") {
      return "X";
    }
    
    return "";
  }, [market, groupedMarket]);

  // Проверяем доступность ставки: учитываем oc_block из groupedMarket
  const isAvailable = isOpen && !(groupedMarket as any)?.oc_block;


  // Мемоизированный обработчик клика
  const handleClick = useMemo(() => {
    if (isAvailable && value !== "--" && market !== "FRONT_NEEDS_TOTAL") {
      return toggleRate(market, value);
    }
    return undefined;
  }, [isAvailable, value, market, toggleRate]);

  return (
    <Button
      className={`${styles.oddCell} ${statusClassNames.cell} ${isRateAdded && styles.oddCell_added} ${className}`}
      data-market={market}
      disabled={!isAvailable}
      onClick={handleClick}
    >
      {isAvailable ? null : <AccessIcon className={styles.lock} />}
      <p className={styles.addedGameName}>{displayText}</p>
      <p
        className={`${styles.oddCoefficient} ${statusClassNames.coef} ${isRateAdded && styles.oddCoefficient_added}`}
      >
        {value}
      </p>
    </Button>
  );
};
