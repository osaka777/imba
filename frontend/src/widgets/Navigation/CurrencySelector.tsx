"use client";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/shared/ui/Select";
import { SITE_CURRENCY_CODES } from "~/shared/lib/siteCurrencies";

import style from "./CurrencySelector.module.css";

export const CurrencySelector = ({ currency, setCurrency }: { currency: string, setCurrency: (currency: string) => void }) => {
  const currencies = SITE_CURRENCY_CODES.map((value) => ({ label: value, value }));

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
