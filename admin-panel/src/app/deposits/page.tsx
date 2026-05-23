"use client"

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { apiCall } from '@/shared/utils/api'
import { Button } from '@/widgets/Button'
// Replacing generic Table with custom responsive layout
import { toast } from 'react-toastify'

interface AdminDeposit {
  id: number
  userId: number
  email?: string
  amount: number
  currency: string
  method: string
  imageUrl?: string
  createdAt: string
  status: 'pending' | 'processing' | 'approved' | 'rejected'
}

export default function AdminDepositsPage() {
  const [items, setItems] = useState<AdminDeposit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const load = async () => {
    setIsLoading(true)
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/deposits?status=${status}`
      const res = await apiCall(url)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to load')
      }
      const data: AdminDeposit[] = await res.json()
      setItems(data || [])
    } catch (e: any) {
      toast.error(e.message || 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const approve = async (id: number) => {
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/deposits/${id}/approve`
      const res = await apiCall(url, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Подтверждено')
      load()
    } catch (e: any) {
      toast.error(e.message || 'Ошибка подтверждения')
    }
  }

  const reject = async (id: number) => {
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/deposits/${id}/reject`
      const res = await apiCall(url, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Отклонено')
      load()
    } catch (e: any) {
      toast.error(e.message || 'Ошибка отклонения')
    }
  }

  const columns = useMemo(() => [], [])

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Заявки пополнений</h1>
            <p className="text-gray-500 text-sm">Статус: {status}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button onClick={() => setStatus('pending')} className={`px-3 py-1 rounded-md text-sm ${status==='pending' ? 'bg-white shadow' : 'text-gray-600'}`}>Ожидают</button>
              <button onClick={() => setStatus('approved')} className={`px-3 py-1 rounded-md text-sm ${status==='approved' ? 'bg-white shadow' : 'text-gray-600'}`}>Подтверждённые</button>
              <button onClick={() => setStatus('rejected')} className={`px-3 py-1 rounded-md text-sm ${status==='rejected' ? 'bg-white shadow' : 'text-gray-600'}`}>Отклонённые</button>
            </div>
            <Button onClick={load} disabled={isLoading}>{isLoading ? 'Загрузка…' : 'Обновить'}</Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="text-left text-sm text-gray-600">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Пользователь</th>
                  <th className="px-4 py-3">Валюта</th>
                  <th className="px-4 py-3">Сумма</th>
                  <th className="px-4 py-3">Метод</th>
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Чек</th>
                  {status === 'pending' && (
                    <th className="px-4 py-3 sticky right-0 bg-white border-l">Действия</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t text-sm">
                    <td className="px-4 py-2">{r.id}</td>
                    <td className="px-4 py-2 max-w-[220px] truncate" title={r.email || ''}>{r.email || '—'}</td>
                    <td className="px-4 py-2">{r.userId}</td>
                    <td className="px-4 py-2">{r.currency}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{r.amount.toLocaleString()} {r.currency}</td>
                    <td className="px-4 py-2">{r.method}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                      {r.status === 'processing' && (
                        <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          Чек загружен
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{r.imageUrl ? (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL || ''}${r.imageUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">Открыть</a>
                    ) : '—'}</td>
                    {status === 'pending' && (
                      <td className="px-4 py-2 sticky right-0 bg-white border-l">
                        <div className="flex gap-2 whitespace-nowrap">
                          <Button onClick={() => approve(r.id)}>
                            Подтвердить
                          </Button>
                          <Button onClick={() => reject(r.id)} variant="secondary">
                            Отклонить
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(!items || items.length === 0) && (
            <div className="text-gray-500 text-sm p-4">Нет заявок</div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
