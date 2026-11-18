import { useEffect, useState } from 'react'
import { Bell, ChevronRight, ClipboardCheck, Database, Eye, EyeOff, FileClock, LayoutDashboard, LogOut, Package, QrCode, Search, ShieldAlert, Timer, Truck } from 'lucide-react'
import { CLAIMS, INVENTORY } from '../lib/data'
import { Banner, Button, cx, Dialog, Field, IconButton, inputCls, Logo, TrainArt } from '../lib/ui'
import { ROLE_META, StaffCtx, type Page, type Role } from './common'
import { staffApi, type StaffUser } from '../lib/api'
import { ClaimsPage, HandoverPage, InventoryPage, ItemDetailPage } from './CS'
import { ShippingQueuePage } from './Logistics'
import { AuditPage, MasterDataPage } from './Admin'
import { DashboardPage } from './Manager'

const MENUS: Record<Role, { p: Page; l: string; icon: typeof Package; badge?: number }[]> = {
  cs: [
    { p: 'inventory', l: 'Inventaris Barang', icon: Package },
    { p: 'claims', l: 'Antrian Klaim', icon: ClipboardCheck, badge: 2 },
    { p: 'handover', l: 'Serah Terima', icon: QrCode },
  ],
  logistik: [{ p: 'shipping', l: 'Antrian Pengiriman', icon: Truck, badge: 1 }],
  admin: [
    { p: 'master', l: 'Data Master', icon: Database },
    { p: 'audit', l: 'Log Audit', icon: FileClock },
  ],
  manager: [{ p: 'dashboard', l: 'Dashboard Eksekutif', icon: LayoutDashboard }],
}
const TITLES: Record<Page, string> = {
  inventory: 'Inventaris Barang',
  item: 'Detail Barang',
  claims: 'Antrian Klaim',
  handover: 'Serah Terima',
  shipping: 'Antrian Pengiriman',
  master: 'Data Master',
  audit: 'Log Audit',
  dashboard: 'Dashboard Eksekutif',
  forbidden: 'Akses Dibatasi',
}

