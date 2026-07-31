'use client'

import { StatisticsData } from '@/shared/api/statistics'
import { formatMoney } from '@/shared/lib/format'
import { EmptyState } from '@/shared/ui/EmptyState'

type CurrencyBreakdownTableProps = {
  statistics: StatisticsData | null
}

export function CurrencyBreakdownTable({ statistics }: CurrencyBreakdownTableProps) {
  const rows = statistics?.byCurrency || []
  const games = statistics?.gamesByCurrency || []

  if (rows.length === 0) {
    return <EmptyState title="Нет валют" description="За период нет финансовых операций." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Валюта</th>
            <th>Депозиты</th>
            <th>Выводы</th>
            <th>Net</th>
            <th>Бонусы</th>
            <th>GGR</th>
            <th>Ставки</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const game = games.find((g) => g.currency === row.currency)
            return (
              <tr key={row.currency}>
                <td className="font-semibold">{row.currency}</td>
                <td className="text-emerald-600">{formatMoney(row.deposits, row.currency)}</td>
                <td className="text-rose-600">{formatMoney(row.withdrawals, row.currency)}</td>
                <td className="font-medium">{formatMoney(row.revenue, row.currency)}</td>
                <td>{formatMoney(row.bonuses, row.currency)}</td>
                <td>{formatMoney(game?.ggr || 0, row.currency)}</td>
                <td>{game?.games || 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
