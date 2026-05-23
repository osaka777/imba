"use client";

import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

interface DepositStatus {
  id: string;
  status: 'SUCCESS' | 'ACCEPTED' | 'ERROR';
  amount: number;
  currency: string;
  timestamp: number;
}

export const useDepositNotifications = () => {
  const processedDeposits = useRef<Set<string>>(new Set());

  const showDepositNotification = (deposit: DepositStatus) => {
    // Проверяем, не показывали ли уже уведомление для этого депозита
    if (processedDeposits.current.has(deposit.id)) {
      return;
    }

    processedDeposits.current.add(deposit.id);

    const { status, amount, currency } = deposit;
    const formattedAmount = `${amount} ${currency}`;

    switch (status) {
      case 'SUCCESS':
        toast.success(`✅ Депозит успешно зачислен! Сумма: ${formattedAmount}`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        break;

      case 'ACCEPTED':
        toast.info(`⏳ Депозит принят к обработке. Сумма: ${formattedAmount}`, {
          position: "top-right",
          autoClose: 7000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        break;

      case 'ERROR':
        toast.error(`❌ Ошибка при обработке депозита. Сумма: ${formattedAmount}`, {
          position: "top-right",
          autoClose: 8000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        break;

      default:
        toast.warning(`⚠️ Неизвестный статус депозита: ${status}. Сумма: ${formattedAmount}`, {
          position: "top-right",
          autoClose: 6000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
    }
  };

  // Функция для проверки новых депозитов (может быть вызвана извне)
  const checkForNewDeposits = async () => {
    try {
      // Здесь можно добавить API вызов для получения последних депозитов
      // Пока что это заглушка для будущего расширения
      console.log('Checking for new deposits...');
      
      // Пример использования:
      // const recentDeposits = await getRecentDeposits(5);
      // recentDeposits.forEach(deposit => {
      //   if (deposit.status === 'SUCCESS' || deposit.status === 'FAILED') {
      //     const depositStatus: DepositStatus = {
      //       id: deposit.id,
      //       status: deposit.status === 'SUCCESS' ? 'SUCCESS' : 'ERROR',
      //       amount: deposit.amount,
      //       currency: deposit.currency,
      //       timestamp: new Date(deposit.updatedAt).getTime(),
      //     };
      //     showDepositNotification(depositStatus);
      //   }
      // });
    } catch (error) {
      console.error('Error checking deposits:', error);
    }
  };

  // Функция для ручного добавления уведомления о депозите
  const addDepositNotification = (deposit: DepositStatus) => {
    showDepositNotification(deposit);
  };

  // Очистка обработанных депозитов при размонтировании
  useEffect(() => {
    return () => {
      processedDeposits.current.clear();
    };
  }, []);

  return {
    addDepositNotification,
    checkForNewDeposits,
  };
};