'use client'

import { CrmFinanceCharts } from '@/widgets/crm/CrmFinanceCharts'
import { StatisticsData } from '@/shared/api/statistics'
import { PeriodValue } from '@/shared/ui/PeriodToggle'

interface StatisticsChartsProps {
  statistics: StatisticsData | null
  timePeriod: PeriodValue
}

export function StatisticsCharts({ statistics, timePeriod }: StatisticsChartsProps) {
  return (
    <CrmFinanceCharts
      statistics={statistics}
      period={timePeriod}
      currency={statistics?.primaryCurrency}
    />
  )
}
