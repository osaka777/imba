"use client"

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { apiCall } from '@/shared/utils/api'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingBlock } from '@/shared/ui/LoadingBlock'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageShell } from '@/shared/ui/PageShell'
import { toast } from 'react-toastify'

type AuditRow = {
  id: number
  actorRole: string
  action: string
  entityType: string
  entityId: string | null
  ip: string | null
  userAgent: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [query, setQuery] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '200')
      if (actionFilter) params.set('action', actionFilter)
      if (entityFilter) params.set('entityType', entityFilter)
      const res = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/audit/logs?${params.toString()}`)
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as AuditRow[]
      setRows(data || [])
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки аудита')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, entityFilter])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      String(row.id).includes(q)
      || row.action.toLowerCase().includes(q)
      || row.entityType.toLowerCase().includes(q)
      || (row.entityId || '').toLowerCase().includes(q)
      || (row.ip || '').toLowerCase().includes(q),
    )
  }, [rows, query])

  const actions = Array.from(new Set(rows.map((row) => row.action))).sort()
  const entities = Array.from(new Set(rows.map((row) => row.entityType))).sort()

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Аудит действий"
          description="История админ-действий по платежам, бонусам и промо"
          actions={(
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Обновить
            </button>
          )}
        />

        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: id, action, entity, ip..."
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Все действия</option>
            {actions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Все сущности</option>
            {entities.map((entity) => (
              <option key={entity} value={entity}>{entity}</option>
            ))}
          </select>
          <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            Записей: <span className="font-semibold text-foreground">{filtered.length}</span>
          </div>
        </div>

        <div className="admin-card overflow-hidden">
          {loading ? (
            <LoadingBlock heightClass="h-48" />
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Записей пока нет" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Время</th>
                    <th>Роль</th>
                    <th>Действие</th>
                    <th>Сущность</th>
                    <th>IP</th>
                    <th>Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{row.id}</td>
                      <td className="whitespace-nowrap text-sm">
                        {new Date(row.createdAt).toLocaleString('ru-RU')}
                      </td>
                      <td>{row.actorRole}</td>
                      <td className="font-medium">{row.action}</td>
                      <td>
                        {row.entityType}
                        {row.entityId ? (
                          <span className="ml-1 text-xs text-muted-foreground">#{row.entityId}</span>
                        ) : null}
                      </td>
                      <td className="text-xs text-muted-foreground">{row.ip || '—'}</td>
                      <td className="max-w-[420px]">
                        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
                          {JSON.stringify(row.metadata || {}, null, 2)}
                        </pre>
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
