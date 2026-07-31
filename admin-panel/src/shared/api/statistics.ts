export interface CurrencyBreakdown {
  currency: string
  deposits: number
  withdrawals: number
  bonuses: number
  revenue: number
}

export interface GamesCurrencyBreakdown {
  currency: string
  wins: number
  losses: number
  ggr: number
  games: number
}

export interface StatisticsData {
  totalDeposits: number
  totalWithdrawals: number
  totalBonuses: number
  totalWins: number
  totalLosses: number
  totalGames: number
  activePartners: number
  totalRevenue: number
  primaryCurrency?: string | null
  byCurrency?: CurrencyBreakdown[]
  gamesByCurrency?: GamesCurrencyBreakdown[]
  revenueChart: Array<{
    name: string
    deposits: number
    withdrawals: number
    profit: number
  }>
  gamesChart: Array<{
    name: string
    games: number
    wins: number
    losses: number
  }>
  partnersData: Array<{
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
  }>
  totalUsers?: number
  newUsers?: number
  activeUsers?: number
}

export class StatisticsAPI {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

  async getStatistics(period: 'day' | 'week' | 'month'): Promise<StatisticsData> {
    const response = await fetch(`${this.baseUrl}/api/admin/statistics?period=${period}`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch statistics: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    return {
      totalDeposits: data.totalDeposits || 0,
      totalWithdrawals: data.totalWithdrawals || 0,
      totalBonuses: data.totalBonuses || 0,
      totalWins: data.totalWins || 0,
      totalLosses: data.totalLosses || 0,
      totalGames: data.totalGames || 0,
      activePartners: data.activePartners || 0,
      totalRevenue: data.totalRevenue || 0,
      primaryCurrency: data.primaryCurrency || null,
      byCurrency: data.byCurrency || [],
      gamesByCurrency: data.gamesByCurrency || [],
      revenueChart: data.revenueChart || [],
      gamesChart: data.gamesChart || [],
      partnersData: data.partnersData || [],
      totalUsers: data.totalUsers || 0,
      newUsers: data.newUsers || 0,
      activeUsers: data.activeUsers || 0,
    }
  }

  private getHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
    return {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    }
  }
}

export const statisticsAPI = new StatisticsAPI()
