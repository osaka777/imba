'use client'

import { ReactNode, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Sidebar } from '@/shared/components/Sidebar'
import { GlobalSearch } from '@/shared/components/GlobalSearch'

interface LayoutClientProps {
  children: ReactNode
}

export function LayoutClient({ children }: LayoutClientProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-xl border border-border bg-card p-2 text-foreground shadow-lg md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Меню"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label="Закрыть меню"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-40 h-screen w-[272px] flex-shrink-0 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="ml-12 flex-1 md:ml-0">
            <GlobalSearch />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-8 pt-4 md:px-8 md:pt-6">
          {children}
        </main>
      </div>
    </div>
  )
}
