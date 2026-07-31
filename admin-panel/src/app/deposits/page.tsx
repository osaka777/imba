"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { apiCall } from '@/shared/utils/api'
import { formatMoney } from '@/shared/lib/format'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'
import { toast } from 'react-toastify'

interface AdminDeposit {
  id: number
  userId: number
  email?: string
  amount: number
  currency: string
  method: string
  imageUrl?: string
  createdAt: string
  status: 'pending' | 'processing' | 'approved' | 'rejected'
}

type StatusFilter = 'pending' | 'approved' | 'rejected'

export default function AdminDepositsPage() {
  const [items, setItems] = useState<AdminDeposit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<StatusFilter>('pending')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = async () => {
    setIsLoading(true)
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/deposits?status=${status}`
      const res = await apiCall(url)
      if (!res.ok) throw new Error(await res.text())
      const data: AdminDeposit[] = await res.json()
      setItems(data || [])
    } catch (e: any) {
      toast.error(e.message || 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      String(item.id).includes(q)
      || String(item.userId).includes(q)
      || item.email?.toLowerCase().includes(q)
      || item.currency?.toLowerCase().includes(q)
      || item.method?.toLowerCase().includes(q),
    )
  }, [items, query])

  const approve = async (id: number) => {
    setBusyId(id)
    try {
      const res = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/deposits/${id}/approve`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Депозит подтверждён')
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Ошибка подтверждения')
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (id: number) => {
    setBusyId(id)
    try {
      const res = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/deposits/${id}/reject`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Депозит отклонён')
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Ошибка отклонения')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Заявки пополнений"
          description="Подтверждение депозитов в валюте пользователя"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-border bg-card p-1">
                {([
                  ['pending', 'Ожидают'],
                  ['approved', 'Подтверждённые'],
                  ['rejected', 'Отклонённые'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      status === key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                Обновить
              </button>
            </div>
          }
        />

        <div className="mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: email, id, валюта, метод…"
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="admin-card overflow-hidden">
          {isLoading ? (
            <LoadingBlock heightClass="h-48" />
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Нет заявок" />
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
                    <th>Дата</th>
                    <th>Чек</th>
                    {status === 'pending' ? <th>Действия</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{row.id}</td>
                      <td>
                        <Link href={`/users/${row.userId}`} className="font-medium text-primary hover:underline">
                          {row.email || `User #${row.userId}`}
                        </Link>
                        <div className="text-xs text-muted-foreground">#{row.userId}</div>
                      </td>
                      <td className="whitespace-nowrap font-semibold">
                        {formatMoney(row.amount, row.currency)}
                      </td>
                      <td>
                        <div>{row.method}</div>
                        {row.status === 'processing' ? (
                          <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                            Чек загружен
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap text-sm">
                        {new Date(row.createdAt).toLocaleString('ru-RU')}
                      </td>
                      <td>
                        {row.imageUrl ? (
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL || ''}${row.imageUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            Открыть
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      {status === 'pending' ? (
                        <td>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void approve(row.id)}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                            >
                              Подтвердить
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void reject(row.id)}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                            >
                              Отклонить
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageShell>
    </AuthGuard>
  )
}
