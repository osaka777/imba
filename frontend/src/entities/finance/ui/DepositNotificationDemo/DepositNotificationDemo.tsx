"use client";

import React from 'react';
import { Button } from '~/shared/ui';
import { useDepositNotificationsContext } from '../../providers/DepositNotificationsProvider';
import styles from './DepositNotificationDemo.module.css';

export const DepositNotificationDemo: React.FC = () => {
  const { addDepositNotification } = useDepositNotificationsContext();

  const showSuccessNotification = () => {
    addDepositNotification({
      id: `demo_success_${Date.now()}`,
      status: 'SUCCESS',
      amount: 5000,
      currency: 'KZT',
      timestamp: Date.now(),
    });
  };

  const showAcceptedNotification = () => {
    addDepositNotification({
      id: `demo_accepted_${Date.now()}`,
      status: 'ACCEPTED',
      amount: 3000,
      currency: 'KZT',
      timestamp: Date.now(),
    });
  };

  const showErrorNotification = () => {
    addDepositNotification({
      id: `demo_error_${Date.now()}`,
      status: 'ERROR',
      amount: 1000,
      currency: 'KZT',
      timestamp: Date.now(),
    });
  };

  return (
    <div className={styles.demo}>
      <h3 className={styles.title}>Демо уведомлений о депозитах</h3>
      <div className={styles.buttons}>
        <Button onClick={showSuccessNotification} className={styles.successButton}>
          ✅ Успешный депозит
        </Button>
        <Button onClick={showAcceptedNotification} className={styles.acceptedButton}>
          ⏳ Принятый депозит
        </Button>
        <Button onClick={showErrorNotification} className={styles.errorButton}>
          ❌ Ошибка депозита
        </Button>
      </div>
    </div>
  );
};