export function StaffApp() {
  const [role, setRole] = useState<Role | null>(null)
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null)
  const [page, setPage] = useState<Page>('inventory')
  const [params, setParams] = useState<Record<string, any>>({})
  const [inventory, setInventory] = useState(INVENTORY)
  const [claims, setClaims] = useState(CLAIMS)
  const [idle, setIdle] = useState(false)
  const [checking, setChecking] = useState(true)

  // Check existing session on mount
  useEffect(() => {
    staffApi.auth.user()
      .then(({ user }) => {
        if (user) {
          setStaffUser(user)
          setRole(user.role)
          setPage(MENUS[user.role][0].p)
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  // Refresh CS dashboard data when logged in as CS or manager
  const refreshDashboard = async () => {
    try {
      const res = await staffApi.cs.dashboard()
      if (res.inventory) setInventory(res.inventory)
      if (res.claims) setClaims(res.claims)
    } catch {}
  }

  useEffect(() => {
    if (role === 'cs' || role === 'admin' || role === 'manager') {
      refreshDashboard()
    }

    const handleFocus = () => {
      if (role === 'cs' || role === 'admin' || role === 'manager') refreshDashboard()
    }
    window.addEventListener('focus', handleFocus)

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && (role === 'cs' || role === 'admin' || role === 'manager')) {
        refreshDashboard()
      }
    }, 3000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [role])

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <p className="text-sm font-semibold text-muted">Memeriksa sesi petugas...</p>
      </div>
    )
  }

  if (!role) {
    return (
      <StaffLogin
        onLogin={(u) => {
          setStaffUser(u)
          setRole(u.role)
          setPage(MENUS[u.role][0].p)
        }}
      />
    )
  }

  const nav = (p: Page, pr: Record<string, any> = {}) => {
    const allowed = MENUS[role].some((m) => m.p === p) || (p === 'item' && (role === 'cs' || role === 'admin'))
    setParams(pr)
    setPage(allowed ? p : 'forbidden')
  }

  const meta = ROLE_META[role]
  const displayName = staffUser ? staffUser.name : meta.name
  const displayInitials = staffUser ? staffUser.initials : meta.initials
  const displayStation = staffUser ? `${meta.label} • ${staffUser.station}` : meta.short
  const menuParent = page === 'item' ? 'inventory' : page

  const handleLogout = async () => {
    try {
      await staffApi.auth.logout()
    } catch {}
    setRole(null)
    setStaffUser(null)
  }

  return (
    <StaffCtx.Provider value={{ role, staffUser, nav, params, inventory, setInventory, claims, setClaims, refreshDashboard }}>
      <div className="flex h-full min-h-[100dvh] bg-canvas">
        <aside className="sticky top-0 flex h-[100dvh] w-[260px] shrink-0 flex-col bg-primary text-white">
          <div className="px-6 pb-6 pt-6">
            <Logo light />
            <p className="mt-1 text-xs text-white/70">Konsol Petugas KAI Commuter</p>
          </div>
          <nav aria-label="Menu petugas" className="flex flex-col gap-1 px-3">
            {MENUS[role].map((m) => {
              const active = menuParent === m.p
              return (
                <button
                  key={m.p}
                  onClick={() => nav(m.p)}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold transition-colors',
                    active ? 'bg-accent text-ink' : 'text-white/90 hover:bg-white/10',
                  )}
                >
                  <m.icon className="size-5" aria-hidden />
                  <span className="flex-1 text-left">{m.l}</span>
                  {(m.p === 'claims' ? claims.filter((c) => c.tab === 'baru').length : m.badge) ? (
                    <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', active ? 'bg-white text-primary' : 'bg-coral text-white')}>
                      {m.p === 'claims' ? claims.filter((c) => c.tab === 'baru').length : m.badge}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>
          <div className="mt-auto">
            <button
              onClick={handleLogout}
              className="mx-3 mb-2 flex min-h-11 w-[calc(100%-24px)] items-center gap-3 rounded-full px-4 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              <LogOut className="size-5" aria-hidden /> Keluar
            </button>
            <TrainArt className="w-full opacity-90" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-white px-8">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
              <span>LoFound</span>
              <ChevronRight className="size-4" aria-hidden />
              {page === 'item' && (
                <>
                  <button onClick={() => nav('inventory')} className="hover:text-primary hover:underline">
                    Inventaris Barang
                  </button>
                  <ChevronRight className="size-4" aria-hidden />
                </>
              )}
              <span className="font-bold text-ink" aria-current="page">
                {TITLES[page]}
              </span>
            </nav>
            <div className="relative ml-auto w-80">
              <Search className="absolute left-3 top-2.5 size-4 text-soft" aria-hidden />
              <label htmlFor="g-search" className="sr-only">
                Pencarian global
              </label>
              <input id="g-search" placeholder="Cari kode barang, laporan, BAST..." className={inputCls() + ' h-9 pl-9'} />
            </div>
            <IconButton icon={Bell} label="Notifikasi" dot className="text-ink hover:bg-tint [&>span]:border-white" />
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {displayInitials}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold text-ink">{displayName}</p>
                <span className="rounded-full bg-tint px-2 py-0.5 text-[11px] font-bold text-primary">
                  {displayStation}
                </span>
              </div>
            </div>
          </header>
          {role === 'manager' && (
            <div role="status" className="flex items-center gap-2 bg-ink px-8 py-2 text-[13px] font-semibold text-white">
              <Eye className="size-4" aria-hidden /> Mode Hanya Lihat • Anda tidak dapat menambah, mengubah, atau menyetujui data.
            </div>
          )}
          <main className="flex-1 p-8">
            {page === 'inventory' && <InventoryPage />}
            {page === 'item' && <ItemDetailPage />}
            {page === 'claims' && <ClaimsPage />}
            {page === 'handover' && <HandoverPage />}
            {page === 'shipping' && <ShippingQueuePage />}
            {page === 'master' && <MasterDataPage />}
            {page === 'audit' && <AuditPage />}
            {page === 'dashboard' && <DashboardPage />}
            {page === 'forbidden' && (
              <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-[24px] border border-line bg-white px-8 py-12 text-center">
                <p className="text-5xl font-extrabold text-tint [-webkit-text-stroke:2px_#318FB5]">403</p>
                <span className="flex size-14 items-center justify-center rounded-2xl bg-tint text-primary">
                  <ShieldAlert className="size-7" aria-hidden />
                </span>
                <h1 className="text-lg font-bold text-ink">Akses dibatasi</h1>
                <p className="text-sm text-muted">Anda tidak memiliki akses ke halaman ini.</p>
                <Button onClick={() => nav(MENUS[role][0].p)}>Kembali ke {MENUS[role][0].l}</Button>
              </div>
            )}
          </main>
        </div>
      </div>
      <Dialog
        fixed
        open={idle}
        onClose={() => {}}
        icon={Timer}
        tone="warn"
        title="Sesi Berakhir"
        actions={
          <Button
            variant="cta"
            full
            onClick={() => {
              setIdle(false)
              handleLogout()
            }}
          >
            Masuk Lagi
          </Button>
        }
      >
        Anda tidak aktif selama 15 menit. Demi keamanan data penumpang, silakan masuk kembali.
      </Dialog>
    </StaffCtx.Provider>
  )
}

function StaffLogin({ onLogin }: { onLogin: (u: StaffUser) => void }) {
  const [email, setEmail] = useState('petugascs@kci.id')
  const [pw, setPw] = useState('lofound2026')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return setErr('Masukkan alamat email dinas yang valid.')
    setErr('')
    setBusy(true)
    try {
      const res = await staffApi.auth.login(email.trim(), pw)
      onLogin(res.user)
    } catch (error: any) {
      setErr(error.message || 'Gagal masuk. Periksa email dan kata sandi Anda.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-[100dvh] grid-cols-[1.1fr_1fr] bg-white">
      <div className="relative flex flex-col justify-between overflow-hidden bg-primary p-12 text-white">
        <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-accent/30" />
        <Logo light />
        <div className="relative">
          <h1 className="max-w-md text-[34px] font-bold leading-tight">Konsol Petugas Lost & Found KRL Commuter Line</h1>
          <p className="mt-3 max-w-md text-white/85">Catat temuan, verifikasi klaim secara buta, dan serahkan barang dengan BAST digital yang tercatat di log audit.</p>
        </div>
        <TrainArt className="relative w-full max-w-xl" />
      </div>
      <div className="flex items-center justify-center p-12">
        <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={submit}>
          <div>
            <h2 className="text-[28px] font-bold text-ink">Masuk Petugas</h2>
            <p className="text-sm text-muted">Hak akses (RBAC) otomatis disesuaikan berdasarkan akun email dinas Anda.</p>
          </div>
          {err && <Banner tone="danger">{err}</Banner>}
          <Field label="Email Dinas" helper="Format role: petugascs@kci.id • petugaslogistik@kci.id • admin@kci.id • kepalastasiun@kci.id">
            {(a) => <input {...a} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="petugascs@kci.id" className={inputCls() + ' h-12'} />}
          </Field>
          <Field label="Kata Sandi" helper="Default sandi dinas: lofound2026">
            {(a) => (
              <div className="relative">
                <input {...a} type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls() + ' h-12 pr-12'} />
                <IconButton
                  type="button"
                  icon={show ? EyeOff : Eye}
                  label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  onClick={() => setShow(!show)}
                  className="absolute right-0.5 top-0.5 text-muted"
                />
              </div>
            )}
          </Field>
          <Button variant="cta" size="lg" full type="submit" loading={busy}>
            {busy ? 'Memproses...' : 'Masuk ke Konsol'}
          </Button>
        </form>
      </div>
    </div>
  )
}
