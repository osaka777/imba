"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  BarChart3,
  Settings,
  Users,
  Gamepad2,
  Gift,
  CreditCard,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  Trophy,
  Target,
  Globe,
  LogOut,
  QrCode,
} from 'lucide-react'
import { authUtils } from '@/shared/utils/auth'

interface SidebarProps {
  onClose?: () => void
}

const navigation = [
  {
    name: 'Статистика',
    href: '/',
    icon: BarChart3,
    current: false,
  },
  {
    name: 'Управление',
    icon: Settings,
    children: [
      { name: 'Приоритет игры', href: '/change-priority', icon: Target },
      { name: 'Приоритет подкатегорий', href: '/change-priority-subcategory', icon: Trophy },
      { name: 'Управление игрой', href: '/manage-game', icon: Gamepad2 },
      { name: 'Редактирование сайта', href: '/website-editing', icon: Globe },
    ]
  },
  {
    name: 'Финансы',
    icon: CreditCard,
    children: [
      { name: 'Настройки платежей', href: '/payment-settings', icon: QrCode },
      { name: 'WC Promo модалка', href: '/promo-modal', icon: Sparkles },
      { name: 'Управление бонусами', href: '/bonuses', icon: Gift },
      { name: 'Заявки пополнений', href: '/deposits', icon: ArrowUpCircle },
      { name: 'Пополнения', href: '/topup', icon: ArrowUpCircle },
      { name: 'Выводы', href: '/withdrawals', icon: ArrowDownCircle },
      { name: 'Ставки ЧМ', href: '/wc-bets', icon: Trophy },
    ]
  },
  {
    name: 'Аккунты',
    icon: Users,
    children: [
      { name: 'пратнеры', href: '/partners', icon: Users },
      { name: 'Пользователи', href: '/users', icon: Users },
      { name: 'рефералы', href: '/referrals', icon: Users },
    ]
  },
]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const handleLinkClick = () => {
    if (onClose) {
      onClose()
    }
  }

  const handleLogout = () => {
    authUtils.logout()
  }

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      {/* Logo */}
      <div className="flex h-16 flex-shrink-0 items-center bg-gray-800 px-4">
        <h1 className="text-xl font-bold text-white">Admin Panel</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto bg-gray-900 px-2 py-4">
        {navigation.map((item) => (
          <div key={item.name}>
            {!item.children ? (
              <Link
                href={item.href!}
                onClick={handleLinkClick}
                className={classNames(
                  pathname === item.href
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                )}
              >
                <item.icon
                  className={classNames(
                    pathname === item.href ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-300',
                    'mr-3 flex-shrink-0 h-6 w-6'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            ) : (
              <div>
                <div className="flex items-center px-2 py-2 text-sm font-medium text-gray-300 rounded-md">
                  <item.icon
                    className="mr-3 flex-shrink-0 h-6 w-6 text-gray-400"
                    aria-hidden="true"
                  />
                  {item.name}
                </div>
                <div className="ml-8 space-y-1">
                  {item.children.map((subItem) => (
                    <Link
                      key={subItem.name}
                      href={subItem.href}
                      onClick={handleLinkClick}
                      className={classNames(
                        pathname === subItem.href
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-700 hover:text-white',
                        'group flex items-center px-2 py-2 text-sm rounded-md'
                      )}
                    >
                      <subItem.icon
                        className={classNames(
                          pathname === subItem.href ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-300',
                          'mr-3 flex-shrink-0 h-5 w-5'
                        )}
                        aria-hidden="true"
                      />
                      {subItem.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-800 p-4">
        {session?.user?.email && (
          <p className="mb-3 truncate text-xs text-gray-400">{session.user.email}</p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center rounded-md px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          <LogOut className="mr-3 h-5 w-5 text-gray-400" />
          Выйти
        </button>
      </div>
    </div>
  )
}
