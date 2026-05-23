import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useWebSocketContext } from '~/entities/game/lib/WebSocketContext';
import { useGamesBettingContext } from '~/app/providers/GamesBetting.provider';
import { getUser } from '~/entities/user/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const useBetNotifications = () => {
  const { isAuth } = useGamesBettingContext();
  const { sendJsonMessage, addMessageHandler, removeMessageHandler, isConnected } = useWebSocketContext();
  const queryClient = useQueryClient();
  const isSubscribedRef = useRef(false);
  
  // Получаем данные пользователя для userId
  const { data: userData } = useQuery({
    queryFn: getUser,
    queryKey: ['user'],
    enabled: isAuth,
  });

  useEffect(() => {
    if (!isAuth || !isConnected || !userData?.id || isSubscribedRef.current) return;

    console.log('🔌 Setting up bet notifications for user:', userData.id);
    isSubscribedRef.current = true;

    // Подписываемся на уведомления пользователя
    sendJsonMessage({
      type: 'subscribe_user',
      userId: userData.id.toString(),
    });

    const handleBetMessage = (message: any) => {
      // Игнорируем служебные сообщения (subscribed, heartbeat и т.д.)
      if (message.status === 'success' || message.type === 'heartbeat' || !message.eventId) {
        return;
      }

      // Проверяем, что это уведомление о ставке для текущего пользователя
      if (message.eventId !== `user_${userData.id}`) {
        return;
      }

      console.log('✅ Received bet notification:', message.type, message.payload);

      if (message.type === 'bet_created') {
        toast.success('✅ Ставка успешно создана!', {
          position: 'top-right',
          autoClose: 3000,
        });
      } else if (message.type === 'bet_status_changed') {
        const { status, amount, currencyCode } = message.payload;
        
        let statusText = '';
        let toastType: 'success' | 'error' | 'info' = 'info';
        
        switch (status) {
          case 'WIN':
            statusText = `🎉 Выигрыш! +${amount} ${currencyCode}`;
            toastType = 'success';
            break;
          case 'LOSE':
            statusText = `❌ Проигрыш`;
            toastType = 'error';
            break;
          case 'RETURN':
            statusText = `🔄 Возврат ставки ${amount} ${currencyCode}`;
            toastType = 'info';
            break;
          case 'PENDING':
            statusText = `⏳ Ставка обрабатывается`;
            toastType = 'info';
            break;
          default:
            statusText = `Статус ставки: ${status}`;
            toastType = 'info';
        }
        
        toast[toastType](statusText, {
          position: 'top-right',
          autoClose: 5000,
        });

        // Инвалидируем кэш пользователя для обновления бонусного баланса
        queryClient.invalidateQueries({ queryKey: ['user'] });
        queryClient.invalidateQueries({ queryKey: ['bonus-history'] });
        queryClient.invalidateQueries({ queryKey: ['bonus-stats'] });
      }
    };

    // Подписываемся на уведомления о ставках
    sendJsonMessage({
      type: 'subscribe',
      filter: { eventIds: [`user_${userData.id}`] },
    });

    addMessageHandler(handleBetMessage);

    return () => {
      if (!isSubscribedRef.current) return;
      
      console.log('🔌 Cleaning up bet notifications for user:', userData?.id);
      isSubscribedRef.current = false;
      removeMessageHandler(handleBetMessage);
      
      if (userData?.id) {
        sendJsonMessage({
          type: 'unsubscribe',
          filter: { eventIds: [`user_${userData.id}`] },
        });
      }
    };
  }, [isAuth, isConnected, userData?.id]);
};