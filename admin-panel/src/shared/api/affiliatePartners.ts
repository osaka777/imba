import apiClient from './index'

export interface AffiliatePartnerItem {
  userId: number
  email: string
  uid: string
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED'
  type: string
  percent: string
  referralsCount: number
  totalEarned: number
  registeredAt: string
  wallet: string | null
  telegram: string | null
  cpaPayoutAmount: number | null
  cpaCurrencyCode: string | null
}

export class AdminAffiliatePartnersAPI {
  async getPartners(limit = 200): Promise<AffiliatePartnerItem[]> {
    const response = await apiClient.get(`/api/admin/affiliate-partners?limit=${limit}`)
    return response.data?.items || []
  }

  async updateStatus(userId: number, status: AffiliatePartnerItem['status']) {
    const response = await apiClient.post(`/api/admin/affiliate-partners/${userId}/status`, {
      status,
    })
    return response.data
  }

  async updatePercent(userId: number, percent: number) {
    const response = await apiClient.post(`/api/admin/affiliate-partners/${userId}/percent`, {
      percent,
    })
    return response.data
  }

  async updateCpa(userId: number, cpaPayoutAmount: number, cpaCurrencyCode: string) {
    const response = await apiClient.post(`/api/admin/affiliate-partners/${userId}/cpa`, {
      cpaPayoutAmount,
      cpaCurrencyCode,
    })
    return response.data
  }
}

export const adminAffiliatePartnersAPI = new AdminAffiliatePartnersAPI()
