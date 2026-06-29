"use client"

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { Button } from '@/widgets/Button'
import { Table } from '@/widgets/Table'
import { slidesAPI, type Slide } from '@/shared/api/slides'

import { PromoBannersEditor } from './PromoBannersEditor'
import { SlideEditorForm } from './SlideEditorForm'
import { DEFAULT_SLIDE_FORM, slideToFormData, type SlideFormData } from './slideEditorDefaults'

export default function WebsiteEditingPage() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null)
  const [section, setSection] = useState<'promo' | 'slider'>('promo')

  const [formData, setFormData] = useState<SlideFormData>(DEFAULT_SLIDE_FORM)
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadSlides()
  }, [])

  const loadSlides = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await slidesAPI.getAllSlides()
      setSlides(data)
    } catch (err) {
      setError('Ошибка при загрузке слайдеров')
      console.error('Error loading slides:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const uploadResult = await slidesAPI.uploadSlideImage(file)
      setFormData(prev => ({
        ...prev,
        imagePath: uploadResult.path,
        imageUrl: `${process.env.NEXT_PUBLIC_API_URL}/${uploadResult.path}`
      }))
      setSelectedFile(file)
    } catch (err) {
      setError('Ошибка при загрузке изображения')
      console.error('Error uploading image:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      if (editingSlide) {
        await slidesAPI.updateSlide(editingSlide.id, formData)
      } else {
        await slidesAPI.createSlide(formData)
      }
      
      // Сброс формы
      setFormData(DEFAULT_SLIDE_FORM)
      setShowCreateForm(false)
      setEditingSlide(null)
      
      // Перезагрузка списка
      await loadSlides()
    } catch (err) {
      setError('Ошибка при сохранении слайдера')
      console.error('Error saving slide:', err)
    }
  }

  const handleEdit = (slide: Slide) => {
    setEditingSlide(slide)
    setFormData(slideToFormData(slide))
    setShowCreateForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот слайдер?')) return
    
    try {
      await slidesAPI.deleteSlide(id)
      await loadSlides()
    } catch (err) {
      setError('Ошибка при удалении слайдера')
      console.error('Error deleting slide:', err)
    }
  }

  const handleToggleStatus = async (id: number) => {
    try {
      await slidesAPI.toggleSlideStatus(id)
      await loadSlides()
    } catch (err) {
      setError('Ошибка при изменении статуса слайдера')
      console.error('Error toggling slide status:', err)
    }
  }

  const cancelForm = () => {
    setShowCreateForm(false)
    setEditingSlide(null)
    setSelectedFile(null)
    setFormData(DEFAULT_SLIDE_FORM)
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Редактирование сайта</h1>
            </div>

            {/* Переключатель разделов */}
            <div className="flex items-center gap-2 mb-6">
              <Button
                onClick={() => setSection('promo')}
                className={`${section === 'promo' ? 'bg-blue-600' : 'bg-gray-500'} hover:opacity-90 text-white`}
              >
                Промо баннеры
              </Button>
              <Button
                onClick={() => setSection('slider')}
                className={`${section === 'slider' ? 'bg-blue-600' : 'bg-gray-500'} hover:opacity-90 text-white`}
              >
                Главный слайдер
              </Button>
            </div>

            {section === 'promo' && (
              <PromoBannersEditor />
            )}

            {/* Раздел слайдеров */}
            {section === 'slider' && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Управление Слайдерами</h2>
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Добавить слайдер
                </Button>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              {/* Форма создания/редактирования */}
              {showCreateForm && (
                <div className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-5">
                    {editingSlide ? 'Редактировать слайд' : 'Новый слайд'}
                  </h3>
                  <SlideEditorForm
                    formData={formData}
                    setFormData={setFormData}
                    onSubmit={handleSubmit}
                    onCancel={cancelForm}
                    editing={!!editingSlide}
                    uploading={uploading}
                    selectedFile={selectedFile}
                    onFileSelect={handleFileUpload}
                  />
                </div>
              )}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Загрузка слайдеров...</p>
                </div>
              ) : (
                <Table
                  data={slides}
                  columns={[
                    { header: 'ID', accessor: 'id' as keyof Slide },
                    { header: 'Заголовок', accessor: 'title' as keyof Slide },
                    {
                      header: 'Описание',
                      accessor: 'description' as keyof Slide,
                      render: (slide: Slide) => slide.description || '-',
                    },
                    {
                      header: 'Изображение',
                      accessor: 'imageUrl' as keyof Slide,
                      render: (slide: Slide) => {
                        const src = slide.imagePath
                          ? `${process.env.NEXT_PUBLIC_API_URL}/${slide.imagePath}`
                          : slide.imageUrl || ''
                        return src ? (
                          <img
                            src={src}
                            alt={slide.title}
                            className="w-16 h-10 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA2NCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAyMEwyOCAyNEwzNiAxNkw0MCAyMFYzMkgyNFYyMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'
                            }}
                          />
                        ) : '-'
                      },
                    },
                    {
                      header: 'Ссылка',
                      accessor: 'linkUrl' as keyof Slide,
                      render: (slide: Slide) => slide.linkUrl || '-',
                    },
                    {
                      header: 'Статус',
                      accessor: 'isActive' as keyof Slide,
                      render: (slide: Slide) => (
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            slide.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {slide.isActive ? 'Активен' : 'Неактивен'}
                        </span>
                      ),
                    },
                    { header: 'Порядок', accessor: 'order' as keyof Slide },
                    {
                      header: 'Действия',
                      accessor: 'id' as keyof Slide,
                      render: (slide: Slide) => (
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => handleEdit(slide)}
                            className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1"
                          >
                            Редактировать
                          </Button>
                          <Button
                            onClick={() => handleToggleStatus(slide.id)}
                            className={`text-white text-xs px-2 py-1 ${
                              slide.isActive
                                ? 'bg-orange-500 hover:bg-orange-600'
                                : 'bg-green-500 hover:bg-green-600'
                            }`}
                          >
                            {slide.isActive ? 'Деактивировать' : 'Активировать'}
                          </Button>
                          <Button
                            onClick={() => handleDelete(slide.id)}
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
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}