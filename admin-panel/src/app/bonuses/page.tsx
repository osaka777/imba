"use client"

import { useState, useEffect } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { bonusAPI, Bonus } from '@/shared/api/bonuses'
import { BonusAnalyticsDashboard } from '@/widgets/bonuses/BonusAnalyticsDashboard'
import { adminAffiliatePartnersAPI } from '@/shared/api/affiliatePartners'
import { formatMoney } from '@/shared/lib/format'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'
import { toast } from 'react-toastify'

const fieldClass =
  'w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30'

const btnPrimary =
  'rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90'

const btnSecondary =
  'rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent'

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
    bonusCurrency: 'KZT',
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
      toast.error('Введите промо-код для управления')
      return
    }
    setUsagesLoading(true)
    try {
      const data = await bonusAPI.getPromoUsages(manageCode)
      setUsages(data.usages)
      setUsagesMeta({ code: data.promo.code, available: data.promo.available, remaining: data.promo.remaining, type: data.promo.type })
    } catch (e) {
      console.error(e)
      toast.error('Не удалось загрузить использования')
    } finally {
      setUsagesLoading(false)
    }
  }

  async function handleGrantManual() {
    if (!manageCode || !grantEmail) {
      toast.error('Укажите промо-код и email')
      return
    }
    try {
      const res = await bonusAPI.grantPromoManually(manageCode, grantEmail)
      toast.success(`Выдано: ${formatMoney(res.bonusAmount, res.bonusCurrency)}, жетоны: ${res.totalTokens}`)
      setGrantEmail('')
      await loadPromoUsages()
    } catch (e) {
      console.error(e)
      toast.error('Не удалось выдать бонус')
    }
  }

  async function handleCancelUsage(userEmail: string) {
    if (!manageCode) return
    try {
      await bonusAPI.cancelPromoUsage(manageCode, userEmail)
      await loadPromoUsages()
    } catch (e) {
      console.error(e)
      toast.error('Не удалось отменить использование')
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
      toast.error(validationError)
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
        bonusCurrency: 'KZT',
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
      toast.success('Бонус создан успешно!')
    } catch (error) {
      console.error('Failed to create bonus:', error)
      toast.error('Ошибка создания бонуса')
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

  const getBonusTypeLabel = (type: string) => {
    const typeLabels = {
      DIRECT_BONUS: 'Прямой бонус',
      DEPOSIT_BONUS: 'Депозитный бонус',
      VOUCHER: 'Ваучер',
      deposit: 'Депозитный',
      welcome: 'Приветственный',
      loyalty: 'Лояльности',
      referral: 'Реферальный',
    }
    return typeLabels[type as keyof typeof typeLabels] || type
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      waiting: { className: 'bg-amber-50 text-amber-700', label: 'Ожидает' },
      pending: { className: 'bg-amber-50 text-amber-700', label: 'Ожидает' },
      success: { className: 'bg-emerald-50 text-emerald-700', label: 'Одобрен' },
      approved: { className: 'bg-emerald-50 text-emerald-700', label: 'Одобрен' },
      failed: { className: 'bg-rose-50 text-rose-700', label: 'Отклонен' },
      rejected: { className: 'bg-rose-50 text-rose-700', label: 'Отклонен' },
    }

    const config = statusConfig[status as keyof typeof statusConfig] ?? {
      className: 'bg-slate-100 text-slate-600',
      label: status,
    }

    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Управление бонусами"
          description="Создание промо, депозитных бонусов и ваучеров"
        />

        <div className="mb-6">
          <BonusAnalyticsDashboard period="week" showExpiringTable />
        </div>

        <section className="admin-card mb-6 p-5">
          <h2 className="mb-5 text-base font-semibold text-foreground">Создать новый бонус</h2>
            <form onSubmit={handleCreateBonus} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Промо-код</label>
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
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Тип бонуса</label>
                  <select
                    value={newBonus.bonusType}
                    onChange={(e) => setNewBonus({ ...newBonus, bonusType: e.target.value as any })}
                    className={fieldClass}
                  >
                    <option value="DIRECT_BONUS">Прямой бонус</option>
                    <option value="DEPOSIT_BONUS">Депозитный бонус</option>
                    <option value="VOUCHER">Ваучер</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Количество купонов</label>
                  <input
                    type="number"
                    value={newBonus.couponCount}
                    onChange={(e) => setNewBonus({ ...newBonus, couponCount: e.target.value })}
                    className={fieldClass}
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Партнёр (атрибуция)</label>
                  <select
                    value={newBonus.partnerId}
                    onChange={(e) => setNewBonus({ ...newBonus, partnerId: e.target.value })}
                    className={fieldClass}
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
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Email пользователя</label>
                  <input
                    type="email"
                    value={newBonus.userEmail}
                    onChange={(e) => setNewBonus({ ...newBonus, userEmail: e.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Описание</label>
                  <input
                    type="text"
                    value={newBonus.description}
                    onChange={(e) => setNewBonus({ ...newBonus, description: e.target.value })}
                    className={fieldClass}
                    placeholder="Дополнительное описание бонуса"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Дата начала</label>
                  <input
                    type="datetime-local"
                    value={newBonus.startDate}
                    onChange={(e) => setNewBonus({ ...newBonus, startDate: e.target.value })}
                    className={fieldClass}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Дата окончания</label>
                  <input
                    type="datetime-local"
                    value={newBonus.endDate}
                    onChange={(e) => setNewBonus({ ...newBonus, endDate: e.target.value })}
                    className={fieldClass}
                    required
                  />
                </div>
              </div>

              {/* Bonus Type Specific Fields */}
              <div className="border-t pt-4">
                <h3 className="mb-4 text-sm font-semibold text-foreground">Настройки {getBonusTypeLabel(newBonus.bonusType)}</h3>
                {newBonus.bonusType === 'DIRECT_BONUS' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Сумма бонуса</label>
                      <input
                        type="number"
                        value={newBonus.bonusAmount}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusAmount: e.target.value })}
                        className={fieldClass}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Валюта</label>
                      <select
                        value={newBonus.bonusCurrency}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusCurrency: e.target.value })}
                        className={fieldClass}
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
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Процент бонуса (%)</label>
                      <input
                        type="number"
                        value={newBonus.bonusPercentage}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusPercentage: e.target.value })}
                        className={fieldClass}
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Мин. депозит</label>
                      <input
                        type="number"
                        value={newBonus.minDeposit}
                        onChange={(e) => setNewBonus({ ...newBonus, minDeposit: e.target.value })}
                        className={fieldClass}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Процент партнера (%)</label>
                      <input
                        type="number"
                        value={newBonus.partnerPercentage}
                        onChange={(e) => setNewBonus({ ...newBonus, partnerPercentage: e.target.value })}
                        className={fieldClass}
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Валюта</label>
                      <select
                        value={newBonus.bonusCurrency}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusCurrency: e.target.value })}
                        className={fieldClass}
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
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Всего жетонов</label>
                      <input
                        type="number"
                        value={newBonus.totalTokens}
                        onChange={(e) => setNewBonus({ ...newBonus, totalTokens: e.target.value })}
                        className={fieldClass}
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Жетонов за ставку</label>
                      <input
                        type="number"
                        value={newBonus.tokensPerBet}
                        onChange={(e) => setNewBonus({ ...newBonus, tokensPerBet: e.target.value })}
                        className={fieldClass}
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Мин. коэффициент</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newBonus.tokenMinOdds}
                        onChange={(e) => setNewBonus({ ...newBonus, tokenMinOdds: e.target.value })}
                        className={fieldClass}
                        min="1.01"
                        required
                      />
                    </div>
                  </div>
                )}

                {newBonus.bonusType === 'VOUCHER' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Сумма бонуса</label>
                      <input
                        type="number"
                        value={newBonus.bonusAmount}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusAmount: e.target.value })}
                        className={fieldClass}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Процент партнера (%)</label>
                      <input
                        type="number"
                        value={newBonus.partnerPercentage}
                        onChange={(e) => setNewBonus({ ...newBonus, partnerPercentage: e.target.value })}
                        className={fieldClass}
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Валюта</label>
                      <select
                        value={newBonus.bonusCurrency}
                        onChange={(e) => setNewBonus({ ...newBonus, bonusCurrency: e.target.value })}
                        className={fieldClass}
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
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Всего жетонов</label>
                      <input
                        type="number"
                        value={newBonus.totalTokens}
                        onChange={(e) => setNewBonus({ ...newBonus, totalTokens: e.target.value })}
                        className={fieldClass}
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Жетонов за ставку</label>
                      <input
                        type="number"
                        value={newBonus.tokensPerBet}
                        onChange={(e) => setNewBonus({ ...newBonus, tokensPerBet: e.target.value })}
                        className={fieldClass}
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">Мин. коэффициент</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newBonus.tokenMinOdds}
                        onChange={(e) => setNewBonus({ ...newBonus, tokenMinOdds: e.target.value })}
                        className={fieldClass}
                        min="1.01"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button type="submit" className={btnPrimary}>
                  Создать бонус
                </button>
              </div>
          </form>
        </section>

          {/* Bonuses Table */}
          <div className="admin-card overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-foreground">Список бонусов</h3>
            </div>
            
            {loading ? (
              <LoadingBlock heightClass="h-32" />
            ) : bonuses.length === 0 ? (
              <div className="p-4"><EmptyState title="Бонусов пока нет" /></div>
            ) : (
              <div className="overflow-x-auto p-2 md:p-4">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Промо-код</th>
                      <th>Тип</th>
                      <th>Сумма</th>
                      <th>Валюта</th>
                      <th>Доступно</th>
                      <th>Осталось</th>
                      <th>Начало</th>
                      <th>Окончание</th>
                      <th>Партнёр</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.map((bonus) => {
                      const isPromo = String(bonus.id).startsWith('promo_');
                      const amountText = typeof bonus.amount === 'number' ? bonus.amount : 0;
                      const currency = (bonus as any).currencyCode || 'KZT'
                      const available = (bonus as any).available ?? (isPromo ? 0 : 1);
                      const remaining = (bonus as any).remaining ?? (isPromo ? 0 : 0);
                      const promoCode = (bonus as any).promoCode || '';
                      const startDate = (bonus as any).startDate || bonus.createdAt;
                      const endDate = (bonus as any).endDate || '';
                      const partnerEmail = (bonus as any).partnerId || '';
                      
                      return (
                        <tr key={bonus.id}>
                          <td className="font-medium">{promoCode}</td>
                          <td>{bonus.type}</td>
                          <td className="font-semibold">{formatMoney(amountText, currency)}</td>
                          <td>{currency}</td>
                          <td>{available}</td>
                          <td>{remaining}</td>
                          <td className="whitespace-nowrap text-sm">{new Date(startDate).toLocaleString('ru-RU')}</td>
                          <td className="whitespace-nowrap text-sm">{endDate ? new Date(endDate).toLocaleString('ru-RU') : '—'}</td>
                          <td>{partnerEmail || '—'}</td>
                          <td>{getStatusBadge(bonus.status)}</td>
                          <td>
                            {!isPromo && (bonus.status === 'pending' || bonus.status === 'waiting') && (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(bonus.id, 'approved')}
                                  className="text-sm font-medium text-emerald-600 hover:underline"
                                >
                                  Одобрить
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(bonus.id, 'rejected')}
                                  className="text-sm font-medium text-rose-600 hover:underline"
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

          <section className="admin-card mt-6 p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">Управление использованием промо-кода</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Промо-код</label>
                <input
                  type="text"
                  value={manageCode}
                  onChange={(e) => setManageCode(e.target.value.trim())}
                  className={fieldClass}
                  placeholder="Введите код"
                />
              </div>
              <div>
                <button type="button" onClick={loadPromoUsages} className={`w-full ${btnSecondary}`}>
                  Показать использования
                </button>
              </div>
              <div className="md:col-span-1"></div>
            </div>

            {usagesLoading ? <LoadingBlock heightClass="h-16" label="Загрузка…" /> : null}

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
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Статус</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usages.map((u) => (
                          <tr key={`${u.userId}-${u.userEmail}`}>
                            <td>{u.userEmail}</td>
                            <td>{u.status}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleCancelUsage(u.userEmail)}
                                className="text-sm font-medium text-rose-600 hover:underline"
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
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">Выдать вручную (email)</label>
                    <input
                      type="email"
                      value={grantEmail}
                      onChange={(e) => setGrantEmail(e.target.value)}
                      className={fieldClass}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <button type="button" onClick={handleGrantManual} className={`w-full ${btnPrimary}`}>
                      Выдать бонус
                    </button>
                  </div>
                </div>
              </div>
            )}
        </section>
      </PageShell>
    </AuthGuard>
  )
}
