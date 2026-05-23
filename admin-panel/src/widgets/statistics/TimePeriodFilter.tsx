"use client"

interface TimePeriodFilterProps {
  value: 'day' | 'week' | 'month'
  onChange: (period: 'day' | 'week' | 'month') => void
}

export function TimePeriodFilter({ value, onChange }: TimePeriodFilterProps) {
  const periods = [
    { key: 'day', label: 'День' },
    { key: 'week', label: 'Неделя' },
    { key: 'month', label: 'Месяц' }
  ] as const

  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      {periods.map((period) => (
        <button
          key={period.key}
          onClick={() => onChange(period.key)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            value === period.key
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}
