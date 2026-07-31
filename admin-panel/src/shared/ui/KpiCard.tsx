'use client'

import { LucideIcon } from 'lucide-react'

type KpiCardProps = {
  label: string
  value: string
  hint?: string
  trend?: string
  trendUp?: boolean
  icon: LucideIcon
  accent?: 'emerald' | 'rose' | 'sky' | 'violet' | 'amber' | 'slate'
}

const accentMap = {
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  rose: 'bg-rose-50 text-rose-600 ring-rose-200',
  sky: 'bg-sky-50 text-sky-600 ring-sky-200',
  violet: 'bg-violet-50 text-violet-600 ring-violet-200',
  amber: 'bg-amber-50 text-amber-600 ring-amber-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function KpiCard({
  label,
  value,
  hint,
  trend,
  trendUp,
  icon: Icon,
  accent = 'slate',
}: KpiCardProps) {
  return (
    <div className="admin-card group p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          {trend ? (
            <p
              className={`mt-2 text-xs font-medium ${
                trendUp === undefined
                  ? 'text-muted-foreground'
                  : trendUp
                    ? 'text-emerald-600'
                    : 'text-rose-600'
              }`}
            >
              {trend}
            </p>
          ) : null}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${accentMap[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
