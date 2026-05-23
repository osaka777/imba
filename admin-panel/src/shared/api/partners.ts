import apiClient from './index'

export interface PartnerStatsItem {
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

export class AdminPartnersAPI {
  async getPartnersStatistics(period: 'day' | 'week' | 'month' = 'month'): Promise<PartnerStatsItem[]> {
    const response = await apiClient.get(`/api/admin/partners-stats?period=${period}`)
    // backend returns { activeCount, data }
    return response.data?.data || []
  }
}

export const adminPartnersAPI = new AdminPartnersAPI()