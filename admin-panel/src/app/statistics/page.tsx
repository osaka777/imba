"use client"

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { statisticsAPI, StatisticsData } from '@/shared/api/statistics'
import { BonusAnalyticsDashboard } from '@/widgets/bonuses/BonusAnalyticsDashboard'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'
import { PeriodToggle, PeriodValue } from '@/shared/ui/PeriodToggle'
import { PartnersTable } from '@/widgets/statistics/PartnersTable'
import { StatisticsCards } from '@/widgets/statistics/StatisticsCards'
import { StatisticsCharts } from '@/widgets/statistics/StatisticsCharts'

export default function StatisticsExtendedPage() {
  const [timePeriod, setTimePeriod] = useState<PeriodValue>('day')
  const [statistics, setStatistics] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatistics = async () => {
      setLoading(true)
      try {
        const data = await statisticsAPI.getStatistics(timePeriod)
        setStatistics(data)
      } catch (error) {
        console.error('Failed to fetch statistics:', error)
      } finally {
        setLoading(false)
      }
    }

    void fetchStatistics()
  }, [timePeriod])

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Расширенная статистика"
          description="Детальная аналитика по играм, финансам, бонусам и партнёрам."
          actions={<PeriodToggle value={timePeriod} onChange={setTimePeriod} />}
        />

        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-6">
            <StatisticsCards statistics={statistics} />
            <StatisticsCharts statistics={statistics} timePeriod={timePeriod} />

            <section className="admin-card p-5 md:p-6">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-foreground">Welcome-бонус</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Воронка, отыгрыш и сгорающие бонусы
                </p>
              </div>
              <BonusAnalyticsDashboard period={timePeriod} />
            </section>

            <section className="admin-card overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">Партнёры</h2>
              </div>
              <div className="p-2 md:p-4">
                <PartnersTable statistics={statistics} />
              </div>
            </section>
          </div>
        )}
      </PageShell>
    </AuthGuard>
  )
}
