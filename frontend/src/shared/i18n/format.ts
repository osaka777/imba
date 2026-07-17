import type { AppLocale } from "./locale";

const INTL_LOCALE: Record<AppLocale, string> = {
  ru: "ru-RU",
  en: "en-US",
};

export function toIntlLocale(locale: AppLocale): string {
  return INTL_LOCALE[locale];
}

export type Formatters = {
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  date: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
  dateTime: (
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  time: (value: string | number | Date) => string;
  currency: (value: number, currency: string) => string;
};

export function createFormatters(locale: AppLocale): Formatters {
  const intlLocale = toIntlLocale(locale);

  return {
    number: (value, options) =>
      new Intl.NumberFormat(intlLocale, options).format(value),
    date: (value, options) =>
      new Intl.DateTimeFormat(intlLocale, options).format(value),
    dateTime: (value, options) =>
      new Intl.DateTimeFormat(intlLocale, options).format(new Date(value)),
    time: (value) =>
      new Intl.DateTimeFormat(intlLocale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value)),
    currency: (value, currency) =>
      new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency,
      }).format(value),
  };
}
