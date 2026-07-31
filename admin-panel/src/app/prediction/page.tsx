"use client"

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { apiCall } from '@/shared/utils/api'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'
import { toast } from 'react-toastify'

type Outcome = {
  id: number
  key: string
  label: string
  labelEn?: string | null
  odds: number
  sortOrder: number
  exposure?: { bets: number; stake: number; liability: number }
}

type PredictionEvent = {
  id: number
  slug: string
  title: string
  titleEn?: string | null
  description: string | null
  descriptionEn?: string | null
  category: string
  imageUrl: string | null
  bannerUrl: string | null
  videoUrl: string | null
  resolveRule: string | null
  resolveRuleEn?: string | null
  status: 'DRAFT' | 'OPEN' | 'LOCKED' | 'SETTLED' | 'VOID'
  closesAt: string | null
  resolvesAt: string | null
  winningOutcomeId: number | null
  settledAt: string | null
  archivedAt?: string | null
  bettingOpen?: boolean
  betsCount?: number
  outcomes: Outcome[]
}

type OutcomeForm = {
  key: string
  label: string
  labelEn: string
  odds: string
}

const fieldClass =
  'w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30'

const btnPrimary =
  'rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'

const btnSecondary =
  'rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50'

function EventMediaEditor({
  row,
  busy,
  onSave,
  onUpload,
}: {
  row: PredictionEvent
  busy: boolean
  onSave: (payload: {
    imageUrl?: string | null
    bannerUrl?: string | null
    videoUrl?: string | null
  }) => Promise<void>
  onUpload: (file: File) => Promise<string>
}) {
  const [imageUrl, setImageUrl] = useState(row.imageUrl || '')
  const [bannerUrl, setBannerUrl] = useState(row.bannerUrl || '')
  const [videoUrl, setVideoUrl] = useState(row.videoUrl || '')
  const [uploading, setUploading] = useState<'image' | 'banner' | null>(null)

  useEffect(() => {
    setImageUrl(row.imageUrl || '')
    setBannerUrl(row.bannerUrl || '')
    setVideoUrl(row.videoUrl || '')
  }, [row.imageUrl, row.bannerUrl, row.videoUrl, row.id])

  const upload = async (file: File, kind: 'image' | 'banner') => {
    setUploading(kind)
    try {
      const path = await onUpload(file)
      const nextImage = kind === 'image' ? path : imageUrl.trim() || null
      const nextBanner = kind === 'banner' ? path : bannerUrl.trim() || null
      if (kind === 'image') setImageUrl(path)
      else setBannerUrl(path)
      await onSave({
        imageUrl: nextImage,
        bannerUrl: nextBanner,
        videoUrl: videoUrl.trim() || null,
      })
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-muted/20 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Медиа / баннер на главной
      </p>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${fieldClass} min-w-[180px] flex-1`}
            placeholder="Иконка"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file, 'image')
            }}
          />
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              src={mediaPreviewUrl(imageUrl) || undefined}
              className="h-8 w-8 rounded object-cover"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${fieldClass} min-w-[180px] flex-1`}
            placeholder="Постер / баннер"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file, 'banner')
            }}
          />
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              src={mediaPreviewUrl(bannerUrl) || undefined}
              className="h-8 max-w-[96px] rounded object-contain bg-muted/40"
            />
          ) : null}
        </div>
        <input
          className={fieldClass}
          placeholder="Видео URL (mp4 / YouTube / Twitch / Kick)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
      </div>
      <button
        type="button"
        className={btnSecondary}
        disabled={busy || uploading != null}
        onClick={() =>
          onSave({
            imageUrl: imageUrl.trim() || null,
            bannerUrl: bannerUrl.trim() || null,
            videoUrl: videoUrl.trim() || null,
          })
        }
      >
        {uploading ? 'Загрузка…' : 'Сохранить медиа'}
      </button>
    </div>
  )
}

