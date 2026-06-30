import apiClient from './index'

export interface ReferralOverviewItem {
  playerId: number
  playerEmail: string
  playerRegisteredAt: string
  registrationIp: string | null
  partnerId: number
  partnerEmail: string
  partnerUid: string
  totalDeposits: number
  firstDepositAt: string | null
  totalBets: number
  totalLosses: number
  affiliateEarnedFromPlayer: number
}

export class AdminReferralsAPI {
  async getReferralsOverview(limit = 200): Promise<ReferralOverviewItem[]> {
    const response = await apiClient.get(`/api/admin/referrals?limit=${limit}`)
    return response.data?.items || []
  }
}

export const adminReferralsAPI = new AdminReferralsAPI()
