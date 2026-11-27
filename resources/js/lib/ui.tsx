import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import {
  AlertCircle,
  Backpack,
  Banknote,
  Check,
  ChevronRight,
  CircleCheck,
  Gem,
  Laptop,
  Loader2,
  Package,
  RefreshCw,
  Shirt,
  Umbrella,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'

import { STATIONS } from './data'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- Buttons ---------- */
type BtnVariant = 'cta' | 'primary' | 'outline' | 'ghost' | 'danger' | 'success' | 'tint' | 'white'
const btnStyles: Record<BtnVariant, string> = {
  cta: 'bg-cta text-white font-bold hover:bg-[#d65544] shadow-[0_6px_16px_-6px_rgba(229,96,79,0.6)]',
  primary: 'bg-primary text-white font-semibold hover:bg-primary-dark',
  outline: 'border-[1.5px] border-primary text-primary font-semibold bg-white hover:bg-tint',
  ghost: 'text-primary font-semibold hover:bg-tint',
  danger: 'bg-danger text-white font-bold hover:bg-[#bf3a3a]',
  success: 'bg-success text-white font-bold hover:bg-[#2f9a5f]',
  tint: 'bg-tint text-primary font-semibold hover:bg-[#dcedf4]',
  white: 'border border-white/80 text-white font-semibold hover:bg-white/10',
}

export function Button({
  variant = 'primary',
  size = 'md',
  full,
  loading,
  icon: Icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
  loading?: boolean
  icon?: LucideIcon
}) {
  const sizes = { sm: 'h-9 px-3 text-[13px] rounded-xl', md: 'h-11 px-4 text-sm rounded-2xl', lg: 'h-[52px] px-5 text-base rounded-2xl' }
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex max-w-full shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap transition-colors select-none min-w-11',
        sizes[size],
        btnStyles[variant],
        full && 'w-full',
        (disabled || loading) && 'opacity-50 shadow-none',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : Icon ? <Icon className="size-[18px] shrink-0" aria-hidden /> : null}
      {typeof children === 'string' || typeof children === 'number' ? <span className="min-w-0 truncate">{children}</span> : children}
    </button>
  )
}

export function IconButton({
  icon: Icon,
  label,
  className,
  dot,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; dot?: boolean }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx('relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors', className)}
    >
      <Icon className="size-5" aria-hidden />
      {dot && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full border-2 border-primary bg-coral" />}
    </button>
  )
}

/* ---------- Surfaces ---------- */
export function Card({ children, className, active, ...rest }: { children: ReactNode; className?: string; active?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('rounded-[20px] bg-white', active ? 'border-2 border-primary' : 'border border-line', className)}>
      {children}
    </div>
  )
}

export function Pill({
  active,
  children,
  onClick,
  icon: Icon,
  className,
  disabled,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  icon?: LucideIcon
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cx(
        'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors',
        active ? 'bg-primary text-white' : 'bg-tint text-primary hover:bg-[#dcedf4]',
        disabled && 'opacity-50',
        className,
      )}
    >
      {Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  )
}

type Tone = 'success' | 'info' | 'coral' | 'warn' | 'danger' | 'neutral' | 'primary'
const toneStyles: Record<Tone, string> = {
  success: 'bg-mint text-[#1f7a4a]',
  info: 'bg-tint text-primary-dark',
  coral: 'bg-[#fdebe8] text-[#b8402f]',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-[#eef1f3] text-muted',
  primary: 'bg-primary text-white',
}
export function Badge({ tone = 'neutral', icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-none', toneStyles[tone], className)}>
      {Icon && <Icon className="size-3.5" aria-hidden strokeWidth={2.5} />}
      {children}
    </span>
  )
}

export function Banner({ tone = 'info', icon: Icon, children, className, action }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className={cx('flex items-start gap-2.5 rounded-2xl p-3 text-[13px] leading-5', toneStyles[tone], className)}>
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {action}
    </div>
  )
}

