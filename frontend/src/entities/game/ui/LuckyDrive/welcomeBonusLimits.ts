export type WelcomeBonusLimitRow = {
  currency: string;
  label: string;
  minDeposit: number;
  maxBonus: number;
};

const CURRENCY_META: Record<string, { label: string; symbol: string }> = {
  KZT: { label: "Тенге", symbol: "₸" },
  RUB: { label: "Рубли", symbol: "₽" },
  USDT: { label: "USDT", symbol: "USDT" },
  TRY: { label: "Лира", symbol: "₺" },
  BRL: { label: "Реал", symbol: "R$" },
  UAH: { label: "Гривна", symbol: "₴" },
  UZS: { label: "Сум", symbol: "so'm" },
  AZN: { label: "Манат", symbol: "₼" },
  KGS: { label: "Сом", symbol: "с" },
  TJS: { label: "Сомони", symbol: "ЅМ" },
};

export const WELCOME_BONUS_LIMITS: WelcomeBonusLimitRow[] = [
  { currency: "KZT", label: "Тенге", minDeposit: 5000, maxBonus: 5000 },
  { currency: "RUB", label: "Рубли", minDeposit: 2000, maxBonus: 3000 },
  { currency: "USDT", label: "USDT", minDeposit: 30, maxBonus: 50 },
  { currency: "TRY", label: "Лира", minDeposit: 500, maxBonus: 2500 },
  { currency: "BRL", label: "Реал", minDeposit: 30, maxBonus: 150 },
  { currency: "UAH", label: "Гривна", minDeposit: 200, maxBonus: 1500 },
];

export function getWelcomeLimit(currencyCode: string): WelcomeBonusLimitRow {
  const code = currencyCode.toUpperCase();
  const meta = CURRENCY_META[code];
  const base =
    WELCOME_BONUS_LIMITS.find((r) => r.currency === code)
    ?? WELCOME_BONUS_LIMITS.find((r) => r.currency === "USDT")!;
  return {
    ...base,
    label: meta?.label ?? base.label,
  };
}

export function formatLimitAmount(amount: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

export function formatWelcomeMoney(amount: number, currencyCode: string): string {
  const code = currencyCode.toUpperCase();
  const meta = CURRENCY_META[code] ?? { label: code, symbol: code };
  return `${formatLimitAmount(amount)} ${meta.symbol}`;
}

export function getCurrencyLabel(currencyCode: string): string {
  const code = currencyCode.toUpperCase();
  return CURRENCY_META[code]?.label ?? getWelcomeLimit(code).label;
}
