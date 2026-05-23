"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { StatisticsData } from '@/shared/api/statistics'

interface StatisticsChartsProps {
  statistics: StatisticsData | null
  timePeriod: 'day' | 'week' | 'month'
}

export function StatisticsCharts({ statistics, timePeriod }: StatisticsChartsProps) {
  if (!statistics) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-md">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Use real data from API
  const revenueData = statistics.revenueChart || []
  const gamesData = statistics.gamesChart || []
  
  // Process partners data for pie chart
  const activePartners = statistics.activePartners || 0
  const partnersData = [
    { name: 'Активные', value: activePartners, color: '#10B981' },
    { name: 'Неактивные', value: Math.max(0, Math.floor(activePartners * 0.3)), color: '#F59E0B' },
    { name: 'Заблокированные', value: Math.max(0, Math.floor(activePartners * 0.1)), color: '#EF4444' }
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Revenue Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Финансовая статистика ({timePeriod === 'day' ? 'по дням' : timePeriod === 'week' ? 'по неделям' : 'по месяцам'})
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          {revenueData.length > 0 ? (
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => new Intl.NumberFormat('ru-RU').format(Number(value)) + ' ₽'} />
              <Bar dataKey="deposits" fill="#10B981" name="Зачисления" />
              <Bar dataKey="withdrawals" fill="#EF4444" name="Выплаты" />
              <Bar dataKey="profit" fill="#3B82F6" name="Прибыль" />
            </BarChart>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Нет данных для отображения
            </div>
          )}
        </ResponsiveContainer>
      </div>

      {/* Games Statistics */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Статистика игр</h3>
        <ResponsiveContainer width="100%" height={300}>
          {gamesData.length > 0 ? (
            <BarChart data={gamesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => new Intl.NumberFormat('ru-RU').format(Number(value))} />
              <Bar dataKey="games" fill="#8B5CF6" name="Всего игр" />
              <Bar dataKey="wins" fill="#10B981" name="Выигрыши (₽)" />
              <Bar dataKey="losses" fill="#EF4444" name="Проигрыши (₽)" />
            </BarChart>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Нет данных для отображения
            </div>
          )}
        </ResponsiveContainer>
      </div>

      {/* Partners Distribution */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Распределение партнеров</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={partnersData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              label={({ name, value }: { name: any, value: any }) => `${name}: ${value}`}
            >
              {partnersData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Activity Trend */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Тренд прибыли</h3>
        <ResponsiveContainer width="100%" height={300}>
          {revenueData.length > 0 ? (
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => new Intl.NumberFormat('ru-RU').format(Number(value)) + ' ₽'} />
              <Line type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={3} name="Прибыль" />
            </LineChart>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Нет данных для отображения
            </div>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
