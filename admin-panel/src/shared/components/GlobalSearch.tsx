'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { adminUsersAPI, User } from '@/shared/api/users'
import { formatBalances } from '@/shared/lib/format'

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await adminUsersAPI.searchUsers(query)
        setResults(data)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="relative w-full max-w-md">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
        <Search className="h-4 w-4" />
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Поиск пользователя: email / id / телефон"
        className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/25"
      />
      {open ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Поиск…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Ничего не найдено</div>
          ) : (
            results.map((user) => (
              <button
                key={user.id}
                type="button"
                className="flex w-full items-start justify-between gap-3 border-b border-border/60 px-3 py-2 text-left last:border-0 hover:bg-accent"
                onMouseDown={() => {
                  router.push(`/users/${user.id}`)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{user.email}</div>
                  <div className="text-xs text-muted-foreground">
                    #{user.id}
                    {user.defaultCurrencyCode ? ` · ${user.defaultCurrencyCode}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-xs font-medium text-emerald-700">
                  {formatBalances(user.balances)}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
