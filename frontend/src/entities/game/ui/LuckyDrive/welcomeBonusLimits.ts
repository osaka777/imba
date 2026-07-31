import type { MessageKey, TranslateParams } from "~/shared/i18n/messages";

export type WelcomeBonusLimitRow = {
  currency: string;
  minDeposit: number;
  maxBonus: number;
};

type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

const CURRENCY_SYMBOLS: Record<string, string> = {
  KZT: "₸",
  RUB: "₽",
  USDT: "USDT",
  TRY: "₺",
  BRL: "R$",
  UAH: "₴",
  UZS: "so'm",
  AZN: "₼",
  KGS: "с",
  TJS: "ЅМ",
};

export const WELCOME_BONUS_LIMITS: WelcomeBonusLimitRow[] = [
  { currency: "KZT", minDeposit: 5000, maxBonus: 5000 },
  { currency: "RUB", minDeposit: 2000, maxBonus: 3000 },
  { currency: "USDT", minDeposit: 30, maxBonus: 50 },
  { currency: "TRY", minDeposit: 500, maxBonus: 2500 },
  { currency: "BRL", minDeposit: 30, maxBonus: 150 },
  { currency: "UAH", minDeposit: 200, maxBonus: 1500 },
];

export function getWelcomeLimit(currencyCode: string): WelcomeBonusLimitRow {
  const code = currencyCode.toUpperCase();
  return (
    WELCOME_BONUS_LIMITS.find((row) => row.currency === code)
    ?? WELCOME_BONUS_LIMITS.find((row) => row.currency === "USDT")!
  );
}

export function currencyLabel(currencyCode: string, t: TranslateFn): string {
  const code = currencyCode.toUpperCase();
  return t(`promo.currency${code}` as MessageKey);
}

export function formatLimitAmount(amount: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

export function formatWelcomeMoney(amount: number, currencyCode: string): string {
  const code = currencyCode.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? code;
  return `${formatLimitAmount(amount)} ${symbol}`;
}
