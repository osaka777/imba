import { useLocalStorage } from "usehooks-ts";
import { useState, useEffect } from "react";

export type AccountType = 'main' | 'bonus';

export const useAccountType = () => {
  const [isClient, setIsClient] = useState(false);
  // Avoid hydration mismatch: SSR and first paint always "main", then sync from storage.
  const [selectedAccountType, setSelectedAccountType] = useLocalStorage<AccountType>(
    "selectedAccountType",
    "main",
    { initializeWithValue: false },
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  const normalized: AccountType =
    selectedAccountType === "bonus" ? "bonus" : "main";

  // On server / first paint always "main"
  const currentAccountType = isClient ? normalized : "main";

  return {
    selectedAccountType: currentAccountType,
    setSelectedAccountType,
    isMainAccount: currentAccountType === "main",
    isBonusAccount: currentAccountType === "bonus",
    isClient,
  };
}; 