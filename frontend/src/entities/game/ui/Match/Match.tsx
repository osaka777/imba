"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

import { LoadingScreen, Button } from "~/shared/ui";
import { ArrowTopIcon } from "~/shared/assets";
import { cn } from "~/shared/lib/twMerge";
import FireIcon from "~/shared/assets/icons/fire.svg?component";

import { useWebSocketContext } from "../../lib/WebSocketContext";
import styles from "./Match.module.css";
import { ScoreBoard } from "./ScoreBoard";
import { OddsTable } from "./OddsTable";
import type { MarketDto } from "./OddsTable";
import { useGamesWebSocket } from "../../lib/useGamesWebSocket";
import { getSubGames, getSubGameData, SubGameDto, SubGameData } from "../../api/getSubGames";

function packSmallGroups<T>(
  items: [string, T][],
  maxGroupSize = 1000
): Array<Array<[string, T]>> {
  const result: Array<Array<[string, T]>> = [];

  if (items.length <= maxGroupSize && items.length > 1) {
    const mid = Math.ceil(items.length / 2);
    result.push(items.slice(0, mid));
    result.push(items.slice(mid));
    return result;
  }

  for (let i = 0; i < items.length; i += maxGroupSize) {
    result.push(items.slice(i, i + maxGroupSize));
  }

  return result;
}

type MatchProps = {
  matchData?: any;
  isSubGame?: boolean;
};

