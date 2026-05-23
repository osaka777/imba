import { useLocalStorage } from "usehooks-ts";
import { useState, useEffect } from "react";

export type AccountType = 'main' | 'bonus';

export const useAccountType = () => {
  const [isClient, setIsClient] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useLocalStorage<AccountType>('selectedAccountType', 'main');

  useEffect(() => {
    setIsClient(true);
  }, []);

  // На сервере всегда возвращаем 'main', на клиенте - реальное значение
  const currentAccountType = isClient ? selectedAccountType : 'main';

  return {
    selectedAccountType: currentAccountType,
    setSelectedAccountType,
    isMainAccount: currentAccountType === 'main',
    isBonusAccount: currentAccountType === 'bonus',
    isClient,
  };
}; 