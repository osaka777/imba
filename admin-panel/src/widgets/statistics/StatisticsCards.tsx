"use client"

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  Gamepad2,
  Gift,
  TrendingUp,
  Users,
} from 'lucide-react'
import { StatisticsData } from '@/shared/api/statistics'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { KpiCard } from '@/shared/ui/KpiCard'

interface StatisticsCardsProps {
  statistics: StatisticsData | null
}

export function StatisticsCards({ statistics }: StatisticsCardsProps) {
  const currency = statistics?.primaryCurrency || statistics?.byCurrency?.[0]?.currency || null

  const cards = [
    {
      label: 'Зачисления',
      value: formatMoney(statistics?.totalDeposits || 0, currency),
      hint: currency || undefined,
      icon: ArrowUpCircle,
      accent: 'emerald' as const,
    },
    {
      label: 'Выплаты',
      value: formatMoney(statistics?.totalWithdrawals || 0, currency),
      hint: currency || undefined,
      icon: ArrowDownCircle,
      accent: 'rose' as const,
    },
    {
      label: 'Бонусы',
      value: formatMoney(statistics?.totalBonuses || 0, currency),
      hint: currency || undefined,
      icon: Gift,
      accent: 'sky' as const,
    },
    {
      label: 'Выигрыши',
      value: formatMoney(statistics?.totalWins || 0, currency),
      hint: currency || undefined,
      icon: TrendingUp,
      accent: 'emerald' as const,
    },
    {
      label: 'Проигрыши',
      value: formatMoney(statistics?.totalLosses || 0, currency),
      hint: currency || undefined,
      icon: Coins,
      accent: 'amber' as const,
    },
    {
      label: 'Игры / ставки',
      value: formatNumber(statistics?.totalGames || 0),
      icon: Gamepad2,
      accent: 'violet' as const,
    },
    {
      label: 'Партнёры',
      value: formatNumber(statistics?.activePartners || 0),
      icon: Users,
      accent: 'slate' as const,
    },
    {
      label: 'Прибыль',
      value: formatMoney(statistics?.totalRevenue || 0, currency),
      hint: currency ? `Основная валюта: ${currency}` : 'Нет данных',
      icon: TrendingUp,
      accent: 'sky' as const,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.label}
          label={card.label}
          value={card.value}
          hint={card.hint}
          icon={card.icon}
          accent={card.accent}
        />
      ))}
    </div>
  )
}
