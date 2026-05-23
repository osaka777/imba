"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/widgets/Button'
import { Table } from '@/widgets/Table'
import { toast } from 'react-toastify'
import { AuthGuard } from '@/shared/components/AuthGuard'

interface Subcategory {
  id: string
  name: string
  code: string
  sport: string
  isPriority: boolean
}

const SPORTS = [
  "soccer",
  "basketball", 
  "hockey",
  "tennis",
  "volleyball",
  "table-tennis",
  "baseball",
  "esports.cs",
  "esports.dota2",
]

export default function ChangePrioritySubcategoryPage() {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSubcategories()
  }, [])

  const formatSportName = (sport: string) => {
    if (sport === "esports.cs") return "CS:GO"
    if (sport === "esports.dota2") return "Dota 2"
    if (sport === "table-tennis") return "Table Tennis"
    return sport.replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase())
  }

  const loadSubcategories = async () => {
    setIsLoading(true)
    try {
      // Используем общий эндпоинт для получения всех подкатегорий
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/subcategories`)
      if (response.ok) {
        const allSubcategories = await response.json()
        // Фильтруем только активные подкатегории из нужных спортов
        const filteredSubcategories = allSubcategories.filter((sub: any) => 
          SPORTS.includes(sub.sport) && sub.isActive
        )
        setSubcategories(filteredSubcategories)
      } else {
        console.error('Ошибка ответа сервера:', response.status, response.statusText)
        toast.error('Ошибка загрузки подкатегорий')
      }
    } catch (error) {
      console.error('Ошибка загрузки подкатегорий:', error)
      toast.error('Ошибка загрузки подкатегорий')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePriorityChange = (id: string, isPriority: boolean) => {
    setSubcategories(prev => 
      prev.map(sub => 
        sub.id === id ? { ...sub, isPriority } : sub
      )
    )
  }

  const saveChanges = async () => {
    setIsSaving(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const updates = subcategories.map(sub => ({
        id: parseInt(sub.id),
        isPriority: sub.isPriority
      }))

      // Обновляем приоритеты подкатегорий
      const response = await fetch(`${baseUrl}/api/subcategories/priority`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Ошибка обновления приоритетов подкатегорий')
      }

      // Обновляем приоритеты игр для приоритетных подкатегорий
      for (const update of updates) {
        if (update.isPriority) {
          const subcategory = subcategories.find(sub => sub.id === update.id.toString())
          if (subcategory) {
            await updateGamePriorities(subcategory)
          }
        }
      }

      toast.success('Приоритеты успешно обновлены!')
      await loadSubcategories()
    } catch (error: any) {
      toast.error(`Ошибка сохранения: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const updateGamePriorities = async (subcategory: Subcategory) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      // Получаем live игры
      const liveResponse = await fetch(`${baseUrl}/api/games/live/${subcategory.sport}/${subcategory.code}`)
      if (liveResponse.ok) {
        const liveGames = await liveResponse.json()
        for (const game of liveGames) {
          await fetch(`${baseUrl}/api/game/${game.eventId}/1`, { method: 'PATCH' })
        }
      }

      // Получаем prematch игры
      const prematchResponse = await fetch(`${baseUrl}/api/games/prematch/${subcategory.sport}/${subcategory.code}`)
      if (prematchResponse.ok) {
        const prematchGames = await prematchResponse.json()
        for (const game of prematchGames) {
          await fetch(`${baseUrl}/api/game/${game.eventId}/1`, { method: 'PATCH' })
        }
      }
    } catch (error) {
      console.error(`Ошибка обновления игр для подкатегории ${subcategory.code}:`, error)
    }
  }

  const columns = [
    { 
      header: 'Спорт', 
      accessor: 'sport' as keyof Subcategory, 
      render: (item: Subcategory) => formatSportName(item.sport) 
    },
    { 
      header: 'Название', 
      accessor: 'name' as keyof Subcategory 
    },
    { 
      header: 'Код', 
      accessor: 'code' as keyof Subcategory 
    },
    { 
      header: 'Приоритет', 
      accessor: 'isPriority' as keyof Subcategory,
      render: (item: Subcategory) => (
        <input
          type="checkbox"
          checked={item.isPriority}
          onChange={(e) => handlePriorityChange(item.id, e.target.checked)}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
        />
      )
    }
  ]

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="p-6 text-center">Загрузка подкатегорий...</div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Изменить приоритет подкатегорий</h1>
          <p className="text-gray-600">
            Управление приоритетами подкатегорий для изменения порядка отображения в меню
          </p>
        </div>

        <div className="mb-6 flex gap-4">
          <Button onClick={loadSubcategories} disabled={isLoading}>
            Обновить
          </Button>
          <Button onClick={saveChanges} disabled={isSaving} variant="secondary">
            {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Подкатегории</h2>
            <p className="text-sm text-gray-600 mt-1">
              Отметьте подкатегории, которые должны иметь высокий приоритет
            </p>
          </div>
          
          <Table data={subcategories} columns={columns} />
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Как работают приоритеты</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Отмеченные подкатегории будут отображаться выше в меню</li>
            <li>• Игры в приоритетных подкатегориях также получат повышенный приоритет</li>
            <li>• Изменения применяются ко всем видам спорта</li>
          </ul>
        </div>
      </div>
    </AuthGuard>
  )
}
