'use client'

import { useEffect, useState } from 'react'
import { apiCall } from '@/shared/utils/api'

type InboxCounts = {
  pendingDeposits: number
  pendingWithdrawals: number
  pendingPredictionSettles: number
  total: number
}

export function useInboxCounts(pollMs = 30_000) {
  const [counts, setCounts] = useState<InboxCounts>({
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    pendingPredictionSettles: 0,
    total: 0,
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await apiCall(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/inbox/counts`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as InboxCounts
        if (!cancelled) setCounts(data)
      } catch {
        // ignore polling errors
      }
    }

    void load()
    const id = setInterval(() => void load(), pollMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [pollMs])

  return counts
}
