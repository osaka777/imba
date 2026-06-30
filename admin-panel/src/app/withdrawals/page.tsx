"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/widgets/Button'
import { Table } from '@/widgets/Table'
import { toast } from 'react-toastify'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { apiCall } from '@/shared/utils/api'

interface Withdrawal {
  id: string
  userId: string
  userEmail: string
  amount: number
  currency: string
  method: string
  cardNumber: string
  cardType?: string
  reason?: string
  createdAt: string
  status: string
  processedAt?: string
  isAffiliate?: boolean
  requiresReview?: boolean
  meta?: {
    method?: string
    cardType?: string
    cardNumber?: string
    title?: string
    withdrawalId?: number
  }
}

// Основные методы вывода
const WITHDRAWAL_METHODS = {
  CARD: 'CARD',
  CRYPTO: 'CRYPTO'
}

// Типы карт и криптовалют (соответствует enum CardType в backend)
const CARD_TYPES = {
  FOREIGN: 'FOREIGN',
  KAZAKHSTAN: 'KAZAKHSTAN',
  TRC20: 'TRC20',
  TRON: 'TRON'
}

// Названия методов
const METHOD_NAMES = {
  [WITHDRAWAL_METHODS.CARD]: 'Банковская карта',
  [WITHDRAWAL_METHODS.CRYPTO]: 'Криптовалюта',
  affiliate: 'Партнёрский (USDT)',
}

// Названия типов карт и криптовалют
const CARD_TYPE_NAMES = {
  [CARD_TYPES.FOREIGN]: 'Зарубежная карта',
  [CARD_TYPES.KAZAKHSTAN]: 'Карта Казахстана',
  [CARD_TYPES.TRC20]: 'TRC-20',
  [CARD_TYPES.TRON]: 'TRON'
}

// Для обратной совместимости со старыми типами
const LEGACY_WITHDRAWAL_TYPES = {
  CARD: 'card',
  CARDS_RU: 'cards_ru',
  CARDS_FOREIGN: 'cards_foreign',
  CARDS_KZ: 'cards_kz',
  CARDS_UA: 'cards_ua',
  SBP: 'sbp',
  USDT: 'usdt',
  USDT_TRC20: 'usdt_trc20',
  USDT_TRON: 'usdt_tron',
  NIRVANAPAY: 'NIRVANAPAY',
  MANUAL: 'manual'
}

