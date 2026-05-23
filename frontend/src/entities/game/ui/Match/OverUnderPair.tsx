import React from 'react';
import { useLocalStorage } from "usehooks-ts";
import { components } from "~/shared/api";
import { Button } from "~/shared/ui";
import { AccessIcon } from "~/shared/assets";
import { Rate, Rates } from "~/entities/bet/types/types";
import { usePrevious } from "~/shared/model";
import { convertToFixed } from "~/entities/game/lib";
import { cn } from "~/shared/lib";
import styles from "~/entities/game/ui/Match/Match.module.css";

type MarketDto = components["schemas"]["MarketDto"];

interface OverUnderPairProps {
  underMarket?: MarketDto;
  overMarket?: MarketDto;
  size: number;
  eventId: string;
  eventName: string;
  parentEventId?: string;
  groupName: string;
  isLive?: boolean;
}

export const OverUnderPair: React.FC<OverUnderPairProps> = ({
  underMarket,
  overMarket,
  size,
  eventId,
  eventName,
  parentEventId,
  groupName,
  isLive
}) => {
  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });

  const handleBetClick = (market: MarketDto) => {
    const existingBetIndex = rates.findIndex(bet => bet.market === market.market);
    
    if (existingBetIndex !== -1) {
      // Удаляем ставку
      setRates(prevRates => prevRates.filter((_, index) => index !== existingBetIndex));
    } else {
      // Для subgames удаляем все ставки с тем же parentEventId, для обычных игр - с тем же eventId
      const gameIdToCheck = parentEventId || eventId;
      const updatedRates = rates.filter(bet => {
        const rateGameId = bet.parentEventId || bet.eventId;
        return rateGameId !== gameIdToCheck;
      });
      
      // Добавляем новую ставку
      const marketAny = market as any;
      const newRate: Rate = {
        market: market.market,
        coef: String(market.cf),
        eventId: eventId,
        eventName: eventName,
        parentEventId: parentEventId,
        groupedMarket: market,
        isOpen: marketAny.isOpen ?? true,
        title: marketAny.oc_name || marketAny.display_name || `${size} ${market.market.includes('М') ? 'М' : 'Б'}`,
        isAvailable: market.available ?? true,
        oc_block: market.oc_block,
        blocked: market.blocked,
        available: market.available,
        isLive: isLive
      };
      setRates([...updatedRates, newRate]);
    }
  };

  const isUnderSelected = underMarket ? rates.some(bet => bet.market === underMarket.market) : false;
  const isOverSelected = overMarket ? rates.some(bet => bet.market === overMarket.market) : false;

  const isUnderAvailable = underMarket ? (underMarket.available && !underMarket.oc_block) : false;
  const isOverAvailable = overMarket ? (overMarket.available && !overMarket.oc_block) : false;

  // Коэффициенты для анимации
  const underValue = underMarket ? `${underMarket.cf}` : "0";
  const overValue = overMarket ? `${overMarket.cf}` : "0";

  // Предыдущие значения для мигания с дебаунсингом
  const { prevState: prevUnder } = usePrevious(underValue, 800);
  const { prevState: prevOver } = usePrevious(overValue, 800);

  // Анимация изменения коэффициентов
  let underCoefClass = "";
  if (typeof prevUnder !== "undefined" && isUnderAvailable) {
    if (+underValue > +prevUnder) underCoefClass = styles.oddCoefficient_up;
    else if (+underValue < +prevUnder) underCoefClass = styles.oddCoefficient_down;
  }

  let overCoefClass = "";
  if (typeof prevOver !== "undefined" && isOverAvailable) {
    if (+overValue > +prevOver) overCoefClass = styles.oddCoefficient_up;
    else if (+overValue < +prevOver) overCoefClass = styles.oddCoefficient_down;
  }

  return (
    <div className={cn(styles.oddsBlock, styles.oddsBlockPair, styles.oddsBlockPairOU)}>
      {underMarket && (
        <div className={cn(styles.oddsItem, !isUnderAvailable && styles.oddsItem_lock)}>
          <Button
            className={cn(styles.odd, isUnderSelected && styles.odd_added)}
            disabled={!isUnderAvailable}
            onClick={() => isUnderAvailable && handleBetClick(underMarket)}
          >
            <p className={cn(styles.oddCoef, underCoefClass)}>
              {convertToFixed(underValue)}
              {!isUnderAvailable && <AccessIcon className={styles.lock} />}
            </p>
            <p className="text-sm font-medium text-black w-[65px] text-start">Меньше</p>
          </Button>
        </div>
      )}
      
      <div className={styles.totalsPivot}>{size}</div>
      
      {overMarket && (
        <div className={cn(styles.oddsItem, !isOverAvailable && styles.oddsItem_lock)}>
          <Button
            className={cn(styles.odd, isOverSelected && styles.odd_added)}
            disabled={!isOverAvailable}
            onClick={() => isOverAvailable && handleBetClick(overMarket)}
          >
            <p className="text-sm font-medium text-black w-[62.5px] text-end">Больше</p>
            <p className={cn(styles.oddCoef, overCoefClass)}>
              {convertToFixed(overValue)}
              {!isOverAvailable && <AccessIcon className={styles.lock} />}
            </p>
          </Button>
        </div>
      )}
    </div>
  );
};