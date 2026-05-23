"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { Button } from '@/widgets/Button'
import { Table } from '@/widgets/Table'
import { adminUsersAPI, UserDetails } from '@/shared/api/users'

export default function UserDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  
  const [user, setUser] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    const fetchUserDetails = async () => {
      try {
        const data = await adminUsersAPI.getUserDetails(userId)
        setUser(data)
      } catch (e: any) {
        console.error('Failed to fetch user details:', e)
        setError('Не удалось загрузить информацию о пользователе')
      } finally {
        setLoading(false)
      }
    }

    fetchUserDetails()
  }, [userId])

  const formatCurrency = (amount: number, currency: string = 'RUB') => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU')
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'win': return 'text-green-600 bg-green-100'
      case 'lose': return 'text-red-600 bg-red-100'
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'calculated': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const betsColumns = [
    { 
      header: 'ID', 
      accessor: 'id' as const,
      render: (bet: any) => (
        <span className="font-mono text-sm">{bet.id}</span>
      )
    },
    { 
      header: 'Сумма', 
      accessor: 'amount' as const,
      render: (bet: any) => (
        <span className="font-semibold">{formatCurrency(bet.amount, bet.currency || 'RUB')}</span>
      )
    },
    { 
      header: 'Коэффициент', 
      accessor: 'cf' as const,
      render: (bet: any) => (
        <span className="font-medium">{bet.cf}</span>
      )
    },
    { 
      header: 'Статус', 
      accessor: 'status' as const,
      render: (bet: any) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bet.status)}`}>
          {bet.status}
        </span>
      )
    },
    { 
      header: 'Тип', 
      accessor: 'betType' as const,
      render: (bet: any) => (
        <span className="text-sm">{bet.betType}</span>
      )
    },
    { 
      header: 'Игра', 
      accessor: 'game' as const,
      render: (bet: any) => (
        <div className="text-sm">
          {bet.game ? (
            <div>
              <div className="font-medium">{bet.game.eventName}</div>
              <div className="text-xs text-gray-500">{bet.game.team1} vs {bet.game.team2}</div>
            </div>
          ) : (
            <span className="text-gray-500">-</span>
          )}
        </div>
      )
    },
    { 
      header: 'Дата', 
      accessor: 'createdAt' as const,
      render: (bet: any) => (
        <span className="text-sm text-gray-600">{formatDate(bet.createdAt)}</span>
      )
    },
  ]

  const operationsColumns = [
    { 
      header: 'ID', 
      accessor: 'id' as const,
      render: (operation: any) => (
        <span className="font-mono text-sm">{operation.id}</span>
      )
    },
    { 
      header: 'Тип', 
      accessor: 'type' as const,
      render: (operation: any) => (
        <span className="font-medium">{operation.type}</span>
      )
    },
    { 
      header: 'Сумма', 
      accessor: 'amount' as const,
      render: (operation: any) => (
        <span className={`font-semibold ${operation.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {operation.amount > 0 ? '+' : ''}{formatCurrency(operation.amount, operation.currency || 'RUB')}
        </span>
      )
    },
    { 
      header: 'Валюта', 
      accessor: 'currency' as const,
      render: (operation: any) => (
        <span className="text-sm">{operation.currency}</span>
      )
    },
    { 
      header: 'Источник', 
      accessor: 'source' as const,
      render: (operation: any) => (
        <span className="text-sm">{operation.source}</span>
      )
    },
    { 
      header: 'Статус', 
      accessor: 'status' as const,
      render: (operation: any) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(operation.status)}`}>
          {operation.status}
        </span>
      )
    },
    { 
      header: 'Дата', 
      accessor: 'createdAt' as const,
      render: (operation: any) => (
        <span className="text-sm text-gray-600">{formatDate(operation.createdAt)}</span>
      )
    },
  ]

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">Загрузка информации о пользователе...</p>
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (error || !user) {
    return (
      <AuthGuard>
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-red-600">{error || 'Пользователь не найден'}</div>
            </div>
            <Button 
              variant="secondary" 
              onClick={() => router.push('/users')}
              className="mt-4"
            >
              ← Назад к списку пользователей
            </Button>
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Заголовок */}
          <div className="mb-6">
            <Button 
              variant="secondary" 
              onClick={() => router.push('/users')}
              className="mb-4"
            >
              ← Назад к списку пользователей
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              👤 Пользователь #{user.id}
            </h1>
            <p className="text-gray-600">Детальная информация и статистика</p>
          </div>

          {/* Основная информация */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">📋 Основная информация</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="text-lg font-medium text-blue-600">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Имя пользователя</label>
                  <p className="text-lg font-medium">{user.username}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Дата регистрации</label>
                  <p className="text-lg">{formatDate(user.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Последняя активность</label>
                  <p className="text-lg">{formatDate(user.updatedAt)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">💰 Балансы</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Основной баланс (все валюты)</label>
                  <div className="mt-1 space-y-1">
                    {(user as any).balances && (user as any).balances.length > 0 ? (
                      (user as any).balances.map((b: any) => (
                        <div key={`bal-${b.id}`} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{b.currency}</span>
                          <span className="font-semibold">{formatCurrency(b.amount, b.currency)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">Нет данных</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Бонусный баланс (все валюты)</label>
                  <div className="mt-1 space-y-1">
                    {(user as any).bonusBalances && (user as any).bonusBalances.length > 0 ? (
                      (user as any).bonusBalances.map((b: any) => (
                        <div key={`bb-${b.id}`} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{b.currency}</span>
                          <span className="font-semibold">{formatCurrency(b.amount, b.currency)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">Нет данных</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Статистика ставок */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">📊 Статистика ставок</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{user.statistics.totalBets}</p>
                <p className="text-sm text-gray-600">Всего ставок</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{user.statistics.winningBets}</p>
                <p className="text-sm text-gray-600">Выигрыши</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{user.statistics.losingBets}</p>
                <p className="text-sm text-gray-600">Проигрыши</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{user.statistics.pendingBets}</p>
                <p className="text-sm text-gray-600">В ожидании</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${
                  user.statistics.winRate >= 60 ? 'text-green-600' : 
                  user.statistics.winRate >= 40 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {user.statistics.winRate.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">Винрейт</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(user.statistics.totalBetAmount)}</p>
                <p className="text-sm text-gray-600">Сумма ставок</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(user.statistics.totalWinAmount)}</p>
                <p className="text-sm text-gray-600">Выигрыши</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${user.statistics.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(user.statistics.profit)}
                </p>
                <p className="text-sm text-gray-600">Прибыль</p>
              </div>
            </div>
          </div>

          {/* Последние ставки */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">🎯 Последние ставки</h2>
            {user.bets && user.bets.length > 0 ? (
              <Table data={user.bets} columns={betsColumns} />
            ) : (
              <p className="text-gray-500 text-center py-8">Ставки не найдены</p>
            )}
          </div>

          {/* Операции */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">💳 Финансовые операции</h2>
            {user.operations && user.operations.length > 0 ? (
              <Table data={user.operations} columns={operationsColumns} />
            ) : (
              <p className="text-gray-500 text-center py-8">Операции не найдены</p>
            )}
          </div>

          {/* Бонусы */}
          {user.bonuses && user.bonuses.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">🎁 Активные бонусы</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {user.bonuses.map((bonus, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium">{bonus.promoCode}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bonus.status)}`}>
                        {bonus.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Тип: {bonus.type}</p>
                    <p className="text-sm text-gray-600">Действует до: {formatDate(bonus.validUntil)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}