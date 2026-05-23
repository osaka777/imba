"use client";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/shared/ui/Select";

import style from "./CurrencySelector.module.css";

export const CurrencySelector = ({ currency, setCurrency }: { currency: string, setCurrency: (currency: string) => void }) => {
  const currencies = [
    { label: 'USD', value: 'USD' },
    { label: 'KZT', value: 'KZT' },
    { label: 'UAH', value: 'UAH' },
    { label: 'RUB', value: 'RUB' },
    { label: 'TRY', value: 'TRY' },
    { label: 'UZS', value: 'UZS' }
  ];

  return (
    <Select onValueChange={(e) => setCurrency(e)} value={currency} >
      <SelectTrigger className={`${style.select} dark:bg-transparent flex justify-end`}>
        <SelectValue>{currency}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {currencies.map(({ label, value }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
