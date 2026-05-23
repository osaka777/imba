"use client"

import { useState, useEffect } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { StatisticsCards } from '@/widgets/statistics/StatisticsCards'
import { StatisticsCharts } from '@/widgets/statistics/StatisticsCharts'
import { TimePeriodFilter } from '@/widgets/statistics/TimePeriodFilter'
import { statisticsAPI, StatisticsData } from '@/shared/api/statistics'

export default function StatisticsPage() {
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('day')
  const [statistics, setStatistics] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatistics()
  }, [timePeriod])

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

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Статистика</h1>
              <p className="text-gray-600">
                Полная аналитика по играм, финансам и партнерам
              </p>
            </div>
            <TimePeriodFilter 
              value={timePeriod} 
              onChange={setTimePeriod}
            />
          </div>

          {/* Main Statistics Dashboard */}
          <div className="space-y-8">
            {/* Statistics Cards */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Общая статистика</h2>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <StatisticsCards statistics={statistics} />
              )}
            </div>

            {/* Charts Section */}
            {!loading && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Графики и аналитика</h2>
                <StatisticsCharts statistics={statistics} timePeriod={timePeriod} />
              </div>
            )}
          </div>

        </div>
      </div>
    </AuthGuard>
  )
}
