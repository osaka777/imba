import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useTimeout } from "usehooks-ts";

import { components } from "~/shared/api";
import { mergeArrays } from "~/shared/lib/mergeArrays";
import { createManagedInterval } from "~/shared/lib";

import { getGame } from "../api";
import { Message } from "../types/types";
import { MarketDto } from "../types/types";
import { useWebSocketContext } from "./WebSocketContext";

type GameDto = components["schemas"]["GameDtoWithGroupedMarkets"];

// Упрощенный кэш для предотвращения дублирующих обновлений
const SIMPLE_UPDATE_CACHE = new Map<string, number>();
const UPDATE_DEBOUNCE_TIME = 100; // Добавляем небольшой дебаунсинг для стабилизации UI
const MAX_CACHE_SIZE = 200; // Уменьшили размер кэша

// Быстрая очистка кэша
const fastCleanupCache = () => {
  if (SIMPLE_UPDATE_CACHE.size > MAX_CACHE_SIZE) {
    SIMPLE_UPDATE_CACHE.clear();
  }
};

export const useGamesWebSocket = ({
  eventId,
  initialData,
  turbo = false,
}: {
  eventId: string;
  initialData?: components["schemas"]["GameDtoWithGroupedMarkets"];
  /** Match detail page — minimal debounce + BetAPI priority ingest. */
  turbo?: boolean;
}) => {
  
  const queryClient = useQueryClient();
  const { addMessageHandler, removeMessageHandler, isConnected, subscribe, unsubscribe } = useWebSocketContext();
  const [hasSubscribed, setHasSubscribed] = useState(false);
  const debounceMs = turbo ? 0 : UPDATE_DEBOUNCE_TIME;
  const pollMs = turbo ? 2000 : 5000;
  
  // Сброс состояния подписки при изменении eventId
  useEffect(() => {
    setHasSubscribed(false);
  }, [eventId]);

  const isNonExistent = useRef(false);
  const lastUpdateTime = useRef<number>(Date.now());
  const isFinished = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateDataRef = useRef<string>('');

  // Быстрая функция для создания ключа обновления
  const createUpdateKey = useCallback((type: string, data: any) => {
    if (type === 'markets' && data) {
      // Простой хеш для маркетов
      const keys = Object.keys(data);
      return `${eventId}:${type}:${keys.length}:${keys.join(',')}`;
    }
    if (type === 'score') {
      return `${eventId}:${type}:${data?.home || 0}:${data?.away || 0}`;
    }
    return `${eventId}:${type}:${typeof data === 'object' ? Object.keys(data || {}).length : data}`;
  }, [eventId]);

  // Упрощенная проверка на дублирующие обновления
  const isDuplicateUpdate = useCallback((type: string, data: any) => {
    const updateKey = createUpdateKey(type, data);
    const now = Date.now();
    const lastUpdate = SIMPLE_UPDATE_CACHE.get(updateKey);
    
    if (lastUpdate && now - lastUpdate < debounceMs) {
      return true;
    }
    
    SIMPLE_UPDATE_CACHE.set(updateKey, now);
    
    // Быстрая очистка кэша
    if (SIMPLE_UPDATE_CACHE.size > MAX_CACHE_SIZE) {
      fastCleanupCache();
    }
    
    return false;
  }, [createUpdateKey, debounceMs]);

  // Оптимизированная функция обновления данных игры
  const updateGameData = useCallback((updater: (prev: GameDto) => GameDto) => {
    queryClient.setQueryData<GameDto>(["game", eventId], (prev: any) => {
      if (!prev) return prev;
      const updated = updater(prev);
      // Важно: не инвалидируем запрос на каждое локальное обновление, чтобы избежать гонок и мерцания
      return updated;
    });
  }, [queryClient, eventId]);

  // Агрессивный дебаунсинг для предотвращения частых обновлений
  const debouncedUpdate = useCallback((updater: (prev: GameDto) => GameDto, delay: number = debounceMs) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      updateGameData(updater);
    }, delay);
  }, [updateGameData, debounceMs]);

  const queryState = useQuery({
    initialData,
    queryFn: async () => {
      if (isNonExistent.current) {
        throw new Error(`Game with ID ${eventId} does not exist`);
      }

      try {
        const game = await getGame(eventId);
        if (game.status === 'FINISHED' || game.status === 'CANCELED') {
          isFinished.current = true;
          // Возвращаем завершенную игру вместо выбрасывания ошибки
        }
        return game;
      } catch (error: any) {
        if (error.response?.status === 404) {
          isNonExistent.current = true;
          throw new Error(`Game with ID ${eventId} not found`);
        }
        throw error;
      }
    },
    queryKey: ["game", eventId],
    // Делаем данные сразу неактуальными, чтобы получить свежий снимок при заходе на страницу
    staleTime: 0,
    refetchInterval: (data) => {
      if (isFinished.current || isNonExistent.current) {
        return false;
      }
      const timeSinceLastUpdate = Date.now() - lastUpdateTime.current;
      if (timeSinceLastUpdate > 5 * 60 * 1000) { // Уменьшили с 10 до 5 минут
        lastUpdateTime.current = Date.now();
        return 0;
      }
      return data ? pollMs : false; // Периодическая подстраховка
    },
    refetchOnWindowFocus: false,
    // Включаем обновление при монтировании, чтобы не ждать WebSocket для первичного заполнения
    refetchOnMount: true,
    retry: (failureCount, error) => {
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        isNonExistent.current = true;
        return false;
      }
      if (error.message.includes('has finished')) {
        isFinished.current = true;
        return false;
      }
      return failureCount < 2; // Уменьшили количество попыток
    }
  });

  useEffect(() => {
    if (queryState.data) {
      lastUpdateTime.current = Date.now();
      if (queryState.data.status === 'FINISHED' || queryState.data.status === 'CANCELED') {
        isFinished.current = true;
        if (hasSubscribed) {
          unsubscribe(eventId);
          setHasSubscribed(false);
        }
      }
    }
  }, [queryState.data, eventId, unsubscribe, hasSubscribed]);

  const [connectToUpdate, start] = useState(false);
  useTimeout(() => {
    console.log('⏰ [useGamesWebSocket] useTimeout triggered, setting connectToUpdate to true for eventId:', eventId);
    start(true);
  }, 0);

  // Логируем изменения connectToUpdate
  useEffect(() => {
    console.log('🔄 [useGamesWebSocket] connectToUpdate changed to:', connectToUpdate, 'for eventId:', eventId);
  }, [connectToUpdate, eventId]);

  useEffect(() => {
    const handleMessage = (message: Message) => {
      if (message.eventId !== eventId) {
        return;
      }

      // Игнорируем сообщения для несуществующих или завершённых игр
      if (isNonExistent.current || isFinished.current) {
        return;
      }

      // Проверяем, что это не remove_event (который не в типе Message)
      if ((message as any).type === "remove_event") {
        isFinished.current = true;
        if (hasSubscribed) {
          unsubscribe(eventId);
          setHasSubscribed(false);
        }
        updateGameData((prev) => ({
          ...prev,
          status: 'FINISHED'
        }));
        return;
      }

      // Обработка нового типа сообщения update_event
      if (message.type === "update_event") {
        // Мгновенное обновление данных игры без проверок
        updateGameData((prev) => ({
          ...prev,
          ...(message.payload?.gameData || {}),
          status: message.payload?.gameData?.status || (prev as any).status,
          meta: {
            ...(prev as any).meta,
            ...(message.payload?.gameData?.meta || {}),
            // Сохраняем существующий stat_list если он есть и новый не предоставлен
            stat_list: message.payload?.gameData?.meta?.stat_list || (prev as any).meta?.stat_list || []
          }
        }));
        return;
      }

      // Обработка детальных обновлений для конкретной игры
      if (message.type === "detailed_update") {
        // Детальное обновление данных игры с полной информацией
        updateGameData((prev) => ({
          ...prev,
          ...(message.payload?.gameData || {}),
          status: message.payload?.gameData?.status || (prev as any).status,
          meta: {
            ...(prev as any).meta,
            ...(message.payload?.gameData?.meta || {}),
            stat_list: message.payload?.gameData?.meta?.stat_list || (prev as any).meta?.stat_list || []
          }
        }));
        return;
      }

      if (message.type === "updateParsedScore") {
        // Мгновенное обновление счета без проверок для максимальной скорости
        updateGameData((prev) => ({
          ...prev,
          parsedScore: message.payload,
        }));
      }

      if (message.type === "update_markets") {
        // Убираем проверку на дублирующие обновления для критических данных
        
        // Логируем WebSocket обновления рынков
        // Логирование после нормализации, чтобы видеть реальные ключи/счётчики
        
        // Helper: normalize market names to canonical keys to avoid alias flicker
        const normalizeMarketName = (name: string): string => {
          switch (name) {
            case 'WIN__1':
            case 'WIN_HOME':
              return 'WIN__P1';
            case 'WIN__2':
            case 'WIN_AWAY':
              return 'WIN__P2';
            case 'WIN__X':
            case 'WIN_DRAW':
              return 'WIN__PX';
            case 'WIN_RT__1':
              return 'WIN_RT__P1';
            case 'WIN_RT__2':
              return 'WIN_RT__P2';
            case 'WIN_RT__X':
              return 'WIN_RT__PX';
            case 'WIN_OT__1':
              return 'WIN_OT__P1';
            case 'WIN_OT__2':
              return 'WIN_OT__P2';
            case 'WIN_OT__X':
              return 'WIN_OT__PX';
            case 'DOUBLE_CHANCE__1X':
            case 'DC__1X':
              return 'WIN__1X';
            case 'DOUBLE_CHANCE__12':
            case 'DC__12':
              return 'WIN__12';
            case 'DOUBLE_CHANCE__X2':
            case 'DC__X2':
              return 'WIN__X2';
            default:
              return name;
          }
        };

        const normalizePayload = (payload: Record<string, MarketDto[]>) => {
          if (!payload) return payload;
          const out: Record<string, MarketDto[]> = {} as any;
          Object.keys(payload).forEach((groupKey) => {
            const markets = payload[groupKey] || [];
            out[groupKey] = markets.map((m: any) => ({
              ...m,
              market: normalizeMarketName(m.market)
            }));
          });
          return out;
        };

        const normalizedPayload = normalizePayload(message.payload || {});
        const payloadKeys = normalizedPayload ? Object.keys(normalizedPayload) : [];
        const normalizedLog = {
          eventId,
          mainMarkets: normalizedPayload?.MAIN?.length || 0,
          totalsMarkets: normalizedPayload?.TOTALS?.length || 0,
          isEmpty: !normalizedPayload || payloadKeys.length === 0 || Object.values(normalizedPayload).every((arr: any) => !arr || arr.length === 0),
        };

        // Дебаунсированное обновление для предотвращения мигания
        debouncedUpdate(() => {
          updateGameData(prev => {
            // Если нет новых данных, возвращаем предыдущее состояние
            if (!normalizedPayload) {
              return prev;
            }

            // Проверяем, действительно ли данные изменились
            const hasChanges = Object.keys(normalizedPayload).some(key => {
              const newMarkets = normalizedPayload[key];
              const oldMarkets = prev.groupedMarkets?.[key];
              return JSON.stringify(newMarkets) !== JSON.stringify(oldMarkets);
            });

            if (!hasChanges) {
              return prev; // Не обновляем, если данные не изменились
            }

            // Заменяем данные рынков полностью, чтобы избежать дублирования групп
            const updatedGroupedMarkets = normalizedPayload || prev.groupedMarkets;

            return {
              ...prev,
              groupedMarkets: updatedGroupedMarkets,
              _lastUpdate: Date.now()
            };
          });
        });
      }

      if (message.type === "removeMarkets") {
        // Убираем проверку на дублирующие обновления для критических данных
        
        // Дебаунсированное обновление для removeMarkets
        debouncedUpdate(() => {
          updateGameData(prev => {
          if (!prev.groupedMarkets) {
            return prev;
          }

          const newMarkets = {} as Record<string, MarketDto[]>;
          Object.keys(prev.groupedMarkets).forEach((marketKey) => {
            const groupedMarket = prev.groupedMarkets?.[marketKey] ?? [];
            const newGroupedMarket = groupedMarket.map((market: any) => {
              if (!message.payload || !message.payload.includes(market.market)) {
                return market;
              }
              // Вместо полного закрытия, помечаем как заблокированный, но оставляем видимым
              return { 
                ...market, 
                isOpen: false,
                oc_block: true,
                blocked: true,
                available: false,
                // Сохраняем коэффициент для отображения, но делаем недоступным для ставок
                cf: market.cf || " --"
              };
            });
            newMarkets[marketKey] = newGroupedMarket;
          });

          return {
            ...prev,
            groupedMarkets: newMarkets,
          };
        });
        });
      }
    };

    addMessageHandler(handleMessage);

    return () => {
      removeMessageHandler(handleMessage);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [eventId, queryClient, addMessageHandler, removeMessageHandler, unsubscribe, hasSubscribed, updateGameData, debouncedUpdate, isDuplicateUpdate]);

  // Отслеживание предыдущего eventId для правильной отписки
  const prevEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Отписываемся от предыдущего eventId если он изменился
    if (prevEventIdRef.current && prevEventIdRef.current !== eventId && hasSubscribed) {
      console.log('🔄 [useGamesWebSocket] Unsubscribing from old eventId:', prevEventIdRef.current);
      unsubscribe(prevEventIdRef.current);
      setHasSubscribed(false);
    }

    // Подписываемся на новый eventId
    // Убираем проверку isConnected, так как subscribe сам инициализирует WebSocket при необходимости
    if (connectToUpdate && !hasSubscribed && !isFinished.current && !isNonExistent.current) {
      console.log('🔄 [useGamesWebSocket] Subscribing to eventId:', eventId);
      subscribe(eventId, 'detailed');
      setHasSubscribed(true);
    } else {
      console.log('🚫 [useGamesWebSocket] Subscription conditions not met for eventId:', eventId, {
        connectToUpdate,
        isConnected,
        hasSubscribed,
        isFinished: isFinished.current,
        isNonExistent: isNonExistent.current
      });
    }

    prevEventIdRef.current = eventId;
  }, [connectToUpdate, eventId, subscribe, unsubscribe, isConnected, hasSubscribed]);

  useEffect(() => {
    if (!turbo || !eventId) return undefined;

    const setPriority = (priority: boolean) => {
      void fetch(`/api/betapi/ws/priority/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority, dataType: "live" }),
      }).catch(() => undefined);
    };

    setPriority(true);
    return () => setPriority(false);
  }, [turbo, eventId]);

  useEffect(() => {
    return () => {
      if (isConnected && hasSubscribed) {
        unsubscribe(eventId);
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [eventId, unsubscribe, isConnected, hasSubscribed]);

  return queryState;
};