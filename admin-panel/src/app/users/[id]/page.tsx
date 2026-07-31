"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Coins,
  Gift,
  Mail,
  Phone,
  Target,
  TrendingDown,
  TrendingUp,
  User as UserIcon,
  Wallet,
} from 'lucide-react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { adminUsersAPI, UserDetails } from '@/shared/api/users'
import { formatMoney } from '@/shared/lib/format'
import { EmptyState } from '@/shared/ui/EmptyState'
import { KpiCard } from '@/shared/ui/KpiCard'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'

function statusBadgeClass(status: string) {
  const value = status.toLowerCase()
  if (['win', 'success', 'approved', 'completed'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700'
  }
  if (['lose', 'failed', 'rejected', 'cancelled'].includes(value)) {
    return 'bg-rose-50 text-rose-700'
  }
  if (['pending', 'processing'].includes(value)) {
    return 'bg-amber-50 text-amber-700'
  }
  return 'bg-slate-100 text-slate-600'
}

export default function UserDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [user, setUser] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    const fetchUserDetails = async () => {
      try {
        const data = await adminUsersAPI.getUserDetails(userId)
        setUser(data)
      } catch (e) {
        console.error('Failed to fetch user details:', e)
        setError('Не удалось загрузить информацию о пользователе')
      } finally {
        setLoading(false)
      }
    }

    void fetchUserDetails()
  }, [userId])

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('ru-RU')

  const money = (amount: number, currency?: string | null) =>
    formatMoney(amount, currency || user?.defaultCurrencyCode)

  if (loading) {
    return (
      <AuthGuard>
        <PageShell>
          <LoadingBlock label="Загрузка профиля пользователя…" />
        </PageShell>
      </AuthGuard>
    )
  }

  if (error || !user) {
    return (
      <AuthGuard>
        <PageShell>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error || 'Пользователь не найден'}
          </div>
          <button
            type="button"
            onClick={() => router.push('/users')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            К списку пользователей
          </button>
        </PageShell>
      </AuthGuard>
    )
  }

  const primaryCurrency = user.defaultCurrencyCode || user.balances?.[0]?.currency || null

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title={`Пользователь #${user.id}`}
          description={user.email}
          actions={
            <button
              type="button"
              onClick={() => router.push('/users')}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </button>
          }
        />

        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="admin-card p-5 xl:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Профиль</h2>
                  <p className="text-sm text-muted-foreground">{user.username}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </p>
                  <p className="font-medium text-foreground">{user.email}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    Телефон
                  </p>
                  <p className="font-medium text-foreground">{user.phone || '—'}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Регистрация
                  </p>
                  <p className="font-medium text-foreground">{formatDate(user.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Активность
                  </p>
                  <p className="font-medium text-foreground">{formatDate(user.updatedAt)}</p>
                </div>
              </div>
            </div>

            <div className="admin-card p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Балансы</h2>
                  <p className="text-sm text-muted-foreground">
                    {primaryCurrency ? `Основная валюта: ${primaryCurrency}` : 'По валютам'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Основной
                  </p>
                  <div className="space-y-2">
                    {user.balances?.length ? (
                      user.balances.map((balance) => (
                        <div
                          key={balance.id}
                          className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                        >
                          <span className="text-sm text-muted-foreground">{balance.currency}</span>
                          <span className="font-semibold text-emerald-700">
                            {money(balance.amount, balance.currency)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Нет балансов</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Бонусный
                  </p>
                  <div className="space-y-2">
                    {user.bonusBalances?.length ? (
                      user.bonusBalances.map((balance) => (
                        <div
                          key={balance.id}
                          className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                        >
                          <span className="text-sm text-muted-foreground">{balance.currency}</span>
                          <span className="font-semibold text-violet-700">
                            {money(balance.amount, balance.currency)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Нет бонусных балансов</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Всего ставок"
              value={String(user.statistics.totalBets)}
              icon={Target}
              accent="sky"
            />
            <KpiCard
              label="Винрейт"
              value={`${user.statistics.winRate.toFixed(1)}%`}
              hint={`W ${user.statistics.winningBets} / L ${user.statistics.losingBets}`}
              icon={TrendingUp}
              accent="emerald"
            />
            <KpiCard
              label="Сумма ставок"
              value={money(user.statistics.totalBetAmount, primaryCurrency)}
              icon={Coins}
              accent="violet"
            />
            <KpiCard
              label="Результат"
              value={money(user.statistics.profit, primaryCurrency)}
              hint={user.statistics.profit >= 0 ? 'В плюсе' : 'В минусе'}
              trend={user.statistics.profit >= 0 ? '↑' : '↓'}
              trendUp={user.statistics.profit >= 0}
              icon={user.statistics.profit >= 0 ? TrendingUp : TrendingDown}
              accent={user.statistics.profit >= 0 ? 'emerald' : 'rose'}
            />
          </section>

          <section className="admin-card overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">Ставки</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Последние {user.bets?.length || 0} ставок
              </p>
            </div>
            {user.bets?.length ? (
              <div className="overflow-x-auto p-2 md:p-4">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Сумма</th>
                      <th>Кэф</th>
                      <th>Статус</th>
                      <th>Тип</th>
                      <th>Матч</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.bets.map((bet) => (
                      <tr key={bet.id}>
                        <td className="font-mono text-xs">{bet.id}</td>
                        <td className="font-semibold">{money(bet.amount, bet.currency)}</td>
                        <td>{bet.cf}</td>
                        <td>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(bet.status)}`}>
                            {bet.status}
                          </span>
                        </td>
                        <td>{bet.betType}</td>
                        <td>
                          {bet.game ? (
                            <div>
                              <div className="font-medium">{bet.game.eventName}</div>
                              <div className="text-xs text-muted-foreground">
                                {bet.game.team1} vs {bet.game.team2}
                              </div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="whitespace-nowrap text-sm">{formatDate(bet.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title="Ставок пока нет" />
              </div>
            )}
          </section>

          <section className="admin-card overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">Финансовые операции</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Депозиты, выводы и начисления
              </p>
            </div>
            {user.operations?.length ? (
              <div className="overflow-x-auto p-2 md:p-4">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Тип</th>
                      <th>Сумма</th>
                      <th>Валюта</th>
                      <th>Источник</th>
                      <th>Статус</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.operations.map((operation) => (
                      <tr key={operation.id}>
                        <td className="font-mono text-xs">{operation.id}</td>
                        <td>{operation.type}</td>
                        <td className={operation.amount >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                          {operation.amount >= 0 ? '+' : ''}
                          {money(operation.amount, operation.currency)}
                        </td>
                        <td>{operation.currency}</td>
                        <td className="text-sm text-muted-foreground">{operation.source}</td>
                        <td>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(operation.status)}`}>
                            {operation.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-sm">{formatDate(operation.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title="Операций пока нет" />
              </div>
            )}
          </section>

          {user.bonuses?.length ? (
            <section className="admin-card p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-200">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Бонусы и промо</h2>
                  <p className="text-sm text-muted-foreground">{user.bonuses.length} активных записей</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {user.bonuses.map((bonus) => (
                  <div key={`${bonus.promoId}-${bonus.promoCode}`} className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground">{bonus.promoCode}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(bonus.status)}`}>
                        {bonus.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Тип: {bonus.type}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      До: {bonus.validUntil ? formatDate(bonus.validUntil) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </PageShell>
    </AuthGuard>
  )
}
