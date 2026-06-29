"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroller";
import { cn } from "~/shared/lib";
import { LoadingSpinner } from "~/shared/ui";
import { transformApiGames } from "../../lib/transformApiGames";
import { useSportFilter } from "../../lib/useSportFilter";
import { useWebSocketContext } from "../../lib/WebSocketContext";
import type { Game} from "../../types/types";
import { Search } from "../Search";
import { SubcategoryMenu } from "../SubcategoryMenu/SubcategoryMenu";
import { TournamentTable } from "../TournamentTable";
import styles from "./Games.module.css";
import shellStyles from "../SportPageShell.module.css";
import { Menu } from "./Menu";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { LuckyDriveBanner } from "../LuckyDrive/LuckyDriveBanner";
import React from "react";
import { OlimpbetLineBlocks } from "~/entities/wc-odds/line/OlimpbetLineBlocks";
import { useOlimpbetLive } from "~/entities/wc-odds/live/useOlimpbetLive";
import {
  WC_LIVE_INITIAL_LIMIT,
  WC_LIVE_INITIAL_LIMIT_MOBILE,
  WC_LIVE_PAGE_SIZE,
} from "~/entities/wc-odds/live/wcLivePagination";
import { useWcListPaginationLimits } from "~/entities/wc-odds/lib/useWcListPaginationLimits";
import { WcLeagueMenu } from "~/entities/wc-odds/ui/WcLeagueMenu";
import { Header } from "~/widgets/Header";

