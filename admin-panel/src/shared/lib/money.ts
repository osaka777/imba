export function formatDate(date: Date | string): string {
  if (!date) return '—'
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (isNaN(dateObj.getTime())) return '—'
  return dateObj.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export { formatMoney as formatCurrency, formatMoney, formatBalances, normalizeCurrency } from './format'
export { cn } from './utils'
