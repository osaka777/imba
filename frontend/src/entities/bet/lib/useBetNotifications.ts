import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useWebSocketContext } from '~/entities/game/lib/WebSocketContext';
import { useGamesBettingContext } from '~/app/providers/GamesBetting.provider';
import { getUser } from '~/entities/user/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { shouldDeferToNativePush, showNativeNotification } from '~/entities/push/lib/nativeApp';
import { useLocale } from '~/shared/model/useLocale';

export const useBetNotifications = () => {
  const { t } = useLocale();
  const { isAuth } = useGamesBettingContext();
  const { sendJsonMessage, addMessageHandler, removeMessageHandler, isConnected } = useWebSocketContext();
  const queryClient = useQueryClient();
  const isSubscribedRef = useRef(false);
  
  const { data: userData } = useQuery({
    queryFn: getUser,
    queryKey: ['user'],
    enabled: isAuth,
  });

  useEffect(() => {
    if (!isAuth || !isConnected || !userData?.id || isSubscribedRef.current) return;

    isSubscribedRef.current = true;

    sendJsonMessage({
      type: 'subscribe_user',
      userId: userData.id.toString(),
    });

    const handleBetMessage = (message: any) => {
      if (message.status === 'success' || message.type === 'heartbeat') {
        return;
      }

      if (message.type === 'telegram_linked') {
        const username = message.payload?.telegramUsername ?? null;
        queryClient.invalidateQueries({ queryKey: ['user'] });
        window.dispatchEvent(
          new CustomEvent('imba:telegram-linked', { detail: { username } }),
        );
        toast.success(t('notify.telegramLinked'), {
          position: 'top-right',
          autoClose: 4000,
        });
        return;
      }

      if (!message.eventId || message.eventId !== `user_${userData.id}`) {
        return;
      }

      if (message.type === 'bet_created') {
        if (!shouldDeferToNativePush()) {
          toast.success(t('notify.betAccepted'), {
            position: 'top-right',
            autoClose: 3000,
          });
        }
        showNativeNotification(t('notify.nativeBrand'), t('notify.betAccepted'));
      } else if (message.type === 'bet_status_changed') {
        const { status, amount, currencyCode } = message.payload;
        
        let statusText = '';
        let toastType: 'success' | 'error' | 'info' = 'info';
        
        switch (status) {
          case 'WIN':
            statusText = t('notify.betWin', { amount, currency: currencyCode });
            toastType = 'success';
            break;
          case 'LOSE':
            statusText = t('notify.betLose');
            toastType = 'error';
            break;
          case 'RETURN':
            statusText = t('notify.betReturn', { amount, currency: currencyCode });
            toastType = 'info';
            break;
          case 'CASHOUT':
            statusText = t('notify.betCashout', { amount, currency: currencyCode });
            toastType = 'success';
            break;
          case 'PENDING':
            statusText = t('notify.betPending');
            toastType = 'info';
            break;
          default:
            statusText = t('notify.betStatus', { status });
            toastType = 'info';
        }
        
        if (!shouldDeferToNativePush()) {
          toast[toastType](statusText, {
            position: 'top-right',
            autoClose: 5000,
          });
        }
        showNativeNotification(t('notify.nativeBrand'), statusText);

        queryClient.invalidateQueries({ queryKey: ['user'] });
        queryClient.invalidateQueries({ queryKey: ['wc-bets'] });
        queryClient.invalidateQueries({ queryKey: ['bets', 'open'] });
        queryClient.invalidateQueries({ queryKey: ['bets'] });
        queryClient.invalidateQueries({ queryKey: ['bets-history'] });
        queryClient.invalidateQueries({ queryKey: ['bonus-history'] });
        queryClient.invalidateQueries({ queryKey: ['bonus-stats'] });
      }
    };

    sendJsonMessage({
      type: 'subscribe',
      filter: { eventIds: [`user_${userData.id}`] },
    });

    addMessageHandler(handleBetMessage);

    return () => {
      if (!isSubscribedRef.current) return;
      
      isSubscribedRef.current = false;
      removeMessageHandler(handleBetMessage);
      
      if (userData?.id) {
        sendJsonMessage({
          type: 'unsubscribe',
          filter: { eventIds: [`user_${userData.id}`] },
        });
      }
    };
  }, [isAuth, isConnected, userData?.id, t]);
};
