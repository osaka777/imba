"use client"

import { StatisticsData } from '@/shared/api/statistics'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { EmptyState } from '@/shared/ui/EmptyState'

interface PartnersTableProps {
  statistics: StatisticsData | null
  currency?: string | null
}

export function PartnersTable({ statistics, currency }: PartnersTableProps) {
  const partnersData = statistics?.partnersData || []
  const moneyCurrency = currency || statistics?.primaryCurrency || null

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { className: 'bg-emerald-50 text-emerald-700', label: 'Активен' },
      inactive: { className: 'bg-amber-50 text-amber-700', label: 'Неактивен' },
      blocked: { className: 'bg-rose-50 text-rose-700', label: 'Заблокирован' },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive

    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  if (partnersData.length === 0) {
    return <EmptyState title="Нет партнёров" description="Данные по партнёрам появятся после первых начислений." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Партнёр</th>
            <th>Заработано</th>
            <th>Клиенты</th>
            <th>Выигрыши</th>
            <th>Проигрыши</th>
            <th>Игры</th>
            <th>Конверсия</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {partnersData.map((partner) => (
            <tr key={partner.id}>
              <td>
                <div className="font-medium text-foreground">{partner.name}</div>
                <div className="text-xs text-muted-foreground">{partner.email}</div>
              </td>
              <td className="font-medium">{formatMoney(partner.totalEarned, moneyCurrency)}</td>
              <td>{formatNumber(partner.clientsCount)}</td>
              <td className="text-emerald-600">{formatMoney(partner.clientsWins, moneyCurrency)}</td>
              <td className="text-rose-600">{formatMoney(partner.clientsLosses, moneyCurrency)}</td>
              <td>{formatNumber(partner.totalGames)}</td>
              <td>{partner.conversionRate.toFixed(1)}%</td>
              <td>{getStatusBadge(partner.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
