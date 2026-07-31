'use client'

type EmptyStateProps = {
  title?: string
  description?: string
}

export function EmptyState({
  title = 'Нет данных',
  description = 'За выбранный период пока нет значений для отображения.',
}: EmptyStateProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
