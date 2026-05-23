"use client"

import { AuthGuard } from '@/shared/components/AuthGuard'

export default function ReferralsPage() {
  return (
    <AuthGuard>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">рефералы</h1>
          <p className="text-gray-600">Страница рефералов (в разработке)</p>
        </div>
      </div>
    </AuthGuard>
  )
}