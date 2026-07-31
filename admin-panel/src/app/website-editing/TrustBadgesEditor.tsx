'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/widgets/Button'
import { Input } from '@/widgets/Input'
import { Table } from '@/widgets/Table'
import {
  footerBadgesAPI,
  type FooterBadge,
} from '@/shared/api/footerBadges'

type FormData = {
  title: string
  imageUrl: string
  imagePath: string
  linkUrl: string
  isActive: boolean
  order: number
}

const EMPTY: FormData = {
  title: '',
  imageUrl: '',
  imagePath: '',
  linkUrl: '',
  isActive: true,
  order: 1,
}

export function TrustBadgesEditor() {
  const [badges, setBadges] = useState<FooterBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FooterBadge | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setBadges(await footerBadgesAPI.getAll())
    } catch (err) {
      setError('Ошибка загрузки бейджей')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const patch = (partial: Partial<FormData>) => setForm((prev) => ({ ...prev, ...partial }))

  const onUpload = async (file: File) => {
    setUploading(true)
    try {
      const result = await footerBadgesAPI.upload(file)
      patch({
        imagePath: result.path,
        imageUrl: `${process.env.NEXT_PUBLIC_API_URL}/${result.path}`,
      })
    } catch (err) {
      setError('Ошибка загрузки изображения')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await footerBadgesAPI.update(editing.id, form)
      } else {
        await footerBadgesAPI.create(form)
      }
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY)
      await load()
    } catch (err) {
      setError('Ошибка сохранения')
      console.error(err)
    }
  }

  const previewSrc = form.imagePath
    ? `${process.env.NEXT_PUBLIC_API_URL}/${form.imagePath}`
    : form.imageUrl

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Награды в футере</h2>
          <p className="text-sm text-gray-500 mt-1">
            Бейджи с вертикальными разделителями под платёжными иконками (как у 1win).
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setForm({ ...EMPTY, order: badges.length + 1 })
            setShowForm(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Добавить бейдж
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-xl space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">
            {editing ? 'Редактировать бейдж' : 'Новый бейдж'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Название"
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Seal of Approval"
            />
            <Input
              label="Ссылка (опционально)"
              value={form.linkUrl}
              onChange={(e) => patch({ linkUrl: e.target.value })}
              placeholder="https://..."
            />
            <Input
              label="Порядок"
              type="number"
              value={form.order}
              onChange={(e) => patch({ order: parseInt(e.target.value) || 1 })}
              min="0"
            />
            <label className="flex items-center gap-2 text-sm pt-6">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => patch({ isActive: e.target.checked })}
                className="rounded"
              />
              Активен
            </label>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Изображение бейджа
              </label>
              <input
                type="file"
                accept="image/*,.svg"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onUpload(file)
                }}
                className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700"
              />
              {uploading && <span className="text-blue-600 text-sm ml-2">Загрузка…</span>}
              {previewSrc ? (
                <div className="mt-3 p-3 bg-[#0f1520] rounded-lg inline-flex">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewSrc} alt="" className="h-10 object-contain" />
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditing(null)
                setForm(EMPTY)
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white"
            >
              Отмена
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Загрузка…</p>
      ) : (
        <Table
          data={badges}
          columns={[
            { header: 'ID', accessor: 'id' as keyof FooterBadge },
            { header: 'Название', accessor: 'title' as keyof FooterBadge },
            {
              header: 'Превью',
              accessor: 'id' as keyof FooterBadge,
              render: (badge: FooterBadge) => {
                const src = badge.imagePath
                  ? `${process.env.NEXT_PUBLIC_API_URL}/${badge.imagePath}`
                  : badge.imageUrl
                return src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-8 object-contain bg-gray-900 px-2 rounded" />
                ) : (
                  '—'
                )
              },
            },
            {
              header: 'Статус',
              accessor: 'isActive' as keyof FooterBadge,
              render: (badge: FooterBadge) => (badge.isActive ? 'Активен' : 'Выкл'),
            },
            { header: 'Порядок', accessor: 'order' as keyof FooterBadge },
            {
              header: 'Действия',
              accessor: 'id' as keyof FooterBadge,
              render: (badge: FooterBadge) => (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setEditing(badge)
                      setForm({
                        title: badge.title || '',
                        imageUrl: badge.imageUrl || '',
                        imagePath: badge.imagePath || '',
                        linkUrl: badge.linkUrl || '',
                        isActive: badge.isActive,
                        order: badge.order,
                      })
                      setShowForm(true)
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1"
                  >
                    Изменить
                  </Button>
                  <Button
                    onClick={async () => {
                      await footerBadgesAPI.toggle(badge.id)
                      await load()
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-2 py-1"
                  >
                    {badge.isActive ? 'Выкл' : 'Вкл'}
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!confirm('Удалить бейдж?')) return
                      await footerBadgesAPI.delete(badge.id)
                      await load()
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1"
                  >
                    Удалить
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
