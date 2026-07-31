'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { statisticsAPI, StatisticsData } from '@/shared/api/statistics'
import { formatMoney } from '@/shared/lib/format'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'
import { PeriodToggle, PeriodValue } from '@/shared/ui/PeriodToggle'
import { CrmFinanceCharts } from '@/widgets/crm/CrmFinanceCharts'
import { CrmKpiGrid } from '@/widgets/crm/CrmKpiGrid'
import { CurrencyBreakdownTable } from '@/widgets/crm/CurrencyBreakdownTable'
import { MetrikaVisitorsWidget } from '@/widgets/crm/MetrikaVisitorsWidget'
import { PartnersTable } from '@/widgets/statistics/PartnersTable'

export default function CrmPage() {
  const [period, setPeriod] = useState<PeriodValue>('day')
  const [currency, setCurrency] = useState<string | null>(null)
  const [statistics, setStatistics] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await statisticsAPI.getStatistics(period)
        setStatistics(data)
        setCurrency((prev) => prev || data.primaryCurrency || data.byCurrency?.[0]?.currency || null)
      } catch (err) {
        console.error('Failed to load CRM data:', err)
        setStatistics(null)
        setError(err instanceof Error ? err.message : 'Не удалось загрузить CRM')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [period])

  const currencies = useMemo(
    () => (statistics?.byCurrency || []).map((row) => row.currency),
    [statistics],
  )

  const exportCsv = () => {
    if (!statistics?.byCurrency?.length) return
    const lines = [
      ['currency', 'deposits', 'withdrawals', 'revenue', 'bonuses'].join(','),
      ...statistics.byCurrency.map((row) =>
        [row.currency, row.deposits, row.withdrawals, row.revenue, row.bonuses].join(','),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `crm-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="CRM — KPI"
          description="Внутренние отчёты по реальной валюте пользователя. Без смешивания KZT/RUB/USDT."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {currencies.length > 0 ? (
                <select
                  value={currency || ''}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm"
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              ) : null}
              <PeriodToggle value={period} onChange={setPeriod} />
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                CSV
              </button>
            </div>
          }
        />

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            <MetrikaVisitorsWidget />
            <CrmKpiGrid statistics={statistics} currency={currency} />

            <section className="admin-card overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">По валютам</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Каждый ряд — своя валюта, без конвертации в рубль
                </p>
              </div>
              <div className="p-2 md:p-4">
                <CurrencyBreakdownTable statistics={statistics} />
              </div>
            </section>

            <CrmFinanceCharts
              statistics={statistics}
              period={period}
              currency={currency}
            />

            <section className="admin-card overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">Партнёры</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Эффективность каналов
                  {currency ? ` · отчёт в ${currency}` : ''}
                </p>
              </div>
              <div className="p-2 md:p-4">
                <PartnersTable statistics={statistics} currency={currency} />
              </div>
            </section>

            {currency ? (
              <p className="text-xs text-muted-foreground">
                Пример: депозиты {formatMoney(statistics?.byCurrency?.find((r) => r.currency === currency)?.deposits || 0, currency)}
              </p>
            ) : null}
          </div>
        )}
      </PageShell>
    </AuthGuard>
  )
}
