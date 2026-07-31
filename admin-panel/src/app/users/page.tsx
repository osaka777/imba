"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { adminUsersAPI, User } from '@/shared/api/users'
import { formatBalances, formatMoney } from '@/shared/lib/format'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await adminUsersAPI.getAllUsers()
        setUsers(data || [])
      } catch (e) {
        console.error('Failed to fetch users:', e)
        setError('Не удалось загрузить список пользователей')
      } finally {
        setLoading(false)
      }
    }

    void fetchUsers()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) =>
      String(user.id).includes(q)
      || user.email?.toLowerCase().includes(q)
      || user.username?.toLowerCase().includes(q)
      || user.phone?.toLowerCase().includes(q)
      || user.defaultCurrencyCode?.toLowerCase().includes(q),
    )
  }, [users, query])

  const currencyTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const user of users) {
      for (const balance of user.balances || []) {
        map.set(balance.currency, (map.get(balance.currency) || 0) + Number(balance.amount || 0))
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [users])

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Пользователи"
          description="Балансы показываются в реальной валюте каждого пользователя"
        />

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="admin-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Всего</p>
            <p className="mt-2 text-2xl font-semibold">{users.length}</p>
          </div>
          {currencyTotals.slice(0, 3).map(([currency, amount]) => (
            <div key={currency} className="admin-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Баланс {currency}</p>
              <p className="mt-2 text-2xl font-semibold">{formatMoney(amount, currency)}</p>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: email, телефон, id, валюта…"
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="admin-card overflow-hidden">
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <div className="p-4 text-sm text-rose-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Пользователь</th>
                    <th>Балансы</th>
                    <th>Бонусы</th>
                    <th>Ставки</th>
                    <th>Винрейт</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id}>
                      <td className="font-mono text-xs">{user.id}</td>
                      <td>
                        <div className="font-medium">{user.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.username}
                          {user.phone ? ` · ${user.phone}` : ''}
                          {user.defaultCurrencyCode ? ` · ${user.defaultCurrencyCode}` : ''}
                        </div>
                      </td>
                      <td className="font-medium text-emerald-700">
                        {formatBalances(user.balances)}
                      </td>
                      <td>{formatBalances(user.bonusBalances)}</td>
                      <td>
                        <div className="text-sm">{user.totalBets}</div>
                        <div className="text-xs text-muted-foreground">
                          W {user.winningBets} / L {user.losingBets}
                        </div>
                      </td>
                      <td>{user.winRate.toFixed(1)}%</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => router.push(`/users/${user.id}`)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                        >
                          Открыть
                        </button>
                      </td>
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
