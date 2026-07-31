"use client"

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { statisticsAPI, StatisticsData } from '@/shared/api/statistics'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'
import { PeriodToggle, PeriodValue } from '@/shared/ui/PeriodToggle'
import { StatisticsCards } from '@/widgets/statistics/StatisticsCards'
import { StatisticsCharts } from '@/widgets/statistics/StatisticsCharts'
import { MetrikaVisitorsWidget } from '@/widgets/crm/MetrikaVisitorsWidget'

export default function StatisticsPage() {
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
          title="Статистика"
          description="Финансы, ставки и партнёрские показатели за выбранный период."
          actions={<PeriodToggle value={timePeriod} onChange={setTimePeriod} />}
        />

        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-6">
            <MetrikaVisitorsWidget />
            <StatisticsCards statistics={statistics} />
            <StatisticsCharts statistics={statistics} timePeriod={timePeriod} />
          </div>
        )}
      </PageShell>
    </AuthGuard>
  )
}
