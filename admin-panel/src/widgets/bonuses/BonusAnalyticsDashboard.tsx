"use client"

import { useEffect, useState } from 'react'
import {
  bonusAPI,
  ExpiringBonusRow,
  WelcomeBonusAnalytics,
} from '@/shared/api/bonuses'

type Period = 'day' | 'week' | 'month'

interface BonusAnalyticsDashboardProps {
  period?: Period
  showExpiringTable?: boolean
}

export function BonusAnalyticsDashboard({
  period = 'week',
  showExpiringTable = true,
}: BonusAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<WelcomeBonusAnalytics | null>(null)
  const [expiring, setExpiring] = useState<ExpiringBonusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [stats, expiringRows] = await Promise.all([
          bonusAPI.getWelcomeBonusAnalytics(period),
          showExpiringTable ? bonusAPI.getExpiringBonuses(24) : Promise.resolve([]),
        ])
        if (!cancelled) {
          setAnalytics(stats)
          setExpiring(expiringRows)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [period, showExpiringTable])

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
        {error ?? 'Не удалось загрузить аналитику welcome-бонусов'}
      </div>
    )
  }

  const cards = [
    {
      title: 'Welcome за период',
      value: analytics.offersInPeriod,
      hint: 'Новых офферов',
      tone: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Активировали депозитом',
      value: analytics.activatedInPeriod,
      hint: `${analytics.depositConversionPct}% конверсия`,
      tone: 'from-emerald-500 to-emerald-600',
    },
    {
      title: 'Ждут депозит',
      value: analytics.lockedNow,
      hint: 'Сейчас заблокированы',
      tone: 'from-amber-500 to-orange-500',
    },
    {
      title: 'Отыгрывают',
      value: analytics.wageringActive,
      hint: `${analytics.wageringCompleted} завершили`,
      tone: 'from-violet-500 to-purple-600',
    },
    {
      title: 'Сгорят за 24 ч',
      value: analytics.expiringSoon,
      hint: 'Нужен контроль',
      tone: 'from-rose-500 to-red-500',
    },
    {
      title: 'Telegram-напоминания',
      value: analytics.telegramWarnings,
      hint: 'За период',
      tone: 'from-sky-500 to-cyan-600',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm p-5"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.tone}`} />
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-900 text-white p-5">
          <p className="text-sm text-slate-300">Конверсия регистрация → welcome</p>
          <p className="mt-2 text-3xl font-bold">{analytics.registrationToWelcomePct}%</p>
        </div>
        <div className="rounded-2xl bg-slate-900 text-white p-5">
          <p className="text-sm text-slate-300">Просрочено без депозита</p>
          <p className="mt-2 text-3xl font-bold">{analytics.expiredLocked}</p>
        </div>
        <div className="rounded-2xl bg-slate-900 text-white p-5">
          <p className="text-sm text-slate-300">Новых пользователей</p>
          <p className="mt-2 text-3xl font-bold">{analytics.newUsersInPeriod}</p>
        </div>
      </div>

      {analytics.funnel?.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">Воронка welcome-бонуса</h3>
            <p className="text-sm text-slate-500">
              Шаги за выбранный период · конверсия от предыдущего этапа
            </p>
          </div>
          <div className="p-5 space-y-3">
            {analytics.funnel.map((step, index) => {
              const maxCount = Math.max(...analytics.funnel.map((s) => s.count), 1)
              const widthPct = Math.max(8, Math.round((step.count / maxCount) * 100))
              return (
                <div key={step.step} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold flex items-center justify-center shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-800">{step.label}</span>
                      <span className="text-sm font-bold text-slate-900">{step.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    {index > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {step.conversionPct}% от предыдущего шага
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {showExpiringTable ? (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Сгорают в ближайшие 24 ч</h3>
              <p className="text-sm text-slate-500">Welcome-бонусы, требующие внимания</p>
            </div>
            <span className="text-sm font-medium text-slate-500">{expiring.length} шт.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Пользователь</th>
                  <th className="px-4 py-3 text-left font-medium">Фаза</th>
                  <th className="px-4 py-3 text-left font-medium">Сумма</th>
                  <th className="px-4 py-3 text-left font-medium">Осталось</th>
                  <th className="px-4 py-3 text-left font-medium">TG</th>
                </tr>
              </thead>
              <tbody>
                {expiring.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Нет бонусов, которые сгорят в ближайшие 24 часа
                    </td>
                  </tr>
                ) : (
                  expiring.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.email ?? `#${row.userId}`}</div>
                        <div className="text-xs text-slate-500">ID {row.userId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                          row.phase === 'awaiting_deposit'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {row.phase === 'awaiting_deposit' ? 'Ждёт депозит' : 'Отыгрыш'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.amount} {row.currency}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.remainingHours != null ? `${row.remainingHours} ч` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.telegramLinked ? (
                          <span className="text-emerald-600 font-medium">✓</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
