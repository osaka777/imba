import getSymbolFromCurrency from "currency-symbol-map";

export function formatCouponMoney(
  amount: number | string,
  currencyCode: string,
  options?: { decimals?: number },
): string {
  const num = Number(amount);
  if (!Number.isFinite(num)) return `${amount} ${currencyCode}`;

  const decimals =
    options?.decimals ?? (Number.isInteger(num) && num >= 100 ? 0 : 2);

  const formatted = Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);

  const symbol = getSymbolFromCurrency(currencyCode) || currencyCode;
  return `${formatted} ${symbol}`;
}
