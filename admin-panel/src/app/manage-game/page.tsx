"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/widgets/Button'
import { Input } from '@/widgets/Input'
import { toast } from 'react-toastify'
import { AuthGuard } from '@/shared/components/AuthGuard'

interface Market {
  basis: string
  cf: number
  display_name: string
  isOpen: boolean
  market: string
  oc_group_name: string
  plr?: string
  dst?: string
  pivot?: string
}

export default function ManageGamePage() {
  const [formData, setFormData] = useState({
    eventId: '',
    eventName: '',
    leagueName: '',
    priority: '',
    score: '',
    sport: '',
    status: '',
    team1: '',
    team2: '',
    start_at: ''
  })

  const [matchWinner, setMatchWinner] = useState({
    winP1: '',
    winP2: '',
    winP1_isOpen: false,
    winP2_isOpen: false
  })

  const [totals, setTotals] = useState<Array<{
    under: string
    over: string
    value: string
    isOpen: boolean
  }>>([])

  const [individualTotals, setIndividualTotals] = useState<Array<{
    team: string
    under: string
    over: string
    value: string
    isOpen: boolean
  }>>([])

  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Загружаем сохраненные данные из localStorage
    const savedData = localStorage.getItem('manageGame_formData')
    if (savedData) {
      try {
        setFormData(JSON.parse(savedData))
      } catch (e) {
        console.error('Ошибка загрузки сохраненных данных формы')
      }
    }

    const savedMatchWinner = localStorage.getItem('manageGame_matchWinner')
    if (savedMatchWinner) {
      try {
        setMatchWinner(JSON.parse(savedMatchWinner))
      } catch (e) {
        console.error('Ошибка загрузки сохраненных данных матч-виннера')
      }
    }

    const savedTotals = localStorage.getItem('manageGame_totals')
    if (savedTotals) {
      try {
        setTotals(JSON.parse(savedTotals))
      } catch (e) {
        console.error('Ошибка загрузки сохраненных данных тоталов')
      }
    }

    const savedIndividualTotals = localStorage.getItem('manageGame_individualTotals')
    if (savedIndividualTotals) {
      try {
        setIndividualTotals(JSON.parse(savedIndividualTotals))
      } catch (e) {
        console.error('Ошибка загрузки сохраненных данных индивидуальных тоталов')
      }
    }
  }, [])

  const saveToLocalStorage = () => {
    localStorage.setItem('manageGame_formData', JSON.stringify(formData))
    localStorage.setItem('manageGame_matchWinner', JSON.stringify(matchWinner))
    localStorage.setItem('manageGame_totals', JSON.stringify(totals))
    localStorage.setItem('manageGame_individualTotals', JSON.stringify(individualTotals))
  }

  const handleFormChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value }
    setFormData(newFormData)
    localStorage.setItem('manageGame_formData', JSON.stringify(newFormData))
  }

  const handleMatchWinnerChange = (field: string, value: string | boolean) => {
    const newMatchWinner = { ...matchWinner, [field]: value }
    setMatchWinner(newMatchWinner)
    localStorage.setItem('manageGame_matchWinner', JSON.stringify(newMatchWinner))
  }

  const addTotalRow = () => {
    const newTotals = [...totals, { under: '', over: '', value: '', isOpen: false }]
    setTotals(newTotals)
    localStorage.setItem('manageGame_totals', JSON.stringify(newTotals))
  }

  const removeTotalRow = (index: number) => {
    const newTotals = totals.filter((_, i) => i !== index)
    setTotals(newTotals)
    localStorage.setItem('manageGame_totals', JSON.stringify(newTotals))
  }

  const updateTotal = (index: number, field: string, value: string | boolean) => {
    const newTotals = totals.map((total, i) => 
      i === index ? { ...total, [field]: value } : total
    )
    setTotals(newTotals)
    localStorage.setItem('manageGame_totals', JSON.stringify(newTotals))
  }

  const addIndividualTotalRow = () => {
    const newIndividualTotals = [...individualTotals, { 
      team: 'team1', under: '', over: '', value: '', isOpen: false 
    }]
    setIndividualTotals(newIndividualTotals)
    localStorage.setItem('manageGame_individualTotals', JSON.stringify(newIndividualTotals))
  }

  const removeIndividualTotalRow = (index: number) => {
    const newIndividualTotals = individualTotals.filter((_, i) => i !== index)
    setIndividualTotals(newIndividualTotals)
    localStorage.setItem('manageGame_individualTotals', JSON.stringify(newIndividualTotals))
  }

  const updateIndividualTotal = (index: number, field: string, value: string | boolean) => {
    const newIndividualTotals = individualTotals.map((total, i) => 
      i === index ? { ...total, [field]: value } : total
    )
    setIndividualTotals(newIndividualTotals)
    localStorage.setItem('manageGame_individualTotals', JSON.stringify(newIndividualTotals))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.eventId || !formData.eventName || !formData.sport) {
      toast.error('Заполните обязательные поля')
      return
    }

    setIsLoading(true)
    try {
      const markets: Market[] = []

      // Добавляем рынки только для tennis/table-tennis
      if (formData.sport === 'tennis' || formData.sport === 'table-tennis') {
        // Победа в матче
        if (matchWinner.winP1) {
          markets.push({
            basis: 'WIN',
            cf: parseFloat(matchWinner.winP1),
            display_name: 'П1',
            isOpen: matchWinner.winP1_isOpen,
            market: 'WIN__P1',
            oc_group_name: '1X2',
            plr: 'P1'
          })
        }
        if (matchWinner.winP2) {
          markets.push({
            basis: 'WIN',
            cf: parseFloat(matchWinner.winP2),
            display_name: 'П2',
            isOpen: matchWinner.winP2_isOpen,
            market: 'WIN__P2',
            oc_group_name: '1X2',
            plr: 'P2'
          })
        }

        // Тоталы на матч
        totals.forEach(total => {
          if (total.under && total.over && total.value) {
            markets.push({
              basis: 'TOTALS',
              cf: parseFloat(total.over),
              dst: 'OVER',
              isOpen: total.isOpen,
              display_name: `${total.value} Б`,
              market: `TOTALS__OVER(${total.value})`,
              oc_group_name: 'Тотал',
              pivot: total.value
            })
            markets.push({
              basis: 'TOTALS',
              cf: parseFloat(total.under),
              dst: 'UNDER',
              isOpen: total.isOpen,
              display_name: `${total.value} М`,
              market: `TOTALS__UNDER(${total.value})`,
              oc_group_name: 'Тотал',
              pivot: total.value
            })
          }
        })

        // Индивидуальные тоталы
        individualTotals.forEach(total => {
          if (total.under && total.over && total.value) {
            markets.push({
              basis: 'TOTALS',
              cf: parseFloat(total.over),
              dst: 'OVER',
              isOpen: total.isOpen,
              display_name: `${total.value} Б`,
              market: `${total.team === 'team1' ? 'P1' : 'P2'}__TOTALS__OVER(${total.value})`,
              oc_group_name: 'Индивидуальный тотал',
              pivot: total.value,
              plr: total.team === 'team1' ? 'P1' : 'P2'
            })
            markets.push({
              basis: 'TOTALS',
              cf: parseFloat(total.under),
              dst: 'UNDER',
              isOpen: total.isOpen,
              display_name: `${total.value} М`,
              market: `${total.team === 'team1' ? 'P1' : 'P2'}__TOTALS__UNDER(${total.value})`,
              oc_group_name: 'Индивидуальный тотал',
              pivot: total.value,
              plr: total.team === 'team1' ? 'P1' : 'P2'
            })
          }
        })
      }

      const requestBody = {
        eventId: formData.eventId,
        eventName: formData.eventName,
        leagueName: formData.leagueName,
        priority: Number(formData.priority),
        score: formData.score,
        sport: formData.sport,
        status: formData.status,
        team1: formData.team1,
        team2: formData.team2,
        start_at: formData.start_at,
        markets
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/createGame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        toast.success('Игра успешно обновлена!')
        saveToLocalStorage()
      } else {
        const errorText = await response.text()
        toast.error(`Ошибка обновления игры: ${errorText}`)
      }
    } catch (error: any) {
      toast.error(`Ошибка подключения: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const showTennisMenus = formData.sport === 'tennis' || formData.sport === 'table-tennis'

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6">Управление игрой</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="eventId" className="block text-sm font-medium text-gray-700 mb-1">
                  ID события *
                </label>
                <Input
                  id="eventId"
                  value={formData.eventId}
                  onChange={(e) => handleFormChange('eventId', e.target.value)}
                  placeholder="Введите ID события"
                  required
                />
              </div>

              <div>
                <label htmlFor="eventName" className="block text-sm font-medium text-gray-700 mb-1">
                  Название события *
                </label>
                <Input
                  id="eventName"
                  value={formData.eventName}
                  onChange={(e) => handleFormChange('eventName', e.target.value)}
                  placeholder="Название события"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="leagueName" className="block text-sm font-medium text-gray-700 mb-1">
                  Название чемпионата *
                </label>
                <Input
                  id="leagueName"
                  value={formData.leagueName}
                  onChange={(e) => handleFormChange('leagueName', e.target.value)}
                  placeholder="Название чемпионата"
                  required
                />
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                  Приоритет *
                </label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => handleFormChange('priority', e.target.value)}
                  placeholder="Приоритет"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="score" className="block text-sm font-medium text-gray-700 mb-1">
                  Счет
                </label>
                <Input
                  id="score"
                  value={formData.score}
                  onChange={(e) => handleFormChange('score', e.target.value)}
                  placeholder="Текущий счет"
                />
              </div>

              <div>
                <label htmlFor="sport" className="block text-sm font-medium text-gray-700 mb-1">
                  Спорт *
                </label>
                <select
                  id="sport"
                  value={formData.sport}
                  onChange={(e) => handleFormChange('sport', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Выберите спорт</option>
                  <option value="soccer">Soccer</option>
                  <option value="volleyball">Volleyball</option>
                  <option value="tennis">Tennis</option>
                  <option value="table-tennis">Table Tennis</option>
                  <option value="hockey">Hockey</option>
                  <option value="basketball">Basketball</option>
                  <option value="esports.cs">Esports CS</option>
                  <option value="esports.dota">Esports Dota</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Статус *
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleFormChange('status', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Выберите статус</option>
                  <option value="PREMATCH">PREMATCH</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="FINISHED">FINISHED</option>
                </select>
              </div>

              <div>
                <label htmlFor="start_at" className="block text-sm font-medium text-gray-700 mb-1">
                  Начало в *
                </label>
                <Input
                  id="start_at"
                  type="datetime-local"
                  value={formData.start_at}
                  onChange={(e) => handleFormChange('start_at', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="team1" className="block text-sm font-medium text-gray-700 mb-1">
                  Команда 1 *
                </label>
                <Input
                  id="team1"
                  value={formData.team1}
                  onChange={(e) => handleFormChange('team1', e.target.value)}
                  placeholder="Название первой команды"
                  required
                />
              </div>

              <div>
                <label htmlFor="team2" className="block text-sm font-medium text-gray-700 mb-1">
                  Команда 2 *
                </label>
                <Input
                  id="team2"
                  value={formData.team2}
                  onChange={(e) => handleFormChange('team2', e.target.value)}
                  placeholder="Название второй команды"
                  required
                />
              </div>
            </div>

            {/* Меню для tennis/table-tennis */}
            {showTennisMenus && (
              <>
                {/* Победа в матче */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-3">Победа в матче</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <label className="w-12 text-sm">П1</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={matchWinner.winP1}
                        onChange={(e) => handleMatchWinnerChange('winP1', e.target.value)}
                        placeholder="Кф П1"
                        className="flex-1"
                      />
                      <label className="text-xs">isOpen</label>
                      <input
                        type="checkbox"
                        checked={matchWinner.winP1_isOpen}
                        onChange={(e) => handleMatchWinnerChange('winP1_isOpen', e.target.checked)}
                        className="ml-2"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="w-12 text-sm">П2</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={matchWinner.winP2}
                        onChange={(e) => handleMatchWinnerChange('winP2', e.target.value)}
                        placeholder="Кф П2"
                        className="flex-1"
                      />
                      <label className="text-xs">isOpen</label>
                      <input
                        type="checkbox"
                        checked={matchWinner.winP2_isOpen}
                        onChange={(e) => handleMatchWinnerChange('winP2_isOpen', e.target.checked)}
                        className="ml-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Тоталы на матч */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Тоталы на матч</h3>
                    <Button type="button" onClick={addTotalRow} variant="secondary" size="sm">
                      + Добавить
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {totals.map((total, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <label className="text-xs">Меньше</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={total.under}
                          onChange={(e) => updateTotal(index, 'under', e.target.value)}
                          placeholder="Кф"
                          className="w-20"
                        />
                        <label className="text-xs">Тотал</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={total.value}
                          onChange={(e) => updateTotal(index, 'value', e.target.value)}
                          placeholder="Знач."
                          className="w-16"
                        />
                        <label className="text-xs">Больше</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={total.over}
                          onChange={(e) => updateTotal(index, 'over', e.target.value)}
                          placeholder="Кф"
                          className="w-20"
                        />
                        <label className="text-xs">isOpen</label>
                        <input
                          type="checkbox"
                          checked={total.isOpen}
                          onChange={(e) => updateTotal(index, 'isOpen', e.target.checked)}
                          className="ml-2"
                        />
                        <Button
                          type="button"
                          onClick={() => removeTotalRow(index)}
                          variant="danger"
                          size="sm"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Индивидуальные тоталы */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Индивидуальные тоталы</h3>
                    <Button type="button" onClick={addIndividualTotalRow} variant="secondary" size="sm">
                      + Добавить
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {individualTotals.map((total, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <label className="text-xs">Команда</label>
                        <select
                          value={total.team}
                          onChange={(e) => updateIndividualTotal(index, 'team', e.target.value)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-xs"
                        >
                          <option value="team1">1</option>
                          <option value="team2">2</option>
                        </select>
                        <label className="text-xs">Меньше</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={total.under}
                          onChange={(e) => updateIndividualTotal(index, 'under', e.target.value)}
                          placeholder="Кф"
                          className="w-20"
                        />
                        <label className="text-xs">Тотал</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={total.value}
                          onChange={(e) => updateIndividualTotal(index, 'value', e.target.value)}
                          placeholder="Знач."
                          className="w-16"
                        />
                        <label className="text-xs">Больше</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={total.over}
                          onChange={(e) => updateIndividualTotal(index, 'over', e.target.value)}
                          placeholder="Кф"
                          className="w-20"
                        />
                        <label className="text-xs">isOpen</label>
                        <input
                          type="checkbox"
                          checked={total.isOpen}
                          onChange={(e) => updateIndividualTotal(index, 'isOpen', e.target.checked)}
                          className="ml-2"
                        />
                        <Button
                          type="button"
                          onClick={() => removeIndividualTotalRow(index)}
                          variant="danger"
                          size="sm"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Обновление...' : 'Обновить игру'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Информация</h3>
            <p className="text-sm text-blue-800">
              Все данные автоматически сохраняются в localStorage. Для tennis и table-tennis 
              доступны дополнительные настройки рынков (победа в матче, тоталы, индивидуальные тоталы).
            </p>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
