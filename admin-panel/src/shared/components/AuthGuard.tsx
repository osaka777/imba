"use client"

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { authUtils } from '@/shared/utils/auth'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      let token = authUtils.getToken()

      if (!token || token === 'demo-token') {
        token = await authUtils.fetchBackendToken()
        if (token) {
          authUtils.setToken(token)
        } else {
          setIsLoading(false)
          router.push('/login')
          return
        }
      }

      const isValid = await authUtils.verifyToken(token)

      if (!isValid) {
        authUtils.removeToken()
        const refreshed = await authUtils.fetchBackendToken()
        if (refreshed && (await authUtils.verifyToken(refreshed))) {
          authUtils.setToken(refreshed)
          setIsLoading(false)
          return
        }
        setIsLoading(false)
        router.push('/login')
        return
      }

      setIsLoading(false)
    }

    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Проверка авторизации...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