const LEGACY_TYPE_NAMES = {
  [LEGACY_WITHDRAWAL_TYPES.CARD]: 'Карта',
  [LEGACY_WITHDRAWAL_TYPES.CARDS_RU]: 'Карта (РФ)',
  [LEGACY_WITHDRAWAL_TYPES.CARDS_FOREIGN]: 'Карта (Зарубеж)',
  [LEGACY_WITHDRAWAL_TYPES.CARDS_KZ]: 'Карта (Казахстан)',
  [LEGACY_WITHDRAWAL_TYPES.CARDS_UA]: 'Карта (Украина)',
  [LEGACY_WITHDRAWAL_TYPES.SBP]: 'СБП',
  [LEGACY_WITHDRAWAL_TYPES.USDT]: 'USDT',
  [LEGACY_WITHDRAWAL_TYPES.USDT_TRC20]: 'USDT TRC-20',
  [LEGACY_WITHDRAWAL_TYPES.USDT_TRON]: 'USDT TRON',
  [LEGACY_WITHDRAWAL_TYPES.NIRVANAPAY]: 'NirvanaPay (KZT)',
  [LEGACY_WITHDRAWAL_TYPES.MANUAL]: 'Ручной'
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [filteredWithdrawals, setFilteredWithdrawals] = useState<Withdrawal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    loadWithdrawals()
  }, [])

  useEffect(() => {
    filterWithdrawals()
  }, [withdrawals, activeFilter])

  const loadWithdrawals = async () => {
    setIsLoading(true)
    try {
      const response = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/all`)
      if (response.ok) {
        const result = await response.json()
        // API возвращает объект с полем data, которое содержит массив
        setWithdrawals(result.data || [])
      } else {
        toast.error('Ошибка загрузки выводов')
      }
    } catch (error: any) {
      toast.error(`Ошибка подключения: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const filterWithdrawals = () => {
    if (activeFilter === 'all') {
      setFilteredWithdrawals(withdrawals)
    } else {
      setFilteredWithdrawals(withdrawals.filter(w => w.status === activeFilter))
    }
  }

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter)
  }

  const approveWithdrawal = async (id: string) => {
    try {
      const response = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/${id}/approve`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Вывод одобрен')
        loadWithdrawals()
      } else {
        const errorText = await response.text()
        toast.error(`Ошибка одобрения: ${errorText}`)
      }
    } catch (error: any) {
      toast.error(`Ошибка подключения: ${error.message}`)
    }
  }

  const rejectWithdrawal = async (id: string, reason: string) => {
    if (!reason.trim()) {
      toast.error('Укажите причину отклонения')
      return
    }

    try {
      const response = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason })
      })

      if (response.ok) {
        toast.success('Вывод отклонен')
        loadWithdrawals()
      } else {
        const errorText = await response.text()
        toast.error(`Ошибка отклонения: ${errorText}`)
      }
    } catch (error: any) {
      toast.error(`Ошибка подключения: ${error.message}`)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pending': {
        classes: 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300',
        icon: '⏳',
        name: 'Ожидает'
      },
      'completed': {
        classes: 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-300',
        icon: '✅',
        name: 'Выполнен'
      },
      'rejected': {
        classes: 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-300',
        icon: '❌',
        name: 'Отклонен'
      },
      'processing': {
        classes: 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-300',
        icon: '🔄',
        name: 'В обработке'
      }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || {
      classes: 'bg-gray-100 text-gray-800 border border-gray-300',
      icon: '❓',
      name: status
    }
    
    return (
      <span className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full shadow-sm ${config.classes}`}>
        <span className="mr-1.5">{config.icon}</span>
        {config.name}
      </span>
    )
  }

  const withdrawalColumns = [
    { header: 'ID', accessor: 'id' as keyof Withdrawal, render: (item: Withdrawal) => (
      <span className="font-mono text-sm">{item.id}</span>
    )},
    { header: 'Пользователь', accessor: 'userEmail' as keyof Withdrawal, render: (item: Withdrawal) => (
      <div className="flex flex-col gap-1">
        <span>{item.userEmail}</span>
        {item.isAffiliate && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 w-fit">
            affiliate
          </span>
        )}
        {item.requiresReview && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 w-fit">
            первый вывод
          </span>
        )}
      </div>
    )},
    { header: 'Сумма', accessor: 'amount' as keyof Withdrawal, render: (item: Withdrawal) => 
      formatCurrency(item.amount, item.currency)
    },
    { header: 'Метод', accessor: 'method' as keyof Withdrawal, render: (item: Withdrawal) => {
      // Получаем название метода (CARD/CRYPTO)
      const methodName = METHOD_NAMES[item.method as keyof typeof METHOD_NAMES];
      
      // Получаем название типа карты/криптовалюты из поля cardType (которое соответствует полю bank в backend)
      const typeName = item.cardType ? CARD_TYPE_NAMES[item.cardType as keyof typeof CARD_TYPE_NAMES] : null;
      
      // Fallback для старых записей
      const legacyName = LEGACY_TYPE_NAMES[item.method as keyof typeof LEGACY_TYPE_NAMES];
      
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {methodName || legacyName || item.method}
          </span>
          {typeName && (
            <span className={`text-xs mt-1 ${
              item.method === 'CARD' ? 'text-blue-600' : 'text-green-600'
            }`}>
              {typeName}
            </span>
          )}
          {!typeName && item.method === 'CRYPTO' && (
            <span className="text-xs text-green-600 mt-1">
              Криптовалюта
            </span>
          )}
        </div>
      );
    }},
    { header: 'Кошелек/Карта', accessor: 'cardNumber' as keyof Withdrawal, render: (item: Withdrawal) => (
      <div className="max-w-xs">
        {item.cardNumber && item.cardNumber.trim() ? 
          <div 
            className="bg-gray-50 rounded-lg p-3 border border-gray-200 cursor-help hover:bg-gray-100 transition-colors" 
            title={item.cardNumber}
          >
            <span className="text-gray-900 break-all font-mono text-xs">
              {item.cardNumber}
            </span>
          </div> :
          <span className="text-gray-400 italic">Не указан</span>
        }
      </div>
    )},
    { header: 'Дата', accessor: 'createdAt' as keyof Withdrawal, render: (item: Withdrawal) => 
      formatDate(item.createdAt)
    },
    { header: 'Статус', accessor: 'status' as keyof Withdrawal, render: (item: Withdrawal) => 
      getStatusBadge(item.status)
    },
    { header: 'Причина отклонения', accessor: 'reason' as keyof Withdrawal, render: (item: Withdrawal) => (
      <div className="max-w-xs">
        {item.reason ? 
          <div 
            className="bg-red-50 rounded-lg p-3 border border-red-200 cursor-help hover:bg-red-100 transition-colors" 
            title={item.reason}
          >
            <span className="text-red-700 text-xs break-words">
              {item.reason.length > 50 ? `${item.reason.slice(0, 50)}...` : item.reason}
            </span>
          </div> :
          <span className="text-gray-400 text-sm">-</span>
        }
      </div>
    )},
    { header: 'Действия', accessor: 'id' as keyof Withdrawal, render: (item: Withdrawal) => {
      if (item.status === 'pending') {
        return (
          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
            <button
              onClick={() => approveWithdrawal(item.id)}
              className="inline-flex items-center justify-center px-2 md:px-3 py-1.5 md:py-2 text-xs font-medium text-white bg-gradient-to-r from-green-500 to-green-600 rounded-lg hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 transition-all duration-200 shadow-sm min-w-0"
            >
              <span className="mr-1">✅</span>
              <span className="hidden sm:inline">Одобрить</span>
              <span className="sm:hidden">✓</span>
            </button>
            <button
              onClick={() => {
                const reason = prompt('Укажите причину отклонения:')
                if (reason) {
                  rejectWithdrawal(item.id, reason)
                }
              }}
              className="inline-flex items-center justify-center px-2 md:px-3 py-1.5 md:py-2 text-xs font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-lg hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-all duration-200 shadow-sm min-w-0"
            >
              <span className="mr-1">❌</span>
              <span className="hidden sm:inline">Отклонить</span>
              <span className="sm:hidden">✗</span>
            </button>
          </div>
        )
      }
      return (
        <span className="text-gray-500 text-sm">
          {item.status === 'completed' ? 'Выполнен' : 
           item.status === 'rejected' ? 'Отклонен' : 'В обработке'}
        </span>
      )
    }}
  ]

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">💳 Управление выводами</h1>
            <p className="text-gray-600">Одобрение и отклонение заявок на вывод средств</p>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
              <div className="flex items-center">
                <div className="p-2 md:p-3 rounded-full bg-blue-100 text-blue-600 text-lg md:text-xl">
                  📊
                </div>
                <div className="ml-3 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-600">Всего заявок</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">{withdrawals.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
               <div className="flex items-center">
                 <div className="p-2 md:p-3 rounded-full bg-yellow-100 text-yellow-600 text-lg md:text-xl">
                   ⏳
                 </div>
                 <div className="ml-3 md:ml-4">
                   <p className="text-xs md:text-sm font-medium text-gray-600">Ожидающие</p>
                   <p className="text-xl md:text-2xl font-bold text-gray-900">{withdrawals.filter(w => w.status === 'pending').length}</p>
                 </div>
               </div>
             </div>
             <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
               <div className="flex items-center">
                 <div className="p-2 md:p-3 rounded-full bg-green-100 text-green-600 text-lg md:text-xl">
                   ✅
                 </div>
                 <div className="ml-3 md:ml-4">
                   <p className="text-xs md:text-sm font-medium text-gray-600">Выполненные</p>
                   <p className="text-xl md:text-2xl font-bold text-gray-900">{withdrawals.filter(w => w.status === 'completed').length}</p>
                 </div>
               </div>
             </div>
             <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
               <div className="flex items-center">
                 <div className="p-2 md:p-3 rounded-full bg-red-100 text-red-600 text-lg md:text-xl">
                   ❌
                 </div>
                 <div className="ml-3 md:ml-4">
                   <p className="text-xs md:text-sm font-medium text-gray-600">Отклоненные</p>
                   <p className="text-xl md:text-2xl font-bold text-gray-900">{withdrawals.filter(w => w.status === 'rejected').length}</p>
                 </div>
               </div>
             </div>
          </div>

          {/* Фильтры */}
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-8">
            <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Фильтры</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Все' },
                { key: 'pending', label: 'Ожидающие' },
                { key: 'completed', label: 'Выполненные' },
                { key: 'rejected', label: 'Отклоненные' },
                { key: 'processing', label: 'В обработке' }
              ].map(filter => (
                <Button
                  key={filter.key}
                  onClick={() => handleFilterChange(filter.key)}
                  variant={activeFilter === filter.key ? 'primary' : 'secondary'}
                  size="sm"
                  className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Список выводов */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-base md:text-xl font-semibold">
                  Выводы {activeFilter !== 'all' && `(${filteredWithdrawals.length})`}
                </h2>
                <Button onClick={loadWithdrawals} disabled={isLoading}>
                  Обновить
                </Button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <Table data={filteredWithdrawals} columns={withdrawalColumns} />
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Информация</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Ожидающие</strong> - заявки, требующие одобрения администратора</li>
              <li>• <strong>Выполненные</strong> - успешно обработанные выводы</li>
              <li>• <strong>Отклоненные</strong> - заявки, отклоненные администратором</li>
              <li>• <strong>В обработке</strong> - заявки, отправленные в обработку</li>
            </ul>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}





