export interface Bonus {
  id: string
  userId: string
  userEmail: string
  amount: number
  type: 'deposit' | 'welcome' | 'loyalty' | 'referral' | 'DIRECT_BONUS' | 'DEPOSIT_BONUS' | 'VOUCHER' | string
  status: 'waiting' | 'pending' | 'success' | 'approved' | 'failed' | 'rejected'
  createdAt: string
  description: string
}

export class BonusAPI {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

  private getHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  }

  async getAllBonuses(status?: string): Promise<{ bonuses: Bonus[] }> {
    try {
      const url = new URL(`${this.baseUrl}/api/admin/bonuses`)
      if (status) {
        url.searchParams.append('status', status)
      }

      const response = await fetch(url.toString(), {
        headers: this.getHeaders()
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch bonuses: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Bonuses API error:', error)
      throw error
    }
  }

  async createBonus(bonusData: {
    userEmail?: string
    amount: number
    type: string
    description: string
    currencyCode?: string
    promoCode?: string
    bonusType?: 'DIRECT_BONUS' | 'DEPOSIT_BONUS' | 'VOUCHER'
    bonusCurrency?: string
    couponCount?: string
    bonusPercentage?: string
    bonusAmount?: string
    partnerPercentage?: string
    minDeposit?: string
    startDate?: string
    endDate?: string
    partnerId?: string
    totalTokens?: string
    tokensPerBet?: string
    tokenMinOdds?: string
  }): Promise<Bonus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/bonuses`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(bonusData)
      })

      if (!response.ok) {
        throw new Error(`Failed to create bonus: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Create bonus API error:', error)
      throw error
    }
  }

  async approveBonus(bonusId: string): Promise<Bonus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/bonuses/${bonusId}/approve`, {
        method: 'POST',
        headers: this.getHeaders()
      })

      if (!response.ok) {
        throw new Error(`Failed to approve bonus: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Approve bonus API error:', error)
      throw error
    }
  }

  async rejectBonus(bonusId: string): Promise<Bonus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/bonuses/${bonusId}/reject`, {
        method: 'POST',
        headers: this.getHeaders()
      })

      if (!response.ok) {
        throw new Error(`Failed to reject bonus: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Reject bonus API error:', error)
      throw error
    }
  }

  async getPromoUsages(code: string): Promise<{ promo: { id: number; code: string; type: string; available: number; remaining: number }, usages: { userId: number; userEmail: string; status: string }[] }> {
    const response = await fetch(`${this.baseUrl}/api/admin/promos/${encodeURIComponent(code)}/usages`, {
      headers: this.getHeaders()
    })
    if (!response.ok) throw new Error(`Failed to fetch promo usages: ${response.status}`)
    return await response.json()
  }

  async grantPromoManually(code: string, userEmail: string): Promise<{ ok: boolean; bonusAmount: number; bonusCurrency: string; totalTokens: number }> {
    const response = await fetch(`${this.baseUrl}/api/admin/promos/${encodeURIComponent(code)}/grant`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userEmail })
    })
    if (!response.ok) throw new Error(`Failed to grant promo: ${response.status}`)
    return await response.json()
  }

  async cancelPromoUsage(code: string, userEmail: string): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/admin/promos/${encodeURIComponent(code)}/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userEmail })
    })
    if (!response.ok) throw new Error(`Failed to cancel promo usage: ${response.status}`)
    return await response.json()
  }
}

export const bonusAPI = new BonusAPI()
