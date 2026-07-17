import { useRef, useState } from "react";

import { isEsportsApiSport } from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import { components } from "~/shared/api";

import { convertToFixed } from "../../lib";
import { useWebSocketContext } from "../../lib/WebSocketContext";
import { useGamesWebSocket } from "../../lib/useGamesWebSocket";

// Helper: robust isOpen calculation from oc_block which can be boolean/number/string
const computeIsOpen = (gm?: components["schemas"]["MarketDto"]): boolean => {
  if (!gm) return false;
  const oc: any = (gm as any).oc_block;
  if (oc === true || oc === 1 || oc === '1') return false;
  return true;
};

type Info = {
  currentPlayer?: "0" | "1" | "2";
};

type LocalMarket = {
  cf: string;
  groupedMarket?: components["schemas"]["MarketDto"];
  isOpen: boolean;
};
type Return = {
  data?: components["schemas"]["GameDtoWithGroupedMarkets"];
  info: Info;
  markets: {
    [key: string]: LocalMarket;
  } | null;
  marketsCount: number;
  score?: components["schemas"]["GameDtoWithGroupedMarkets"]["parsedScore"];
};

export const useMatchRow = (
  matchData: components["schemas"]["GameDtoWithGroupedMarkets"],
): Return => {
  const { isConnected } = useWebSocketContext();
  
  // Cache last found markets to reduce flicker on partial updates
  const lastMarketsRef = useRef<Record<string, LocalMarket>>({});

  const { data } = useGamesWebSocket({
    eventId: matchData.eventId,
    initialData: matchData,
  });

  const scoreGroups = data?.parsedScore;

  const defaultReturn: Return = {
    data,
    info: { currentPlayer: undefined },
    markets: null,
    marketsCount: 0,
    score: scoreGroups,
  };
  const groupedMarkets = data?.groupedMarkets;

  if (typeof groupedMarkets === "undefined") {
    // Return cached data if available
    if (Object.keys(lastMarketsRef.current).length > 0) {
      return {
        ...defaultReturn,
        markets: Object.keys(lastMarketsRef.current).length > 0 ? lastMarketsRef.current : null,
      };
    }
    return defaultReturn;
  }

  let marketsCount = 0;

  Object.keys(groupedMarkets).map((groupedMarketKey) => {
    const groupedMarket = groupedMarkets[groupedMarketKey];
    marketsCount = marketsCount + groupedMarket.length;
  });

  // Returns acceptable alias variants for a target market name
  const marketAliases = (market: string): string[] => {
    switch (market) {
      case "WIN__P1":
        return ["WIN__P1", "WIN_RT__P1", "WIN_OT__P1", "WIN__1", "WIN_HOME"];
      case "WIN__P2":
        return ["WIN__P2", "WIN_RT__P2", "WIN_OT__P2", "WIN__2", "WIN_AWAY"];
      case "WIN__PX":
        return ["WIN__PX", "WIN_RT__PX", "WIN_OT__PX", "WIN__X", "WIN_DRAW"];
      case "WIN__1X":
        return ["WIN__1X", "DOUBLE_CHANCE__1X", "DC__1X"]; 
      case "WIN__12":
        return ["WIN__12", "DOUBLE_CHANCE__12", "DC__12"]; 
      case "WIN__X2":
        return ["WIN__X2", "DOUBLE_CHANCE__X2", "DC__X2"]; 
      default:
        return [market];
    }
  };

  // Enhanced finder with fallback bases (e.g., try WIN_RT, then WIN) and alias markets
  const findMarket = (base: string | string[], market: string): LocalMarket => {
    
    const basesToTry = Array.isArray(base) ? base : [base];
    const candidates = marketAliases(market);
    
    
    for (const b of basesToTry) {
      if (!groupedMarkets[b]) {
        continue;
      }
      
      const list = groupedMarkets[b];
      
      // Try exact first, then aliases
      const gm = list.find((m: components["schemas"]["MarketDto"]) => m.market === market) 
        || list.find((m: components["schemas"]["MarketDto"]) => candidates.includes(m.market));
        
      if (gm) {
        
        const found: LocalMarket = {
          cf: convertToFixed(`${gm.cf}`),
          groupedMarket: gm,
          isOpen: computeIsOpen(gm),
        };
        
        
        // Save to cache
        lastMarketsRef.current[market] = found;
        return found;
      }
    }
    
    
    for (const key of Object.keys(groupedMarkets)) {
      const list = groupedMarkets[key];
      const gm = list.find((mm: components["schemas"]["MarketDto"]) => candidates.includes(mm.market));
      if (gm) {
        
        const found: LocalMarket = {
          cf: convertToFixed(`${gm.cf}`),
          groupedMarket: gm,
          isOpen: computeIsOpen(gm),
        };
        
        
        // Save to cache
        lastMarketsRef.current[market] = found;
        return found;
      }
    }
    
    // If not found, try to use cached value to prevent flicker
    if (lastMarketsRef.current[market] && lastMarketsRef.current[market].cf !== "--") {
      return lastMarketsRef.current[market];
    }
    
    const emptyMarket: LocalMarket = {
      cf: "--",
      groupedMarket: undefined,
      isOpen: false,
    };
    
    
    return emptyMarket;
  };

  // Функция getTotals удалена - тоталы больше не отображаются

  switch (data?.sport) {
    case "tennis": {
      const WIN__P1 = findMarket("WIN", "WIN__P1");
      const WIN__P2 = findMarket("WIN", "WIN__P2");

      return {
        data,
        info: defaultReturn.info,
        markets: {
          WIN__P1,
          WIN__P2,
        },
        marketsCount,
        score: scoreGroups,
      };
    }

    case "table-tennis": {
      const WIN__P1 = findMarket("WIN", "WIN__P1");
      const WIN__P2 = findMarket("WIN", "WIN__P2");

      return {
        data,
        info: defaultReturn.info,
        markets: {
          WIN__P1,
          WIN__P2,
        },
        marketsCount,
        score: scoreGroups,
      };
    }

    case "volleyball": {
      const WIN__P1 = findMarket("WIN", "WIN__P1");
      const WIN__P2 = findMarket("WIN", "WIN__P2");

      return {
        data,
        info: defaultReturn.info,
        markets: {
          WIN__P1,
          WIN__P2,
        },
        marketsCount,
        score: scoreGroups,
      };
    }

    case "basketball": {
      // Fallback to WIN if split groups are missing
      const WIN_OT__P1 = findMarket(["WIN_OT", "WIN"], "WIN_OT__P1");
      const WIN_OT__P2 = findMarket(["WIN_OT", "WIN"], "WIN_OT__P2");
      const WIN_RT__PX = findMarket(["WIN_RT", "WIN"], "WIN_RT__PX");
      return {
        data,
        info: defaultReturn.info,
        markets: {
          WIN_OT__P1,
          WIN_RT__PX,
          WIN_OT__P2,
        },
        marketsCount,
        score: scoreGroups,
      };
    }

    case "hockey": {
      // Fallback to WIN if WIN_RT group is not present
      const WIN_RT__P1 = findMarket(["WIN_RT", "WIN"], "WIN_RT__P1");
      const WIN_RT__P2 = findMarket(["WIN_RT", "WIN"], "WIN_RT__P2");
      const WIN_RT__PX = findMarket(["WIN_RT", "WIN"], "WIN_RT__PX");

      return {
        data,
        info: defaultReturn.info,
        markets: {
          WIN_RT__P1,
          WIN_RT__PX,
          WIN_RT__P2,
        },
        marketsCount,
        score: scoreGroups,
      };
    }

    case "soccer": {
      const WIN__P1 = findMarket("WIN", "WIN__P1");
      const WIN__P2 = findMarket("WIN", "WIN__P2");
      const WIN__PX = findMarket("WIN", "WIN__PX");
      const WIN__1X = findMarket("WIN", "WIN__1X");
      const WIN__12 = findMarket("WIN", "WIN__12");
      const WIN__X2 = findMarket("WIN", "WIN__X2");

      const markets = {
        WIN__P1,
        WIN__PX,
        WIN__P2,
        WIN__1X,
        WIN__12,
        WIN__X2,
      };
      
      // Cache the markets
      lastMarketsRef.current = markets;
      
      return {
        data,
        info: defaultReturn.info,
        markets,
        marketsCount,
        score: scoreGroups,
      };
    }

    default: {
      const sportKey = data?.sport ?? "";
      if (isEsportsApiSport(sportKey)) {
        const WIN__P1 = findMarket("WIN", "WIN__P1");
        const WIN__P2 = findMarket("WIN", "WIN__P2");

        return {
          data,
          info: defaultReturn.info,
          markets: { WIN__P1, WIN__P2 },
          marketsCount,
          score: scoreGroups,
        };
      }

      return { ...defaultReturn, marketsCount };
    }
  }
};
