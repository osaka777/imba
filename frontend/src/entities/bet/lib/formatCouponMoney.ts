import getSymbolFromCurrency from "currency-symbol-map";

import type { AppLocale } from "~/shared/i18n/locale";
import { toIntlLocale } from "~/shared/i18n/format";

export function formatCouponMoney(
  amount: number | string,
  currencyCode: string,
  options?: { decimals?: number; locale?: AppLocale },
): string {
  const num = Number(amount);
  if (!Number.isFinite(num)) return `${amount} ${currencyCode}`;

  const decimals =
    options?.decimals ?? (Number.isInteger(num) && num >= 100 ? 0 : 2);

  const intlLocale = options?.locale ? toIntlLocale(options.locale) : "ru-RU";
  const formatted = Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);

  const symbol = getSymbolFromCurrency(currencyCode) || currencyCode;
  return `${formatted} ${symbol}`;
}
