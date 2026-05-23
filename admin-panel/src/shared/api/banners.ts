export interface Banner {
  id: number
  title: string
  description?: string
  imageUrl?: string
  imagePath?: string
  linkUrl?: string
  isActive: boolean
  order: number
  
  // Позиционирование текста
  textPosition: string
  textVerticalPos: string
  textOffsetX: number
  textOffsetY: number
  // Новые независимые позиции (в процентах)
  titlePosXPct?: number
  titlePosYPct?: number
  descPosXPct?: number
  descPosYPct?: number
  // Переключатели отображения
  showTitle?: boolean
  showDesc?: boolean
  showButton?: boolean
  
  // Кнопка
  buttonText?: string
  buttonPosXPct?: number
  buttonPosYPct?: number
  
  // Стилизация текста
  titleColor: string
  titleSize: number
  descColor: string
  descSize: number
  textShadow: boolean
  
  createdAt: string
  updatedAt: string
}

export interface CreateBannerData {
  title: string
  description?: string
  imageUrl?: string
  imagePath?: string
  linkUrl?: string
  isActive: boolean
  order: number
  
  // Позиционирование текста
  textPosition?: string
  textVerticalPos?: string
  textOffsetX?: number
  textOffsetY?: number
  // Новые независимые позиции (в процентах)
  titlePosXPct?: number
  titlePosYPct?: number
  descPosXPct?: number
  descPosYPct?: number
  // Переключатели отображения
  showTitle?: boolean
  showDesc?: boolean
  showButton?: boolean
  
  // Кнопка
  buttonText?: string
  buttonPosXPct?: number
  buttonPosYPct?: number
  
  // Стилизация текста
  titleColor?: string
  titleSize?: number
  descColor?: string
  descSize?: number
  textShadow?: boolean
}

export interface UpdateBannerData {
  title?: string
  description?: string
  imageUrl?: string
  imagePath?: string
  linkUrl?: string
  isActive?: boolean
  order?: number
  
  // Позиционирование текста
  textPosition?: string
  textVerticalPos?: string
  textOffsetX?: number
  textOffsetY?: number
  // Новые независимые позиции (в процентах)
  titlePosXPct?: number
  titlePosYPct?: number
  descPosXPct?: number
  descPosYPct?: number
  // Переключатели отображения
  showTitle?: boolean
  showDesc?: boolean
  showButton?: boolean
  
  // Кнопка
  buttonText?: string
  buttonPosXPct?: number
  buttonPosYPct?: number
  
  // Стилизация текста
  titleColor?: string
  titleSize?: number
  descColor?: string
  descSize?: number
  textShadow?: boolean
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('authToken')
  }
  return null
}

class BannersAPI {
  private getHeaders() {
    const token = getAuthToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  }

  async getAllBanners(): Promise<Banner[]> {
    const response = await fetch(`${API_BASE_URL}/api/admin/banners`, {
      method: 'GET',
      headers: this.getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch banners: ${response.statusText}`)
    }

    return response.json()
  }

  async getBannerById(id: number): Promise<Banner> {
    const response = await fetch(`${API_BASE_URL}/api/admin/banners/${id}`, {
      method: 'GET',
      headers: this.getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch banner: ${response.statusText}`)
    }

    return response.json()
  }

  async createBanner(data: CreateBannerData): Promise<Banner> {
    const response = await fetch(`${API_BASE_URL}/api/admin/banners`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error(`Failed to create banner: ${response.statusText}`)
    }

    return response.json()
  }

  async updateBanner(id: number, data: UpdateBannerData): Promise<Banner> {
    const response = await fetch(`${API_BASE_URL}/api/admin/banners/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error(`Failed to update banner: ${response.statusText}`)
    }

    return response.json()
  }

  async deleteBanner(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/banners/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to delete banner: ${response.statusText}`)
    }
  }

  async toggleBannerStatus(id: number): Promise<Banner> {
    const response = await fetch(`${API_BASE_URL}/api/admin/banners/${id}/toggle`, {
      method: 'PATCH',
      headers: this.getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to toggle banner status: ${response.statusText}`)
    }

    return response.json()
  }

  // Публичные методы для получения активных баннеров
  async getActiveBanners(): Promise<Banner[]> {
    const response = await fetch(`${API_BASE_URL}/api/banners`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch active banners: ${response.statusText}`)
    }

    return response.json()
  }

  async uploadBannerImage(file: File): Promise<{ filename: string; path: string; originalName: string; size: number }> {
    const formData = new FormData()
    formData.append('image', file)

    const token = getAuthToken()
    const response = await fetch(`${API_BASE_URL}/api/admin/banners/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.statusText}`)
    }

    return response.json()
  }
}

export const bannersAPI = new BannersAPI()