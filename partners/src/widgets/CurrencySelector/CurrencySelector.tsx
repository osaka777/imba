"use client";
import React, { useState, useEffect } from "react";
import { ChevronDownIcon } from "lucide-react";
import { getBalances } from "@/entities/user/api/getBalances";
import { IBalances } from "@/entities/user/interface/IBalances";
import styles from "./CurrencySelector.module.css";

interface CurrencySelectorProps {
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  className?: string;
  options?: string[];
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  selectedCurrency,
  onCurrencyChange,
  className = "",
  options,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currencies, setCurrencies] = useState<IBalances[]>([]);

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const data = await getBalances();
        let list: IBalances[] = data || [];

        if (options && options.length > 0) {
          const map = new Map(list.map((b) => [b.currencyCode, b.amount]));
          list = options.map((code) => ({
            currencyCode: code,
            amount: map.get(code) ?? "0",
            id: 0 as unknown as number,
          })) as unknown as IBalances[];
        }

        if (list.length > 0) {
          setCurrencies(list);
          const exists = list.some((c) => c.currencyCode === selectedCurrency);
          if (!exists) {
            onCurrencyChange(list[0].currencyCode);
          }
        } else if (options && options.length > 0) {
          // Fallback to options if no balances returned
          const fallback = options.map((code) => ({
            currencyCode: code,
            amount: "0",
            id: 0 as unknown as number,
          })) as unknown as IBalances[];
          setCurrencies(fallback);
          if (!options.includes(selectedCurrency)) {
            onCurrencyChange(options[0]);
          }
        }
      } catch (error) {
        // In case of error, still expose options if provided
        if (options && options.length > 0) {
          const fallback = options.map((code) => ({
            currencyCode: code,
            amount: "0",
            id: 0 as unknown as number,
          })) as unknown as IBalances[];
          setCurrencies(fallback);
          if (!options.includes(selectedCurrency)) {
            onCurrencyChange(options[0]);
          }
        } else {
          console.error("Error fetching currencies:", error);
        }
      }
    };

    fetchCurrencies();
  }, [selectedCurrency, onCurrencyChange, options]);

  const handleCurrencySelect = (currency: string) => {
    onCurrencyChange(currency);
    setIsOpen(false);
  };

  return (
    <div className={`${styles.currencySelector} ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${styles.currencyButton} ${isOpen ? styles.open : ''}`}
      >
        <span className={styles.currencyCode}>
          {selectedCurrency}
        </span>
        <ChevronDownIcon className={styles.chevronIcon} />
      </button>

      {isOpen && (
        <div className={styles.currencyDropdown}>
          {currencies.map((currency) => (
            <button
              key={currency.currencyCode}
              onClick={() => handleCurrencySelect(currency.currencyCode)}
              className={`${styles.currencyOption} ${
                currency.currencyCode === selectedCurrency ? styles.selected : ''
              }`}
            >
              <span className={styles.currencyCode}>{currency.currencyCode}</span>
              <span className={styles.currencyAmount}>
                {parseFloat(currency.amount).toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
