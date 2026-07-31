"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { apiCall } from '@/shared/utils/api'
import { formatMoney } from '@/shared/lib/format'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'
import { toast } from 'react-toastify'

type DepositRow = {
  id: number
  userId: number
  email?: string
  amount: number
  currency: string
  method: string
  imageUrl?: string
  createdAt: string
  status: string
}

type WithdrawalRow = {
  id: string
  userId: string
  userEmail: string
  amount: number
  currencyCode?: string
  currency?: string
  method: string
  cardNumber?: string
  createdAt: string
  status: string
  requiresReview?: boolean
}

export default function InboxPage() {
  const [deposits, setDeposits] = useState<DepositRow[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [depRes, wdRes] = await Promise.all([
        apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/deposits?status=pending`),
        apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/withdrawals/all?status=PENDING`),
      ])

      if (depRes.ok) {
        setDeposits(await depRes.json())
      }

      if (wdRes.ok) {
        const data = await wdRes.json()
        const list: WithdrawalRow[] = data.withdrawals || data || []
        setWithdrawals(
          list.filter((item) => ['pending', 'processing'].includes(String(item.status).toLowerCase())),
        )
      }
    } catch (e: any) {
      toast.error(e.message || 'Ошибка загрузки inbox')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 30_000)
    return () => clearInterval(id)
  }, [])

  const approveDeposit = async (id: number) => {
    const res = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/deposits/${id}/approve`, {
      method: 'POST',
    })
    if (!res.ok) {
      toast.error(await res.text())
      return
    }
    toast.success('Депозит подтверждён')
    await load()
  }

  const rejectDeposit = async (id: number) => {
    const res = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/deposits/${id}/reject`, {
      method: 'POST',
    })
    if (!res.ok) {
      toast.error(await res.text())
      return
    }
    toast.success('Депозит отклонён')
    await load()
  }

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Inbox"
          description="Срочные заявки: депозиты и выводы. Суммы в валюте пользователя."
          actions={
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Обновить
            </button>
          }
        />

        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="admin-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-semibold">Депозиты</h2>
                  <p className="text-sm text-muted-foreground">{deposits.length} в очереди</p>
                </div>
                <Link href="/deposits" className="text-sm text-primary hover:underline">
                  Все →
                </Link>
              </div>
              {deposits.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Очередь пуста" />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {deposits.slice(0, 12).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <Link href={`/users/${item.userId}`} className="truncate font-medium text-primary hover:underline">
                          {item.email || `#${item.userId}`}
                        </Link>
                        <div className="text-sm font-semibold">
                          {formatMoney(item.amount, item.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.method} · {new Date(item.createdAt).toLocaleString('ru-RU')}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void approveDeposit(item.id)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white"
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => void rejectDeposit(item.id)}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
                        >
                          Нет
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-semibold">Выводы</h2>
                  <p className="text-sm text-muted-foreground">{withdrawals.length} в очереди</p>
                </div>
                <Link href="/withdrawals" className="text-sm text-primary hover:underline">
                  Все →
                </Link>
              </div>
              {withdrawals.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="Очередь пуста" />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {withdrawals.slice(0, 12).map((item) => (
                    <div key={item.id} className="px-5 py-3">
                      <Link href={`/users/${item.userId}`} className="font-medium text-primary hover:underline">
                        {item.userEmail}
                      </Link>
                      <div className="text-sm font-semibold">
                        {formatMoney(item.amount, item.currencyCode || item.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.method}
                        {item.cardNumber ? ` · ${item.cardNumber}` : ''}
                        {item.requiresReview ? ' · review' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </PageShell>
    </AuthGuard>
  )
}
