'use client'

import { ReactNode } from 'react'

type ChartPanelProps = {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}

export function ChartPanel({ title, subtitle, children, className = '' }: ChartPanelProps) {
  return (
    <section className={`admin-card p-5 md:p-6 ${className}`}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}
