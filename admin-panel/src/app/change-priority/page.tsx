"use client"

import { useState } from 'react'
import { Button } from '@/widgets/Button'
import { Input } from '@/widgets/Input'
import { toast } from 'react-toastify'
import { AuthGuard } from '@/shared/components/AuthGuard'

export default function ChangePriorityPage() {
  const [eventId, setEventId] = useState('')
  const [priority, setPriority] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!eventId || !priority) {
      toast.error('Заполните все поля')
      return
    }

    setIsLoading(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/game/${eventId}/${priority}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        toast.success('Приоритет успешно изменен!')
        setEventId('')
        setPriority('')
      } else {
        const errorText = await response.text()
        toast.error(`Ошибка изменения приоритета: ${errorText}`)
      }
    } catch (error: any) {
      toast.error(`Ошибка подключения: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6">Изменить приоритет игры</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="eventId" className="block text-sm font-medium text-gray-700 mb-1">
                ID события
              </label>
              <Input
                id="eventId"
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="Введите ID события"
                required
              />
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Приоритет
              </label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="Введите новый приоритет"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Изменение...' : 'Изменить приоритет'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Информация</h3>
            <p className="text-sm text-blue-800">
              Введите ID события и новый приоритет для изменения порядка отображения игры.
              Чем выше число приоритета, тем выше в списке будет отображаться игра.
            </p>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
