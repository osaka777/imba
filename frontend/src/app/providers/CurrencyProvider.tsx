"use client";

import { createContext, useEffect, useState } from "react";

type CurrencyContextType = {
  currency: string;
  setCurrency: (currency: string) => void;
};

export const CurrencyContext = createContext<CurrencyContextType | null>(null);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrencyState] = useState("KZT");

  useEffect(() => {
    const saved = localStorage.getItem("currency");
    if (saved) setCurrencyState(JSON.parse(saved));
  }, []);

  const setCurrency = (newCurrency: string) => {
    localStorage.setItem("currency", JSON.stringify(newCurrency));
    setCurrencyState(newCurrency);
    window.dispatchEvent(new Event("currencyChanged")); 
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};
