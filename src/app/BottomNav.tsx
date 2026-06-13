'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/log',             icon: '📋', label: 'Log' },
  { href: '/history',         icon: '📅', label: 'History' },
  { href: '/patterns',        icon: '📊', label: 'Patterns' },
  { href: '/meals',           icon: '🍽️', label: 'Meals' },
  { href: '/recommendations', icon: '✨', label: 'Coach' },
  { href: '/export',          icon: '📤', label: 'Export' },
]

export default function BottomNav() {
  const path = usePathname()
  return (
    <nav className="bottom-nav">
      <div className="nav-inner">
        {tabs.map(t => (
          <Link key={t.href} href={t.href} className={`nav-tab${path === t.href ? ' active' : ''}`}>
            <span className="nav-icon">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
