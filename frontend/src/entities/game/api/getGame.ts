import { toast } from "react-toastify";
import { api } from "~/shared/api";
import { createManagedInterval } from "~/shared/lib";

// Кэш для несуществующих ID игр
const nonExistentGameIds = new Set<string>();
// Кэш времени последнего обновления для каждой игры
const lastUpdateTimes = new Map<string, number>();

// Функция очистки кэша
const cleanupGameCache = () => {
  nonExistentGameIds.clear();
  lastUpdateTimes.clear();
};

// Добавляем очистку кэша в менеджер памяти (каждые 10 минут)
if (typeof window !== 'undefined') {
  createManagedInterval(cleanupGameCache, 10 * 60 * 1000);
}

export const getGame = async (eventId: string) => {
  // Проверяем, не находится ли ID в кэше несуществующих
  if (nonExistentGameIds.has(eventId)) {
    // Проверяем, не прошло ли 5 минут с последнего обновления
    const lastUpdate = lastUpdateTimes.get(eventId) || 0;
    const timeSinceLastUpdate = Date.now() - lastUpdate;
    
    if (timeSinceLastUpdate > 5 * 60 * 1000) {
      // Если прошло больше 5 минут, удаляем из кэша несуществующих
      nonExistentGameIds.delete(eventId);
      lastUpdateTimes.delete(eventId);
    } else {
      console.warn(`Game with ID ${eventId} is in frontend nonExistent cache. Skipping API call.`);
      throw new Error(`Game with ID ${eventId} does not exist`);
    }
  }
  
  try {
    const { data: game, error, response } = await api.GET(`/api/game/${eventId}`, {});
    
    // Проверяем статус ответа
    if (error || !game || response.status === 404) {
      console.warn(`Game with ID ${eventId} not found. Status: ${response.status}`);
      
      // Добавляем ID в кэш несуществующих
      nonExistentGameIds.add(eventId);
      lastUpdateTimes.set(eventId, Date.now());
      
      throw new Error(`Game with ID ${eventId} not found`);
    }
    
    // Обновляем время последнего успешного получения данных
    lastUpdateTimes.set(eventId, Date.now());
    
    if (game.groupedMarkets) {
      // console.log("=== API MARKETS ===");
      // console.log("Market groups:", Object.keys(game.groupedMarkets));
      
      // Выводим детали маркетов
      Object.entries(game.groupedMarkets).forEach(([groupName, markets]) => {
        if (Array.isArray(markets) && markets.length > 0) {
          // console.log(`Group ${groupName} example market:`, markets[0]);
          // console.log(`Market fields:`, Object.keys(markets[0]));
        }
      });
    }
    
    return game;
  } catch (error) {
    // Если это не ошибка 404, логируем её
    if (error instanceof Error && !error.message.includes('not found')) {
      console.error(`Error fetching game with ID ${eventId}:`, error);
    }
    throw error;
  }
};
