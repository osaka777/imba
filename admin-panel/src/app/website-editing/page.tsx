"use client"

import { useEffect, useRef, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { Button } from '@/widgets/Button'
import { Input } from '@/widgets/Input'
import { Table } from '@/widgets/Table'
import { slidesAPI, type Slide } from '@/shared/api/slides'

import { PromoBannersEditor } from './PromoBannersEditor'

export default function WebsiteEditingPage() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null)
  const [section, setSection] = useState<'promo' | 'slider'>('promo')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    imagePath: '',
    linkUrl: '',
    isActive: true,
    order: 1,
    textPosition: 'center',
    textVerticalPos: 'center',
    textOffsetX: 0,
    textOffsetY: 0,
    titleColor: '#ffffff',
    titleSize: 28,
    descColor: '#ffffff',
    descSize: 13,
    textShadow: true,
    // Новые независимые позиции (проценты) и переключатели
    titlePosXPct: undefined as number | undefined,
    titlePosYPct: undefined as number | undefined,
    descPosXPct: undefined as number | undefined,
    descPosYPct: undefined as number | undefined,
    showTitle: true,
    showDesc: true,
    // Кнопка
    showButton: false,
    buttonText: '',
    buttonPosXPct: undefined as number | undefined,
    buttonPosYPct: undefined as number | undefined,
  })
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  // Drag state for preview
  const previewRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState<null | 'title' | 'desc' | 'button'>(null)

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
      setFormData({
        title: '',
        description: '',
        imageUrl: '',
        imagePath: '',
        linkUrl: '',
        isActive: true,
        order: 1,
        textPosition: 'center',
        textVerticalPos: 'center',
        textOffsetX: 0,
        textOffsetY: 0,
        titleColor: '#ffffff',
        titleSize: 28,
        descColor: '#ffffff',
        descSize: 13,
        textShadow: true,
        titlePosXPct: undefined,
        titlePosYPct: undefined,
        descPosXPct: undefined,
        descPosYPct: undefined,
        showTitle: true,
        showDesc: true,
        showButton: false,
        buttonText: '',
        buttonPosXPct: undefined,
        buttonPosYPct: undefined,
      })
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
    setFormData({
      title: slide.title,
      description: slide.description || '',
      imageUrl: slide.imageUrl || '',
      imagePath: slide.imagePath || '',
      linkUrl: slide.linkUrl || '',
      isActive: slide.isActive,
      order: slide.order,
      textPosition: slide.textPosition || 'center',
      textVerticalPos: slide.textVerticalPos || 'center',
      textOffsetX: slide.textOffsetX || 0,
      textOffsetY: slide.textOffsetY || 0,
      titleColor: slide.titleColor || '#ffffff',
      titleSize: slide.titleSize || 28,
      descColor: slide.descColor || '#ffffff',
      descSize: slide.descSize || 13,
      textShadow: slide.textShadow !== undefined ? slide.textShadow : true,
      titlePosXPct: slide.titlePosXPct,
      titlePosYPct: slide.titlePosYPct,
      descPosXPct: slide.descPosXPct,
      descPosYPct: slide.descPosYPct,
      showTitle: slide.showTitle !== undefined ? slide.showTitle : true,
      showDesc: slide.showDesc !== undefined ? slide.showDesc : true,
      showButton: slide.showButton ?? false,
      buttonText: slide.buttonText ?? '',
      buttonPosXPct: slide.buttonPosXPct,
      buttonPosYPct: slide.buttonPosYPct,
    })
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
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      imagePath: '',
      linkUrl: '',
      isActive: true,
      order: 1,
      textPosition: 'center',
      textVerticalPos: 'center',
      textOffsetX: 0,
      textOffsetY: 0,
      titleColor: '#ffffff',
      titleSize: 28,
      descColor: '#ffffff',
      descSize: 13,
      textShadow: true,
      titlePosXPct: undefined,
      titlePosYPct: undefined,
      descPosXPct: undefined,
      descPosYPct: undefined,
      showTitle: true,
      showDesc: true,
      showButton: false,
      buttonText: '',
      buttonPosXPct: undefined,
      buttonPosYPct: undefined,
    })
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
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <h3 className="text-lg font-medium mb-4">
                    {editingSlide ? 'Редактировать слайдер' : 'Создать новый слайдер'}
                  </h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Заголовок"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                      />
                      <Input
                        label="Описание"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                      
                      {/* Загрузка изображения */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Изображение слайдера
                        </label>
                        <div className="flex items-center space-x-4">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileUpload(file)
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                          {uploading && <span className="text-blue-600">Загрузка...</span>}
                          {selectedFile && <span className="text-green-600">✓ {selectedFile.name}</span>}
                        </div>

                        {/* Кнопка на слайдере */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Показывать Кнопку</label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={!!formData.showButton}
                                onChange={(e) => setFormData({ ...formData, showButton: e.target.checked })}
                                className="mr-2"
                              />
                              Кнопка
                            </label>
                          </div>
                          <div className="md:col-span-2">
                            <Input
                              label="Текст кнопки"
                              value={formData.buttonText}
                              onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                              placeholder="Например: Подробнее"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Кнопка X (%)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={formData.buttonPosXPct ?? ''}
                              onChange={(e) => setFormData({ ...formData, buttonPosXPct: e.target.value === '' ? undefined : Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="—"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Кнопка Y (%)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={formData.buttonPosYPct ?? ''}
                              onChange={(e) => setFormData({ ...formData, buttonPosYPct: e.target.value === '' ? undefined : Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="—"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              onClick={() => setFormData({ ...formData, buttonPosXPct: undefined, buttonPosYPct: undefined })}
                              className="bg-gray-500 hover:bg-gray-600 text-white"
                            >
                              Сбросить кнопку
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Поддерживаемые форматы: JPG, PNG, GIF, WebP. Максимальный размер: 5MB
                        </p>
                      </div>

                      {/* Удалено поле URL изображения по требованию */}
                      <Input
                        label="Ссылка"
                        value={formData.linkUrl}
                        onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                      />

                      {/* Позиционирование текста */}
                      <div className="md:col-span-2">
                        <h4 className="text-lg font-medium text-gray-900 mb-3">Настройки текста</h4>
                        {/* Удалены селекты Горизонтальное/Вертикальное положение по требованию. Оставлена настройка тени ниже. */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formData.textShadow}
                                onChange={(e) => setFormData({ ...formData, textShadow: e.target.checked })}
                                className="mr-2"
                              />
                              Тень текста
                            </label>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                          <Input
                            label="Смещение X (px)"
                            type="number"
                            value={formData.textOffsetX}
                            onChange={(e) => setFormData({ ...formData, textOffsetX: parseInt(e.target.value) || 0 })}
                          />
                          <Input
                            label="Смещение Y (px)"
                            type="number"
                            value={formData.textOffsetY}
                            onChange={(e) => setFormData({ ...formData, textOffsetY: parseInt(e.target.value) || 0 })}
                          />
                          <Input
                            label="Размер заголовка (px)"
                            type="number"
                            value={formData.titleSize}
                            onChange={(e) => setFormData({ ...formData, titleSize: parseInt(e.target.value) || 28 })}
                            min="10"
                            max="100"
                          />
                          <Input
                            label="Размер описания (px)"
                            type="number"
                            value={formData.descSize}
                            onChange={(e) => setFormData({ ...formData, descSize: parseInt(e.target.value) || 13 })}
                            min="8"
                            max="50"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Цвет заголовка
                            </label>
                            <input
                              type="color"
                              value={formData.titleColor}
                              onChange={(e) => setFormData({ ...formData, titleColor: e.target.value })}
                              className="block w-full h-10 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Цвет описания
                            </label>
                            <input
                              type="color"
                              value={formData.descColor}
                              onChange={(e) => setFormData({ ...formData, descColor: e.target.value })}
                              className="block w-full h-10 border border-gray-300 rounded-md"
                            />
                          </div>
                        </div>

                        {/* Независимое позиционирование заголовка и описания (проценты) */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Показывать Заголовок</label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={!!formData.showTitle}
                                onChange={(e) => setFormData({ ...formData, showTitle: e.target.checked })}
                                className="mr-2"
                              />
                              Заголовок
                            </label>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Показывать Описание</label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={!!formData.showDesc}
                                onChange={(e) => setFormData({ ...formData, showDesc: e.target.checked })}
                                className="mr-2"
                              />
                              Описание
                            </label>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок X (%)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={formData.titlePosXPct ?? ''}
                              onChange={(e) => setFormData({ ...formData, titlePosXPct: e.target.value === '' ? undefined : Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="—"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок Y (%)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={formData.titlePosYPct ?? ''}
                              onChange={(e) => setFormData({ ...formData, titlePosYPct: e.target.value === '' ? undefined : Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="—"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Описание X (%)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={formData.descPosXPct ?? ''}
                              onChange={(e) => setFormData({ ...formData, descPosXPct: e.target.value === '' ? undefined : Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="—"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Описание Y (%)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={formData.descPosYPct ?? ''}
                              onChange={(e) => setFormData({ ...formData, descPosYPct: e.target.value === '' ? undefined : Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="—"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              onClick={() => setFormData({ ...formData, titlePosXPct: undefined, titlePosYPct: undefined, descPosXPct: undefined, descPosYPct: undefined })}
                              className="bg-gray-500 hover:bg-gray-600 text-white"
                            >
                              Сбросить проценты
                            </Button>
                          </div>
                        </div>

                        {/* Превью и перетаскивание */}
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Превью слайдера (перетащите Заголовок/Описание/Кнопку)</label>
                          <div
                            ref={previewRef}
                            className="relative w-full"
                            style={{
                              paddingTop: '35%',
                              backgroundColor: '#111',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundImage: (formData.imagePath || formData.imageUrl) ? `url(${formData.imagePath ? `${process.env.NEXT_PUBLIC_API_URL}/${formData.imagePath}` : formData.imageUrl})` : 'none',
                              borderRadius: 8,
                              overflow: 'hidden',
                            }}
                            onMouseMove={(e) => {
                              if (!dragging || !previewRef.current) return
                              const rect = previewRef.current.getBoundingClientRect()
                              const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
                              const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
                              if (dragging === 'title') {
                                setFormData({ ...formData, titlePosXPct: Math.round(xPct), titlePosYPct: Math.round(yPct) })
                              } else if (dragging === 'desc') {
                                setFormData({ ...formData, descPosXPct: Math.round(xPct), descPosYPct: Math.round(yPct) })
                              } else if (dragging === 'button') {
                                setFormData({ ...formData, buttonPosXPct: Math.round(xPct), buttonPosYPct: Math.round(yPct) })
                              }
                            }}
                            onMouseUp={() => setDragging(null)}
                            onMouseLeave={() => setDragging(null)}
                          >
                            {/* Draggable title */}
                            {formData.showTitle && formData.title && (
                              <div
                                onMouseDown={() => setDragging('title')}
                                style={{
                                  position: 'absolute',
                                  left: `${(formData.titlePosXPct ?? 50)}%`,
                                  top: `${(formData.titlePosYPct ?? 40)}%`,
                                  transform: 'translate(-50%, -50%)',
                                  color: formData.titleColor,
                                  fontSize: `${formData.titleSize}px`,
                                  fontWeight: 'bold',
                                  textShadow: formData.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                                  cursor: 'move',
                                  userSelect: 'none',
                                }}
                              >
                                {formData.title}
                              </div>
                            )}
                          {/* Draggable button */}
                          {formData.showButton && formData.buttonText && (
                            <button
                              type="button"
                              onMouseDown={() => setDragging('button')}
                              style={{
                                position: 'absolute',
                                left: `${(formData.buttonPosXPct ?? 50)}%`,
                                top: `${(formData.buttonPosYPct ?? 70)}%`,
                                transform: 'translate(-50%, -50%)',
                                background: 'white',
                                color: 'black',
                                padding: '12px 16px',
                                borderRadius: 8,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                cursor: 'move',
                                userSelect: 'none',
                                border: 'none',
                                fontWeight: 700,
                              }}
                            >
                              {formData.buttonText}
                            </button>
                          )}
                            {/* Draggable description */}
                          {formData.showDesc && formData.description && (
                              <div
                                onMouseDown={() => setDragging('desc')}
                                style={{
                                  position: 'absolute',
                                  left: `${(formData.descPosXPct ?? 50)}%`,
                                  top: `${formData.descPosYPct !== undefined ? formData.descPosYPct : 55}%`,
                                  transform: 'translate(-50%, -50%)',
                                  color: formData.descColor,
                                  fontSize: `${formData.descSize}px`,
                                  textShadow: formData.textShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none',
                                  cursor: 'move',
                                  userSelect: 'none',
                                }}
                              >
                                {formData.description}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Подсказка: удерживайте мышь на тексте и перетаскивайте его для выставления точной позиции. Позиции сохраняются в процентах.</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="mr-2"
                          />
                          Активен
                        </label>
                        <Input
                          label="Порядок"
                          type="number"
                          value={formData.order}
                          onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                          min="1"
                          className="w-24"
                        />
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
                        {editingSlide ? 'Обновить' : 'Создать'}
                      </Button>

                      <Button
                        type="button"
                        onClick={cancelForm}
                        className="bg-gray-500 hover:bg-gray-600 text-white"
                      >
                        Отмена
                      </Button>
                    </div>
                  </form>
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