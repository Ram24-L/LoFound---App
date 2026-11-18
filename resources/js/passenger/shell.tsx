import type { ReactNode } from 'react'
import { ArrowLeft, Home, ClipboardList, PlusCircle, User, WifiOff } from 'lucide-react'
import { cx, IconButton } from '../lib/ui'
import { useApp } from './ctx'

export function Screen({ header, footer, children, className, bodyClass }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <div className={cx('flex h-full min-h-0 flex-col', className)}>
      {header}
      <main className={cx('min-h-0 flex-1 overflow-y-auto lf-noscroll', bodyClass)}>{children}</main>
      {footer && <div className="shrink-0 border-t border-line bg-white/95 px-5 pb-4 pt-3 backdrop-blur">{footer}</div>}
    </div>
  )
}

export function TopBar({ title, onBack, right, sub, tone = 'white' }: { title: ReactNode; onBack?: () => void; right?: ReactNode; sub?: ReactNode; tone?: 'white' | 'primary' }) {
  const { back } = useApp()
  const primary = tone === 'primary'
  return (
    <header className={cx('shrink-0 px-2 pb-2 pt-2', primary ? 'bg-primary text-white' : 'border-b border-line bg-white text-ink')}>
      <div className="flex min-h-12 items-center gap-1">
        <IconButton icon={ArrowLeft} label="Kembali" onClick={onBack ?? back} className={primary ? 'hover:bg-white/10' : 'hover:bg-tint'} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[18px] font-bold leading-6">{title}</h1>
          {sub && <p className={cx('truncate text-xs', primary ? 'text-white/80' : 'text-muted')}>{sub}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function OfflineBanner() {
  return (
    <div role="status" className="flex shrink-0 items-center gap-2 bg-ink px-5 py-2 text-xs font-medium text-white">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      Anda sedang offline. Draf laporan tersimpan otomatis.
    </div>
  )
}

export function BottomNav() {
  const { route, tab, go, user, requireAuth } = useApp()
  const items = [
    { k: 'home', l: 'Beranda', icon: Home },
    { k: 'wizard', l: 'Lapor', icon: PlusCircle },
    { k: 'reports', l: 'Lacak', icon: ClipboardList },
    { k: 'profile', l: 'Profil', icon: User },
  ] as const
  return (
    <nav aria-label="Navigasi utama" className="shrink-0 border-t border-line bg-white px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1">
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          const active = route.name === it.k
          return (
            <li key={it.k}>
              <button
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (it.k === 'wizard') return go('wizard')
                  if (it.k === 'home') return tab('home')
                  if (!user)
                    return requireAuth(
                      it.k === 'reports' ? 'Masuk untuk melihat dan melacak semua laporan kehilangan Anda.' : 'Masuk untuk mengelola profil, alamat tersimpan, dan pengaturan notifikasi.',
                      () => tab(it.k),
                      'Berhasil masuk.',
                    )
                  tab(it.k)
                }}
                className={cx('flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold', active ? 'text-primary' : 'text-muted hover:text-ink')}
              >
                <span className={cx('flex h-7 w-12 items-center justify-center rounded-full', active && 'bg-tint')}>
                  <it.icon className="size-5" aria-hidden strokeWidth={active ? 2.4 : 2} />
                </span>
                {it.l}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-bold text-ink">{children}</h2>
      {action}
    </div>
  )
}
