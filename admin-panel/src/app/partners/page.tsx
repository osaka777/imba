"use client"

import { useCallback, useEffect, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { Table } from '@/widgets/Table'
import { adminPartnersAPI, PartnerStatsItem } from '@/shared/api/partners'
import {
  adminAffiliatePartnersAPI,
  AffiliatePartnerItem,
} from '@/shared/api/affiliatePartners'

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerStatsItem[]>([])
  const [affiliatePartners, setAffiliatePartners] = useState<AffiliatePartnerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [editingPercentId, setEditingPercentId] = useState<number | null>(null)
  const [percentDraft, setPercentDraft] = useState('')
  const [editingCpaId, setEditingCpaId] = useState<number | null>(null)
  const [cpaAmountDraft, setCpaAmountDraft] = useState('')
  const [cpaCurrencyDraft, setCpaCurrencyDraft] = useState('KZT')

  const fetchData = useCallback(async () => {
    try {
      const [stats, affiliates] = await Promise.all([
        adminPartnersAPI.getPartnersStatistics('month'),
        adminAffiliatePartnersAPI.getPartners(300),
      ])
      setPartners(stats || [])
      setAffiliatePartners(affiliates || [])
    } catch (e: unknown) {
      console.error('Failed to fetch partners:', e)
      setError('Не удалось загрузить список партнеров')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateStatus = async (
    userId: number,
    status: AffiliatePartnerItem['status'],
  ) => {
    setUpdatingId(userId)
    try {
      await adminAffiliatePartnersAPI.updateStatus(userId, status)
      await fetchData()
    } catch (e) {
      console.error('Failed to update partner status:', e)
    } finally {
      setUpdatingId(null)
    }
  }

  const savePercent = async (userId: number) => {
    const percent = parseFloat(percentDraft)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      alert('Введите процент от 0 до 100')
      return
    }
    setUpdatingId(userId)
    try {
      await adminAffiliatePartnersAPI.updatePercent(userId, percent)
      setEditingPercentId(null)
      await fetchData()
    } catch (e) {
      console.error('Failed to update partner percent:', e)
    } finally {
      setUpdatingId(null)
    }
  }

  const saveCpa = async (userId: number) => {
    const amount = parseFloat(cpaAmountDraft)
    if (!Number.isFinite(amount) || amount < 0) {
      alert('Введите корректную сумму CPA')
      return
    }
    setUpdatingId(userId)
    try {
      await adminAffiliatePartnersAPI.updateCpa(userId, amount, cpaCurrencyDraft)
      setEditingCpaId(null)
      await fetchData()
    } catch (e) {
      console.error('Failed to update CPA:', e)
    } finally {
      setUpdatingId(null)
    }
  }

  const statsColumns = [
    { header: 'Имя', accessor: 'name' as const },
    { header: 'Email', accessor: 'email' as const },
    { header: 'Клиенты', accessor: 'clientsCount' as const },
    {
      header: 'Доход',
      accessor: 'totalEarned' as const,
      render: (item: PartnerStatsItem) =>
        new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: 'RUB',
          minimumFractionDigits: 0,
        }).format(item.totalEarned),
    },
    { header: 'Игры', accessor: 'totalGames' as const },
    { header: 'Победы', accessor: 'clientsWins' as const },
    { header: 'Поражения', accessor: 'clientsLosses' as const },
    {
      header: 'Конверсия',
      accessor: 'conversionRate' as const,
      render: (item: PartnerStatsItem) => `${item.conversionRate.toFixed(1)}%`,
    },
  ]

  const affiliateColumns = [
    { header: 'Email', accessor: 'email' as const },
    { header: 'UID', accessor: 'uid' as const },
    { header: 'Статус', accessor: 'status' as const },
    { header: 'Тип', accessor: 'type' as const },
    {
      header: 'CPA',
      accessor: 'cpaPayoutAmount' as const,
      render: (item: AffiliatePartnerItem) =>
        editingCpaId === item.userId ? (
          <div className="flex gap-1 items-center flex-wrap">
            <input
              type="number"
              className="w-20 px-1 py-0.5 border rounded text-sm"
              value={cpaAmountDraft}
              onChange={(e) => setCpaAmountDraft(e.target.value)}
            />
            <select
              className="text-sm border rounded"
              value={cpaCurrencyDraft}
              onChange={(e) => setCpaCurrencyDraft(e.target.value)}
            >
              <option value="KZT">KZT</option>
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
            </select>
            <button
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
              disabled={updatingId === item.userId}
              onClick={() => saveCpa(item.userId)}
            >
              OK
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-blue-600 underline text-sm"
            onClick={() => {
              setEditingCpaId(item.userId)
              setCpaAmountDraft(String(item.cpaPayoutAmount ?? ''))
              setCpaCurrencyDraft(item.cpaCurrencyCode ?? 'KZT')
            }}
          >
            {item.type === 'CPA'
              ? `${item.cpaPayoutAmount ?? '—'} ${item.cpaCurrencyCode ?? ''}`
              : '—'}
          </button>
        ),
    },
    {
      header: 'RevShare %',
      accessor: 'percent' as const,
      render: (item: AffiliatePartnerItem) =>
        editingPercentId === item.userId ? (
          <div className="flex gap-1 items-center">
            <input
              type="number"
              className="w-16 px-1 py-0.5 border rounded text-sm"
              value={percentDraft}
              min={0}
              max={100}
              onChange={(e) => setPercentDraft(e.target.value)}
            />
            <button
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
              disabled={updatingId === item.userId}
              onClick={() => savePercent(item.userId)}
            >
              OK
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-blue-600 underline text-sm"
            onClick={() => {
              setEditingPercentId(item.userId)
              setPercentDraft(item.percent)
            }}
          >
            {item.percent}%
          </button>
        ),
    },
    { header: 'Рефералы', accessor: 'referralsCount' as const },
    {
      header: 'Заработано',
      accessor: 'totalEarned' as const,
      render: (item: AffiliatePartnerItem) =>
        new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
          item.totalEarned,
        ),
    },
    { header: 'Telegram', accessor: 'telegram' as const, render: (item: AffiliatePartnerItem) => item.telegram || '—' },
    {
      header: 'Действия',
      accessor: 'userId' as const,
      render: (item: AffiliatePartnerItem) => (
        <div className="flex gap-2 flex-wrap">
          {item.status !== 'ACTIVE' && (
            <button
              disabled={updatingId === item.userId}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded"
              onClick={() => updateStatus(item.userId, 'ACTIVE')}
            >
              Активировать
            </button>
          )}
          {item.status !== 'BLOCKED' && (
            <button
              disabled={updatingId === item.userId}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded"
              onClick={() => updateStatus(item.userId, 'BLOCKED')}
            >
              Блок
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-10">
          <div>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Партнёры — модерация</h1>
              <p className="text-gray-600">
                Новые партнёры в статусе PENDING не могут выводить средства до активации
              </p>
            </div>

            {loading && <div className="text-gray-500">Загрузка...</div>}
            {error && <div className="text-red-600 mb-4">{error}</div>}

            {!loading && (
              <Table<AffiliatePartnerItem> data={affiliatePartners} columns={affiliateColumns} />
            )}
          </div>

          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Статистика партнёров</h2>
            </div>
            {!loading && (
              <Table<PartnerStatsItem> data={partners} columns={statsColumns} />
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