function EventI18nEditor({
  row,
  busy,
  onSave,
}: {
  row: PredictionEvent
  busy: boolean
  onSave: (payload: {
    title: string
    titleEn: string | null
    description: string | null
    descriptionEn: string | null
    resolveRule: string | null
    resolveRuleEn: string | null
    outcomes?: Array<{
      key: string
      label: string
      labelEn?: string
      odds: number
      sortOrder?: number
    }>
  }) => Promise<void>
}) {
  const [title, setTitle] = useState(row.title)
  const [titleEn, setTitleEn] = useState(row.titleEn || '')
  const [description, setDescription] = useState(row.description || '')
  const [descriptionEn, setDescriptionEn] = useState(row.descriptionEn || '')
  const [resolveRule, setResolveRule] = useState(row.resolveRule || '')
  const [resolveRuleEn, setResolveRuleEn] = useState(row.resolveRuleEn || '')
  const [outcomeLabels, setOutcomeLabels] = useState(
    row.outcomes.map((o) => ({
      key: o.key,
      label: o.label,
      labelEn: o.labelEn || '',
      odds: o.odds,
      sortOrder: o.sortOrder,
    })),
  )

  useEffect(() => {
    setTitle(row.title)
    setTitleEn(row.titleEn || '')
    setDescription(row.description || '')
    setDescriptionEn(row.descriptionEn || '')
    setResolveRule(row.resolveRule || '')
    setResolveRuleEn(row.resolveRuleEn || '')
    setOutcomeLabels(
      row.outcomes.map((o) => ({
        key: o.key,
        label: o.label,
        labelEn: o.labelEn || '',
        odds: o.odds,
        sortOrder: o.sortOrder,
      })),
    )
  }, [
    row.id,
    row.title,
    row.titleEn,
    row.description,
    row.descriptionEn,
    row.resolveRule,
    row.resolveRuleEn,
    row.outcomes,
  ])

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-muted/20 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Тексты RU / EN
      </p>
      <div className="grid gap-2 lg:grid-cols-2">
        <input
          className={fieldClass}
          placeholder="Title RU"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={fieldClass}
          placeholder="Title EN"
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
        />
        <textarea
          className={fieldClass}
          rows={2}
          placeholder="Description RU"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <textarea
          className={fieldClass}
          rows={2}
          placeholder="Description EN"
          value={descriptionEn}
          onChange={(e) => setDescriptionEn(e.target.value)}
        />
        <input
          className={fieldClass}
          placeholder="Resolve rule RU"
          value={resolveRule}
          onChange={(e) => setResolveRule(e.target.value)}
        />
        <input
          className={fieldClass}
          placeholder="Resolve rule EN"
          value={resolveRuleEn}
          onChange={(e) => setResolveRuleEn(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        {outcomeLabels.map((o, idx) => (
          <div key={o.key} className="grid grid-cols-3 gap-2">
            <div className="flex items-center text-xs text-muted-foreground">
              {o.key}
            </div>
            <input
              className={fieldClass}
              placeholder="label RU"
              value={o.label}
              onChange={(e) => {
                const next = [...outcomeLabels]
                next[idx] = { ...o, label: e.target.value }
                setOutcomeLabels(next)
              }}
            />
            <input
              className={fieldClass}
              placeholder="label EN"
              value={o.labelEn}
              onChange={(e) => {
                const next = [...outcomeLabels]
                next[idx] = { ...o, labelEn: e.target.value }
                setOutcomeLabels(next)
              }}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className={btnSecondary}
        disabled={busy || !title.trim()}
        onClick={() =>
          onSave({
            title: title.trim(),
            titleEn: titleEn.trim() || null,
            description: description.trim() || null,
            descriptionEn: descriptionEn.trim() || null,
            resolveRule: resolveRule.trim() || null,
            resolveRuleEn: resolveRuleEn.trim() || null,
            outcomes: outcomeLabels.map((o, i) => ({
              key: o.key,
              label: o.label.trim() || o.key,
              labelEn: o.labelEn.trim() || undefined,
              odds: o.odds,
              sortOrder: o.sortOrder ?? i,
            })),
          })
        }
      >
        Сохранить тексты
      </button>
    </div>
  )
}

const statusTone: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  OPEN: 'bg-emerald-100 text-emerald-800',
  LOCKED: 'bg-amber-100 text-amber-800',
  SETTLED: 'bg-sky-100 text-sky-800',
  VOID: 'bg-rose-100 text-rose-800',
}

const API = () => `${process.env.NEXT_PUBLIC_API_URL}/api/admin/prediction`

async function uploadPredictionImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('image', file)
  const res = await apiCall(`${API()}/upload`, {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) throw new Error(await res.text())
  const data = (await res.json()) as { path: string }
  const path = data.path.replace(/^\.\//, '')
  return path.startsWith('/') ? path : `/${path}`
}

function mediaPreviewUrl(path: string | null | undefined) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${normalized}` : normalized
}

export default function PredictionEventsPage() {
  const [rows, setRows] = useState<PredictionEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [archiveFilter, setArchiveFilter] = useState<'0' | '1' | 'all'>('0')
  const [busyId, setBusyId] = useState<number | null>(null)

  const [title, setTitle] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')
  const [category, setCategory] = useState('sports')
  const [resolveRule, setResolveRule] = useState('')
  const [resolveRuleEn, setResolveRuleEn] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [publish, setPublish] = useState(true)
  const [outcomes, setOutcomes] = useState<OutcomeForm[]>([
    { key: 'yes', label: 'Да', labelEn: 'Yes', odds: '1.85' },
    { key: 'no', label: 'Нет', labelEn: 'No', odds: '1.85' },
  ])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('archived', archiveFilter)
      const res = await apiCall(`${API()}/events?${params.toString()}`)
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as PredictionEvent[]
      setRows(data || [])
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, archiveFilter])

  const openCount = useMemo(
    () => rows.filter((r) => r.status === 'OPEN').length,
    [rows],
  )

  const create = async () => {
    if (!title.trim()) {
      toast.error('Укажите название (RU)')
      return
    }
    if (!titleEn.trim()) {
      toast.error('Укажите название (EN)')
      return
    }
    if (publish && !resolveRule.trim()) {
      toast.error('Для публикации укажите правило резолва (RU)')
      return
    }
    if (publish && !resolveRuleEn.trim()) {
      toast.error('Для публикации укажите правило резолва (EN)')
      return
    }
    try {
      setBusyId(-1)
      const res = await apiCall(`${API()}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          titleEn: titleEn.trim(),
          description: description.trim() || undefined,
          descriptionEn: descriptionEn.trim() || undefined,
          category,
          resolveRule: resolveRule.trim() || undefined,
          resolveRuleEn: resolveRuleEn.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          bannerUrl: bannerUrl.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
          closesAt: closesAt || undefined,
          publish,
          outcomes: outcomes.map((o, i) => ({
            key: o.key.trim(),
            label: o.label.trim(),
            labelEn: o.labelEn.trim() || undefined,
            odds: Number(o.odds),
            sortOrder: i,
          })),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Событие создано')
      setTitle('')
      setTitleEn('')
      setDescription('')
      setDescriptionEn('')
      setResolveRule('')
      setResolveRuleEn('')
      setClosesAt('')
      setImageUrl('')
      setBannerUrl('')
      setVideoUrl('')
      await load()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка создания')
    } finally {
      setBusyId(null)
    }
  }

  const patchTexts = async (
    id: number,
    payload: {
      title?: string
      titleEn?: string | null
      description?: string | null
      descriptionEn?: string | null
      resolveRule?: string | null
      resolveRuleEn?: string | null
      outcomes?: Array<{
        key: string
        label: string
        labelEn?: string
        odds: number
        sortOrder?: number
      }>
    },
  ) => {
    try {
      setBusyId(id)
      const res = await apiCall(`${API()}/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Тексты обновлены')
      await load()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setBusyId(null)
    }
  }

  const patchMedia = async (
    id: number,
    payload: { imageUrl?: string | null; bannerUrl?: string | null; videoUrl?: string | null },
  ) => {
    try {
      setBusyId(id)
      const res = await apiCall(`${API()}/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Медиа обновлено')
      await load()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setBusyId(null)
    }
  }

  const action = async (
    id: number,
    path: string,
    body?: Record<string, unknown>,
  ) => {
    try {
      setBusyId(id)
      const res = await apiCall(`${API()}/events/${id}/${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Готово')
      await load()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Маркеты"
          description="Event markets RU/EN · house odds · ручной settle"
          actions={(
            <button type="button" onClick={() => void load()} className={btnSecondary}>
              Обновить
            </button>
          )}
        />

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="admin-card p-4">
            <p className="text-xs text-muted-foreground">Всего</p>
            <p className="text-2xl font-semibold">{rows.length}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-xs text-muted-foreground">Открыто</p>
            <p className="text-2xl font-semibold text-emerald-700">{openCount}</p>
          </div>
        </div>

        <div className="admin-card mb-6 p-4">
          <h2 className="mb-3 text-sm font-semibold">Новое событие</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <input
              className={fieldClass}
              placeholder="Название (RU)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="Title (EN)"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
            />
            <select
              className={fieldClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="sports">sports</option>
              <option value="esports">esports</option>
              <option value="other">other</option>
            </select>
            <input
              type="datetime-local"
              className={fieldClass}
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
            <textarea
              className={fieldClass}
              rows={2}
              placeholder="Описание RU (опционально)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <textarea
              className={fieldClass}
              rows={2}
              placeholder="Description EN (optional)"
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="Правило резолва RU (обязательно для публикации)"
              value={resolveRule}
              onChange={(e) => setResolveRule(e.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="Resolve rule EN (required to publish)"
              value={resolveRuleEn}
              onChange={(e) => setResolveRuleEn(e.target.value)}
            />
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Иконка (квадрат ~1:1, JPG/PNG)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={fieldClass}
                  placeholder="/uploads/prediction/icon.png"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploadingImage(true)
                    void uploadPredictionImage(file)
                      .then((path) => setImageUrl(path))
                      .catch((err: unknown) =>
                        toast.error(
                          err instanceof Error ? err.message : 'Ошибка загрузки',
                        ),
                      )
                      .finally(() => setUploadingImage(false))
                  }}
                />
                {uploadingImage ? (
                  <span className="text-xs text-muted-foreground">Загрузка…</span>
                ) : null}
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    src={mediaPreviewUrl(imageUrl) || undefined}
                    className="h-10 w-10 rounded-lg border border-border object-cover"
                  />
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Баннер/логотип (PNG с прозрачным фоном, не чёрный прямоугольник)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={fieldClass}
                  placeholder="/uploads/prediction/banner.png"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploadingBanner(true)
                    void uploadPredictionImage(file)
                      .then((path) => setBannerUrl(path))
                      .catch((err: unknown) =>
                        toast.error(
                          err instanceof Error ? err.message : 'Ошибка загрузки',
                        ),
                      )
                      .finally(() => setUploadingBanner(false))
                  }}
                />
                {uploadingBanner ? (
                  <span className="text-xs text-muted-foreground">Загрузка…</span>
                ) : null}
                {bannerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    src={mediaPreviewUrl(bannerUrl) || undefined}
                    className="h-10 max-w-[120px] rounded border border-border object-contain bg-muted/30"
                  />
                ) : null}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Видео для баннера на главной (mp4 / YouTube / Twitch / Kick)
              </label>
              <input
                className={fieldClass}
                placeholder="https://…"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Исходы: key · label RU · label EN · odds
            </p>
            {outcomes.map((o, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <input
                  className={fieldClass}
                  value={o.key}
                  onChange={(e) => {
                    const next = [...outcomes]
                    next[idx] = { ...o, key: e.target.value }
                    setOutcomes(next)
                  }}
                  placeholder="key"
                />
                <input
                  className={fieldClass}
                  value={o.label}
                  onChange={(e) => {
                    const next = [...outcomes]
                    next[idx] = { ...o, label: e.target.value }
                    setOutcomes(next)
                  }}
                  placeholder="label RU"
                />
                <input
                  className={fieldClass}
                  value={o.labelEn}
                  onChange={(e) => {
                    const next = [...outcomes]
                    next[idx] = { ...o, labelEn: e.target.value }
                    setOutcomes(next)
                  }}
                  placeholder="label EN"
                />
                <input
                  className={fieldClass}
                  value={o.odds}
                  onChange={(e) => {
                    const next = [...outcomes]
                    next[idx] = { ...o, odds: e.target.value }
                    setOutcomes(next)
                  }}
                  placeholder="odds"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
              />
              Сразу открыть (OPEN)
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={busyId === -1}
              onClick={() => void create()}
            >
              Создать
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <select
            className={`${fieldClass} max-w-xs`}
            value={archiveFilter}
            onChange={(e) => setArchiveFilter(e.target.value as '0' | '1' | 'all')}
          >
            <option value="0">Активные</option>
            <option value="1">Архив</option>
            <option value="all">Все (активные + архив)</option>
          </select>
          <select
            className={`${fieldClass} max-w-xs`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Все статусы</option>
            <option value="DRAFT">DRAFT</option>
            <option value="OPEN">OPEN</option>
            <option value="LOCKED">LOCKED</option>
            <option value="SETTLED">SETTLED</option>
            <option value="VOID">VOID</option>
          </select>
        </div>

        <div className="admin-card overflow-hidden">
          {loading ? (
            <LoadingBlock heightClass="h-48" />
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Событий пока нет" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Событие</th>
                    <th>Статус</th>
                    <th>Исходы / liability</th>
                    <th>Закрытие</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{row.id}</td>
                      <td>
                        <div className="font-medium">{row.title}</div>
                        {row.titleEn ? (
                          <div className="text-xs text-muted-foreground">
                            EN: {row.titleEn}
                          </div>
                        ) : (
                          <div className="text-xs text-amber-700">EN: нет перевода</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          /{row.slug} · {row.category}
                          {row.betsCount != null ? ` · ставок: ${row.betsCount}` : ''}
                        </div>
                        {row.resolveRule ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            RU: {row.resolveRule}
                          </div>
                        ) : null}
                        {row.resolveRuleEn ? (
                          <div className="text-xs text-muted-foreground">
                            EN: {row.resolveRuleEn}
                          </div>
                        ) : null}
                        <EventI18nEditor
                          busy={busyId === row.id}
                          row={row}
                          onSave={(payload) => patchTexts(row.id, payload)}
                        />
                        <EventMediaEditor
                          busy={busyId === row.id}
                          row={row}
                          onSave={(payload) => patchMedia(row.id, payload)}
                          onUpload={uploadPredictionImage}
                        />
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${statusTone[row.status] || ''}`}
                          >
                            {row.status}
                          </span>
                          {row.archivedAt ? (
                            <span className="inline-flex w-fit rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                              ARCHIVED
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          {row.outcomes.map((o) => (
                            <div key={o.id} className="text-xs">
                              <span className="font-medium">
                                {o.label}
                                {o.labelEn ? ` / ${o.labelEn}` : ''}
                              </span>
                              {' '}
                              <span className="text-muted-foreground">
                                {o.odds.toFixed(2)} · liab {Math.round(o.exposure?.liability || 0)}
                              </span>
                              {(row.status === 'OPEN' || row.status === 'LOCKED') && (
                                <button
                                  type="button"
                                  className="ml-2 text-primary hover:underline"
                                  disabled={busyId === row.id}
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Рассчитать «${row.title}» как победу «${o.label}»?`,
                                      )
                                    ) {
                                      void action(row.id, 'settle', {
                                        winningOutcomeId: o.id,
                                      })
                                    }
                                  }}
                                >
                                  settle
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted-foreground">
                        {row.closesAt
                          ? new Date(row.closesAt).toLocaleString('ru-RU')
                          : '—'}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {row.status === 'DRAFT' && (
                            <button
                              type="button"
                              className={btnSecondary}
                              disabled={busyId === row.id}
                              onClick={() => void action(row.id, 'publish')}
                            >
                              Publish
                            </button>
                          )}
                          {row.status === 'OPEN' && (
                            <button
                              type="button"
                              className={btnSecondary}
                              disabled={busyId === row.id}
                              onClick={() => void action(row.id, 'lock')}
                            >
                              Lock
                            </button>
                          )}
                          {(row.status === 'OPEN' || row.status === 'LOCKED') && (
                            <button
                              type="button"
                              className={btnSecondary}
                              disabled={busyId === row.id}
                              onClick={() => {
                                if (confirm('Аннулировать событие и вернуть ставки?')) {
                                  void action(row.id, 'void')
                                }
                              }}
                            >
                              Void
                            </button>
                          )}
                          {!row.archivedAt ? (
                            <button
                              type="button"
                              className={btnSecondary}
                              disabled={busyId === row.id}
                              onClick={() => {
                                if (
                                  confirm(
                                    'Отправить в архив? Событие исчезнет с /markets, но не удалится.',
                                  )
                                ) {
                                  void action(row.id, 'archive')
                                }
                              }}
                            >
                              В архив
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={btnSecondary}
                              disabled={busyId === row.id}
                              onClick={() => void action(row.id, 'unarchive')}
                            >
                              Из архива
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageShell>
    </AuthGuard>
  )
}
