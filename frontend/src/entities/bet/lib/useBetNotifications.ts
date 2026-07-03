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
      if (message.status === 'success' || message.type === 'heartbeat') {
        return;
      }

      if (message.type === 'telegram_linked') {
        const username = message.payload?.telegramUsername ?? null;
        queryClient.invalidateQueries({ queryKey: ['user'] });
        window.dispatchEvent(
          new CustomEvent('imba:telegram-linked', { detail: { username } }),
        );
        toast.success('Telegram успешно привязан', {
          position: 'top-right',
          autoClose: 4000,
        });
        return;
      }

      // Проверяем, что это уведомление о ставке для текущего пользователя
      if (!message.eventId || message.eventId !== `user_${userData.id}`) {
        return;
      }

      console.log('✅ Received bet notification:', message.type, message.payload);

      if (message.type === 'bet_created') {
        toast.success('Ставка принята', {
          position: 'top-right',
          autoClose: 3000,
        });
      } else if (message.type === 'bet_status_changed') {
        const { status, amount, currencyCode } = message.payload;
        
        let statusText = '';
        let toastType: 'success' | 'error' | 'info' = 'info';
        
        switch (status) {
          case 'WIN':
            statusText = `Выигрыш: +${amount} ${currencyCode}`;
            toastType = 'success';
            break;
          case 'LOSE':
            statusText = 'Ставка проиграла';
            toastType = 'error';
            break;
          case 'RETURN':
            statusText = `Возврат: ${amount} ${currencyCode}`;
            toastType = 'info';
            break;
          case 'CASHOUT':
            statusText = `Продажа: +${amount} ${currencyCode}`;
            toastType = 'success';
            break;
          case 'PENDING':
            statusText = 'Ставка обрабатывается';
            toastType = 'info';
            break;
          default:
            statusText = `Статус: ${status}`;
            toastType = 'info';
        }
        
        toast[toastType](statusText, {
          position: 'top-right',
          autoClose: 5000,
        });

        queryClient.invalidateQueries({ queryKey: ['user'] });
        queryClient.invalidateQueries({ queryKey: ['wc-bets'] });
        queryClient.invalidateQueries({ queryKey: ['bets', 'open'] });
        queryClient.invalidateQueries({ queryKey: ['bets'] });
        queryClient.invalidateQueries({ queryKey: ['bets-history'] });
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