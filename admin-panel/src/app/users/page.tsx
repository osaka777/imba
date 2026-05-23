"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { Table } from '@/widgets/Table'
import { Button } from '@/widgets/Button'
import { adminUsersAPI, User } from '@/shared/api/users'

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await adminUsersAPI.getAllUsers()
        setUsers(data || [])
      } catch (e: any) {
        console.error('Failed to fetch users:', e)
        setError('Не удалось загрузить список пользователей')
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU')
  }

  const columns = [
    { 
      header: 'ID', 
      accessor: 'id' as const,
      render: (user: User) => (
        <span className="font-mono text-sm">{user.id}</span>
      )
    },
    { 
      header: 'Email', 
      accessor: 'email' as const,
      render: (user: User) => (
        <span className="text-blue-600">{user.email}</span>
      )
    },
    { 
      header: 'Имя пользователя', 
      accessor: 'username' as const,
      render: (user: User) => (
        <span className="font-medium">{user.username}</span>
      )
    },
    { 
      header: 'Баланс', 
      accessor: 'totalBalance' as const,
      render: (user: User) => (
        <span className={`font-semibold ${user.totalBalance > 0 ? 'text-green-600' : 'text-gray-500'}`}>
          {formatCurrency(user.totalBalance)}
        </span>
      )
    },
    { 
      header: 'Бонусный баланс', 
      accessor: 'bonusBalance' as const,
      render: (user: User) => (
        <span className={`font-semibold ${user.bonusBalance > 0 ? 'text-purple-600' : 'text-gray-500'}`}>
          {formatCurrency(user.bonusBalance)}
        </span>
      )
    },
    { 
      header: 'Ставки', 
      accessor: 'totalBets' as const,
      render: (user: User) => (
        <div className="text-sm">
          <div>Всего: <span className="font-medium">{user.totalBets}</span></div>
          <div className="text-xs text-gray-500">
            Выигрыши: {user.winningBets} | Проигрыши: {user.losingBets}
          </div>
        </div>
      )
    },
    { 
      header: 'Винрейт', 
      accessor: 'winRate' as const,
      render: (user: User) => (
        <span className={`font-semibold ${
          user.winRate >= 60 ? 'text-green-600' : 
          user.winRate >= 40 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {user.winRate.toFixed(1)}%
        </span>
      )
    },
    { 
      header: 'Последняя активность', 
      accessor: 'updatedAt' as const,
      render: (user: User) => (
        <span className="text-sm text-gray-600">
          {formatDate(user.updatedAt)}
        </span>
      )
    },
    { 
      header: 'Действия', 
      accessor: 'id' as const,
      render: (user: User) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(`/users/${user.id}`)}
        >
          Подробнее
        </Button>
      )
    },
  ]

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">👥 Пользователи</h1>
            <p className="text-gray-600">Полный список пользователей с детальной статистикой</p>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600 text-xl">
                  👥
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Всего пользователей</p>
                  <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 text-green-600 text-xl">
                  💰
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Общий баланс</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(users.reduce((sum, user) => sum + user.totalBalance, 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600 text-xl">
                  🎁
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Бонусные средства</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(users.reduce((sum, user) => sum + user.bonusBalance, 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 text-xl">
                  🎯
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Всего ставок</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {users.reduce((sum, user) => sum + user.totalBets, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Загрузка пользователей...</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-red-600">{error}</div>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <Table<User> data={users} columns={columns} />
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}