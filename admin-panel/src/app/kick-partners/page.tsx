"use client"

import { useCallback, useEffect, useState } from 'react'
import { AuthGuard } from '@/shared/components/AuthGuard'
import { Table } from '@/widgets/Table'
import {
  adminKickPartnersAPI,
  KickPartnerAdminItem,
  KickPartnerAdminSessionItem,
  KickPartnerSessionItem,
} from '@/shared/api/kickPartners'

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('ru-RU')
}

function LiveBadge({ isLive }: { isLive: boolean }) {
  if (!isLive) {
    return <span className="text-gray-500">офлайн</span>
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      LIVE
    </span>
  )
}

export default function KickPartnersPage() {
  const [overview, setOverview] = useState({
    total: 0,
    liveCount: 0,
    connectedCount: 0,
    items: [] as KickPartnerAdminItem[],
  })
  const [recentSessions, setRecentSessions] = useState<KickPartnerAdminSessionItem[]>([])
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null)
  const [partnerSessions, setPartnerSessions] = useState<Record<number, KickPartnerSessionItem[]>>({})
  const [loadingSessionsFor, setLoadingSessionsFor] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'live' | 'token' | 'onboarding'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [partnersData, sessionsData] = await Promise.all([
        adminKickPartnersAPI.getOverview(300),
        adminKickPartnersAPI.getRecentSessions(40),
      ])
      setOverview(partnersData)
      setRecentSessions(sessionsData)
    } catch (e: unknown) {
      console.error('Failed to fetch kick partners:', e)
      setError('Не удалось загрузить Kick-партнёров')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleSessions = async (userId: number) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null)
      return
    }

    setExpandedUserId(userId)
    if (partnerSessions[userId]) return

    setLoadingSessionsFor(userId)
    try {
      const sessions = await adminKickPartnersAPI.getPartnerSessions(userId, 30)
      setPartnerSessions((prev) => ({ ...prev, [userId]: sessions }))
    } catch (e) {
      console.error('Failed to fetch partner sessions:', e)
    } finally {
      setLoadingSessionsFor(null)
    }
  }

  const filteredItems = overview.items.filter((item) => {
    if (filter === 'live') return item.isLive
    if (filter === 'token') return Boolean(item.tokenRefreshFailedAt)
    if (filter === 'onboarding') return item.connected && !item.onboardingComplete
    return true
  })

  const partnerColumns = [
    { header: 'Email', accessor: 'email' as const },
    {
      header: 'Kick',
      accessor: 'channelSlug' as const,
      render: (item: KickPartnerAdminItem) =>
        item.channelSlug ? (
          <a
            href={`https://kick.com/${encodeURIComponent(item.channelSlug)}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            {item.channelSlug}
          </a>
        ) : (
          '—'
        ),
    },
    {
      header: 'Статус',
      accessor: 'isLive' as const,
      render: (item: KickPartnerAdminItem) => (
        <div className="space-y-1">
          <LiveBadge isLive={item.isLive} />
          {!item.connected && item.sessionsCount > 0 ? (
            <div className="text-xs text-amber-600">отключён</div>
          ) : null}
        </div>
      ),
    },
    {
      header: 'Зрители',
      accessor: 'viewerCount' as const,
      render: (item: KickPartnerAdminItem) =>
        item.isLive && item.viewerCount != null ? item.viewerCount : '—',
    },
    {
      header: 'Брендинг',
      accessor: 'hasBranding' as const,
      render: (item: KickPartnerAdminItem) => (item.hasBranding ? 'да' : 'нет'),
    },
    {
      header: 'Часы (30д)',
      accessor: 'compliantHours30d' as const,
      render: (item: KickPartnerAdminItem) => `${item.compliantHours30d} ч`,
    },
    {
      header: 'Welcome $',
      accessor: 'registrationBonusPaid' as const,
      render: (item: KickPartnerAdminItem) =>
        item.registrationBonusPaid > 0 ? `$${item.registrationBonusPaid}` : '—',
    },
    {
      header: 'Онбординг',
      accessor: 'onboardingComplete' as const,
      render: (item: KickPartnerAdminItem) =>
        item.onboardingComplete ? (
          <span className="text-green-700">готов</span>
        ) : item.connected ? (
          <span className="text-amber-600">в процессе</span>
        ) : (
          '—'
        ),
    },
    {
      header: 'Последний эфир',
      accessor: 'lastSessionAt' as const,
      render: (item: KickPartnerAdminItem) => formatDate(item.lastSessionAt),
    },
    {
      header: 'Эфиры',
      accessor: 'sessionsCount' as const,
      render: (item: KickPartnerAdminItem) => (
        <button
          type="button"
          onClick={() => toggleSessions(item.userId)}
          className="text-blue-600 hover:underline"
        >
          {item.sessionsCount}
          {expandedUserId === item.userId ? ' ▲' : ' ▼'}
        </button>
      ),
    },
    {
      header: 'Tag',
      accessor: 'uid' as const,
      render: (item: KickPartnerAdminItem) => (
        <code className="text-xs text-gray-600">{item.uid.slice(0, 8)}…</code>
      ),
    },
    {
      header: 'Токен',
      accessor: 'tokenRefreshFailedAt' as const,
      render: (item: KickPartnerAdminItem) =>
        item.tokenRefreshFailedAt ? (
          <span className="text-xs text-red-600" title={item.tokenRefreshFailedAt}>
            refresh fail
          </span>
        ) : item.connected ? (
          <span className="text-xs text-green-600">ok</span>
        ) : (
          '—'
        ),
    },
  ]

  const recentSessionColumns = [
    { header: 'Партнёр', accessor: 'partnerEmail' as const },
    {
      header: 'Канал',
      accessor: 'kickChannel' as const,
      render: (item: KickPartnerAdminSessionItem) => (
        <a
          href={`https://kick.com/${encodeURIComponent(item.kickChannel)}`}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline"
        >
          {item.kickChannel}
        </a>
      ),
    },
    {
      header: 'Начало',
      accessor: 'startedAt' as const,
      render: (item: KickPartnerAdminSessionItem) => formatDate(item.startedAt),
    },
    {
      header: 'Длительность',
      accessor: 'durationMinutes' as const,
      render: (item: KickPartnerAdminSessionItem) =>
        item.durationMinutes != null ? `${item.durationMinutes} мин` : 'в эфире',
    },
    {
      header: 'Брендинг',
      accessor: 'hadBranding' as const,
      render: (item: KickPartnerAdminSessionItem) => (item.hadBranding ? 'да' : 'нет'),
    },
    {
      header: 'Заголовок',
      accessor: 'lastStreamTitle' as const,
      render: (item: KickPartnerAdminSessionItem) => item.lastStreamTitle || '—',
    },
  ]

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Kick партнёры</h1>
            <p className="text-gray-600">
              Kick-стримеры: live, welcome $10, вывод от $50, онбординг
            </p>
          </div>

          {!loading && !error ? (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', 'Все'],
                  ['live', 'В эфире'],
                  ['token', 'Токен сломан'],
                  ['onboarding', 'Онбординг'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    filter === id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {!loading && !error ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-sm text-gray-500">Всего в списке</div>
                <div className="text-2xl font-semibold text-gray-900">{overview.total}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-sm text-gray-500">Подключены</div>
                <div className="text-2xl font-semibold text-gray-900">{overview.connectedCount}</div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
                <div className="text-sm text-red-600">Сейчас в эфире</div>
                <div className="text-2xl font-semibold text-red-700">{overview.liveCount}</div>
              </div>
            </div>
          ) : null}

          {loading && <div className="text-gray-500">Загрузка...</div>}
          {error && <div className="text-red-600 mb-4">{error}</div>}

          {!loading && (
            <>
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Партнёры</h2>
                <Table<KickPartnerAdminItem> data={filteredItems} columns={partnerColumns} />
                {expandedUserId != null ? (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-800">
                      Сессии партнёра #{expandedUserId}
                    </h3>
                    {loadingSessionsFor === expandedUserId ? (
                      <div className="text-sm text-gray-500">Загрузка сессий...</div>
                    ) : (partnerSessions[expandedUserId]?.length ?? 0) > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                              <th className="px-3 py-2">Начало</th>
                              <th className="px-3 py-2">Длительность</th>
                              <th className="px-3 py-2">Брендинг</th>
                              <th className="px-3 py-2">Заголовок</th>
                            </tr>
                          </thead>
                          <tbody>
                            {partnerSessions[expandedUserId]?.map((session) => (
                              <tr key={session.id} className="border-b border-gray-100">
                                <td className="px-3 py-2">{formatDate(session.startedAt)}</td>
                                <td className="px-3 py-2">
                                  {session.durationMinutes != null
                                    ? `${session.durationMinutes} мин`
                                    : 'в эфире'}
                                </td>
                                <td className="px-3 py-2">
                                  {session.hadBranding ? 'да' : 'нет'}
                                </td>
                                <td className="px-3 py-2">{session.lastStreamTitle || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Сессий нет</div>
                    )}
                  </div>
                ) : null}
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Последние эфиры</h2>
                <Table<KickPartnerAdminSessionItem>
                  data={recentSessions}
                  columns={recentSessionColumns}
                />
              </section>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
