import React, { createContext, useContext, useState } from 'react';

type CurrencyContextType = {
  currentCurrency: string;
  setCurrentCurrency: (currency: string) => void;
};

const CurrencyContext = createContext<CurrencyContextType>({
  currentCurrency: 'KZT',
  setCurrentCurrency: () => {},
});

export const CurrencyProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentCurrency, setCurrentCurrency] = useState<string>('KZT');
  
  return (
    <CurrencyContext.Provider value={{ currentCurrency, setCurrentCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext); 