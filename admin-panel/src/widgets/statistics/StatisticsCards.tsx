"use client"

interface StatisticsData {
  totalDeposits: number
  totalWithdrawals: number
  totalBonuses: number
  totalWins: number
  totalLosses: number
  totalGames: number
  activePartners: number
  totalRevenue: number
}

interface StatisticsCardsProps {
  statistics: StatisticsData | null
}

export function StatisticsCards({ statistics }: StatisticsCardsProps) {
  const cards = [
    {
      title: 'Общие зачисления',
      value: statistics?.totalDeposits || 0,
      format: 'currency',
      color: 'bg-green-500',
      icon: '💰'
    },
    {
      title: 'Общие выплаты',
      value: statistics?.totalWithdrawals || 0,
      format: 'currency',
      color: 'bg-red-500',
      icon: '💸'
    },
    {
      title: 'Выплачено бонусов',
      value: statistics?.totalBonuses || 0,
      format: 'currency',
      color: 'bg-blue-500',
      icon: '🎁'
    },
    {
      title: 'Общие выигрыши',
      value: statistics?.totalWins || 0,
      format: 'currency',
      color: 'bg-emerald-500',
      icon: '🏆'
    },
    {
      title: 'Общие проигрыши',
      value: statistics?.totalLosses || 0,
      format: 'currency',
      color: 'bg-orange-500',
      icon: '📉'
    },
    {
      title: 'Всего игр',
      value: statistics?.totalGames || 0,
      format: 'number',
      color: 'bg-purple-500',
      icon: '🎮'
    },
    {
      title: 'Активные партнеры',
      value: statistics?.activePartners || 0,
      format: 'number',
      color: 'bg-indigo-500',
      icon: '🤝'
    },
    {
      title: 'Общая прибыль',
      value: statistics?.totalRevenue || 0,
      format: 'currency',
      color: 'bg-yellow-500',
      icon: '📊'
    }
  ]

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value)
    }
    return new Intl.NumberFormat('ru-RU').format(value)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatValue(card.value, card.format)}
              </p>
            </div>
            <div className={`${card.color} p-3 rounded-full text-white text-xl`}>
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
