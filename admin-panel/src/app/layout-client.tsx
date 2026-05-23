'use client'

import { ReactNode, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/shared/components/Sidebar'
import { Menu, X } from 'lucide-react'

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
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Mobile menu button */}
      <button
        type="button"
        className="fixed top-4 left-4 z-50 md:hidden bg-gray-800 text-white p-2 rounded-md shadow-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 h-screen w-64 flex-shrink-0 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto pt-16 md:pt-0 px-4 md:px-6 pb-8">
        {children}
      </main>
    </div>
  )
}