/* ---------- Form fields ---------- */
export function Field({
  label,
  error,
  helper,
  children,
  counter,
  id,
  required,
}: {
  label: ReactNode
  error?: string
  helper?: ReactNode
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
  counter?: string
  id?: string
  required?: boolean
}) {
  const gen = useId()
  const fid = id ?? gen
  const descId = `${fid}-desc`
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={fid} className="text-xs font-semibold text-muted">
          {label}
          {required && <span className="text-cta"> *</span>}
        </label>
        {counter && <span className="text-[11px] tabular-nums text-soft">{counter}</span>}
      </div>
      {children({ id: fid, 'aria-invalid': !!error || undefined, 'aria-describedby': error || helper ? descId : undefined })}
      <div id={descId} aria-live="polite">
        {error ? (
          <p className="flex items-center gap-1 text-xs font-medium text-danger">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
          </p>
        ) : helper ? (
          <p className="text-xs text-muted">{helper}</p>
        ) : null}
      </div>
    </div>
  )
}

export const inputCls = (err?: boolean) =>
  cx(
    'w-full rounded-xl bg-field px-3.5 text-sm text-ink placeholder:text-soft outline-none transition-shadow',
    'focus:ring-2 focus:ring-primary',
    err && 'ring-2 ring-danger/70',
  )

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId()
  return (
    <div className={cx('flex items-center gap-3', disabled && 'opacity-60')}>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-semibold text-ink">
          {label}
        </label>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex h-11 w-14 shrink-0 items-center justify-center"
      >
        <span className={cx('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-success' : 'bg-[#cdd6dc]')}>
          <span className={cx('absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
        </span>
      </button>
    </div>
  )
}

export function Checkbox({ checked, onChange, children, disabled, size = 20 }: { checked: boolean; onChange: (v: boolean) => void; children?: ReactNode; disabled?: boolean; size?: number }) {
  return (
    <label className={cx('flex min-h-11 cursor-pointer items-start gap-3 py-2', disabled && 'cursor-not-allowed opacity-50')}>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        style={{ width: size, height: size }}
        className={cx(
          'mt-0.5 flex shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
          checked ? 'border-primary bg-primary text-white' : 'border-[#b9c7d0] bg-white',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      </span>
      {children && <span className="text-[13px] leading-5 text-ink">{children}</span>}
    </label>
  )
}

export function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-primary' : 'border-[#b9c7d0]')}>
      {checked && <span className="size-2.5 rounded-full bg-primary" />}
    </span>
  )
}

/* ---------- Signature: dashed route connector ---------- */
function RouteRow({
  children,
  onClick,
  label,
  coral,
  showChevron,
}: {
  children: ReactNode
  onClick?: () => void
  label?: string
  coral?: boolean
  showChevron?: boolean
}) {
  const inner = (
    <>
      <span className={cx('relative z-10 size-4 shrink-0 rounded-full border-[3px] bg-white', coral ? 'border-coral' : 'border-primary')} />
      <span className="min-w-0 flex-1 text-left">
        {label && <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>}
        <span className="block truncate text-sm font-bold text-ink">{children}</span>
      </span>
      {onClick && showChevron && <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="-mx-1.5 flex min-h-11 w-[calc(100%+12px)] items-center gap-3 rounded-xl px-1.5 text-left transition-colors hover:bg-white/70">
      {inner}
    </button>
  ) : (
    <div className="flex min-h-11 items-center gap-3">{inner}</div>
  )
}

export function RouteConnector({
  from,
  to,
  fromLabel,
  toLabel,
  gap = 'gap-5',
  onFrom,
  onTo,
  showChevron,
}: {
  from: ReactNode
  to: ReactNode
  fromLabel?: string
  toLabel?: string
  gap?: string
  onFrom?: () => void
  onTo?: () => void
  showChevron?: boolean
}) {
  return (
    <div className={cx('relative flex flex-col', gap)}>
      <span aria-hidden className="absolute bottom-[22px] left-[7px] top-[22px] border-l-2 border-dashed border-[#a9cfdf]" />
      <RouteRow onClick={onFrom} label={fromLabel} showChevron={showChevron}>
        {from}
      </RouteRow>
      <RouteRow onClick={onTo} label={toLabel} coral showChevron={showChevron}>
        {to}
      </RouteRow>
    </div>
  )
}

export function InlineRoute({ from, to, className }: { from: string; to: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5', className)}>
      <span className="size-2 rounded-full border-2 border-primary" aria-hidden />
      {from}
      <span className="w-5 border-t-2 border-dashed border-[#a9cfdf]" aria-hidden />
      <span className="size-2 rounded-full border-2 border-coral" aria-hidden />
      {to}
    </span>
  )
}

/* ---------- Category icons ---------- */
export const categoryIcon: Record<string, LucideIcon> = {
  Elektronik: Laptop,
  'Non Elektronik': Backpack,
  'Uang Tunai': Banknote,
}
/* Icon choices for the admin category icon picker */
export const iconLibrary: Record<string, LucideIcon> = {
  ...categoryIcon,
  Dompet: Wallet,
  Pakaian: Shirt,
  Payung: Umbrella,
  Perhiasan: Gem,
  Lainnya: Package,
}
export function CategoryBadge({ category, size = 44, tone = 'tint', className }: { category: string; size?: number; tone?: 'tint' | 'mint' | 'white'; className?: string }) {
  const Icon = categoryIcon[category] ?? Package
  return (
    <span
      style={{ width: size, height: size }}
      className={cx('flex shrink-0 items-center justify-center rounded-2xl', tone === 'mint' ? 'bg-mint text-success' : tone === 'white' ? 'bg-white text-primary' : 'bg-tint text-primary', className)}
      aria-hidden
    >
      <Icon style={{ width: size * 0.46, height: size * 0.46 }} />
    </span>
  )
}

/* ---------- Feedback ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('lf-skeleton rounded-xl', className)} />
}

export function EmptyState({ icon: Icon = Package, title, body, action }: { icon?: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-tint text-primary">
        <Icon className="size-7" aria-hidden />
      </span>
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {body && <p className="max-w-72 text-[13px] leading-5 text-muted">{body}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ title, onRetry, body }: { title: string; body?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-danger-soft text-danger">
        <AlertCircle className="size-7" aria-hidden />
      </span>
      <p className="text-[15px] font-bold text-ink">{title}</p>
      <p className="max-w-72 text-[13px] text-muted">{body ?? 'Belum berhasil, coba lagi dalam beberapa saat.'}</p>
      <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRetry}>
        Coba Lagi
      </Button>
    </div>
  )
}

/* Prototype-only state switcher, visually separated from product UI */
export function StatePicker<T extends string>({ value, onChange, options, label = 'Pratinjau status' }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[]; label?: string }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-dashed border-[#b9c7d0] bg-white/60 px-2 py-1.5 lf-noscroll">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-soft">{label}</span>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cx('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', value === o.v ? 'bg-ink text-white' : 'text-muted hover:bg-tint')}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

/* ---------- Overlays ---------- */
export function Sheet({ open, onClose, title, children, footer, labelledBy }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const tid = useId()
  useEffect(() => {
    if (!open) return
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="lf-fade absolute inset-0 bg-[#0d2433]/45" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (title ? tid : undefined)}
        className="lf-sheet relative flex max-h-[88%] flex-col rounded-t-[24px] bg-white outline-none"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-[#d5dde2]" aria-hidden />
        {title && (
          <div className="flex items-start gap-2 px-5 pb-1 pt-3">
            <h2 id={tid} className="flex-1 text-lg font-bold leading-6 text-ink">
              {title}
            </h2>
            <IconButton icon={X} label="Tutup" onClick={onClose} className="-mr-2 -mt-2 text-muted hover:bg-tint" />
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-5 pt-2">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  icon: Icon,
  tone = 'info',
  fixed,
  width = 'max-w-[340px]',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children?: ReactNode
  actions: ReactNode
  icon?: LucideIcon
  tone?: Tone
  fixed?: boolean
  width?: string
}) {
  const tid = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className={cx(fixed ? 'fixed' : 'absolute', 'inset-0 z-50 flex items-center justify-center p-5')}>
      <div className="lf-fade absolute inset-0 bg-[#0d2433]/45" onClick={onClose} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-labelledby={tid} className={cx('lf-pop relative w-full rounded-[24px] bg-white p-5 shadow-xl', width)}>
        {Icon && (
          <span className={cx('mb-3 flex size-12 items-center justify-center rounded-2xl', toneStyles[tone])}>
            <Icon className="size-6" aria-hidden />
          </span>
        )}
        <h2 id={tid} className="text-lg font-bold leading-6 text-ink">
          {title}
        </h2>
        {children && <div className="mt-2 text-sm leading-5 text-muted">{children}</div>}
        <div className="mt-5 flex flex-col gap-2">{actions}</div>
      </div>
    </div>
  )
}

/* ---------- Toast ---------- */
type ToastItem = { id: number; msg: string; action?: { label: string; run: () => void }; tone?: 'success' | 'info' }
const ToastCtx = createContext<(msg: string, opts?: { action?: ToastItem['action']; tone?: ToastItem['tone']; duration?: number }) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children, fixed }: { children: ReactNode; fixed?: boolean }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const timer = useRef<number>(0)
  const show = useCallback((msg: string, opts?: { action?: ToastItem['action']; tone?: ToastItem['tone']; duration?: number }) => {
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), msg, action: opts?.action, tone: opts?.tone ?? 'success' })
    timer.current = window.setTimeout(() => setToast(null), opts?.duration ?? 3000)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className={cx(fixed ? 'fixed bottom-6' : 'absolute bottom-28', 'left-1/2 z-[60] w-[calc(100%-40px)] max-w-[380px] -translate-x-1/2')}>
        {toast && (
          <div key={toast.id} className="lf-toast flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-[13px] font-medium text-white shadow-lg">
            <CircleCheck className={cx('size-5 shrink-0', toast.tone === 'success' ? 'text-[#7be0a6]' : 'text-accent')} aria-hidden />
            <span className="flex-1">{toast.msg}</span>
            {toast.action && (
              <button
                className="min-h-9 rounded-lg px-2 text-[13px] font-bold text-accent hover:bg-white/10"
                onClick={() => {
                  toast.action!.run()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- Motion helpers ---------- */
export function useCountUp(target: number, duration = 800, decimals = 0) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setV(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v.toFixed(decimals)
}

export function useAnimatedNumber(target: number, duration = 400) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const f = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const val = f + (target - f) * (1 - Math.pow(1 - p, 3))
      setV(val)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return Math.round(v)
}

export const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

export function ProgressRing({ value, size = 48, stroke = 5, color = '#38B26F', track = '#cdeedb', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset 0.8s ease-out' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  )
}

/* Deterministic pseudo-QR for prototype display */
export function QRCode({ value, size = 180 }: { value: string; size?: number }) {
  const n = 25
  let seed = 0
  for (const ch of value) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const rand = () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return ((seed >>> 0) % 1000) / 1000
  }
  const cells: [number, number][] = []
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && rand() > 0.52) cells.push([x, y])
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#0b1f2c" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#0b1f2c" />
    </g>
  )
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} width={size} height={size} role="img" aria-label={`Kode QR ${value}`} shapeRendering="crispEdges">
      <rect x={-1} y={-1} width={n + 2} height={n + 2} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} fill="#0b1f2c" />
      ))}
      {finder(0, 0)}
      {finder(n - 7, 0)}
      {finder(0, n - 7)}
    </svg>
  )
}

/* Flat vector commuter train */
export function TrainArt({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const body = tone === 'light' ? '#ffffff' : '#ffffff'
  const stripe = tone === 'light' ? '#F47C6D' : '#F47C6D'
  const glass = tone === 'light' ? '#5EB5D7' : '#5EB5D7'
  return (
    <svg viewBox="0 0 320 110" className={className} aria-hidden>
      <rect x="0" y="98" width="320" height="4" rx="2" fill="#ffffff" opacity="0.35" />
      <rect x="0" y="104" width="320" height="2" rx="1" fill="#ffffff" opacity="0.2" />
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${i * 150 + 14} 18)`}>
          <path d={i === 0 ? 'M30 0h112a6 6 0 0 1 6 6v68a6 6 0 0 1-6 6H8a8 8 0 0 1-8-8V40C0 18 12 0 30 0z' : 'M6 0h130a6 6 0 0 1 6 6v68a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6z'} fill={body} />
          <rect x={i === 0 ? 0 : 0} y="52" width={i === 0 ? 148 : 142} height="7" fill={stripe} />
          <rect x={i === 0 ? 0 : 0} y="60" width={i === 0 ? 148 : 142} height="3" fill="#318FB5" />
          {i === 0 && <path d="M6 22c4-10 12-16 24-16h4v30H4z" fill={glass} />}
          {[0, 1, 2, 3].map((w) => (
            <rect key={w} x={(i === 0 ? 44 : 12) + w * 26} y="14" width="18" height="22" rx="3" fill={glass} />
          ))}
          <rect x={i === 0 ? 120 : 118} y="10" width="2" height="62" fill="#d5e8f0" />
          <circle cx="26" cy="82" r="7" fill="#18364A" />
          <circle cx={i === 0 ? 120 : 116} cy="82" r="7" fill="#18364A" />
        </g>
      ))}
    </svg>
  )
}

export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="64 116 420 256" fill="none" className={className} aria-hidden>
      <path d="M126.381 140.8H212.126L158.535 299.536H229.989L212.126 344.889H83.5081L126.381 140.8Z" fill="#318FB5" />
      <path d="M250.9 140.8H322.645C369.279 140.8 415.914 166.4 444.612 203.378H297.535L250.9 140.8Z" fill="#318FB5" />
      <path d="M262.039 192H322.76L310.258 231.638H404.911L388.838 274.107H294.185L269.183 344.889H208.462L262.039 192Z" fill="#49B8E5" />
      <path d="M444.269 270.222C456.177 270.222 465.831 262.581 465.831 253.156C465.831 243.73 456.177 236.089 444.269 236.089C432.361 236.089 422.708 243.73 422.708 253.156C422.708 262.581 432.361 270.222 444.269 270.222Z" fill="#E5604F" />
    </svg>
  )
}

export function Logo({ light, size = 'md' }: { light?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cx(
          'flex shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm',
          size === 'sm' ? 'size-7' : 'size-8',
          !light && 'ring-1 ring-line',
        )}
      >
        <LogoMark className="h-full w-full" />
      </span>
      <span className={cx('font-extrabold tracking-tight', size === 'sm' ? 'text-base' : 'text-lg', light ? 'text-white' : 'text-ink')}>
        Lo<span className={light ? 'text-[#cfeaf5]' : 'text-primary'}>Found</span>
      </span>
    </span>
  )
}

export function useCategories(fallback: string[] = ['Elektronik', 'Non Elektronik', 'Uang Tunai']) {
  const [categories, setCategories] = useState<string[]>(fallback)
  const [nonShippable, setNonShippable] = useState<string[]>(['Uang Tunai'])

  useEffect(() => {
    let mounted = true
    const load = () => {
      fetch('/api/categories', { headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((data) => {
          if (mounted && Array.isArray(data) && data.length > 0) {
            setCategories(data.map((c: any) => c.nama || c.name))
            setNonShippable(data.filter((c: any) => c.shippable === false).map((c: any) => c.nama || c.name))
          }
        })
        .catch(() => {})
    }
    load()
    window.addEventListener('focus', load)
    return () => {
      mounted = false
      window.removeEventListener('focus', load)
    }
  }, [])

  return { categories, nonShippable }
}

export type StationOption = {
  id?: number
  code: string
  name: string
  line: string
  hours?: string
  address?: string | null
  postal_code?: string | null
  phone?: string | null
}

export function useStations(fallback: StationOption[] = STATIONS) {
  const [stations, setStations] = useState<StationOption[]>(fallback)

  useEffect(() => {
    let mounted = true
    const load = () => {
      fetch('/api/stations', { headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((data) => {
          if (mounted && Array.isArray(data) && data.length > 0) {
            setStations(
              data.map((s: any) => ({
                id: s.id,
                code: s.kode || s.code,
                name: s.nama || s.name,
                line: s.lin || s.line,
                hours: s.jam_layanan || s.hours || '04:00–24:00',
                address: s.alamat_posko ?? s.address ?? null,
                postal_code: s.kode_pos ?? s.postal_code ?? null,
                phone: s.telepon_posko ?? s.phone ?? null,
              })),
            )
          }
        })
        .catch(() => {})
    }
    load()
    window.addEventListener('focus', load)
    return () => {
      mounted = false
      window.removeEventListener('focus', load)
    }
  }, [])

  return { stations }
}
