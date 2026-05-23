import { api } from "~/shared/api";

// Кэш для предзагруженных данных
const preloadCache = new Map<string, { data: any; timestamp: number }>();
const PRELOAD_CACHE_TTL = 30 * 1000; // 30 секунд

// Очистка старых записей кэша
const cleanupPreloadCache = () => {
  const now = Date.now();
  for (const [key, value] of preloadCache.entries()) {
    if (now - value.timestamp > PRELOAD_CACHE_TTL) {
      preloadCache.delete(key);
    }
  }
};

// Автоматическая очистка кэша каждые 30 секунд
if (typeof window !== 'undefined') {
  setInterval(cleanupPreloadCache, 30000);
}

export const preloadData = async (url: string, params?: any) => {
  const cacheKey = `${url}-${JSON.stringify(params)}`;
  const now = Date.now();
  
  // Проверяем кэш
  const cached = preloadCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < PRELOAD_CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const { data, error } = await api.GET(url as any, { params });
    if (error) throw error;
    preloadCache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (error) {
    console.warn('Preload failed:', url, error);
    return null;
  }
};

// Предзагрузка популярных страниц
export const preloadPopularPages = async () => {
  try {
    // Ждем, пока основная страница полностью загрузится
    if (typeof window !== 'undefined' && document.readyState !== 'complete') {
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve(void 0);
        } else {
          window.addEventListener('load', () => resolve(void 0), { once: true });
        }
      });
    }

    // Дополнительная задержка для обеспечения плавной работы основного контента
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Предзагружаем данные для популярных страниц с ограниченным количеством
    const popularPages = [
      { url: "/api/games/live", key: ["games"] },
      { url: "/api/games/prematch", key: ["gamesPrematch"] },
      // Убираем специфичные спорты для уменьшения нагрузки
    ];

    // Запускаем предзагрузку с интервалами, чтобы не перегружать сеть
    for (let i = 0; i < popularPages.length; i++) {
      const { url } = popularPages[i];
      
      // Используем requestIdleCallback для предзагрузки в свободное время
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          api.GET(url as any, {
            params: { query: { limit: 3, offset: 0 } }, // Уменьшаем лимит
          }).catch(() => {
            // Игнорируем ошибки предзагрузки
          });
        });
      } else {
        // Fallback с задержкой между запросами
        setTimeout(() => {
          api.GET(url as any, {
            params: { query: { limit: 3, offset: 0 } },
          }).catch(() => {
            // Игнорируем ошибки предзагрузки
          });
        }, i * 1000); // Задержка между запросами
      }
    }

    console.debug("Started optimized preload of popular pages data");
  } catch (error) {
    // Игнорируем ошибки предзагрузки
  }
};

// Предзагрузка при наведении на ссылку
export const preloadOnHover = (url: string, params?: any) => {
  if (typeof window === 'undefined') return;
  
  // Используем requestIdleCallback для предзагрузки в свободное время
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      preloadData(url, params);
    });
  } else {
    // Fallback для браузеров без requestIdleCallback
    setTimeout(() => {
      preloadData(url, params);
    }, 100);
  }
};