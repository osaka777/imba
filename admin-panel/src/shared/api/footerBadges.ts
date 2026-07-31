export interface FooterBadge {
  id: number
  title?: string
  imageUrl?: string
  imagePath?: string
  linkUrl?: string
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export type CreateFooterBadgeData = {
  title?: string
  imageUrl?: string
  imagePath?: string
  linkUrl?: string
  isActive: boolean
  order: number
}

export type UpdateFooterBadgeData = Partial<CreateFooterBadgeData>

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('authToken')
  }
  return null
}

class FooterBadgesAPI {
  private getHeaders() {
    const token = getAuthToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async getAll(): Promise<FooterBadge[]> {
    const response = await fetch(`${API_BASE_URL}/api/admin/footer-badges`, {
      method: 'GET',
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error(`Failed to fetch badges: ${response.statusText}`)
    return response.json()
  }

  async create(data: CreateFooterBadgeData): Promise<FooterBadge> {
    const response = await fetch(`${API_BASE_URL}/api/admin/footer-badges`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error(`Failed to create badge: ${response.statusText}`)
    return response.json()
  }

  async update(id: number, data: UpdateFooterBadgeData): Promise<FooterBadge> {
    const response = await fetch(`${API_BASE_URL}/api/admin/footer-badges/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error(`Failed to update badge: ${response.statusText}`)
    return response.json()
  }

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/footer-badges/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error(`Failed to delete badge: ${response.statusText}`)
  }

  async toggle(id: number): Promise<FooterBadge> {
    const response = await fetch(`${API_BASE_URL}/api/admin/footer-badges/${id}/toggle`, {
      method: 'PATCH',
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error(`Failed to toggle badge: ${response.statusText}`)
    return response.json()
  }

  async upload(file: File): Promise<{ filename: string; path: string }> {
    const formData = new FormData()
    formData.append('image', file)
    const token = getAuthToken()
    const response = await fetch(`${API_BASE_URL}/api/admin/footer-badges/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!response.ok) throw new Error(`Failed to upload: ${response.statusText}`)
    return response.json()
  }
}

export const footerBadgesAPI = new FooterBadgesAPI()
