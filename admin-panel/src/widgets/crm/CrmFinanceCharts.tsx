'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { StatisticsData } from '@/shared/api/statistics'
import { chartColors, chartTooltipStyle } from '@/shared/lib/chartTheme'
import { formatMoney } from '@/shared/lib/format'
import { ChartPanel } from '@/shared/ui/ChartPanel'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PeriodValue } from '@/shared/ui/PeriodToggle'

type CrmFinanceChartsProps = {
  statistics: StatisticsData | null
  period: PeriodValue
  currency?: string | null
}

const periodLabel = {
  day: 'по дням',
  week: 'по неделям',
  month: 'по месяцам',
}

export function CrmFinanceCharts({ statistics, period, currency }: CrmFinanceChartsProps) {
  const revenueData = statistics?.revenueChart || []
  const gamesData = statistics?.gamesChart || []
  const moneyCurrency = currency || statistics?.primaryCurrency || null
  const moneyFmt = (value: number) => formatMoney(Number(value), moneyCurrency)

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <ChartPanel
        title="Финансовый поток"
        subtitle={`Депозиты, выводы и прибыль ${periodLabel[period]}`}
      >
        {revenueData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="depositsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.deposits} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={chartColors.deposits} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.profit} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={chartColors.profit} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="4 4" />
              <XAxis dataKey="name" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
              <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: number) => moneyFmt(Number(value))}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="deposits"
                name="Депозиты"
                stroke={chartColors.deposits}
                fill="url(#depositsFill)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Прибыль"
                stroke={chartColors.profit}
                fill="url(#profitFill)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="withdrawals"
                name="Выводы"
                stroke={chartColors.withdrawals}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState />
        )}
      </ChartPanel>

      <ChartPanel title="Ставки и исходы" subtitle="Объём и денежный результат">
        {gamesData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={gamesData}>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="4 4" />
              <XAxis dataKey="name" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
              <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: number) => moneyFmt(Number(value))}
              />
              <Legend />
              <Bar dataKey="wins" name="Выигрыши" fill={chartColors.deposits} radius={[6, 6, 0, 0]} />
              <Bar dataKey="losses" name="Проигрыши" fill={chartColors.withdrawals} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState />
        )}
      </ChartPanel>

      <ChartPanel
        title="Тренд прибыли"
        subtitle="Чистый финансовый результат"
        className="xl:col-span-2"
      >
        {revenueData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenueData}>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="4 4" />
              <XAxis dataKey="name" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
              <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: number) => moneyFmt(Number(value))}
              />
              <Line
                type="monotone"
                dataKey="profit"
                name="Прибыль"
                stroke={chartColors.ggr}
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState />
        )}
      </ChartPanel>
    </div>
  )
}