const GamesComponent = ({
  className,
  queryOptions: { queryFn, queryKey },
}: any) => {
  const sport = useSportFilter();
  const { initialLimit, pageSize } = useWcListPaginationLimits(
    WC_LIVE_INITIAL_LIMIT,
    WC_LIVE_INITIAL_LIMIT_MOBILE,
    WC_LIVE_PAGE_SIZE,
  );

  const {
    enabled: olimpbetEnabled,
    initialLoading: olimpbetLoading,
    loadingMore: olimpbetLoadingMore,
    hasMore: olimpbetHasMore,
    loadMore: loadMoreOlimpbet,
    leagues: olimpbetLeagues,
  } = useOlimpbetLive(sport);
  const hasOlimpbetLive = olimpbetEnabled !== false && olimpbetLeagues.length > 0;

  const queryClient = useQueryClient();
  const [allGames, setAllGames] = useState<Game[]>([]);
  const uniqueEventIds = useRef<Set<string>>(new Set());
  const { isConnected, addMessageHandler, removeMessageHandler, sendJsonMessage } = useWebSocketContext();

  useEffect(() => {
    setAllGames([]);
    uniqueEventIds.current.clear();
    queryClient.invalidateQueries({ queryKey: [...queryKey, sport, initialLimit] });
    
    // Очистка при размонтировании компонента
    return () => {
      setAllGames([]);
      uniqueEventIds.current.clear();
    };
  }, [sport, initialLimit, queryClient, queryKey]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: [...queryKey, sport, initialLimit],
    queryFn,
    initialPageParam: { limit: initialLimit, offset: 0 },
    getNextPageParam: (lastPage: Game[], _allPages, lastPageParam) => {
      if (!lastPage || lastPage.length === 0) return undefined;
      return {
        limit: pageSize,
        offset: lastPageParam.offset + lastPageParam.limit,
      };
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60000, // Увеличили до 60 секунд для лучшего кэширования
    gcTime: 1000 * 60 * 15, // Увеличили до 15 минут для экономии запросов
    retry: 1,
    retryDelay: 1000,
    // Добавляем агрессивное кэширование
    placeholderData: (previousData) => previousData,
    // Отключаем автоматическую загрузку в фоне
    refetchOnReconnect: false,
    // BetAPI live отключён, когда активна линия Olimpbet
    enabled: typeof window !== "undefined" && olimpbetEnabled === false,
  });

  const loadMore = useCallback(() => {
    if (olimpbetEnabled !== false) {
      if (olimpbetHasMore && !olimpbetLoadingMore) {
        void loadMoreOlimpbet();
      }
      return;
    }
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    loadMoreOlimpbet,
    olimpbetEnabled,
    olimpbetHasMore,
    olimpbetLoadingMore,
  ]);

  const hasMoreToLoad =
    olimpbetEnabled !== false ? olimpbetHasMore : Boolean(hasNextPage);

  const games = useMemo(() => {
    if (!data?.pages) return [];

    const transformedGames = data.pages.flatMap((page) => {
      if (!page) return [];
      
      // Упрощенная обработка данных без лишних логов
      const transformed = transformApiGames(page as Game[]);
      return transformed;
    });

    return transformedGames;
  }, [data?.pages]);

  // Подписка на WebSocket BetAPI только когда Olimpbet выключен
  useEffect(() => {
    if (olimpbetEnabled !== false) return undefined;
    if (!games.length || !isConnected || isLoading) return;

    // Добавляем увеличенную задержку для оптимизации производительности
    const subscriptionTimer = setTimeout(() => {
      // Подписываемся только если пользователь все еще на странице
      if (document.visibilityState === 'visible') {
        // Собираем все eventIds из загруженных игр
        const eventIds = games.flatMap(league => 
          league.games.map(game => game.eventId)
        ).filter(Boolean);

        if (eventIds.length === 0) return;

        // Подписываемся на обновления всех игр только после задержки
        sendJsonMessage({
          type: "subscribe",
          filter: { 
            eventIds,
            subscriptionType: 'detailed' // Изменяем на detailed для получения полных обновлений
          }
        });
      }
    }, 2000); // Увеличили задержку до 2 секунд

    return () => {
      clearTimeout(subscriptionTimer);
      // Отписываемся при размонтировании или изменении списка игр
      if (games.length > 0) {
        const eventIds = games.flatMap(league => 
          league.games.map(game => game.eventId)
        ).filter(Boolean);
        
        if (eventIds.length > 0) {
          sendJsonMessage({
            type: "unsubscribe",
            filter: { eventIds }
          });
        }
      }
    };
  }, [isConnected, games, sendJsonMessage, isLoading, olimpbetEnabled]);

  useEffect(() => {
    if (error) {
      console.error('Error fetching games:', error);
    }
  }, [error]);

  // WebSocket обновления BetAPI (только если Olimpbet выключен)
  useEffect(() => {
    if (olimpbetEnabled !== false) return;
    // Обрабатываем сообщения только если WebSocket уже подключен и есть игры
    if (!isConnected || !games.length) return;

    const handleWebSocketUpdate = (message: any) => {
      // Обрабатываем различные типы сообщений для обновления состояния игр
      if (!message?.type) return;
      if (!message.payload?.gameData && !message.eventId && !message.payload?.groupedMarkets) {
        return;
      }

      let updatedGame: any = null;
      let eventId: string | null = null;

      // Обработка разных типов сообщений
      if (message.type === 'update_event' && message.payload?.gameData) {
        updatedGame = message.payload.gameData;
        eventId = message.eventId || updatedGame?.eventId || null;
      } else if (message.type === 'detailed_update' && message.eventId) {
        // Обработка детальных обновлений (включая состояние available/isOpen)
        eventId = message.eventId;
        updatedGame = {
          eventId,
          ...(message.payload?.gameData || {}),
        };
        // На случай, если сервер присылает рынки в detailed_update
        if (message.payload?.groupedMarkets || message.payload?.markets) {
          updatedGame.groupedMarkets = message.payload.groupedMarkets || message.payload.markets;
        }
      } else if (message.type === 'update_markets' && message.eventId) {
        // Обработка обновлений рынков
        eventId = message.eventId;
        updatedGame = {
          eventId,
          // Согласно типам, payload уже является объектом groupedMarkets
          groupedMarkets: message.payload,
        };
      }

      if (!eventId || !updatedGame) return;
      
      queryClient.setQueryData([...queryKey, sport, initialLimit], (oldData: any) => {
        if (!oldData?.pages) return oldData;

        const newPages = oldData.pages.map((page: Game[]) => {
          if (!page) return page;
          return page.map((game: Game) => {
            if (game.eventId === eventId) {
              // Мержим данные, сохраняя существующие поля
              return {
                ...game,
                ...updatedGame,
                // Убеждаемся что критические поля обновляются
                groupedMarkets: (updatedGame as any).groupedMarkets ?? game.groupedMarkets,
              } as Game;
            }
            return game;
          });
        });

        return {
          ...oldData,
          pages: newPages,
        };
      });
    };

    // Подключаем обработчик к WebSocket только если есть игры для обновления
    addMessageHandler(handleWebSocketUpdate);

    return () => {
      removeMessageHandler(handleWebSocketUpdate);
    };
    
  }, [isConnected, games, initialLimit, queryClient, queryKey, sport, addMessageHandler, removeMessageHandler, olimpbetEnabled]);
  
  const showGamesLoader =
    isFetchingNextPage
    || olimpbetLoadingMore
    || (olimpbetEnabled !== false && olimpbetLoading && olimpbetLeagues.length === 0)
    || (olimpbetEnabled === false && isLoading && games.length === 0);

  return (
    <div className={cn(styles.Games, className)}>
      <div className={shellStyles.pageShell}>
        <div className={shellStyles.pageHeaderSlot}>
          <Header />
        </div>
        <div className={shellStyles.pageFlow}>
        <div className={shellStyles.sidebarColumn}>
        <aside className={shellStyles.sportsSidebar}>
          <div className={shellStyles.sidebarControls}>
            <div className={shellStyles.sidebarSearchSlot}>
              <Search sport={sport} />
            </div>
          </div>
          <div className={shellStyles.sidebarMenuScroll}>
          <Menu
            layout="sidebar"
            className={sport ? shellStyles.sportsMenuSlot_mobileHidden : undefined}
          />
          {sport ? (
            olimpbetEnabled !== false ? (
              <WcLeagueMenu type="live" layout="sidebar" />
            ) : (
              <SubcategoryMenu type="live" layout="sidebar" />
            )
          ) : null}
          </div>
        </aside>
        </div>

        <div className={shellStyles.pageMain}>
      <div className={shellStyles.pageMainLead}>
      <LuckyDriveBanner compact placement="live" />
      </div>
      <div className={shellStyles.pageMainBody}>
      <Search sport={sport} hideOnDesktop />
      <InfiniteScroll
        className={styles.Games}
        hasMore={hasMoreToLoad && !isFetchingNextPage && !olimpbetLoadingMore}
        loadMore={loadMore}
        pageStart={0}
        threshold={250}
        element="div"
        useWindow={true}
      >
        {error && (
          <div className="p-4 text-center bg-red-500/10 text-red-500">
            Ошибка загрузки игр. Пожалуйста, попробуйте позже.
          </div>
        )}
        <OlimpbetLineBlocks leagues={olimpbetLeagues} showInlineStats={false} />
        {games.length === 0 && !isLoading && !error && !hasOlimpbetLive && !olimpbetLoading && (
          <p className="p-4 text-center bg-white/5">Игры не найдены</p>
        )}
        {games.map((league, index) => (
          <TournamentTable
            games={league.games}
            isLive={true}
            key={league.leagueName + index}
            league={league.leagueName}
            sport={league.games[0].sport}
          />
        ))}
        {showGamesLoader ? (
          <LoadingSpinner key="games-loading" className={styles.loading} />
        ) : null}
      </InfiniteScroll>
      </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export const Games = React.memo(GamesComponent);
