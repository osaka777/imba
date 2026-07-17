/** Temporarily hidden from registration and currency selectors. */
export const HIDDEN_SITE_CURRENCY_CODES = [
  "UAH",
  "TRY",
  "UZS",
  "AZN",
  "KGS",
  "TJS",
] as const;

/** Active currencies on imba.bet (USD removed — use USDT). */
export const VISIBLE_SITE_CURRENCY_CODES = ["KZT", "RUB", "USDT"] as const;

/** Shown in header selector, registration, profile switcher. */
export const SITE_CURRENCY_CODES = VISIBLE_SITE_CURRENCY_CODES;

export const ALL_SITE_CURRENCY_CODES = [
  ...VISIBLE_SITE_CURRENCY_CODES,
  ...HIDDEN_SITE_CURRENCY_CODES,
] as const;

export type VisibleSiteCurrencyCode = (typeof VISIBLE_SITE_CURRENCY_CODES)[number];
export type SiteCurrencyCode = (typeof ALL_SITE_CURRENCY_CODES)[number];

export const DEFAULT_SITE_CURRENCY: VisibleSiteCurrencyCode = "KZT";

export function isHiddenSiteCurrency(code: string): boolean {
  return HIDDEN_SITE_CURRENCY_CODES.includes(
    code.toUpperCase() as (typeof HIDDEN_SITE_CURRENCY_CODES)[number],
  );
}

export function isVisibleSiteCurrency(code: string): boolean {
  return VISIBLE_SITE_CURRENCY_CODES.includes(
    code.toUpperCase() as VisibleSiteCurrencyCode,
  );
}

export function isSiteCurrency(code: string): boolean {
  return ALL_SITE_CURRENCY_CODES.includes(code.toUpperCase() as SiteCurrencyCode);
}

export function normalizeSiteCurrency(code?: string | null): string {
  const normalized = (code ?? "").toUpperCase();
  if (!normalized || normalized === "USD" || isHiddenSiteCurrency(normalized)) {
    return DEFAULT_SITE_CURRENCY;
  }
  if (isVisibleSiteCurrency(normalized)) {
    return normalized;
  }
  return DEFAULT_SITE_CURRENCY;
}
