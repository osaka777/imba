"use client"

import { useState, useEffect } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { StatisticsCards } from '@/widgets/statistics/StatisticsCards'
import { StatisticsCharts } from '@/widgets/statistics/StatisticsCharts'
import { PartnersTable } from '@/widgets/statistics/PartnersTable'
import { TimePeriodFilter } from '@/widgets/statistics/TimePeriodFilter'
import { BonusAnalyticsDashboard } from '@/widgets/bonuses/BonusAnalyticsDashboard'

export default function StatisticsPage() {
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('day')
  const [statistics, setStatistics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatistics()
  }, [timePeriod])

  const fetchStatistics = async () => {
    setLoading(true)
    try {
      // TODO: Replace with actual API call
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${baseUrl}/api/admin/statistics?period=${timePeriod}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await response.json()
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

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Main Statistics Cards */}
              <StatisticsCards statistics={statistics} />
              
              {/* Charts Section */}
              <StatisticsCharts statistics={statistics} timePeriod={timePeriod} />

              <section>
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Welcome-бонус</h2>
                  <p className="text-gray-600 text-sm">Воронка, отыгрыш и сгорающие бонусы</p>
                </div>
                <BonusAnalyticsDashboard period={timePeriod} />
              </section>
              
              {/* Partners Performance Table */}
              <PartnersTable statistics={statistics} />
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
