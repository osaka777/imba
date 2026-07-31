/** Per-currency stake floors for WC sportsbook. */
export function wcOddsMinStakeForCurrency(
  currencyCode: string,
  fallback = 100,
): number {
  const c = (currencyCode || '').toUpperCase();
  if (c === 'USD' || c === 'USDT') return 1;
  if (c === 'RUB') return 50;
  if (c === 'KZT') return 100;
  return fallback;
}

export function wcOddsMaxStakeForCurrency(
  currencyCode: string,
  fallback = 1_000_000,
): number {
  const c = (currencyCode || '').toUpperCase();
  if (c === 'USD' || c === 'USDT') return 10_000;
  if (c === 'RUB') return 150_000;
  if (c === 'KZT') return 1_000_000;
  return fallback;
}
