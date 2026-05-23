import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSessionClient } from '../lib';

export const useProfileAutoRefresh = () => {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const token = getSessionClient();
    if (!token) {
      return;
    }

    // Функция для проверки и обновления данных профиля
    const checkAndRefreshProfile = async () => {
      try {
        
        // Проверяем, есть ли активные ставки
        const bets = await queryClient.fetchQuery({
          queryKey: ["bets", "pending"],
          queryFn: async () => {
            const getApiUrl = () => {
              if (typeof window !== 'undefined') {
                return window.location.origin;
              }
              return process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';
            };
            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/api/bet?status=PENDING`, {
              headers: { 
                Authorization: `Bearer ${token}`,
                'Accept': 'application/json'
              },
            });
            
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Проверяем тип контента
            const contentType = response.headers.get('content-type');
            
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error(`Expected JSON but got ${contentType}`);
            }
            
            const data = await response.json();
            return data || { express: [], ordinar: [] };
          },
          staleTime: 0, // Всегда получаем свежие данные
        });

        // Если есть активные ставки, обновляем данные профиля
        if (bets && (bets.express?.length > 0 || bets.ordinar?.length > 0)) {
          await queryClient.invalidateQueries({ queryKey: ["user"] });
        } else {
        }
      } catch (error) {
        // Логируем ошибку, но не прерываем работу
        console.warn('Profile auto-refresh warning:', error);
        
        // Если ошибка связана с сетью или сервером, не обновляем данные
        if (error instanceof Error) {
          if (error.message.includes('Expected JSON') || 
              error.message.includes('HTTP error')) {
            return;
          }
        }
      }
    };

    // Запускаем проверку каждые 30 секунд
    intervalRef.current = setInterval(checkAndRefreshProfile, 30000);

    // Очистка при размонтировании
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [queryClient]);

  // Функция для принудительного обновления
  const forceRefresh = async () => {
    const token = getSessionClient();
    if (!token) return;

    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user"] }),
        queryClient.invalidateQueries({ queryKey: ["bets"] }),
        queryClient.invalidateQueries({ queryKey: ["bets", "pending"] })
      ]);
    } catch (error) {
      console.error('Error in forced refresh:', error);
    }
  };

  return { forceRefresh };
};