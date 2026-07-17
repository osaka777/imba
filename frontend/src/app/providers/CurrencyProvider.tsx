"use client";

import { createContext, useEffect, useState } from "react";

import { DEFAULT_SITE_CURRENCY, normalizeSiteCurrency } from "~/shared/lib/siteCurrencies";

type CurrencyContextType = {
  currency: string;
  setCurrency: (currency: string) => void;
};

export const CurrencyContext = createContext<CurrencyContextType | null>(null);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrencyState] = useState(DEFAULT_SITE_CURRENCY);

  useEffect(() => {
    const saved = localStorage.getItem("currency");
    if (saved) {
      const parsed = JSON.parse(saved) as string;
      setCurrencyState(normalizeSiteCurrency(parsed));
    }
  }, []);

  const setCurrency = (newCurrency: string) => {
    const normalized = normalizeSiteCurrency(newCurrency);
    localStorage.setItem("currency", JSON.stringify(normalized));
    setCurrencyState(normalized);
    window.dispatchEvent(new Event("currencyChanged")); 
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};
