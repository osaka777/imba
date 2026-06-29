"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useDepositNotifications } from '../lib/useDepositNotifications';
import { useDepositStatusNotifications } from '../lib/useDepositStatusNotifications';
import { useAuth } from '~/app/providers/AuthProvider';

interface DepositStatus {
  id: string;
  status: 'SUCCESS' | 'ACCEPTED' | 'ERROR';
  amount: number;
  currency: string;
  timestamp: number;
}

interface DepositNotificationsContextType {
  addDepositNotification: (deposit: DepositStatus) => void;
  checkForNewDeposits: () => Promise<void>;
}

const DepositNotificationsContext = createContext<DepositNotificationsContextType | undefined>(undefined);

export const useDepositNotificationsContext = () => {
  const context = useContext(DepositNotificationsContext);
  if (!context) {
    throw new Error('useDepositNotificationsContext must be used within DepositNotificationsProvider');
  }
  return context;
};

interface DepositNotificationsProviderProps {
  children: ReactNode;
}

const DepositRealtimeListener = () => {
  useDepositStatusNotifications();
  return null;
};

const DepositAuthListener = () => {
  const { isAuth } = useAuth();
  if (!isAuth) return null;
  return <DepositRealtimeListener />;
};

export const DepositNotificationsProvider: React.FC<DepositNotificationsProviderProps> = ({ children }) => {
  const { addDepositNotification, checkForNewDeposits } = useDepositNotifications();

  const value: DepositNotificationsContextType = {
    addDepositNotification,
    checkForNewDeposits,
  };

  return (
    <DepositNotificationsContext.Provider value={value}>
      <DepositAuthListener />
      {children}
    </DepositNotificationsContext.Provider>
  );
};
