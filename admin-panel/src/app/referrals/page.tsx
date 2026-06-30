"use client"

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { Table } from '@/widgets/Table'
import { adminReferralsAPI, ReferralOverviewItem } from '@/shared/api/referrals'

export default function ReferralsPage() {
  const [items, setItems] = useState<ReferralOverviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const data = await adminReferralsAPI.getReferralsOverview(300)
        setItems(data || [])
      } catch (e: any) {
        console.error('Failed to fetch referrals:', e)
        setError('Не удалось загрузить рефералов')
      } finally {
        setLoading(false)
      }
    }
    fetchReferrals()
  }, [])

  const columns = [
    { header: 'Игрок', accessor: 'playerEmail' as const },
    { header: 'Партнёр', accessor: 'partnerEmail' as const },
    {
      header: 'Регистрация',
      accessor: 'playerRegisteredAt' as const,
      render: (item: ReferralOverviewItem) =>
        new Date(item.playerRegisteredAt).toLocaleDateString('ru-RU'),
    },
    { header: 'IP', accessor: 'registrationIp' as const, render: (item: ReferralOverviewItem) => item.registrationIp || '—' },
    {
      header: 'Депозиты',
      accessor: 'totalDeposits' as const,
      render: (item: ReferralOverviewItem) =>
        new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(item.totalDeposits),
    },
    { header: 'Ставки', accessor: 'totalBets' as const },
    { header: 'Проигрыши', accessor: 'totalLosses' as const },
    {
      header: 'Комиссия партнёру',
      accessor: 'affiliateEarnedFromPlayer' as const,
      render: (item: ReferralOverviewItem) =>
        new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(item.affiliateEarnedFromPlayer),
    },
  ]

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Рефералы</h1>
            <p className="text-gray-600">Игроки, привязанные к партнёрам через ?tag=</p>
          </div>

          {loading && <div className="text-gray-500">Загрузка...</div>}
          {error && <div className="text-red-600 mb-4">{error}</div>}

          {!loading && (
            <Table<ReferralOverviewItem> data={items} columns={columns} />
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
