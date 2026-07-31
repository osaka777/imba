'use client'

type LoadingBlockProps = {
  label?: string
  heightClass?: string
}

export function LoadingBlock({ label = 'Загрузка…', heightClass = 'h-64' }: LoadingBlockProps) {
  return (
    <div className={`flex ${heightClass} flex-col items-center justify-center gap-3`}>
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
