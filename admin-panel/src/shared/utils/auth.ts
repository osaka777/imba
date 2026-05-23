export const authUtils = {
  // Получить токен из localStorage
  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('authToken')
  },

  // Сохранить токен в localStorage и cookies
  setToken(token: string): void {
    if (typeof window === 'undefined') return
    
    localStorage.setItem('authToken', token)
    document.cookie = `authToken=${token}; path=/; max-age=${60 * 60 * 24 * 7}` // 7 дней
  },

  // Удалить токен из localStorage и cookies
  removeToken(): void {
    if (typeof window === 'undefined') return
    
    localStorage.removeItem('authToken')
    document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  },

  // Проверить токен через API
  async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/verify-superuser`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        return result.valid === true
      }
      
      return false
    } catch (error) {
      return false
    }
  },

  // Получить backend-токен после Google OAuth (только для авторизованных email)
  async fetchBackendToken(): Promise<string | null> {
    try {
      const response = await fetch('/api/auth/complete')
      if (!response.ok) return null
      const data = await response.json()
      return data.token || null
    } catch {
      return null
    }
  },

  // Выйти из системы
  async logout(): Promise<void> {
    this.removeToken()
    if (typeof window !== 'undefined') {
      const { signOut } = await import('next-auth/react')
      await signOut({ callbackUrl: '/login' })
    }
  },
}
