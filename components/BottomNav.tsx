'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Upload, ShoppingBag, Wallet } from 'lucide-react'

const navItems = [
  { href: '/', icon: Home, label: 'Market' },
  { href: '/upload', icon: Upload, label: 'Upload' },
  { href: '/purchases', icon: ShoppingBag, label: 'Purchases' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="glass-strong border-t border-border/50 px-2 py-2 safe-area-pb">
        <div className="flex items-center justify-around">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[60px]
                  ${active
                    ? 'text-primary bg-primary/10'
                    : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-semibold tracking-wide">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
