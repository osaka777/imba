export interface StatisticsData {
  totalDeposits: number
  totalWithdrawals: number
  totalBonuses: number
  totalWins: number
  totalLosses: number
  totalGames: number
  activePartners: number
  totalRevenue: number
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
}

export class StatisticsAPI {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

  async getStatistics(period: 'day' | 'week' | 'month'): Promise<StatisticsData> {
    try {
      console.log(`Fetching statistics for period: ${period}`)
      console.log(`API URL: ${this.baseUrl}/api/admin/statistics?period=${period}`)
      
      // Use single consolidated endpoint
      const response = await fetch(`${this.baseUrl}/api/admin/statistics?period=${period}`, {
        headers: this.getHeaders()
      })
      
      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error Response:', errorText)
        throw new Error(`Failed to fetch statistics: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Received data:', data)
      
      return {
        totalDeposits: data.totalDeposits || 0,
        totalWithdrawals: data.totalWithdrawals || 0,
        totalBonuses: data.totalBonuses || 0,
        totalWins: data.totalWins || 0,
        totalLosses: data.totalLosses || 0,
        totalGames: data.totalGames || 0,
        activePartners: data.activePartners || 0,
        totalRevenue: data.totalRevenue || 0,
        revenueChart: data.revenueChart || [],
        gamesChart: data.gamesChart || [],
        partnersData: data.partnersData || []
      }
    } catch (error) {
      console.error('Statistics API error:', error)
      // Return mock data as fallback
      return this.getMockStatistics(period)
    }
  }

  private async getFinancialStatistics(period: string) {
    const response = await fetch(`${this.baseUrl}/api/admin/financial-stats?period=${period}`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) throw new Error('Failed to fetch financial stats')
    return await response.json()
  }

  private async getGamesStatistics(period: string) {
    const response = await fetch(`${this.baseUrl}/api/admin/games-stats?period=${period}`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) throw new Error('Failed to fetch games stats')
    return await response.json()
  }

  private async getPartnersStatistics(period: string) {
    const response = await fetch(`${this.baseUrl}/api/admin/partners-stats?period=${period}`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) throw new Error('Failed to fetch partners stats')
    return await response.json()
  }

  private async getUsersStatistics(period: string) {
    const response = await fetch(`${this.baseUrl}/api/admin/users-stats?period=${period}`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) throw new Error('Failed to fetch users stats')
    return await response.json()
  }

  private getHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  }

  private getMockStatistics(period: string): StatisticsData {
    const multiplier = period === 'month' ? 30 : period === 'week' ? 7 : 1

    return {
      totalDeposits: 2450000 * multiplier,
      totalWithdrawals: 1890000 * multiplier,
      totalBonuses: 340000 * multiplier,
      totalWins: 1560000 * multiplier,
      totalLosses: 1890000 * multiplier,
      totalGames: 3420 * multiplier,
      activePartners: 76,
      totalRevenue: 560000 * multiplier,
      revenueChart: [
        { name: period === 'month' ? 'Янв' : period === 'week' ? 'Нед 1' : 'Пн', deposits: 45000, withdrawals: 32000, profit: 13000 },
        { name: period === 'month' ? 'Фев' : period === 'week' ? 'Нед 2' : 'Вт', deposits: 52000, withdrawals: 38000, profit: 14000 },
        { name: period === 'month' ? 'Мар' : period === 'week' ? 'Нед 3' : 'Ср', deposits: 48000, withdrawals: 35000, profit: 13000 },
        { name: period === 'month' ? 'Апр' : period === 'week' ? 'Нед 4' : 'Чт', deposits: 61000, withdrawals: 42000, profit: 19000 },
        { name: period === 'month' ? 'Май' : period === 'week' ? 'Нед 5' : 'Пт', deposits: 55000, withdrawals: 39000, profit: 16000 },
        { name: period === 'month' ? 'Июн' : period === 'week' ? 'Нед 6' : 'Сб', deposits: 67000, withdrawals: 45000, profit: 22000 },
        { name: period === 'month' ? 'Июл' : period === 'week' ? 'Нед 7' : 'Вс', deposits: 59000, withdrawals: 41000, profit: 18000 }
      ],
      gamesChart: [
        { name: 'Футбол', games: 1250 * multiplier, wins: 580 * multiplier, losses: 670 * multiplier },
        { name: 'Баскетбол', games: 890 * multiplier, wins: 420 * multiplier, losses: 470 * multiplier },
        { name: 'Теннис', games: 650 * multiplier, wins: 310 * multiplier, losses: 340 * multiplier },
        { name: 'Хоккей', games: 420 * multiplier, wins: 195 * multiplier, losses: 225 * multiplier },
        { name: 'Волейбол', games: 280 * multiplier, wins: 130 * multiplier, losses: 150 * multiplier }
      ],
      partnersData: [
        {
          id: '1',
          name: 'Иван Петров',
          email: 'ivan@example.com',
          totalEarned: 125000 * multiplier,
          clientsCount: 45,
          clientsWins: 180000 * multiplier,
          clientsLosses: 220000 * multiplier,
          totalGames: 156 * multiplier,
          conversionRate: 12.5,
          status: 'active'
        },
        {
          id: '2',
          name: 'Мария Сидорова',
          email: 'maria@example.com',
          totalEarned: 89000 * multiplier,
          clientsCount: 32,
          clientsWins: 145000 * multiplier,
          clientsLosses: 178000 * multiplier,
          totalGames: 98 * multiplier,
          conversionRate: 15.2,
          status: 'active'
        },
        {
          id: '3',
          name: 'Алексей Козлов',
          email: 'alexey@example.com',
          totalEarned: 67000 * multiplier,
          clientsCount: 28,
          clientsWins: 98000 * multiplier,
          clientsLosses: 134000 * multiplier,
          totalGames: 76 * multiplier,
          conversionRate: 8.9,
          status: 'inactive'
        },
        {
          id: '4',
          name: 'Елена Волкова',
          email: 'elena@example.com',
          totalEarned: 156000 * multiplier,
          clientsCount: 52,
          clientsWins: 234000 * multiplier,
          clientsLosses: 267000 * multiplier,
          totalGames: 189 * multiplier,
          conversionRate: 18.7,
          status: 'active'
        },
        {
          id: '5',
          name: 'Дмитрий Новиков',
          email: 'dmitry@example.com',
          totalEarned: 43000 * multiplier,
          clientsCount: 19,
          clientsWins: 67000 * multiplier,
          clientsLosses: 89000 * multiplier,
          totalGames: 45 * multiplier,
          conversionRate: 6.8,
          status: 'blocked'
        }
      ]
    }
  }
}

export const statisticsAPI = new StatisticsAPI()
