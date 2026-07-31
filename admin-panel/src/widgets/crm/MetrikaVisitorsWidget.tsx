'use client'

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { apiCall } from '@/shared/utils/api'
import { formatNumber } from '@/shared/lib/format'

type MetrikaVisitors = {
  configured: boolean
  counterId: number | null
  today: number | null
  yesterday: number | null
  week: number | null
  error?: string
}

export function MetrikaVisitorsWidget() {
  const [data, setData] = useState<MetrikaVisitors | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/metrika/visitors`)
        if (!res.ok) {
          setData({
            configured: false,
            counterId: null,
            today: null,
            yesterday: null,
            week: null,
            error: `HTTP ${res.status}`,
          })
          return
        }
        setData(await res.json())
      } catch (error) {
        setData({
          configured: false,
          counterId: null,
          today: null,
          yesterday: null,
          week: null,
          error: error instanceof Error ? error.message : 'Ошибка загрузки',
        })
      }
    }

    void load()
  }, [])

  const items = [
    { label: 'Сегодня', value: data?.today },
    { label: 'Вчера', value: data?.yesterday },
    { label: '7 дней', value: data?.week },
  ]

  return (
    <section className="admin-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-200">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Посетители (Яндекс.Метрика)</h2>
          <p className="text-sm text-muted-foreground">
            Уникальные пользователи · счётчик {data?.counterId || '111057273'}
          </p>
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : data.error && data.today == null ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {data.error}. Добавь `YANDEX_METRIKA_OAUTH_TOKEN` в backend `.env`.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-muted/30 px-3 py-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                {item.value == null ? '—' : formatNumber(item.value)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">человек</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
