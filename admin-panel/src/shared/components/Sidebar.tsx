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
  Radio,
  LayoutDashboard,
  Inbox,
  ShieldCheck,
  Vote,
} from 'lucide-react'
import { authUtils } from '@/shared/utils/auth'
import { useInboxCounts } from '@/shared/hooks/useInboxCounts'

interface SidebarProps {
  onClose?: () => void
}

const navigation = [
  {
    name: 'Inbox',
    href: '/inbox',
    icon: Inbox,
  },
  {
    name: 'CRM',
    href: '/crm',
    icon: LayoutDashboard,
  },
  {
    name: 'Статистика',
    href: '/',
    icon: BarChart3,
  },
  {
    name: 'Управление',
    icon: Settings,
    children: [
      { name: 'Приоритет игры', href: '/change-priority', icon: Target },
      { name: 'Приоритет подкатегорий', href: '/change-priority-subcategory', icon: Trophy },
      { name: 'Управление игрой', href: '/manage-game', icon: Gamepad2 },
      { name: 'Редактирование сайта', href: '/website-editing', icon: Globe },
    ],
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
      { name: 'Маркеты', href: '/prediction', icon: Vote },
    ],
  },
  {
    name: 'Аккаунты',
    icon: Users,
    children: [
      { name: 'Аудит действий', href: '/audit', icon: ShieldCheck },
      { name: 'Партнёры', href: '/partners', icon: Users },
      { name: 'Kick партнёры', href: '/kick-partners', icon: Radio },
      { name: 'Пользователи', href: '/users', icon: Users },
      { name: 'Рефералы', href: '/referrals', icon: Users },
    ],
  },
]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const inboxCounts = useInboxCounts()

  const handleLinkClick = () => {
    onClose?.()
  }

  return (
    <aside className="flex h-full w-[272px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))]">
      <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-[hsl(var(--sidebar-border))] px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
          I
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Imba CRM</p>
          <p className="text-xs text-muted-foreground">cdn.imba.bet</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => (
          <div key={item.name}>
            {!item.children ? (
              <Link
                href={item.href!}
                onClick={handleLinkClick}
                className={classNames(
                  isActive(pathname, item.href!)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                )}
              >
                <item.icon className="mr-3 h-4 w-4 shrink-0" />
                <span className="flex-1">{item.name}</span>
                {item.href === '/inbox' && inboxCounts.total > 0 ? (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
                    {inboxCounts.total > 99 ? '99+' : inboxCounts.total}
                  </span>
                ) : null}
              </Link>
            ) : (
              <div className="pt-2">
                <div className="flex items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <item.icon className="mr-2 h-3.5 w-3.5" />
                  {item.name}
                </div>
                <div className="mt-1 space-y-0.5">
                  {item.children.map((subItem) => (
                    <Link
                      key={subItem.name}
                      href={subItem.href}
                      onClick={handleLinkClick}
                      className={classNames(
                        isActive(pathname, subItem.href)
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        'group flex items-center rounded-xl px-3 py-2 text-sm transition-colors',
                      )}
                    >
                      <subItem.icon className="mr-3 h-4 w-4 shrink-0 opacity-70" />
                      {subItem.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-[hsl(var(--sidebar-border))] p-4">
        {session?.user?.email ? (
          <p className="mb-3 truncate text-xs text-muted-foreground">{session.user.email}</p>
        ) : null}
        <button
          type="button"
          onClick={() => authUtils.logout()}
          className="flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Выйти
        </button>
      </div>
    </aside>
  )
}
