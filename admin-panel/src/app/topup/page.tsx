"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/widgets/Button'
import { Input } from '@/widgets/Input'
import { Table } from '@/widgets/Table'
import { toast } from 'react-toastify'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { apiCall } from '@/shared/utils/api'

interface TopupHistory {
  id: string
  email: string
  currencyCode: string
  amount: number
  createdAt: string
  status: string
}

export default function TopupPage() {
  const [formData, setFormData] = useState({
    email: '',
    currencyCode: 'USD',
    amount: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<TopupHistory[]>([])

  useEffect(() => {
    loadTopupHistory()
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email || !formData.currencyCode || !formData.amount) {
      toast.error('Заполните все поля')
      return
    }

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Введите корректную сумму')
      return
    }

    setIsLoading(true)
    try {
      const response = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/finance/topup/${formData.email}/${formData.currencyCode}/${amount}`, {
        method: 'GET'
      })

      if (response.ok) {
        toast.success('Пополнение выполнено успешно!')
        setFormData(prev => ({ ...prev, amount: '' }))
        loadTopupHistory()
      } else {
        const errorText = await response.text()
        toast.error(`Ошибка пополнения: ${errorText}`)
      }
    } catch (error: any) {
      toast.error(`Ошибка подключения: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const loadTopupHistory = async () => {
    try {
      const response = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/finance/topup/history`)
      if (response.ok) {
        const historyData = await response.json()
        setHistory(historyData)
      } else {
        console.error('Ошибка загрузки истории пополнений')
      }
    } catch (error) {
      console.error('Ошибка загрузки истории:', error)
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

  const historyColumns = [
    { header: 'Email', accessor: 'email' as keyof TopupHistory },
    { header: 'Валюта', accessor: 'currencyCode' as keyof TopupHistory },
    { header: 'Сумма', accessor: 'amount' as keyof TopupHistory, render: (item: TopupHistory) => 
      formatCurrency(item.amount, item.currencyCode)
    },
    { header: 'Дата', accessor: 'createdAt' as keyof TopupHistory, render: (item: TopupHistory) => 
      formatDate(item.createdAt)
    },
    { header: 'Статус', accessor: 'status' as keyof TopupHistory, render: (item: TopupHistory) => {
      const statusClasses = {
        'completed': 'bg-green-100 text-green-800',
        'pending': 'bg-yellow-100 text-yellow-800',
        'failed': 'bg-red-100 text-red-800'
      }
      const statusNames = {
        'completed': 'Выполнено',
        'pending': 'В обработке',
        'failed': 'Ошибка'
      }
      return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[item.status as keyof typeof statusClasses] || 'bg-gray-100 text-gray-800'}`}>
          {statusNames[item.status as keyof typeof statusNames] || item.status}
        </span>
      )
    }}
  ]

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">💰 Пополнение баланса</h1>
            <p className="text-gray-600">Ручное пополнение баланса пользователей</p>
          </div>

          {/* Форма пополнения */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Пополнить баланс</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email пользователя *
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="currencyCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Валюта *
                  </label>
                  <select
                    id="currencyCode"
                    value={formData.currencyCode}
                    onChange={(e) => handleInputChange('currencyCode', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="USD">USD (Доллар США)</option>
                    <option value="RUB">RUB (Рубль)</option>
                    <option value="UAH">UAH (Гривна)</option>
                    <option value="KZT">KZT (Тенге)</option>
                    <option value="TRY">TRY (Турецкая лира)</option>
                    <option value="UZS">UZS (Узбекский сум)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Сумма *
                  </label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    placeholder="100.00"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? 'Пополнение...' : 'Пополнить баланс'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, amount: '' }))}
                  variant="secondary"
                  className="flex-1"
                >
                  Очистить сумму
                </Button>
              </div>
            </form>
          </div>

          {/* История пополнений */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">История пополнений</h2>
              <Button onClick={loadTopupHistory}>
                Обновить
              </Button>
            </div>
            
            <Table data={history} columns={historyColumns} />
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Информация</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Пополнение происходит мгновенно</li>
              <li>• Сумма добавляется к текущему балансу пользователя</li>
              <li>• Все операции записываются в историю</li>
              <li>• Поддерживаются основные валюты</li>
            </ul>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}





