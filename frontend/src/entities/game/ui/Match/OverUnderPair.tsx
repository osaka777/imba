import React from "react";
import { useLocalStorage } from "usehooks-ts";
import { components } from "~/shared/api";
import { Rate, Rates } from "~/entities/bet/types/types";
import { usePrevious } from "~/shared/model";
import { useLocale } from "~/shared/model/useLocale";
import { MarketPairRow } from "~/entities/markets/ui/MarketPairRow";

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
  isLive,
}) => {
  const { t } = useLocale();
  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });

  const handleBetClick = (market: MarketDto) => {
    const existingBetIndex = rates.findIndex((bet) => bet.market === market.market);

    if (existingBetIndex !== -1) {
      setRates((prevRates) => prevRates.filter((_, index) => index !== existingBetIndex));
    } else {
      const gameIdToCheck = parentEventId || eventId;
      const updatedRates = rates.filter((bet) => {
        const rateGameId = bet.parentEventId || bet.eventId;
        return rateGameId !== gameIdToCheck;
      });

      const marketAny = market as Record<string, unknown>;
      const newRate: Rate = {
        market: market.market,
        coef: String(market.cf),
        eventId: eventId,
        eventName: eventName,
        parentEventId: parentEventId,
        groupedMarket: market,
        isOpen: (marketAny.isOpen as boolean | undefined) ?? true,
        title:
          (marketAny.oc_name as string | undefined)
          || (marketAny.display_name as string | undefined)
          || `${size} ${market.market.includes("М") ? "М" : "Б"}`,
        isAvailable: market.available ?? true,
        oc_block: market.oc_block,
        blocked: market.blocked,
        available: market.available,
        isLive: isLive,
      };
      setRates([...updatedRates, newRate]);
    }
  };

  const underValue = underMarket ? `${underMarket.cf}` : "0";
  const overValue = overMarket ? `${overMarket.cf}` : "0";

  const { prevState: prevUnder } = usePrevious(underValue, 800);
  const { prevState: prevOver } = usePrevious(overValue, 800);

  let underCoefClass = "";
  const isUnderAvailable = underMarket ? underMarket.available && !underMarket.oc_block : false;
  if (typeof prevUnder !== "undefined" && isUnderAvailable) {
    if (+underValue > +prevUnder) underCoefClass = styles.oddCoefficient_up;
    else if (+underValue < +prevUnder) underCoefClass = styles.oddCoefficient_down;
  }

  let overCoefClass = "";
  const isOverAvailable = overMarket ? overMarket.available && !overMarket.oc_block : false;
  if (typeof prevOver !== "undefined" && isOverAvailable) {
    if (+overValue > +prevOver) overCoefClass = styles.oddCoefficient_up;
    else if (+overValue < +prevOver) overCoefClass = styles.oddCoefficient_down;
  }

  return (
    <MarketPairRow
      handicapLayout
      pivot={size}
      showPivot
      left={
        underMarket
          ? {
              label: t("common.under"),
              value: underValue,
              selected: rates.some((bet) => bet.market === underMarket.market),
              bettable: isUnderAvailable,
              flashCoef: underCoefClass,
              onClick: () => handleBetClick(underMarket),
            }
          : undefined
      }
      right={
        overMarket
          ? {
              label: t("common.over"),
              value: overValue,
              selected: rates.some((bet) => bet.market === overMarket.market),
              bettable: isOverAvailable,
              flashCoef: overCoefClass,
              onClick: () => handleBetClick(overMarket),
            }
          : undefined
      }
    />
  );
};
