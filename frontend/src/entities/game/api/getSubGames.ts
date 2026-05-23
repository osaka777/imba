import { api } from "~/shared/api";
// Убираем неиспользуемый импорт components

export interface SubGameDto {
  game_id: number;
  subGameDbId?: number; // ID записи в таблице SubGame для корректной передачи в ставках
  game_num: number;
  game_name: string;
}

export interface SubGameData {
  game_id: number;
  subGameDbId?: number; // ID записи в таблице SubGame для корректной передачи в ставках
  game_num: number;
  game_name: string;
  // Добавляем поля, которые могут прийти из API
  eventId?: string;
  eventName?: string;
  team1?: string;
  team2?: string;
  sport?: string;
  leagueName?: string;
  status?: string;
  groupedMarkets?: {
    [key: string]: any[];
  };
  parsedScore?: any;
  meta?: any;
}

export interface SubGamesResponse {
  sub_games: SubGameDto[];
  // Основные данные игры
  eventId?: string;
  eventName?: string;
  team1?: string;
  team2?: string;
  sport?: string;
  leagueName?: string;
  status?: string;
}

export const getSubGames = async (eventId: string): Promise<SubGamesResponse> => {
  try {
    // Используем backend API вместо прямого fetch
    const { data } = await api.GET(`/api/game/${eventId}/sub-games`);
    
    if (!data) {
      throw new Error('No data received from API');
    }
    
    // Логирование для отладки
    console.log('[getSubGames] Raw API response:', data);
    
    // Проверяем структуру ответа
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format');
    }

    // Обрабатываем ответ API - статус 1 означает успех с данными в body
    let responseData = data;
    if (data.status === 1 && data.body) {
      // Проверяем, не является ли body строкой с ошибкой
      if (typeof data.body === 'string' && data.body.includes('Error in you package!')) {
        throw new Error(data.body);
      }
      // Если статус 1, данные находятся в поле body
      responseData = data.body;
    } else if (data.status === 99) {
      // Статус 99 означает ошибку
      throw new Error(data.body || 'API error');
    } else if (data.status && data.status !== 200 && data.status !== 1) {
      // Только если статус не 200 и не 1, это ошибка
      throw new Error(data.body || 'API error');
    }

    const result: SubGamesResponse = {
      sub_games: responseData.sub_games || [],
      eventId: responseData.eventId || eventId,
      eventName: responseData.eventName || `${responseData.opp_1_name || ''} vs ${responseData.opp_2_name || ''}`,
      team1: responseData.opp_1_name,
      team2: responseData.opp_2_name,
      sport: responseData.sport_name,
      leagueName: responseData.tournament_name,
      status: responseData.status
    };

    // Логирование финальных данных
    console.log('[getSubGames] Final result:', result);
    console.log('[getSubGames] Sub games:', result.sub_games);
    
    return result;
  } catch (error) {
    console.error(`Error fetching sub games for event ${eventId}:`, error);
    throw error;
  }
};

export const getSubGameData = async (gameId: number): Promise<SubGameData> => {
  try {
    const { data, response } = await api.GET( `/api/sub-game/${gameId}`, {
      params: {
        path: {
          eventId: gameId.toString(),
        },
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response data');
    }

    // Проверяем структуру ответа
    const responseData = data as any;
    
    // Создаем объект результата
    const result: SubGameData = {
      game_id: gameId,
      game_num: 1,
      game_name: responseData.eventName || `Game ${gameId}`,
      eventId: responseData.eventId || gameId.toString(),
      eventName: responseData.eventName || `Game ${gameId}`,
      team1: responseData.team1 || '',
      team2: responseData.team2 || '',
      sport: responseData.sport || '',
      leagueName: responseData.leagueName || '',
      status: responseData.status || '',
      groupedMarkets: responseData.groupedMarkets || {},
      parsedScore: responseData.parsedScore || null,
      meta: responseData.meta || {
        stat_list: responseData.stat_list || [],
        last_markets_update: responseData.last_markets_update
      }
    };

    return result;
  } catch (error) {
    console.error(`Error fetching sub game data for game ${gameId}:`, error);
    throw error;
  }
};