import { StatisticsData } from '@/shared/api/statistics'
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'

export type CrmKpiSnapshot = {
  currency: string | null
  deposits: number
  withdrawals: number
  netRevenue: number
  ggr: number
  totalBets: number
  arpu: number
  newUsers: number
  activeUsers: number
  conversionRate: number
}

export function buildCrmKpiSnapshot(
  data: StatisticsData | null,
  currency?: string | null,
): CrmKpiSnapshot {
  if (!data) {
    return {
      currency: null,
      deposits: 0,
      withdrawals: 0,
      netRevenue: 0,
      ggr: 0,
      totalBets: 0,
      arpu: 0,
      newUsers: 0,
      activeUsers: 0,
      conversionRate: 0,
    }
  }

  const selected =
    currency
    || data.primaryCurrency
    || data.byCurrency?.[0]?.currency
    || null

  const finance = data.byCurrency?.find((row) => row.currency === selected)
  const games = data.gamesByCurrency?.find((row) => row.currency === selected)

  const deposits = finance?.deposits ?? data.totalDeposits
  const withdrawals = finance?.withdrawals ?? data.totalWithdrawals
  const ggr = games?.ggr ?? Math.max(0, data.totalLosses - data.totalWins)
  const activeUsers = data.activeUsers || 0
  const newUsers = data.newUsers || 0
  const totalUsers = data.totalUsers || 0

  return {
    currency: selected,
    deposits,
    withdrawals,
    netRevenue: finance?.revenue ?? data.totalRevenue,
    ggr,
    totalBets: games?.games ?? data.totalGames,
    arpu: activeUsers > 0 ? deposits / activeUsers : 0,
    newUsers,
    activeUsers,
    conversionRate: totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0,
  }
}

export function formatCrmKpi(snapshot: CrmKpiSnapshot) {
  const c = snapshot.currency
  return {
    currency: c || '—',
    deposits: formatMoney(snapshot.deposits, c),
    withdrawals: formatMoney(snapshot.withdrawals, c),
    netRevenue: formatMoney(snapshot.netRevenue, c),
    ggr: formatMoney(snapshot.ggr, c),
    totalBets: formatNumber(snapshot.totalBets),
    arpu: formatMoney(snapshot.arpu, c),
    newUsers: formatNumber(snapshot.newUsers),
    activeUsers: formatNumber(snapshot.activeUsers),
    conversionRate: formatPercent(snapshot.conversionRate),
  }
}
