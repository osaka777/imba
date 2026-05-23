"use client"

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { Table } from '@/widgets/Table'
import { adminPartnersAPI, PartnerStatsItem } from '@/shared/api/partners'

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerStatsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const data = await adminPartnersAPI.getPartnersStatistics('month')
        setPartners(data || [])
      } catch (e: any) {
        console.error('Failed to fetch partners statistics:', e)
        setError('Не удалось загрузить список партнеров')
      } finally {
        setLoading(false)
      }
    }
    fetchPartners()
  }, [])

  const columns = [
    { header: 'Имя', accessor: 'name' as const },
    { header: 'Email', accessor: 'email' as const },
    { header: 'Клиенты', accessor: 'clientsCount' as const },
    { header: 'Доход', accessor: 'totalEarned' as const, render: (item: PartnerStatsItem) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(item.totalEarned) },
    { header: 'Игры', accessor: 'totalGames' as const },
    { header: 'Победы', accessor: 'clientsWins' as const },
    { header: 'Поражения', accessor: 'clientsLosses' as const },
    { header: 'Конверсия', accessor: 'conversionRate' as const, render: (item: PartnerStatsItem) => `${item.conversionRate.toFixed(1)}%` },
  ]

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Партнеры</h1>
            <p className="text-gray-600">Список партнеров и их статистика</p>
          </div>

          {loading && <div className="text-gray-500">Загрузка...</div>}
          {error && <div className="text-red-600 mb-4">{error}</div>}

          {!loading && (
            <Table<PartnerStatsItem> data={partners} columns={columns} />
          )}
        </div>
      </div>
    </AuthGuard>
  )
}