export const Match = ({ matchData, isSubGame = false }: MatchProps) => {
  const params = useParams();
  const eventId = params.eventId as string;
  
  // Состояние для подыгр
  const [subGames, setSubGames] = useState<SubGameDto[]>([]);
  const [activeSubGame, setActiveSubGame] = useState<SubGameDto | null>(null);
  const [subGameData, setSubGameData] = useState<SubGameData | null>(null);
  const [loadingSubGames, setLoadingSubGames] = useState(false);
  const [errorSubGames, setErrorSubGames] = useState<string | null>(null);
  
  // Данные родительской игры для ScoreBoard
  const [parentGameData, setParentGameData] = useState<any>(null);

  // Состояние для TournamentOdds логики
  const [selectedSubGameData, setSelectedSubGameData] = useState<SubGameData | null>(null);
  const [allExpanded, setAllExpanded] = useState(true);

  // Определяем активный eventId для WebSocket подписки
  const activeEventId = activeSubGame?.game_id?.toString() || eventId;

  const { data, isLoading, error } = useGamesWebSocket({
    eventId: activeEventId,
    initialData: matchData,
    turbo: true,
  });

  // Для подыгр также получаем данные родительской игры для ScoreBoard
  const { data: parentData } = useGamesWebSocket({
    eventId: eventId,
    initialData: undefined,
    turbo: true,
  });

  const { addMessageHandler, removeMessageHandler } = useWebSocketContext();

  const gameId = data?.eventId || data?.game_id || data?.id;

  // Загрузка списка подыгр
  useEffect(() => { 
    const loadSubGames = async () => {
      if (!eventId) return;

      setLoadingSubGames(true);
      setErrorSubGames(null);

      try {
        const subGamesData = await getSubGames(eventId);
        setSubGames(subGamesData.sub_games);
        
        // Сохраняем данные родительской игры для ScoreBoard
        setParentGameData({
          eventId: subGamesData.eventId || eventId,
          eventName: subGamesData.eventName,
          team1: subGamesData.team1,
          team2: subGamesData.team2,
          sport: subGamesData.sport,
          leagueName: subGamesData.leagueName,
          status: subGamesData.status
        });
      } catch (err) {
        setErrorSubGames('Ошибка загрузки подыгр');
      } finally {
        setLoadingSubGames(false);
      }
    };

    loadSubGames();
  }, [eventId]);

  // Обработчик переключения подыгры
  const handleSubGameSwitch = async (subGame: SubGameDto | null) => {

    if (!subGame) {
      // Переключение на основную игру
      setActiveSubGame(null);
      setSubGameData(null);
      setSelectedSubGameData(null);
      return;
    }

    try {
      // Загружаем данные подыгры
      const data = await getSubGameData(subGame.game_id);

      setActiveSubGame(subGame);
      setSubGameData(data);
      setSelectedSubGameData(data);
    } catch (err) {
      console.error('❌ [Match] Error loading subgame data:', err);
      setErrorSubGames('Ошибка загрузки данных подыгры');
    }
  };

  // Обработка входящих WS-сообщений для выбранной подигры
  useEffect(() => {
    const handler = (message: any) => {
      // Фильтрация по активному eventId, чтобы обрабатывать только сообщения нужной игры/подыгры
      if (!message?.eventId || message.eventId?.toString() !== activeEventId?.toString()) {
        return;
      }

      if (message.type === 'closeMarkets') {
        setSelectedSubGameData((prev) => {
          if (!prev) return prev as any;
          const toClose: string[] = Array.isArray(message.payload) ? message.payload : [];
          const next: any = { ...prev };
          Object.keys(next.groupedMarkets || {}).forEach((mk) => {
            next.groupedMarkets[mk] = (next.groupedMarkets[mk] || []).map((m: any) => {
              if (!toClose.length) return m;
              return toClose.includes(m.market) ? { ...m, isOpen: false } : m;
            });
          });
          return next;
        });
      } else if (message.type === 'remove_markets' || message.type === 'removeMarkets') {
        setSelectedSubGameData((prev) => {
          if (!prev?.groupedMarkets) return prev;
          const toClose: string[] = Array.isArray(message.payload) ? message.payload : [];
          const newMarkets: Record<string, any[]> = {};
          Object.keys(prev.groupedMarkets).forEach((marketKey) => {
            const grouped = prev.groupedMarkets?.[marketKey] ?? [];
            newMarkets[marketKey] = grouped.map((m: any) => {
              if (!toClose.length) return m;
              return toClose.includes(m.market) ? { ...m, isOpen: false } : m;
            });
          });
          return { ...prev, groupedMarkets: newMarkets } as any;
        });
      } else if (message.type === 'updateParsedScore') {
        setSelectedSubGameData((prev) => prev ? ({ ...prev, parsedScore: message.payload } as any) : prev);
      } else if (message.type === 'update_event' || message.type === 'detailed_update') {
        setSelectedSubGameData((prev) => prev ? ({ ...prev, ...(message.payload?.gameData || {}) } as any) : prev);
      } else if (message.type === 'update_event_full') {
        setSelectedSubGameData((prev) => {
          if (!prev) return prev as any;
          const next: any = { ...prev };
          if (message.payload?.gameData && typeof message.payload.gameData === 'object') {
            Object.assign(next, message.payload.gameData);
          }
          if (message.payload?.groupedMarkets && typeof message.payload.groupedMarkets === 'object') {
            next.groupedMarkets = normalizeGroupedMarkets(message.payload.groupedMarkets);
          }
          // @ts-ignore
          next._lastUpdate = Date.now();
          return next;
        });
      }
    };

    addMessageHandler(handler);
    return () => {
      removeMessageHandler(handler);
    };
  }, [selectedSubGameData?.game_id, addMessageHandler, removeMessageHandler, activeEventId]);

  // WebSocket обработчик для обновления списка subGames
  useEffect(() => {
    const handleSubGamesUpdate = (message: any) => {
      if (message.eventId !== eventId) return;

      if (message.type === "subgames_removed") {
        if (activeSubGame && message.removedGameIds?.includes(activeSubGame.game_id)) {
          setActiveSubGame(null);
          setSelectedSubGameData(null);
        }

        setSubGames([]);
        getSubGames(eventId).then((response) => {
          setSubGames(response?.sub_games || []);
        }).catch((error) => {
          console.error('[Match] Error reloading subGames:', error);
        });
      }

      if (message.type === "subgames_added" || message.type === "subgames_updated") {
        getSubGames(eventId).then((response) => {
          setSubGames(response?.sub_games || []);
        }).catch((error) => {
          console.error('[Match] Error reloading subGames:', error);
        });
      }
    };

    addMessageHandler(handleSubGamesUpdate);

    return () => {
      removeMessageHandler(handleSubGamesUpdate);
    };
  }, [eventId, activeSubGame, addMessageHandler, removeMessageHandler]);


  const marketsToShow: Record<string, MarketDto[]> = useMemo(() => {
    let markets: Record<string, MarketDto[]> = {};
    
    if (selectedSubGameData) {
      // Если выбрана подигра, показываем её рынки
      markets = (selectedSubGameData.groupedMarkets as Record<string, MarketDto[]>) || {};
      
      // Если у подигры нет рынков, это нормально - показываем сообщение об отсутствии ставок для подигры
    } else {
      // Если подигра не выбрана, используем рынки основной игры
      markets = (data?.groupedMarkets as Record<string, MarketDto[]>) || {};
    }
    
    return markets;
  }, [selectedSubGameData, data?.groupedMarkets]);

  // Определяем live/prematch статус для ставок
  const isLive = !!(
    data?.parsedScore?.liveScore?.active ||
    data?.status === 'LIVE' ||
    data?.status === 'IN_PLAY' ||
    data?.live === true ||
    data?.status === 'IN_PROGRESS'
  );

  const filteredEntries: [string, MarketDto[]][] = useMemo(() => {
    if (!marketsToShow || typeof marketsToShow !== 'object') {
      return [] as [string, MarketDto[]][];
    }
    const entries = Object.entries(marketsToShow) as [string, MarketDto[]][];
    return entries;
  }, [marketsToShow]);

  const sortedMarkets: [string, MarketDto[]][] = useMemo(() => {
    // Возвращаем рынки в том порядке, как они приходят с API
    return [...filteredEntries];
  }, [filteredEntries]);

  const rowBlocks: Array<Array<[string, MarketDto[]]>> = useMemo(() => {
    const blocks = packSmallGroups<MarketDto[]>(sortedMarkets, 15);
    return blocks;
  }, [sortedMarkets]);

  // Условный рендер только здесь - более мягкие условия
  const shouldShowNoMarkets = (
    !marketsToShow ||
    (data?.status === "FINISHED" || data?.status === "CANCELED") ||
    (marketsToShow && Object.keys(marketsToShow).length === 0)
  );

  // Определяем текст сообщения об отсутствии рынков
  const noMarketsMessage = selectedSubGameData 
    ? `пока нет доступных ставок`
    : "Ставок больше нет";

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!data) {
    return <div className={styles.err}>Данные не найдены</div>;
  }


  const gameDataForScoreBoard = activeSubGame && parentData 
    ? parentData // Используем данные родительской игры из WebSocket
    : data; // Для основной игры используем текущие данные
  
  return (
    <div className={styles.Match}>
      <ScoreBoard game={gameDataForScoreBoard} hasSubGames={subGames.length > 0} />

      {/* TournamentOdds section */}
      <section className={styles.TournamentOdds}>
        {/* Панель переключения подыгр */}
        {subGames.length > 0 && (
          <div className={styles.TournamentOddsHeader}>
            <div className={styles.oddMenuList}>
              <button
                className={`${!activeSubGame ? styles.activeButton : ''}`}
                onClick={() => handleSubGameSwitch(null)}
              >
                Все
              </button>
              {subGames.map((subGame) => (
                <button
                  key={subGame.game_id}
                  className={`${activeSubGame?.game_id === subGame.game_id ? styles.activeButton : ''}`}
                  onClick={() => handleSubGameSwitch(subGame)}
                >
                  {subGame.game_name === 'Быстрые события' &&<FireIcon className={styles.fireIcon} />}
                  {subGame.game_name}
                </button>
              ))}
            </div>
            <div className={styles.TournamentOddsHeaderButton} onClick={() => setAllExpanded(prev => !prev)}>
              <Button>
                <ArrowTopIcon
                  className={cn("transition-transform duration-300", {
                    "rotate-180": allExpanded,
                  })}
                />
              </Button>
            </div>
          </div>
        )}

        {errorSubGames && (
          <div className={styles.err}>{errorSubGames}</div>
        )}

        {shouldShowNoMarkets ? (
          <h3 className="py-4 font-medium text-center text-md">
            {noMarketsMessage}
          </h3>
        ) : (
          <>

            <div className={styles.oddsTables}>
              {rowBlocks.map((row: Array<[string, MarketDto[]]>, rowIndex: number) => {
                return (
                  <div className={styles.oddsTable} key={rowIndex} >
                    {row.map(([name, data]: [string, MarketDto[]]) => {
                      return (
                        <OddsTable
                          eventId={selectedSubGameData?.game_id?.toString() || activeEventId}
                          eventName={selectedSubGameData?.game_name || gameDataForScoreBoard?.eventName || `${gameDataForScoreBoard?.team1 || ''} vs ${gameDataForScoreBoard?.team2 || ''}`}
                          key={name}
                          name={name}
                          markets={data}
                          isParentExpanded={allExpanded}
                          isLive={isLive}
                          subGameId={(() => {
                            // Логирование для отладки
                            return selectedSubGameData?.subGameDbId;
                          })()}
                          subGameName={selectedSubGameData?.game_name}
                          parentEventId={selectedSubGameData ? eventId : undefined}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

// Helper: normalize markets payload to ensure cf/isOpen etc. are consistent
const normalizeGroupedMarkets = (payload: Record<string, any[]> | undefined) => {
  if (!payload || typeof payload !== 'object') return payload as any;
  const out: Record<string, any[]> = {};
  Object.keys(payload).forEach((groupKey) => {
    const markets = (payload as any)[groupKey] || [];
    out[groupKey] = markets.map((m: any) => ({
      ...m,
      cf: Number((m as any).odds ?? (m as any).cf ?? (m as any).oc_rate),
      market: String((m as any).market ?? ''),
      // robust isOpen from oc_block variations
      isOpen:
        (m as any).isOpen !== undefined
          ? (m as any).isOpen
          : !(
            (m as any).oc_block === true ||
            String((m as any).oc_block).toLowerCase() === 'true' ||
            Number((m as any).oc_block) === 1
          ),
    }));
  });
  return out;
};
