'use client'

import { ReactNode } from 'react'

type PageShellProps = {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <div className={`admin-page mx-auto w-full max-w-[1440px] py-6 md:py-8 ${className}`}>
      {children}
    </div>
  )
}
