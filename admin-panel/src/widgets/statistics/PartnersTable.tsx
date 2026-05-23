"use client"

interface PartnerStats {
  id: string
  name: string
  email: string
  totalEarned: number
  clientsCount: number
  clientsWins: number
  clientsLosses: number
  totalGames: number
  conversionRate: number
  status: 'active' | 'inactive' | 'blocked'
}

interface PartnersTableProps {
  statistics: any
}

export function PartnersTable({ statistics }: PartnersTableProps) {
  // Mock data - replace with real data from statistics
  const partnersData: PartnerStats[] = [
    {
      id: '1',
      name: 'Иван Петров',
      email: 'ivan@example.com',
      totalEarned: 125000,
      clientsCount: 45,
      clientsWins: 180000,
      clientsLosses: 220000,
      totalGames: 156,
      conversionRate: 12.5,
      status: 'active'
    },
    {
      id: '2',
      name: 'Мария Сидорова',
      email: 'maria@example.com',
      totalEarned: 89000,
      clientsCount: 32,
      clientsWins: 145000,
      clientsLosses: 178000,
      totalGames: 98,
      conversionRate: 15.2,
      status: 'active'
    },
    {
      id: '3',
      name: 'Алексей Козлов',
      email: 'alexey@example.com',
      totalEarned: 67000,
      clientsCount: 28,
      clientsWins: 98000,
      clientsLosses: 134000,
      totalGames: 76,
      conversionRate: 8.9,
      status: 'inactive'
    },
    {
      id: '4',
      name: 'Елена Волкова',
      email: 'elena@example.com',
      totalEarned: 156000,
      clientsCount: 52,
      clientsWins: 234000,
      clientsLosses: 267000,
      totalGames: 189,
      conversionRate: 18.7,
      status: 'active'
    },
    {
      id: '5',
      name: 'Дмитрий Новиков',
      email: 'dmitry@example.com',
      totalEarned: 43000,
      clientsCount: 19,
      clientsWins: 67000,
      clientsLosses: 89000,
      totalGames: 45,
      conversionRate: 6.8,
      status: 'blocked'
    }
  ]

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Активен' },
      inactive: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Неактивен' },
      blocked: { bg: 'bg-red-100', text: 'text-red-800', label: 'Заблокирован' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig]
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Статистика партнеров</h3>
        <p className="text-sm text-gray-600 mt-1">
          Детальная информация по доходам партнеров и активности их клиентов
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Партнер
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Заработано
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Клиенты
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Выигрыши клиентов
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Проигрыши клиентов
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Всего игр
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Конверсия %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {partnersData.map((partner) => (
              <tr key={partner.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{partner.name}</div>
                    <div className="text-sm text-gray-500">{partner.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(partner.totalEarned)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{partner.clientsCount}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-green-600">
                    {formatCurrency(partner.clientsWins)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-red-600">
                    {formatCurrency(partner.clientsLosses)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{partner.totalGames}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{partner.conversionRate}%</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(partner.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Показано {partnersData.length} из {partnersData.length} партнеров
          </div>
          <div className="flex space-x-2">
            <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Предыдущая
            </button>
            <button className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Следующая
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
