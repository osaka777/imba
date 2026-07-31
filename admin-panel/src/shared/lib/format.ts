const SYMBOLS: Record<string, string> = {
  KZT: '₸',
  RUB: '₽',
  USD: '$',
  EUR: '€',
  USDT: 'USDT',
  UZS: "so'm",
  UAH: '₴',
  TRY: '₺',
  AZN: '₼',
  GBP: '£',
}

const INTL_SAFE = new Set(['KZT', 'RUB', 'USD', 'EUR', 'UAH', 'TRY', 'GBP', 'AZN', 'UZS'])

export function normalizeCurrency(currency?: string | null): string {
  const code = (currency || '').trim().toUpperCase()
  if (!code) return ''
  if (code === 'USDT_TRC20' || code === 'USDT-TRC20' || code === 'TRC20') return 'USDT'
  return code
}

export function formatMoney(value: number, currency?: string | null): string {
  const amount = Number(value) || 0
  const code = normalizeCurrency(currency)

  if (!code) {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  if (INTL_SAFE.has(code)) {
    try {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 0,
        maximumFractionDigits: code === 'USD' || code === 'EUR' ? 2 : 0,
      }).format(amount)
    } catch {
      // fall through
    }
  }

  const symbol = SYMBOLS[code] || code
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

  if (symbol === code) return `${formatted} ${code}`
  if (code === 'USD' || code === 'EUR' || code === 'GBP') return `${symbol}${formatted}`
  return `${formatted} ${symbol}`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value)
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

export function formatBalances(
  balances: Array<{ amount: number; currency: string }> | undefined | null,
): string {
  if (!balances || balances.length === 0) return '—'
  const positive = balances.filter((b) => Number(b.amount) !== 0)
  const list = positive.length > 0 ? positive : balances.slice(0, 1)
  return list.map((b) => formatMoney(b.amount, b.currency)).join(' · ')
}
