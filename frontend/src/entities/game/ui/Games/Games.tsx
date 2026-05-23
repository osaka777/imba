"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroller";
import { useParams } from "next/navigation";
import { cn } from "~/shared/lib";
import { LoadingSpinner } from "~/shared/ui";
import { transformApiGames } from "../../lib/transformApiGames";
import { useWebSocketContext } from "../../lib/WebSocketContext";
import type { Game} from "../../types/types";
import { Search } from "../Search";
import { SubcategoryMenu } from "../SubcategoryMenu/SubcategoryMenu";
import { TournamentTable } from "../TournamentTable";
import styles from "./Games.module.css";
import { Menu } from "./Menu";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { LuckyDriveBanner } from "../LuckyDrive/LuckyDriveBanner";
import React from "react";

const GamesComponent = ({
  className,
  queryOptions: { queryFn, queryKey },
}: any) => {
  const params = useParams();
  const sport = params?.sport as string | undefined;

  const queryClient = useQueryClient();
  const [allGames, setAllGames] = useState<Game[]>([]);
  const uniqueEventIds = useRef<Set<string>>(new Set());
  const { isConnected, addMessageHandler, removeMessageHandler, sendJsonMessage } = useWebSocketContext();

  useEffect(() => {
    setAllGames([]);
    uniqueEventIds.current.clear();
    queryClient.invalidateQueries({ queryKey: [...queryKey, sport] });
    
    // Очистка при размонтировании компонента
    return () => {
      setAllGames([]);
      uniqueEventIds.current.clear();
    };
  }, [sport, queryClient, queryKey]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: [...queryKey, sport],
    queryFn,
    initialPageParam: { limit: 10, offset: 0 }, // Уменьшили начальный лимит
    getNextPageParam: (lastPage: Game[], _allPages, lastPageParam) => {
      if (!lastPage || lastPage.length === 0) return undefined;
      // Увеличиваем лимит для последующих запросов
      const nextLimit = lastPageParam.offset === 0 ? 20 : lastPageParam.limit;
      return {
        ...lastPageParam,
        limit: nextLimit,
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
    // Добавляем задержку для первого запроса на главной странице
    enabled: typeof window !== 'undefined',
  });

  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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

  // Подписка на WebSocket с увеличенной задержкой для лучшей производительности
  useEffect(() => {
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
  }, [isConnected, games, sendJsonMessage, isLoading]);

  useEffect(() => {
    if (error) {
      console.error('Error fetching games:', error);
      }
  }, [error]);

  // WebSocket обновления для реал-тайм данных (только если уже подключен)
  useEffect(() => {
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
      
      queryClient.setQueryData([...queryKey, sport], (oldData: any) => {
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
    
  }, [isConnected, games, queryClient, queryKey, sport, addMessageHandler, removeMessageHandler]);
  
  return (
    <div className={cn(styles.Games, className)}>
      {sport ? <SubcategoryMenu type="live" /> : <Menu />}
      <LuckyDriveBanner />
      <Search />
      {/* @ts-ignore */}
      <InfiniteScroll
        className={styles.Games}
        hasMore={hasNextPage && !isFetchingNextPage}
        loadMore={loadMore}
        loader={
          <LoadingSpinner key="loading-spinner" className={styles.loading} />
        }
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
        {games.length === 0 && !isLoading && !error && (
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
      </InfiniteScroll>
    </div>
  );
};

export const Games = React.memo(GamesComponent);
