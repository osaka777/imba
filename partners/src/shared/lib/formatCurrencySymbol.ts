export function formatCurrencySymbol(currencyCode: string): string {
  switch (currencyCode.toUpperCase()) {
    case "USD":
      return "$";
    case "KZT":
      return "₸";
    case "RUB":
      return "₽";
    case "UAH":
      return "₴";
    case "EUR":
      return "€";
    default:
      return currencyCode;
  }
}

export function formatMoney(amount: number, currencyCode: string): string {
  const symbol = formatCurrencySymbol(currencyCode);
  if (symbol === "$") {
    return `$${amount.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${amount.toLocaleString("ru-RU")} ${symbol}`;
}
