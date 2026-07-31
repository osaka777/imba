"use client";

import { createContext, useEffect, useState } from "react";

import { DEFAULT_SITE_CURRENCY, normalizeSiteCurrency } from "~/shared/lib/siteCurrencies";

type CurrencyContextType = {
  currency: string;
  setCurrency: (currency: string) => void;
};

export const CurrencyContext = createContext<CurrencyContextType | null>(null);

function readStoredCurrency(): string {
  try {
    const saved = localStorage.getItem("currency");
    if (!saved) return DEFAULT_SITE_CURRENCY;
    try {
      const parsed = JSON.parse(saved) as unknown;
      if (typeof parsed === "string") return normalizeSiteCurrency(parsed);
    } catch {
      // Legacy/plain values like KZT without JSON quotes.
    }
    return normalizeSiteCurrency(saved.replace(/^"|"$/g, ""));
  } catch {
    return DEFAULT_SITE_CURRENCY;
  }
}

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrencyState] = useState(DEFAULT_SITE_CURRENCY);

  useEffect(() => {
    setCurrencyState(readStoredCurrency());
  }, []);

  const setCurrency = (newCurrency: string) => {
    const normalized = normalizeSiteCurrency(newCurrency);
    try {
      localStorage.setItem("currency", JSON.stringify(normalized));
    } catch {
      /* ignore quota / private mode */
    }
    setCurrencyState(normalized);
    window.dispatchEvent(new Event("currencyChanged"));
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};
