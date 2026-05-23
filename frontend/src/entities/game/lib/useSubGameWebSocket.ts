import { useEffect, useRef, useCallback } from "react";
import { useWebSocketContext } from "./WebSocketContext";

// Упрощенный кэш для предотвращения дублирующих обновлений subgames
const SUBGAME_UPDATE_CACHE = new Map<string, number>();
const UPDATE_DEBOUNCE_TIME = 100;
const MAX_CACHE_SIZE = 100;

const fastCleanupSubGameCache = () => {
  if (SUBGAME_UPDATE_CACHE.size > MAX_CACHE_SIZE) {
    SUBGAME_UPDATE_CACHE.clear();
  }
};

export const useSubGameWebSocket = ({
  subGameId,
  onUpdate,
}: {
  subGameId: string | number;
  onUpdate?: (message: any) => void;
}) => {
  const { addMessageHandler, removeMessageHandler, isConnected, subscribe, unsubscribe } = useWebSocketContext();
  const hasSubscribedRef = useRef(false);
  const subGameIdStr = subGameId.toString();

  // Подписка на WebSocket сообщения для subgame
  useEffect(() => {
    if (!isConnected || !subGameIdStr || hasSubscribedRef.current) {
      return;
    }

    console.log('🔌 [SubGameWebSocket] Subscribing to subgame:', subGameIdStr);
    subscribe(subGameIdStr);
    hasSubscribedRef.current = true;

    return () => {
      if (hasSubscribedRef.current) {
        console.log('🔌 [SubGameWebSocket] Unsubscribing from subgame:', subGameIdStr);
        unsubscribe(subGameIdStr);
        hasSubscribedRef.current = false;
      }
    };
  }, [isConnected, subGameIdStr, subscribe, unsubscribe]);

  // Обработчик WebSocket сообщений для subgame
  const handleSubGameMessage = useCallback((message: any) => {
    if (message.eventId !== subGameIdStr) {
      return;
    }

    // Проверяем кэш для предотвращения дублирующих обновлений
    const cacheKey = `${subGameIdStr}-${message.type}-${Date.now()}`;
    const now = Date.now();
    const lastUpdate = SUBGAME_UPDATE_CACHE.get(subGameIdStr);
    
    if (lastUpdate && (now - lastUpdate) < UPDATE_DEBOUNCE_TIME) {
      return;
    }

    SUBGAME_UPDATE_CACHE.set(subGameIdStr, now);
    fastCleanupSubGameCache();

    // Обрабатываем только релевантные типы сообщений для subgames
    if (message.type === "update_event" || 
        message.type === "detailed_update" || 
        message.type === "update_markets" ||
        message.type === "updateParsedScore") {
      
      console.log('📨 [SubGameWebSocket] Received update for subgame:', subGameIdStr, message.type);
      
      if (onUpdate) {
        onUpdate(message);
      }
    }
  }, [subGameIdStr, onUpdate]);

  useEffect(() => {
    addMessageHandler(handleSubGameMessage);

    return () => {
      removeMessageHandler(handleSubGameMessage);
    };
  }, [handleSubGameMessage, addMessageHandler, removeMessageHandler]);

  // Сброс состояния подписки при изменении subGameId
  useEffect(() => {
    hasSubscribedRef.current = false;
  }, [subGameIdStr]);

  return {
    isConnected,
  };
};