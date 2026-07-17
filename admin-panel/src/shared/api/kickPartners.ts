import apiClient from './index'

export interface KickPartnerAdminItem {
  userId: number
  email: string
  uid: string
  affilatorStatus: string
  connected: boolean
  channelSlug: string | null
  channelTitle: string | null
  connectedAt: string | null
  isLive: boolean
  viewerCount: number | null
  streamTitle: string | null
  hasBranding: boolean
  compliantHours30d: number
  tokenExpiresAt: string | null
  tokenRefreshFailedAt: string | null
  sessionsCount: number
  registrationBonusPaid: number
  activationCount: number
  onboardingComplete: boolean
  lastSessionAt: string | null
}

export interface KickPartnerSessionItem {
  id: string
  kickChannel: string
  startedAt: string
  endedAt: string | null
  peakViewers: number
  hadBranding: boolean
  lastStreamTitle: string | null
  durationMinutes: number | null
}

export interface KickPartnerAdminSessionItem extends KickPartnerSessionItem {
  partnerUserId: number
  partnerEmail: string
  partnerTag: string
}

export interface KickPartnersOverview {
  total: number
  liveCount: number
  connectedCount: number
  items: KickPartnerAdminItem[]
}

export class AdminKickPartnersAPI {
  async getOverview(limit = 200): Promise<KickPartnersOverview> {
    const response = await apiClient.get(`/api/admin/kick-partners?limit=${limit}`)
    return {
      total: response.data?.total ?? 0,
      liveCount: response.data?.liveCount ?? 0,
      connectedCount: response.data?.connectedCount ?? 0,
      items: response.data?.items ?? [],
    }
  }

  async getPartnerSessions(userId: number, limit = 50): Promise<KickPartnerSessionItem[]> {
    const response = await apiClient.get(
      `/api/admin/kick-partners/${userId}/sessions?limit=${limit}`,
    )
    return response.data?.items ?? []
  }

  async getRecentSessions(limit = 50): Promise<KickPartnerAdminSessionItem[]> {
    const response = await apiClient.get(`/api/admin/kick-partners/sessions?limit=${limit}`)
    return response.data?.items ?? []
  }
}

export const adminKickPartnersAPI = new AdminKickPartnersAPI()
