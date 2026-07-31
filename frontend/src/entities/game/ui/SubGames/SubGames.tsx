"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from "~/shared/model/useLocale";
import { getSubGames, getSubGameData, SubGameDto, SubGameData } from '../../api/getSubGames';
import { useWebSocketContext } from '../../lib/WebSocketContext';
import styles from './SubGames.module.css';

interface SubGamesProps {
  eventId: string;
  onSubGameSelect?: (subGameData: SubGameData | null) => void;
}

export const SubGames: React.FC<SubGamesProps> = ({ eventId, onSubGameSelect }) => {
  const { t } = useLocale();
  const [selectedSubGameId, setSelectedSubGameId] = useState<number | null>(null);
  const [subGameData, setSubGameData] = useState<SubGameData | null>(null);
  const [loadingSubGame, setLoadingSubGame] = useState(false);
  const queryClient = useQueryClient();
  const { addMessageHandler, removeMessageHandler } = useWebSocketContext();

  // Получаем список sub_games
  const {
    data: subGamesResponse,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['subGames', eventId],
    queryFn: () => getSubGames(eventId),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000, // 5 минут
    retry: 2,
    retryDelay: 1000
  });

  // Обработчик клика по sub_game
  const handleSubGameClick = useCallback(async (subGame: SubGameDto) => {
    if (selectedSubGameId === subGame.game_id) {
      // Если уже выбрана эта подигра, скрываем её данные
      setSelectedSubGameId(null);
      setSubGameData(null);
      // Вызываем callback для сброса
      if (onSubGameSelect) {
        onSubGameSelect(null);
      }
      return;
    }

    setSelectedSubGameId(subGame.game_id);
    setLoadingSubGame(true);

    try {
      // Загружаем данные подыгры
      const data = await getSubGameData(subGame.game_id);
      setSubGameData(data);
      
      // Вызываем callback если передан
      if (onSubGameSelect) {
        onSubGameSelect(data);
      }
    } catch (error) {
      console.error('Error loading sub game data:', error);
      setSubGameData(null);
    } finally {
      setLoadingSubGame(false);
    }
  }, [selectedSubGameId, onSubGameSelect]);

  // WebSocket обработчик для удаления подигр и обновлений
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.eventId !== eventId) {
        // Также проверяем, не является ли это сообщением для одной из наших subgames
        const isSubGameMessage = subGamesResponse?.sub_games?.some(
          subGame => subGame.game_id.toString() === message.eventId
        );
        
        if (!isSubGameMessage) {
          return;
        }
      }

      // Обработка удаления подигр
      if (message.type === "subgames_removed") {
        // Очищаем кэш подигр
        queryClient.invalidateQueries({ queryKey: ['subGames', eventId] });
        
        // Сбрасываем выбранную подигру
        setSelectedSubGameId(null);
        setSubGameData(null);
        
        // Уведомляем родительский компонент
        if (onSubGameSelect) {
          onSubGameSelect(null);
        }
        return;
      }

      // Обработка обновлений данных subgames
      if (message.type === "update_event" || message.type === "detailed_update" || message.type === "update_markets") {
        const subGameId = parseInt(message.eventId);
        
        // Проверяем, является ли это сообщением для одной из наших subgames
        const isOurSubGame = subGamesResponse?.sub_games?.some(
          subGame => subGame.game_id === subGameId
        );
        
        if (isOurSubGame) {
          console.log('📨 [SubGames] Received WebSocket update for subgame:', subGameId, message.type);
          
          // Если это обновление для текущей выбранной subgame, обновляем её данные
          if (selectedSubGameId === subGameId && subGameData) {
            const updatedSubGameData = { ...subGameData };
            
            // Обновляем данные в зависимости от типа сообщения
            if (message.payload?.gameData) {
              Object.assign(updatedSubGameData, message.payload.gameData);
            }
            
            if (message.payload?.groupedMarkets) {
              updatedSubGameData.groupedMarkets = message.payload.groupedMarkets;
            }
            
            if (message.payload?.parsedScore) {
              updatedSubGameData.parsedScore = message.payload.parsedScore;
            }
            
            if (message.payload?.meta) {
              updatedSubGameData.meta = {
                ...updatedSubGameData.meta,
                ...message.payload.meta
              };
            }
            
            // Обновляем состояние
            setSubGameData(updatedSubGameData);
            
            // Уведомляем родительский компонент об обновлении
            if (onSubGameSelect) {
              onSubGameSelect(updatedSubGameData);
            }
            
            console.log('✅ [SubGames] Updated subgame data:', updatedSubGameData);
          }
          
          // Данные обновлены через WebSocket
        }
      }
    };

    addMessageHandler(handleMessage);

    return () => {
      removeMessageHandler(handleMessage);
    };
  }, [eventId, queryClient, onSubGameSelect, addMessageHandler, removeMessageHandler, subGamesResponse, selectedSubGameId, subGameData]);

  if (isLoading) {
    return (
      <div className={styles.subGamesContainer}>
        <div className={styles.loading}>
          <span>{t("common.loadingSubGames")}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.subGamesContainer}>
        <div className={styles.error}>
          <span>{t("common.subGamesError", { message: error.message })}</span>
        </div>
      </div>
    );
  }

  // Раньше при пустом списке возвращали null. Теперь всегда показываем блок с кнопкой "Все".

  return (
    <div className={styles.subGamesContainer}>
      <div className={styles.oddMenuList}>
        <button
          className={selectedSubGameId === null ? styles.activeButton : ""}
          onClick={() => {
            setSelectedSubGameId(null);
            setSubGameData(null);
            if (onSubGameSelect) {
              onSubGameSelect(null);
            }
          }}
        >
          {t("common.all")}
        </button>
        {(subGamesResponse?.sub_games ?? []).map((subGame) => (
          <button
            key={subGame.game_id}
            className={selectedSubGameId === subGame.game_id ? styles.activeButton : ""}
            onClick={() => handleSubGameClick(subGame)}
            disabled={loadingSubGame}
          >
            {subGame.game_name}
            {selectedSubGameId === subGame.game_id && loadingSubGame && (
              <span className={styles.loadingDot}>...</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SubGames;