export interface Slide {
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
  // Независимые позиции (в процентах)
  titlePosXPct?: number
  titlePosYPct?: number
  titleMobilePosXPct?: number
  titleMobilePosYPct?: number
  descPosXPct?: number
  descPosYPct?: number
  descMobilePosXPct?: number
  descMobilePosYPct?: number
  // Переключатели отображения
  showTitle?: boolean
  showDesc?: boolean
  showButton?: boolean
  // Кнопка
  buttonText?: string
  buttonPosXPct?: number
  buttonPosYPct?: number
  buttonMobilePosXPct?: number
  buttonMobilePosYPct?: number
  // Стилизация текста
  titleColor: string
  titleSize: number
  titleMobileSize?: number
  descColor: string
  descSize: number
  descMobileSize?: number
  textShadow: boolean
  buttonSize?: number
  buttonMobileSize?: number
  createdAt: string
  updatedAt: string
}

export interface CreateSlideData {
  title: string
  description?: string
  imageUrl?: string
  imagePath?: string
  linkUrl?: string
  isActive: boolean
  order: number
  // Позиционирование и стили
  textPosition?: string
  textVerticalPos?: string
  textOffsetX?: number
  textOffsetY?: number
  titlePosXPct?: number
  titlePosYPct?: number
  titleMobilePosXPct?: number
  titleMobilePosYPct?: number
  descPosXPct?: number
  descPosYPct?: number
  descMobilePosXPct?: number
  descMobilePosYPct?: number
  showTitle?: boolean
  showDesc?: boolean
  showButton?: boolean
  buttonText?: string
  buttonPosXPct?: number
  buttonPosYPct?: number
  buttonMobilePosXPct?: number
  buttonMobilePosYPct?: number
  titleColor?: string
  titleSize?: number
  titleMobileSize?: number
  descColor?: string
  descSize?: number
  descMobileSize?: number
  textShadow?: boolean
  buttonSize?: number
  buttonMobileSize?: number
}

export interface UpdateSlideData extends Partial<CreateSlideData> {}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('authToken')
  }
  return null
}

class SlidesAPI {
  private getHeaders() {
    const token = getAuthToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    }
  }

  async getAllSlides(): Promise<Slide[]> {
    const response = await fetch(`${API_BASE_URL}/api/admin/slides`, {
      method: 'GET',
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error(`Failed to fetch slides: ${response.statusText}`)
    return response.json()
  }

  async getSlideById(id: number): Promise<Slide> {
    const response = await fetch(`${API_BASE_URL}/api/admin/slides/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error(`Failed to fetch slide: ${response.statusText}`)
    return response.json()
  }

  async createSlide(data: CreateSlideData): Promise<Slide> {
    const response = await fetch(`${API_BASE_URL}/api/admin/slides`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error(`Failed to create slide: ${response.statusText}`)
    return response.json()
  }

  async updateSlide(id: number, data: UpdateSlideData): Promise<Slide> {
    const response = await fetch(`${API_BASE_URL}/api/admin/slides/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error(`Failed to update slide: ${response.statusText}`)
    return response.json()
  }

  async deleteSlide(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/admin/slides/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error(`Failed to delete slide: ${response.statusText}`)
  }

  async toggleSlideStatus(id: number): Promise<Slide> {
    const response = await fetch(`${API_BASE_URL}/api/admin/slides/${id}/toggle`, {
      method: 'PATCH',
      headers: this.getHeaders(),
    })
    if (!response.ok) throw new Error(`Failed to toggle slide status: ${response.statusText}`)
    return response.json()
  }

  // Публично
  async getActiveSlides(): Promise<Slide[]> {
    const response = await fetch(`${API_BASE_URL}/api/slides`, { method: 'GET' })
    if (!response.ok) throw new Error(`Failed to fetch active slides: ${response.statusText}`)
    return response.json()
  }

  async uploadSlideImage(file: File): Promise<{ filename: string; path: string; originalName: string; size: number }>{
    const formData = new FormData()
    formData.append('image', file)

    const token = getAuthToken()
    const response = await fetch(`${API_BASE_URL}/api/admin/slides/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    })

    if (!response.ok) throw new Error(`Failed to upload slide image: ${response.statusText}`)
    return response.json()
  }
}

export const slidesAPI = new SlidesAPI()
