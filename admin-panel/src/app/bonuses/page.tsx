"use client"

import { useState, useEffect } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { bonusAPI, Bonus } from '@/shared/api/bonuses'
import { adminAffiliatePartnersAPI } from '@/shared/api/affiliatePartners'

interface EnhancedBonusForm {
  promoCode: string
  bonusType: 'DIRECT_BONUS' | 'DEPOSIT_BONUS' | 'VOUCHER'
  bonusCurrency: string
  couponCount: string
  bonusPercentage: string
  bonusAmount: string
  partnerPercentage: string
  minDeposit: string
  startDate: string
  endDate: string
  partnerId: string
  totalTokens: string
  tokensPerBet: string
  tokenMinOdds: string
  userEmail: string
  description: string
}

export default function BonusesPage() {
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState<any[]>([])
  const [manageCode, setManageCode] = useState('')
  const [usages, setUsages] = useState<{ userId: number; userEmail: string; status: string }[] | null>(null)
  const [usagesMeta, setUsagesMeta] = useState<{ code: string; available: number; remaining: number; type: string } | null>(null)
  const [usagesLoading, setUsagesLoading] = useState(false)
  const [grantEmail, setGrantEmail] = useState('')
  const [newBonus, setNewBonus] = useState<EnhancedBonusForm>({
    promoCode: '',
    bonusType: 'DIRECT_BONUS',
    bonusCurrency: 'RUB',
    couponCount: '100',
    bonusPercentage: '50',
    bonusAmount: '1000',
    partnerPercentage: '10',
    minDeposit: '500',
    startDate: new Date().toISOString().slice(0, 16),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    partnerId: '',
    totalTokens: '4',
    tokensPerBet: '1',
    tokenMinOdds: '1.8',
    userEmail: '',
    description: ''
  })

  useEffect(() => {
    fetchBonuses()
    adminAffiliatePartnersAPI.getPartners(500).then(setPartners).catch(console.error)
  }, [])

  const fetchBonuses = async () => {
    try {
      const response = await bonusAPI.getAllBonuses()
      setBonuses(response.bonuses)
    } catch (error) {
      console.error('Failed to fetch bonuses:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadPromoUsages() {
    if (!manageCode) {
      alert('Введите промо-код для управления')
      return
    }
    setUsagesLoading(true)
    try {
      const data = await bonusAPI.getPromoUsages(manageCode)
      setUsages(data.usages)
      setUsagesMeta({ code: data.promo.code, available: data.promo.available, remaining: data.promo.remaining, type: data.promo.type })
    } catch (e) {
      console.error(e)
      alert('Не удалось загрузить использования')
    } finally {
      setUsagesLoading(false)
    }
  }

  async function handleGrantManual() {
    if (!manageCode || !grantEmail) {
      alert('Укажите промо-код и email')
      return
    }
    try {
      const res = await bonusAPI.grantPromoManually(manageCode, grantEmail)
      alert(`Выдано: ${res.bonusAmount} ${res.bonusCurrency}, жетоны: ${res.totalTokens}`)
      setGrantEmail('')
      await loadPromoUsages()
    } catch (e) {
      console.error(e)
      alert('Не удалось выдать бонус')
    }
  }

  async function handleCancelUsage(userEmail: string) {
    if (!manageCode) return
    try {
      await bonusAPI.cancelPromoUsage(manageCode, userEmail)
      await loadPromoUsages()
    } catch (e) {
      console.error(e)
      alert('Не удалось отменить использование')
    }
  }

  const generatePromoCode = () => {
    const code = 'PROMO' + Date.now().toString().slice(-6)
    setNewBonus({ ...newBonus, promoCode: code })
  }

  const validateForm = (): string | null => {
    if (!newBonus.promoCode) return 'Введите промо-код'
    if (!/^[a-zA-Z0-9]+$/.test(newBonus.promoCode)) return 'Промо-код должен содержать только буквы и цифры'
    if (parseInt(newBonus.couponCount) <= 0) return 'Количество купонов должно быть больше 0'
    if (new Date(newBonus.startDate) >= new Date(newBonus.endDate)) return 'Дата начала должна быть раньше даты окончания'
    if (new Date(newBonus.endDate) <= new Date()) return 'Дата окончания должна быть в будущем'
    
    if (newBonus.bonusType === 'DIRECT_BONUS') {
      if (parseFloat(newBonus.bonusAmount) <= 0) return 'Сумма бонуса должна быть больше 0'
    } else if (newBonus.bonusType === 'DEPOSIT_BONUS') {
      if (parseFloat(newBonus.bonusPercentage) <= 0) return 'Процент бонуса должен быть больше 0'
      if (parseFloat(newBonus.minDeposit) <= 0) return 'Минимальная сумма депозита должна быть больше 0'
      if (parseInt(newBonus.totalTokens) <= 0) return 'Количество жетонов должно быть больше 0'
      if (parseInt(newBonus.tokensPerBet) <= 0 || parseInt(newBonus.tokensPerBet) > parseInt(newBonus.totalTokens)) return 'Неверное количество жетонов за ставку'
      if (parseFloat(newBonus.tokenMinOdds) < 1.01) return 'Минимальный коэффициент должен быть не менее 1.01'
    } else if (newBonus.bonusType === 'VOUCHER') {
      if (parseFloat(newBonus.bonusAmount) <= 0) return 'Сумма бонуса должна быть больше 0'
      if (parseInt(newBonus.totalTokens) <= 0) return 'Количество жетонов должно быть больше 0'
      if (parseInt(newBonus.tokensPerBet) <= 0 || parseInt(newBonus.tokensPerBet) > parseInt(newBonus.totalTokens)) return 'Неверное количество жетонов за ставку'
      if (parseFloat(newBonus.tokenMinOdds) < 1.01) return 'Минимальный коэффициент должен быть не менее 1.01'
    }
    
    return null
  }

  const handleCreateBonus = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      alert(validationError)
      return
    }
    
    try {
      // Map the enhanced form to the API format
      // Для DEPOSIT_BONUS amount не используется - процент применяется к реальной сумме депозита
      const amount = newBonus.bonusType === 'DIRECT_BONUS' || newBonus.bonusType === 'VOUCHER' 
        ? parseFloat(newBonus.bonusAmount)
        : 0
      
      await bonusAPI.createBonus({
        userEmail: newBonus.userEmail || undefined,
        amount: amount,
        type: newBonus.bonusType.toLowerCase().replace('_', '-'),
        description: `${newBonus.promoCode} - ${newBonus.description || getBonusTypeLabel(newBonus.bonusType)}`,
        currencyCode: newBonus.bonusCurrency,
        promoCode: newBonus.promoCode,
        bonusType: newBonus.bonusType,
        bonusCurrency: newBonus.bonusCurrency,
        couponCount: newBonus.couponCount,
        bonusPercentage: newBonus.bonusType === 'DEPOSIT_BONUS' ? newBonus.bonusPercentage : undefined,
        bonusAmount: newBonus.bonusType !== 'DEPOSIT_BONUS' ? newBonus.bonusAmount : undefined,
        partnerPercentage: newBonus.partnerPercentage,
        minDeposit: newBonus.minDeposit,
        startDate: newBonus.startDate,
        endDate: newBonus.endDate,
        partnerId: newBonus.partnerId,
        totalTokens: newBonus.totalTokens,
        tokensPerBet: newBonus.tokensPerBet,
        tokenMinOdds: newBonus.tokenMinOdds,
      })
      
      // Reset form
      setNewBonus({
        promoCode: '',
        bonusType: 'DIRECT_BONUS',
        bonusCurrency: 'RUB',
        couponCount: '100',
        bonusPercentage: '50',
        bonusAmount: '1000',
        partnerPercentage: '10',
        minDeposit: '500',
        startDate: new Date().toISOString().slice(0, 16),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        partnerId: '',
        totalTokens: '4',
        tokensPerBet: '1',
        tokenMinOdds: '1.8',
        userEmail: '',
        description: ''
      })
      
      fetchBonuses()
      alert('Бонус создан успешно!')
    } catch (error) {
      console.error('Failed to create bonus:', error)
      alert('Ошибка создания бонуса')
    }
  }

  const handleStatusChange = async (bonusId: string, newStatus: 'approved' | 'rejected') => {
    try {
      if (newStatus === 'approved') {
        await bonusAPI.approveBonus(bonusId)
      } else {
        await bonusAPI.rejectBonus(bonusId)
      }
      fetchBonuses() // Refresh the list
    } catch (error) {
      console.error('Failed to update bonus status:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getBonusTypeLabel = (type: string) => {
    const typeLabels = {
      'DIRECT_BONUS': 'Прямой бонус',
      'DEPOSIT_BONUS': 'Депозитный бонус', 
      'VOUCHER': 'Ваучер',
      'deposit': 'Депозитный',
      'welcome': 'Приветственный',
      'loyalty': 'Лояльности',
      'referral': 'Реферальный'
    }
    return typeLabels[type as keyof typeof typeLabels] || type
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      waiting: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Ожидает' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Ожидает' },
      success: { bg: 'bg-green-100', text: 'text-green-800', label: 'Одобрен' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Одобрен' },
      failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Отклонен' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Отклонен' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig]
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Управление бонусами</h1>
            <p className="text-gray-600">
              Создание и управление бонусами для пользователей
            </p>
          </div>

          {/* Create Bonus Form */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Создать новый бонус</h2>
            <form onSubmit={handleCreateBonus} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Промо-код</label>
                  <div className="flex">
                    <input
                      type="text"
                      value={newBonus.promoCode}
                      onChange={(e) => setNewBonus({ ...newBonus, promoCode: e.target.value.toUpperCase() })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Введите код или сгенерируйте"
                      required
                    />
                    <button
                      type="button"
                      onClick={generatePromoCode}
                      className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200 text-sm"
                    >
                      Генерировать
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип бонуса</label>
                  <select
                    value={newBonus.bonusType}
                    onChange={(e) => setNewBonus({ ...newBonus, bonusType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DIRECT_BONUS">Прямой бонус</option>
                    <option value="DEPOSIT_BONUS">Депозитный бонус</option>
                    <option value="VOUCHER">Ваучер</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Количество купонов</label>
                  <input
                    type="number"
                    value={newBonus.couponCount}
                    onChange={(e) => setNewBonus({ ...newBonus, couponCount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Партнёр (атрибуция)</label>
                  <select
                    value={newBonus.partnerId}
                    onChange={(e) => setNewBonus({ ...newBonus, partnerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Без партнёра</option>
                    {partners.map((p) => (
                      <option key={p.userId} value={String(p.userId)}>
                        {p.email} ({p.uid.slice(0, 8)}…)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* User Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email пользователя</label>
                  <input
                    type="email"
                    value={newBonus.userEmail}
                    onChange={(e) => setNewBonus({ ...newBonus, userEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                  <input
                    type="text"
                    value={newBonus.description}
                    onChange={(e) => setNewBonus({ ...newBonus, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Дополнительное описание бонуса"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
                  <input
                    type="datetime-local"
                    value={newBonus.startDate}
                    onChange={(e) => setNewBonus({ ...newBonus, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания</label>
                  <input
                    type="datetime-local"
                    value={newBonus.endDate}
                    onChange={(e) => setNewBonus({ ...newBonus, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Bonus Type Specific Fields */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Настройки {getBonusTypeLabel(newBonus.bonusType)}</h3>
                {newBonus.bonusType === 'DIRECT_BONUS' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Сумма бонуса</label>
                      <input
                        type="number"
                        value={newBonus.bonusAmount}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusAmount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
                      <select
                        value={newBonus.bonusCurrency}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusCurrency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="RUB">RUB</option>
                        <option value="USD">USD</option>
                        <option value="UAH">UAH</option>
                        <option value="KZT">KZT</option>
                        <option value="TRY">TRY</option>
                        <option value="UZS">UZS</option>
                      </select>
                    </div>
                  </div>
                )}

                {newBonus.bonusType === 'DEPOSIT_BONUS' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Процент бонуса (%)</label>
                      <input
                        type="number"
                        value={newBonus.bonusPercentage}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusPercentage: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Мин. депозит</label>
                      <input
                        type="number"
                        value={newBonus.minDeposit}
                        onChange={(e) => setNewBonus({ ...newBonus, minDeposit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Процент партнера (%)</label>
                      <input
                        type="number"
                        value={newBonus.partnerPercentage}
                        onChange={(e) => setNewBonus({ ...newBonus, partnerPercentage: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
                      <select
                        value={newBonus.bonusCurrency}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusCurrency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="RUB">RUB</option>
                        <option value="USD">USD</option>
                        <option value="UAH">UAH</option>
                        <option value="KZT">KZT</option>
                        <option value="TRY">TRY</option>
                        <option value="UZS">UZS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Всего жетонов</label>
                      <input
                        type="number"
                        value={newBonus.totalTokens}
                        onChange={(e) => setNewBonus({ ...newBonus, totalTokens: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Жетонов за ставку</label>
                      <input
                        type="number"
                        value={newBonus.tokensPerBet}
                        onChange={(e) => setNewBonus({ ...newBonus, tokensPerBet: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Мин. коэффициент</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newBonus.tokenMinOdds}
                        onChange={(e) => setNewBonus({ ...newBonus, tokenMinOdds: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1.01"
                        required
                      />
                    </div>
                  </div>
                )}

                {newBonus.bonusType === 'VOUCHER' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Сумма бонуса</label>
                      <input
                        type="number"
                        value={newBonus.bonusAmount}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusAmount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Процент партнера (%)</label>
                      <input
                        type="number"
                        value={newBonus.partnerPercentage}
                        onChange={(e) => setNewBonus({ ...newBonus, partnerPercentage: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
                      <select
                        value={newBonus.bonusCurrency}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusCurrency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="RUB">RUB</option>
                        <option value="USD">USD</option>
                        <option value="UAH">UAH</option>
                        <option value="KZT">KZT</option>
                        <option value="TRY">TRY</option>
                        <option value="UZS">UZS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Всего жетонов</label>
                      <input
                        type="number"
                        value={newBonus.totalTokens}
                        onChange={(e) => setNewBonus({ ...newBonus, totalTokens: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Жетонов за ставку</label>
                      <input
                        type="number"
                        value={newBonus.tokensPerBet}
                        onChange={(e) => setNewBonus({ ...newBonus, tokensPerBet: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Мин. коэффициент</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newBonus.tokenMinOdds}
                        onChange={(e) => setNewBonus({ ...newBonus, tokenMinOdds: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1.01"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Создать бонус
                </button>
              </div>
            </form>
          </div>

          {/* Bonuses Table */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Список бонусов</h3>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Промо-код</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Валюта</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Доступно</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Осталось</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата начала</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Окончание</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email партнёра</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bonuses.map((bonus) => {
                      const isPromo = String(bonus.id).startsWith('promo_');
                      const amountText = typeof bonus.amount === 'number' ? bonus.amount : 0;
                      const currency = (bonus as any).currencyCode || 'RUB';
                      const available = (bonus as any).available ?? (isPromo ? 0 : 1);
                      const remaining = (bonus as any).remaining ?? (isPromo ? 0 : 0);
                      const promoCode = (bonus as any).promoCode || '';
                      const startDate = (bonus as any).startDate || bonus.createdAt;
                      const endDate = (bonus as any).endDate || '';
                      const partnerEmail = (bonus as any).partnerId || '';
                      
                      return (
                        <tr key={bonus.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{promoCode}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bonus.type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{amountText}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{currency}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{available}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{remaining}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(startDate).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{endDate ? new Date(endDate).toLocaleString() : ''}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{partnerEmail}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(bonus.status)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {!isPromo && (bonus.status === 'pending' || bonus.status === 'waiting') && (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleStatusChange(bonus.id, 'approved')}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Одобрить
                                </button>
                                <button
                                  onClick={() => handleStatusChange(bonus.id, 'rejected')}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Отклонить
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Promo usages management */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Управление использованием промо-кода</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Промо-код</label>
                <input
                  type="text"
                  value={manageCode}
                  onChange={(e) => setManageCode(e.target.value.trim())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите код"
                />
              </div>
              <div>
                <button
                  onClick={loadPromoUsages}
                  className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md border border-gray-300"
                >
                  Показать использования
                </button>
              </div>
              <div className="md:col-span-1"></div>
            </div>

            {usagesLoading && (
              <div className="mt-4 text-sm text-gray-500">Загрузка...</div>
            )}

            {usagesMeta && (
              <div className="mt-4 text-sm text-gray-700">
                <div><b>Код:</b> {usagesMeta.code}</div>
                <div><b>Тип:</b> {usagesMeta.type}</div>
                <div><b>Доступно:</b> {usagesMeta.available}</div>
                <div><b>Осталось:</b> {usagesMeta.remaining}</div>
              </div>
            )}

            {usages && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Кто использовал</h3>
                {usages.length === 0 ? (
                  <div className="text-sm text-gray-500">Нет использований</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {usages.map((u) => (
                          <tr key={`${u.userId}-${u.userEmail}`}>
                            <td className="px-4 py-2 text-sm">{u.userEmail}</td>
                            <td className="px-4 py-2 text-sm">{u.status}</td>
                            <td className="px-4 py-2 text-sm">
                              <button
                                onClick={() => handleCancelUsage(u.userEmail)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Отменить
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Выдать вручную (email)</label>
                    <input
                      type="email"
                      value={grantEmail}
                      onChange={(e) => setGrantEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <button
                      onClick={handleGrantManual}
                      className="w-full bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700"
                    >
                      Выдать бонус
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
