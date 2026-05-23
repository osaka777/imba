import { useLocalStorage } from "usehooks-ts";
import { useEffect } from "react";
import { Rates } from "~/entities/bet";
import { components } from "~/shared/api";
import { cn } from "~/shared/lib";
import { OverUnderPair } from "./OverUnderPair";
import { SingleBetRow } from "./SingleBetRow";
import styles from "./Match.module.css";
import { PXPair } from "./PXPair";

type MarketDto = components["schemas"]["MarketDto"];

type OddsItemProps = {
  eventId: string;
  eventName: string;
  marketData: MarketDto[];
  isLive?: boolean;
  subGameId?: number;
  subGameName?: string;
  parentEventId?: string;
  groupName?: string;
};

export const OddsItem: React.FC<OddsItemProps> = ({
  eventId,
  eventName,
  marketData,
  isLive,
  subGameId,
  subGameName,
  parentEventId,
  groupName,
}) => {
  if (marketData.length === 0) return null;

  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });

  // Получаем текущую ставку по этому событию
  const currentRate = rates.find((rate) => rate.eventId === eventId);

  const toggleRate = (item: MarketDto) => () => {
    const isAlreadyAdded = currentRate?.market === item.market;

    if (!isAlreadyAdded) {
      // Логирование для отладки передачи subGameId
      console.log('[OddsItem] Creating rate with subGameId:', subGameId, 'subGameName:', subGameName, 'eventId:', eventId);
      
      const newRate = {
        coef: `${(item as any).odds || (item as any).cf || (item as any).oc_rate}`,
        eventId,
        eventName,
        groupedMarket: item,
        isOpen: (item as any).isOpen,
        market: (item as any).market,
        title: (item as any).oc_name || (item as any).name || (item as any).market,
        isAvailable: (item as any).isOpen && !(item as any).oc_block,
        isLive: !!isLive,
        oc_block: (item as any).oc_block,
        blocked: (item as any).blocked,
        available: (item as any).available,
        subGameId,
        subGameName,
        parentEventId,
      };
      
      // Для subgames удаляем все ставки с тем же parentEventId, для обычных игр - с тем же eventId
      setRates((prev) => {
        const gameIdToCheck = parentEventId || eventId;
        const newRates = [
          ...prev.filter((r) => {
            const rateGameId = r.parentEventId || r.eventId;
            return rateGameId !== gameIdToCheck;
          }),
          newRate,
        ];
        return newRates;
      });

      // 🔥 Открываем купон
      window.dispatchEvent(new CustomEvent("open-coupon"));
    } else {
      // Удаляем ставку (используем ту же логику проверки игры)
      const gameIdToCheck = parentEventId || eventId;
      setRates((prev) => prev.filter((r) => {
        const rateGameId = r.parentEventId || r.eventId;
        return rateGameId !== gameIdToCheck || r.market !== item.market;
      }));
    }
  };

  // Логика для обработки тоталов (меньше/больше)
  const isTotalGroup = groupName && (
    groupName === "тотал" || 
    groupName === "Тотал" ||
    groupName === "TOTAL"
  );

  if (isTotalGroup) {
    // Группируем ставки по размеру
    const totalPairs: { [key: string]: { under?: MarketDto, over?: MarketDto, size: string } } = {};
    
    marketData.forEach(market => {
      // Извлекаем размер из различных полей
      let size = "0";
      const marketAny = market as any;
      
      // Приоритет: pivot -> oc_size -> извлечение из oc_name -> извлечение из market
      if (market.pivot && market.pivot !== null && market.pivot !== undefined) {
        size = market.pivot.toString();
      } else if (marketAny.oc_size) {
        size = marketAny.oc_size.toString();
      } else if (marketAny.oc_name) {
        // Извлекаем число из строки типа "73.5 М" или "73.5 Б"
        const match = marketAny.oc_name.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          size = match[1];
        }
      } else {
        // Извлекаем из названия рынка
        const match = market.market.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          size = match[1];
        }
      }
      
      const isUnder = market.market.includes('М') || (marketAny.oc_name && marketAny.oc_name.includes('М'));
      const isOver = market.market.includes('Б') || (marketAny.oc_name && marketAny.oc_name.includes('Б'));
      
      if (!totalPairs[size]) {
        totalPairs[size] = { size };
      }
      
      if (isUnder) {
        totalPairs[size].under = market;
      } else if (isOver) {
        totalPairs[size].over = market;
      }
    });

    // Отображаем все пары тоталов (даже неполные), отсортированные по размеру от меньшего к большему
    const allPairs = Object.values(totalPairs)
      .filter(pair => pair.under || pair.over)
      .sort((a, b) => parseFloat(a.size) - parseFloat(b.size));
    
    if (allPairs.length > 0) {
       return (
         <>
           {allPairs.map((pair) => (
              <OverUnderPair
                key={pair.size}
                underMarket={pair.under}
                overMarket={pair.over}
                size={parseFloat(pair.size)}
                eventId={eventId}
                eventName={eventName}
                parentEventId={parentEventId}
                groupName={groupName || ""}
                isLive={isLive}
              />
            ))}
        </>
      );
    }
  }

  // Check for 1X2 group using passed groupName prop
  const is1X2 = groupName === "1X2" || groupName === "WIN";
  if (is1X2) {
    // Проверяем, есть ли только базовые ставки P1, PX, P2 (без комбинированных)
    const marketPX = marketData.find((x) => !(x as any).ot_rt && (x as any).plr === "PX")
    const marketP1 = marketData.find((x) => !(x as any).ot_rt && (x as any).plr === "P1")
    const marketP2 = marketData.find((x) => !(x as any).ot_rt && (x as any).plr === "P2")
    
    // Проверяем, есть ли комбинированные ставки (1X, 12, X2)
    const hasCombinedBets = marketData.some((x) => {
      const plr = (x as any).plr;
      return plr === "1X" || plr === "12" || plr === "X2";
    });
    
    // Используем PXPair только если есть все базовые ставки И нет комбинированных
    if (marketPX && marketP1 && marketP2 && !hasCombinedBets) {
      return (
        <div className={cn(styles.oddsBlock, styles.oddsBlockPX)}>
          <PXPair
            isRateAddedP1={currentRate?.market === marketP1.market}
            isRateAddedP2={currentRate?.market === marketP2.market}
            isRateAddedPX={currentRate?.market === marketPX.market}
            p1={marketP1}
            p2={marketP2}
            px={marketPX}
            toggleRate={toggleRate}
          />
        </div>
      )
    }
  }
  return (
    <div className={cn(styles.oddsBlock)}>
      {marketData.map((item) => {
        const isRateAdded = currentRate?.market === (item as any).market;
        return (
          <SingleBetRow
            isRateAdded={isRateAdded}
            item={item}
            key={(item as any).market}
            toggleRate={toggleRate}
            is1X2={is1X2}
          />
        );
      })}
    </div>
  );
};
