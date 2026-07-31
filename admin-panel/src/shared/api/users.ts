import apiClient from './index'

export interface BalanceRow {
  amount: number
  currency: string
}

export interface User {
  id: number
  email: string
  phone?: string | null
  username: string
  defaultCurrencyCode?: string | null
  createdAt: string
  updatedAt: string
  totalBalance: number
  bonusBalance: number
  balances?: BalanceRow[]
  bonusBalances?: BalanceRow[]
  totalBets: number
  winningBets: number
  losingBets: number
  winRate: number
  recentBets: any[]
  recentOperations: any[]
}

export interface UserDetails extends User {
  balances: Array<{
    id: number
    amount: number
    currency: string
    createdAt: string
  }>
  statistics: {
    totalBets: number
    winningBets: number
    losingBets: number
    pendingBets: number
    winRate: number
    totalBetAmount: number
    totalWinAmount: number
    profit: number
  }
  operations: Array<{
    id: number
    type: string
    amount: number
    currency: string
    createdAt: string
    source: string
    status: string
  }>
  bets: Array<{
    id: number
    amount: number
    currency?: string
    cf: number
    status: string
    betType: string
    betInfo: string
    createdAt: string
    game: {
      eventId: string
      eventName: string
      team1: string
      team2: string
      status: string
    } | null
  }>
  bonusBalances: Array<{
    id: number
    amount: number
    currency: string
    createdAt: string
  }>
  bonuses: Array<{
    promoId: number
    promoCode: string
    status: string
    type: string
    validUntil: string
  }>
}

export class AdminUsersAPI {
  async getUsersWithBonusBalances(): Promise<any[]> {
    const response = await apiClient.get('/api/bonus-balance/users')
    return response.data
  }

  async getAllUsers(): Promise<User[]> {
    const response = await apiClient.get('/api/admin/users')
    return response.data
  }

  async getUserDetails(userId: string): Promise<UserDetails> {
    const response = await apiClient.get(`/api/admin/users/${userId}`)
    return response.data
  }

  async searchUsers(query: string): Promise<User[]> {
    const all = await this.getAllUsers()
    const q = query.trim().toLowerCase()
    if (!q) return all.slice(0, 20)
    return all
      .filter((user) => {
        return (
          String(user.id).includes(q)
          || user.email?.toLowerCase().includes(q)
          || user.username?.toLowerCase().includes(q)
          || user.phone?.toLowerCase().includes(q)
        )
      })
      .slice(0, 20)
  }
}

export const adminUsersAPI = new AdminUsersAPI()
