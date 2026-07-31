"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { apiCall } from '@/shared/utils/api'
import { formatMoney } from '@/shared/lib/format'
import { EmptyState } from '@/shared/ui/EmptyState'
import { KpiCard } from '@/shared/ui/KpiCard'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'
import { toast } from 'react-toastify'

interface Withdrawal {
  id: string
  userId: string
  userEmail: string
  amount: number
  currency: string
  currencyCode?: string
  method: string
  cardNumber: string
  cardType?: string
  reason?: string
  createdAt: string
  status: string
  isAffiliate?: boolean
  requiresReview?: boolean
}

const METHOD_NAMES: Record<string, string> = {
  CARD: 'Банковская карта',
  CRYPTO: 'Криптовалюта',
  affiliate: 'Партнёрский (USDT)',
}

const CARD_TYPE_NAMES: Record<string, string> = {
  FOREIGN: 'Зарубежная карта',
  KAZAKHSTAN: 'Карта Казахстана',
  RUSSIA: 'Карта России',
  TRC20: 'TRC-20',
  TRON: 'TRON',
}

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'rejected'

function statusBadgeClass(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-amber-50 text-amber-700'
    case 'processing':
      return 'bg-sky-50 text-sky-700'
    case 'completed':
      return 'bg-emerald-50 text-emerald-700'
    case 'rejected':
      return 'bg-rose-50 text-rose-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'pending':
      return 'Ожидает'
    case 'processing':
      return 'В обработке'
    case 'completed':
      return 'Выполнен'
    case 'rejected':
      return 'Отклонён'
    default:
      return status
  }
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')

  const loadWithdrawals = async () => {
    setLoading(true)
    try {
      const response = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/withdrawals/all`)
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      const list = (result.withdrawals || result.data || []).map((item: Withdrawal) => ({
        ...item,
        currency: item.currency || item.currencyCode || '',
        currencyCode: item.currencyCode || item.currency,
      }))
      setWithdrawals(list)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWithdrawals()
  }, [])

  const filtered = useMemo(() => {
    let rows = withdrawals
    if (activeFilter !== 'all') {
      rows = rows.filter((w) => w.status === activeFilter)
    }
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((w) =>
      w.id.includes(q)
      || w.userId.includes(q)
      || w.userEmail?.toLowerCase().includes(q)
      || w.cardNumber?.toLowerCase().includes(q)
      || w.method?.toLowerCase().includes(q)
      || (w.currencyCode || w.currency)?.toLowerCase().includes(q),
    )
  }, [withdrawals, activeFilter, query])

  const counts = useMemo(() => ({
    all: withdrawals.length,
    pending: withdrawals.filter((w) => w.status === 'pending').length,
    processing: withdrawals.filter((w) => w.status === 'processing').length,
    completed: withdrawals.filter((w) => w.status === 'completed').length,
    rejected: withdrawals.filter((w) => w.status === 'rejected').length,
  }), [withdrawals])

  const markProcessing = async (id: string) => {
    setBusyId(id)
    try {
      const response = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/${id}/processing`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error(await response.text())
      toast.success('Статус: в обработке')
      await loadWithdrawals()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setBusyId(null)
    }
  }

  const approveWithdrawal = async (id: string) => {
    setBusyId(id)
    try {
      const response = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/${id}/approve`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error(await response.text())
      toast.success('Вывод одобрен')
      await loadWithdrawals()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setBusyId(null)
    }
  }

  const rejectWithdrawal = async (id: string) => {
    const reason = prompt('Укажите причину отклонения:')
    if (!reason?.trim()) return

    setBusyId(id)
    try {
      const response = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!response.ok) throw new Error(await response.text())
      toast.success('Вывод отклонён')
      await loadWithdrawals()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setBusyId(null)
    }
  }

  const formatMethod = (item: Withdrawal) => {
    const methodName = METHOD_NAMES[item.method] || item.method
    const typeName = item.cardType ? CARD_TYPE_NAMES[item.cardType] : null
    return { methodName, typeName }
  }

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Выводы"
          description="Одобрение и отклонение заявок. Суммы в валюте пользователя."
          actions={
            <button
              type="button"
              onClick={() => void loadWithdrawals()}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
              Обновить
            </button>
          }
        />

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Всего" value={String(counts.all)} icon={ArrowDownCircle} accent="slate" />
          <KpiCard label="Ожидают" value={String(counts.pending)} icon={Clock} accent="amber" />
          <KpiCard label="В обработке" value={String(counts.processing)} icon={Loader2} accent="sky" />
          <KpiCard label="Выполнены" value={String(counts.completed)} icon={CheckCircle2} accent="emerald" />
          <KpiCard label="Отклонены" value={String(counts.rejected)} icon={XCircle} accent="rose" />
        </section>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            {([
              ['all', 'Все'],
              ['pending', 'Ожидают'],
              ['processing', 'В обработке'],
              ['completed', 'Выполнены'],
              ['rejected', 'Отклонены'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  activeFilter === key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                {key !== 'all' ? ` (${counts[key]})` : ''}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: email, id, карта, валюта…"
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 sm:max-w-sm"
          />
        </div>

        <div className="admin-card overflow-hidden">
          {loading ? (
            <LoadingBlock heightClass="h-48" />
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Заявок не найдено" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Пользователь</th>
                    <th>Сумма</th>
                    <th>Метод</th>
                    <th>Реквизиты</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const { methodName, typeName } = formatMethod(item)
                    const currency = item.currencyCode || item.currency
                    const isActionable = item.status === 'pending' || item.status === 'processing'

                    return (
                      <tr key={item.id}>
                        <td className="font-mono text-xs">{item.id}</td>
                        <td>
                          <Link href={`/users/${item.userId}`} className="font-medium text-primary hover:underline">
                            {item.userEmail}
                          </Link>
                          <div className="text-xs text-muted-foreground">#{item.userId}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.isAffiliate ? (
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                                affiliate
                              </span>
                            ) : null}
                            {item.requiresReview ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                первый вывод
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="whitespace-nowrap font-semibold">
                          {formatMoney(item.amount, currency)}
                        </td>
                        <td>
                          <div className="font-medium">{methodName}</div>
                          {typeName ? (
                            <div className="text-xs text-muted-foreground">{typeName}</div>
                          ) : null}
                        </td>
                        <td className="max-w-[200px]">
                          {item.cardNumber?.trim() ? (
                            <code className="block break-all rounded-lg border border-border bg-muted/30 px-2 py-1 text-xs">
                              {item.cardNumber}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {item.reason ? (
                            <div className="mt-1 text-xs text-rose-600">{item.reason}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap text-sm">
                          {new Date(item.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td>
                          {isActionable ? (
                            <div className="flex flex-wrap gap-2">
                              {item.status === 'pending' ? (
                                <button
                                  type="button"
                                  disabled={busyId === item.id}
                                  onClick={() => void markProcessing(item.id)}
                                  className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                >
                                  В работу
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={() => void approveWithdrawal(item.id)}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              >
                                OK
                              </button>
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={() => void rejectWithdrawal(item.id)}
                                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                              >
                                Отклонить
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageShell>
    </AuthGuard>
  )
}
