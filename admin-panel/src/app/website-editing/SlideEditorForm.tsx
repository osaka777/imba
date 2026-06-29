'use client'

import { useRef, useState } from 'react'
import { Button } from '@/widgets/Button'
import { Input } from '@/widgets/Input'
import type { SlideFormData } from './slideEditorDefaults'

type Layer = 'title' | 'desc' | 'button'
type Viewport = 'desktop' | 'mobile'

type StepperProps = {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  unit?: string
}

function StepperControl({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = 'px',
}: StepperProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        <button
          type="button"
          aria-label="Уменьшить"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="px-4 py-2.5 text-xl font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          −
        </button>
        <div className="flex-1 text-center py-2 border-x border-gray-200 bg-gray-50/50">
          <span className="text-xl font-semibold tabular-nums text-gray-900">{value}</span>
          <span className="text-xs text-gray-500 ml-1">{unit}</span>
        </div>
        <button
          type="button"
          aria-label="Увеличить"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="px-4 py-2.5 text-xl font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          +
        </button>
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function PositionReadout({
  x,
  y,
  onReset,
}: {
  x: number
  y: number
  onReset: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 text-sm">
      <span className="text-gray-600 tabular-nums">
        X: <strong className="text-gray-900">{Math.round(x)}%</strong>
        <span className="mx-2 text-gray-400">·</span>
        Y: <strong className="text-gray-900">{Math.round(y)}%</strong>
      </span>
      <button
        type="button"
        onClick={onReset}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Сброс
      </button>
    </div>
  )
}

type Props = {
  formData: SlideFormData
  setFormData: (data: SlideFormData) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  editing: boolean
  uploading: boolean
  selectedFile: File | null
  onFileSelect: (file: File) => void
}

export function SlideEditorForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  editing,
  uploading,
  selectedFile,
  onFileSelect,
}: Props) {
  const previewRef = useRef<HTMLDivElement | null>(null)
  const [previewViewport, setPreviewViewport] = useState<Viewport>('desktop')
  const [selectedLayer, setSelectedLayer] = useState<Layer>('title')
  const [dragging, setDragging] = useState<Layer | null>(null)

  const patch = (partial: Partial<SlideFormData>) => setFormData({ ...formData, ...partial })

  const isMobile = previewViewport === 'mobile'

  const activeTitlePos = {
    x: isMobile
      ? (formData.titleMobilePosXPct ?? formData.titlePosXPct ?? 50)
      : (formData.titlePosXPct ?? 50),
    y: isMobile
      ? (formData.titleMobilePosYPct ?? formData.titlePosYPct ?? 40)
      : (formData.titlePosYPct ?? 40),
  }

  const activeDescPos = {
    x: isMobile
      ? (formData.descMobilePosXPct ?? formData.descPosXPct ?? 50)
      : (formData.descPosXPct ?? 50),
    y: isMobile
      ? (formData.descMobilePosYPct ?? formData.descPosYPct ?? 55)
      : (formData.descPosYPct ?? 55),
  }

  const activeButtonPos = {
    x: isMobile
      ? (formData.buttonMobilePosXPct ?? formData.buttonPosXPct ?? 50)
      : (formData.buttonPosXPct ?? 50),
    y: isMobile
      ? (formData.buttonMobilePosYPct ?? formData.buttonPosYPct ?? 70)
      : (formData.buttonPosYPct ?? 70),
  }

  const setActiveTitlePos = (xPct: number, yPct: number) => {
    const x = Math.round(xPct)
    const y = Math.round(yPct)
    if (isMobile) {
      patch({ titleMobilePosXPct: x, titleMobilePosYPct: y })
    } else {
      patch({ titlePosXPct: x, titlePosYPct: y })
    }
  }

  const setActiveDescPos = (xPct: number, yPct: number) => {
    const x = Math.round(xPct)
    const y = Math.round(yPct)
    if (isMobile) {
      patch({ descMobilePosXPct: x, descMobilePosYPct: y })
    } else {
      patch({ descPosXPct: x, descPosYPct: y })
    }
  }

  const setActiveButtonPos = (xPct: number, yPct: number) => {
    const x = Math.round(xPct)
    const y = Math.round(yPct)
    if (isMobile) {
      patch({ buttonMobilePosXPct: x, buttonMobilePosYPct: y })
    } else {
      patch({ buttonPosXPct: x, buttonPosYPct: y })
    }
  }

  const titleDisplaySize = isMobile
    ? (formData.titleMobileSize ?? formData.titleSize)
    : formData.titleSize

  const descDisplaySize = isMobile
    ? (formData.descMobileSize ?? formData.descSize)
    : formData.descSize

  const buttonDisplaySize = isMobile
    ? (formData.buttonMobileSize ?? formData.buttonSize)
    : formData.buttonSize

  const setTitleDisplaySize = (v: number) => {
    if (isMobile) patch({ titleMobileSize: v })
    else patch({ titleSize: v })
  }

  const setDescDisplaySize = (v: number) => {
    if (isMobile) patch({ descMobileSize: v })
    else patch({ descSize: v })
  }

  const setButtonDisplaySize = (v: number) => {
    if (isMobile) patch({ buttonMobileSize: v })
    else patch({ buttonSize: v })
  }

  const imageUrl = formData.imagePath
    ? `${process.env.NEXT_PUBLIC_API_URL}/${formData.imagePath}`
    : formData.imageUrl

  const layerRing = (layer: Layer) =>
    selectedLayer === layer
      ? 'outline outline-2 outline-blue-500 outline-offset-2 rounded-sm'
      : ''

  const handlePreviewMove = (e: React.MouseEvent) => {
    if (!dragging || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    if (dragging === 'title') setActiveTitlePos(xPct, yPct)
    else if (dragging === 'desc') setActiveDescPos(xPct, yPct)
    else setActiveButtonPos(xPct, yPct)
  }

  const layers: { id: Layer; label: string }[] = [
    { id: 'title', label: 'Заголовок' },
    { id: 'desc', label: 'Описание' },
    { id: 'button', label: 'Кнопка' },
  ]

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500 mr-1">Превью:</span>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setPreviewViewport('desktop')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                previewViewport === 'desktop'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setPreviewViewport('mobile')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 ${
                previewViewport === 'mobile'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Mobile
            </button>
          </div>
          <span className="text-xs text-gray-400 hidden sm:inline">
            {isMobile ? '390×220 · 16:9' : 'широкий · 16:6'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">Слой:</span>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            {layers.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedLayer(l.id)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l first:border-l-0 border-gray-200 ${
                  selectedLayer === l.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main editor grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Preview */}
        <div className="space-y-2">
          <div
            ref={previewRef}
            className="relative w-full mx-auto select-none"
            style={{
              maxWidth: isMobile ? 390 : undefined,
              paddingTop: isMobile ? '56.25%' : '37.5%',
              backgroundColor: '#111',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}
            onMouseMove={handlePreviewMove}
            onMouseUp={() => setDragging(null)}
            onMouseLeave={() => setDragging(null)}
          >
            {!imageUrl && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                Загрузите изображение
              </div>
            )}

            {formData.showTitle && formData.title && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault()
                  setSelectedLayer('title')
                  setDragging('title')
                }}
                className={layerRing('title')}
                style={{
                  position: 'absolute',
                  left: `${activeTitlePos.x}%`,
                  top: `${activeTitlePos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  color: formData.titleColor,
                  fontSize: `${titleDisplaySize}px`,
                  maxWidth: isMobile ? '88%' : '70%',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  textShadow: formData.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                  cursor: 'move',
                  lineHeight: 1.2,
                }}
              >
                {formData.title}
              </div>
            )}

            {formData.showDesc && formData.description && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault()
                  setSelectedLayer('desc')
                  setDragging('desc')
                }}
                className={layerRing('desc')}
                style={{
                  position: 'absolute',
                  left: `${activeDescPos.x}%`,
                  top: `${activeDescPos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  color: formData.descColor,
                  fontSize: `${descDisplaySize}px`,
                  maxWidth: isMobile ? '90%' : '75%',
                  textAlign: 'center',
                  textShadow: formData.textShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none',
                  cursor: 'move',
                  lineHeight: 1.4,
                }}
              >
                {formData.description}
              </div>
            )}

            {formData.showButton && formData.buttonText && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setSelectedLayer('button')
                  setDragging('button')
                }}
                className={layerRing('button')}
                style={{
                  position: 'absolute',
                  left: `${activeButtonPos.x}%`,
                  top: `${activeButtonPos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  background: 'white',
                  color: 'black',
                  padding: `${Math.round(buttonDisplaySize * 0.6)}px ${Math.round(buttonDisplaySize * 1.1)}px`,
                  borderRadius: 8,
                  fontSize: `${buttonDisplaySize}px`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  cursor: 'move',
                  border: 'none',
                  fontWeight: 700,
                  lineHeight: 1.15,
                }}
              >
                {formData.buttonText}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Перетаскивайте элементы на превью. Размеры и позиции сохраняются отдельно для Desktop и Mobile.
          </p>
        </div>

        {/* Inspector */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              {selectedLayer === 'title' && 'Заголовок'}
              {selectedLayer === 'desc' && 'Описание'}
              {selectedLayer === 'button' && 'Кнопка'}
              <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
                ({isMobile ? 'mobile' : 'desktop'})
              </span>
            </h4>

            {selectedLayer === 'title' && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.showTitle}
                    onChange={(e) => patch({ showTitle: e.target.checked })}
                    className="rounded"
                  />
                  Показывать заголовок
                </label>
                <Input
                  label="Текст заголовка"
                  value={formData.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  required
                />
                <StepperControl
                  label="Размер шрифта"
                  hint={isMobile && !formData.titleMobileSize ? 'Пока используется desktop-размер' : undefined}
                  value={titleDisplaySize}
                  onChange={setTitleDisplaySize}
                  min={12}
                  max={80}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
                  <input
                    type="color"
                    value={formData.titleColor}
                    onChange={(e) => patch({ titleColor: e.target.value })}
                    className="block w-full h-10 border border-gray-200 rounded-lg cursor-pointer"
                  />
                </div>
                <PositionReadout
                  x={activeTitlePos.x}
                  y={activeTitlePos.y}
                  onReset={() =>
                    patch({
                      ...(isMobile
                        ? { titleMobilePosXPct: undefined, titleMobilePosYPct: undefined }
                        : { titlePosXPct: undefined, titlePosYPct: undefined }),
                    })
                  }
                />
              </>
            )}

            {selectedLayer === 'desc' && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.showDesc}
                    onChange={(e) => patch({ showDesc: e.target.checked })}
                    className="rounded"
                  />
                  Показывать описание
                </label>
                <Input
                  label="Текст описания"
                  value={formData.description}
                  onChange={(e) => patch({ description: e.target.value })}
                />
                <StepperControl
                  label="Размер шрифта"
                  hint={isMobile && !formData.descMobileSize ? 'Пока используется desktop-размер' : undefined}
                  value={descDisplaySize}
                  onChange={setDescDisplaySize}
                  min={10}
                  max={40}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
                  <input
                    type="color"
                    value={formData.descColor}
                    onChange={(e) => patch({ descColor: e.target.value })}
                    className="block w-full h-10 border border-gray-200 rounded-lg cursor-pointer"
                  />
                </div>
                <PositionReadout
                  x={activeDescPos.x}
                  y={activeDescPos.y}
                  onReset={() =>
                    patch({
                      ...(isMobile
                        ? { descMobilePosXPct: undefined, descMobilePosYPct: undefined }
                        : { descPosXPct: undefined, descPosYPct: undefined }),
                    })
                  }
                />
              </>
            )}

            {selectedLayer === 'button' && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.showButton}
                    onChange={(e) => patch({ showButton: e.target.checked })}
                    className="rounded"
                  />
                  Показывать кнопку
                </label>
                <Input
                  label="Текст кнопки"
                  value={formData.buttonText}
                  onChange={(e) => patch({ buttonText: e.target.value })}
                  placeholder="Например: Подробнее"
                />
                <StepperControl
                  label="Размер кнопки"
                  hint="Размер шрифта и отступов"
                  value={buttonDisplaySize}
                  onChange={setButtonDisplaySize}
                  min={10}
                  max={28}
                />
                <PositionReadout
                  x={activeButtonPos.x}
                  y={activeButtonPos.y}
                  onReset={() =>
                    patch({
                      ...(isMobile
                        ? { buttonMobilePosXPct: undefined, buttonMobilePosYPct: undefined }
                        : { buttonPosXPct: undefined, buttonPosYPct: undefined }),
                    })
                  }
                />
              </>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.textShadow}
                onChange={(e) => patch({ textShadow: e.target.checked })}
                className="rounded"
              />
              Тень у текста
            </label>
          </div>
        </div>
      </div>

      {/* Global settings */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">Общие настройки</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Изображение слайда
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onFileSelect(file)
                }}
                className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {uploading && <span className="text-blue-600 text-sm">Загрузка…</span>}
              {selectedFile && (
                <span className="text-green-600 text-sm">✓ {selectedFile.name}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF, WebP · до 5 MB</p>
          </div>
          <Input
            label="Ссылка при клике"
            value={formData.linkUrl}
            onChange={(e) => patch({ linkUrl: e.target.value })}
            placeholder="https://..."
          />
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => patch({ isActive: e.target.checked })}
                className="rounded"
              />
              Активен
            </label>
            <Input
              label="Порядок"
              type="number"
              value={formData.order}
              onChange={(e) => patch({ order: parseInt(e.target.value) || 1 })}
              min="1"
              className="w-24"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
          {editing ? 'Сохранить изменения' : 'Создать слайд'}
        </Button>
        <Button type="button" onClick={onCancel} className="bg-gray-500 hover:bg-gray-600 text-white">
          Отмена
        </Button>
      </div>
    </form>
  )
}
