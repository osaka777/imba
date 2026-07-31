'use client'

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  LineChart,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { StatisticsData } from '@/shared/api/statistics'
import { buildCrmKpiSnapshot, formatCrmKpi } from '@/shared/lib/crmKpi'
import { KpiCard } from '@/shared/ui/KpiCard'

type CrmKpiGridProps = {
  statistics: StatisticsData | null
  currency?: string | null
}

export function CrmKpiGrid({ statistics, currency }: CrmKpiGridProps) {
  const snapshot = buildCrmKpiSnapshot(statistics, currency)
  const formatted = formatCrmKpi(snapshot)

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Валюта отчёта: {formatted.currency}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Депозиты"
          value={formatted.deposits}
          hint="Успешные зачисления"
          icon={ArrowUpCircle}
          accent="emerald"
        />
        <KpiCard
          label="Выводы"
          value={formatted.withdrawals}
          hint="Успешные выплаты"
          icon={ArrowDownCircle}
          accent="rose"
        />
        <KpiCard
          label="Net Revenue"
          value={formatted.netRevenue}
          hint="Депозиты − выводы"
          icon={Wallet}
          accent="sky"
        />
        <KpiCard
          label="GGR"
          value={formatted.ggr}
          hint="Проигрыши − выигрыши"
          icon={Coins}
          accent="violet"
        />
        <KpiCard
          label="Ставки"
          value={formatted.totalBets}
          hint="Количество ставок"
          icon={LineChart}
          accent="slate"
        />
        <KpiCard
          label="ARPU"
          value={formatted.arpu}
          hint="Депозиты / активные пользователи"
          icon={TrendingUp}
          accent="amber"
        />
        <KpiCard
          label="Новые пользователи"
          value={formatted.newUsers}
          hint={`Конверсия ${formatted.conversionRate}`}
          icon={UserPlus}
          accent="sky"
        />
        <KpiCard
          label="Активные пользователи"
          value={formatted.activeUsers}
          hint="За выбранный период"
          icon={Users}
          accent="emerald"
        />
      </div>
    </div>
  )
}
