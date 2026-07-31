'use client'

export type PeriodValue = 'day' | 'week' | 'month'

type PeriodToggleProps = {
  value: PeriodValue
  onChange: (period: PeriodValue) => void
}

const periods: Array<{ key: PeriodValue; label: string }> = [
  { key: 'day', label: 'День' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

export function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-card p-1">
      {periods.map((period) => (
        <button
          key={period.key}
          type="button"
          onClick={() => onChange(period.key)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            value === period.key
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}
