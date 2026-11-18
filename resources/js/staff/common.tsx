import { createContext, useContext, useEffect, useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Claim, InvItem } from '../lib/data'
import type { StaffUser } from '../lib/api'
import { cx, IconButton } from '../lib/ui'

export type Role = 'cs' | 'logistik' | 'admin' | 'manager'
export type Page = 'inventory' | 'item' | 'claims' | 'handover' | 'shipping' | 'master' | 'audit' | 'dashboard' | 'forbidden'

export const ROLE_META: Record<Role, { label: string; short: string; name: string; initials: string }> = {
  cs: { label: 'Petugas CS', short: 'Petugas CS • JAKK', name: 'Rina Kurniasih', initials: 'RK' },
  logistik: { label: 'Petugas Logistik', short: 'Petugas Logistik • JAKK', name: 'Agus Pratama', initials: 'AP' },
  admin: { label: 'Administrator Sistem', short: 'Administrator • Pusat', name: 'Hendra Wijaya', initials: 'HW' },
  manager: { label: 'Kepala Stasiun', short: 'Kepala Stasiun • JAKK', name: 'Ir. Sutrisno', initials: 'SU' },
}

export type StaffCtxT = {
  role: Role
  staffUser: StaffUser | null
  nav: (p: Page, params?: Record<string, any>) => void
  params: Record<string, any>
  inventory: InvItem[]
  setInventory: React.Dispatch<React.SetStateAction<InvItem[]>>
  claims: Claim[]
  setClaims: React.Dispatch<React.SetStateAction<Claim[]>>
  refreshDashboard?: () => Promise<void>
}
export const StaffCtx = createContext<StaffCtxT>(null as unknown as StaffCtxT)
export const useStaff = () => useContext(StaffCtx)

export function Modal({ open, onClose, title, children, footer, width = 'max-w-[560px]', sub }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  const id = useId()
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="lf-fade absolute inset-0 bg-[#0d2433]/50" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby={id} className={cx('lf-pop relative flex max-h-[92vh] w-full flex-col rounded-[24px] bg-white shadow-2xl', width)}>
        <div className="flex items-start gap-3 border-b border-line px-6 py-4">
          <div className="flex-1">
            <h2 id={id} className="text-lg font-bold text-ink">
              {title}
            </h2>
            {sub && <p className="text-[13px] text-muted">{sub}</p>}
          </div>
          <IconButton icon={X} label="Tutup" onClick={onClose} className="-mr-2 text-muted hover:bg-tint" />
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const id = useId()
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="lf-fade absolute inset-0 bg-[#0d2433]/45" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-labelledby={id} className="relative flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl" style={{ animation: 'lf-fade .2s' }}>
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <h2 id={id} className="flex-1 text-lg font-bold text-ink">
            {title}
          </h2>
          <IconButton icon={X} label="Tutup" onClick={onClose} className="text-muted hover:bg-tint" />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </aside>
    </div>
  )
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-4">
      <div className="flex-1">
        <h1 className="text-[28px] font-bold leading-9 text-ink">{title}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-white', className)}>
      {title && (
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <h2 className="flex-1 text-[15px] font-bold text-ink">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export const th = 'px-4 py-3 text-left text-[12px] font-bold uppercase tracking-wide text-muted'
export const td = 'px-4 py-3 text-[13px] text-ink'

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { v: T; l: string }[] }) {
  return (
    <div role="tablist" className="inline-flex gap-1 rounded-full bg-tint p-1">
      {items.map((i) => (
        <button key={i.v} role="tab" aria-selected={value === i.v} onClick={() => onChange(i.v)} className={cx('h-10 rounded-full px-4 text-[13px] font-bold', value === i.v ? 'bg-primary text-white' : 'text-primary hover:bg-white/60')}>
          {i.l}
        </button>
      ))}
    </div>
  )
}
