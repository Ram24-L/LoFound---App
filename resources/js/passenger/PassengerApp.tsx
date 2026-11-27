import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, LogIn, ShieldCheck } from 'lucide-react'
import type { Report } from '../lib/data'
import { authApi, getTabToken, reportApi, setTabToken } from '../lib/api'
import { Button, Sheet, useToast } from '../lib/ui'
import { Ctx, type Draft, type PassengerCtx, type Route, type RouteName, type User } from './ctx'
import { BottomNav, OfflineBanner } from './shell'
import { HomeScreen } from './Home'
import { AuthScreen } from './Auth'
import { ReportsScreen, DetailScreen, EditScreen } from './Reports'
import { WizardScreen, WizardSuccess } from './Wizard'
import { TrackingScreen, CandidatesScreen, ClaimScreen } from './Tracking'
import { BastScreen, ShippingScreen } from './Bast'
import { NotificationsScreen, ProfileScreen, HelpScreen, SystemScreen } from './Support'

const TAB_ROUTES: RouteName[] = ['home', 'reports', 'profile']
let keySeq = 1

type Gate = { reason: string; intent: () => void; successMsg?: string; expired?: boolean }
type ServerPaymentReturn = { reportId?: string; tabToken?: string }

function readPaymentResume(): { reportId?: string; tabToken?: string | null; ts?: number } | null {
  try {
    const raw = localStorage.getItem('lofound_payment_resume')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { reportId?: string; tabToken?: string | null; ts?: number }
    const isFresh = typeof parsed.ts === 'number' && Date.now() - parsed.ts < 30 * 60 * 1000
    return isFresh ? parsed : null
  } catch {
    return null
  }
}

function detectPaymentReturnSignal(): boolean {
  if (typeof window === 'undefined') return false
  const win = window as Window & { __LOFOUND_PAYMENT_RETURN__?: ServerPaymentReturn }
  if (win.__LOFOUND_PAYMENT_RETURN__?.reportId) return true
  const params = new URLSearchParams(window.location.search)
  if (params.get('payment_return') || params.get('order_id') || params.get('transaction_status')) return true
  try {
    if (sessionStorage.getItem('lofound_payment_return')) return true
  } catch {}
  return Boolean(readPaymentResume()?.reportId)
}

export function PassengerApp() {
  const toast = useToast()
  const [stack, setStack] = useState<Route[]>([{ name: 'home', key: 0 }])
  const [user, setUser] = useState<User | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [unread, setUnread] = useState(0)
  const [gate, setGate] = useState<Gate | null>(null)
  const [loading, setLoading] = useState(true)
  const [returningPayment, setReturningPayment] = useState<boolean>(() => detectPaymentReturnSignal())
  const [offline, setOffline] = useState(!navigator.onLine)
  const pending = useRef<Gate | null>(null)

  // Check session on mount and handle redirect return from payment page (StrictMode-safe)
  useEffect(() => {
    let cancelled = false
    const win = window as Window & {
      __LOFOUND_PAYMENT_RETURN__?: ServerPaymentReturn
    }
    const serverReturn = win.__LOFOUND_PAYMENT_RETURN__
    if (serverReturn?.tabToken) {
      setTabToken('passenger', serverReturn.tabToken)
    }

    const params = new URLSearchParams(window.location.search)
    const returnKode = params.get('payment_return')
    const orderIdParam = params.get('order_id')
    const txStatusParam = params.get('transaction_status')
    const serverReturnId = serverReturn?.reportId ?? null
    let savedReturnId: string | null = null
    try {
      savedReturnId = sessionStorage.getItem('lofound_payment_return')
    } catch {}
    const resumeData = readPaymentResume()
    const resumeReportId = resumeData?.reportId ?? null
    if (!getTabToken('passenger') && resumeData?.tabToken) {
      setTabToken('passenger', resumeData.tabToken)
    }

    const hasReturnSignal = Boolean(serverReturnId || returnKode || resumeReportId || orderIdParam || txStatusParam || savedReturnId)

    const bootstrap = hasReturnSignal
      ? Promise.all([authApi.user(), reportApi.list().catch(() => [] as Report[])]).then(([authRes, list]) => ({
          user: authRes.user,
          list,
        }))
      : authApi.user().then(async ({ user: u }) => ({
          user: u,
          list: u ? await reportApi.list().catch(() => [] as Report[]) : ([] as Report[]),
        }))

    bootstrap
      .then(({ user: u, list }) => {
        if (cancelled) return
        if (u) {
          setUser(u)
          setReports(list)
          if (hasReturnSignal) {
            delete win.__LOFOUND_PAYMENT_RETURN__
            try {
              sessionStorage.removeItem('lofound_payment_return')
              localStorage.removeItem('lofound_payment_resume')
            } catch {}
            if (window.location.pathname !== '/' || window.location.search) {
              window.history.replaceState({}, '', '/')
            }
            const target =
              list.find((r) => serverReturnId && r.id === serverReturnId) ||
              list.find((r) => returnKode && r.id === returnKode) ||
              list.find((r) => resumeReportId && r.id === resumeReportId) ||
              list.find((r) => savedReturnId && r.id === savedReturnId) ||
              list.find((r) => orderIdParam && (r.paymentOrderId === orderIdParam || r.bastCode === orderIdParam))
            if (target) {
              setStack([
                { name: 'home', key: 0 },
                { name: 'reports', key: keySeq++ },
                { name: 'shipping', params: { id: target.id, autoSync: true }, key: keySeq++ },
              ])
            }
          }
        } else {
          delete win.__LOFOUND_PAYMENT_RETURN__
          setTabToken('passenger', null)
          if (window.location.pathname.startsWith('/payment/return')) {
            window.history.replaceState({}, '', '/')
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setReturningPayment(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Listen for online/offline
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const refreshReports = useCallback(async () => {
    if (!user) return
    try {
      const data = await reportApi.list()
      setReports(data)
    } catch {}
  }, [user])

  // Polling & Refetch on window focus for cross-tab sync
  useEffect(() => {
    const handleFocus = () => {
      refreshReports()
    }
    window.addEventListener('focus', handleFocus)

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshReports()
      }
    }, 3000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [refreshReports])

  const go = useCallback((name: RouteName, params?: Record<string, any>) => setStack((s) => [...s, { name, params, key: keySeq++ }]), [])
  const replace = useCallback((name: RouteName, params?: Record<string, any>) => setStack((s) => [...s.slice(0, -1), { name, params, key: keySeq++ }]), [])
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), [])
  const tab = useCallback((name: 'home' | 'reports' | 'profile') => setStack([{ name, key: keySeq++ }]), [])

  const finishLogin = useCallback(
    (u?: Partial<User>) => {
      const userData: User = { name: 'Penumpang', full: 'Penumpang KRL', contact: '-', ...u }
      setUser(userData)
      // Fetch reports for newly logged-in user
      reportApi.list().then(setReports).catch(() => {})

      const p = pending.current
      pending.current = null
      setGate(null)
      setStack((s) => (s[s.length - 1]?.name === 'auth' ? s.slice(0, -1) : s))
      if (p) {
        p.intent()
        toast(p.successMsg ?? 'Berhasil masuk.')
      } else toast('Berhasil masuk. Selamat datang kembali!')
    },
    [toast],
  )

  const requireAuth = useCallback(
    (reason: string, intent: () => void, successMsg?: string) => {
      if (user) return intent()
      setGate({ reason, intent, successMsg })
    },
    [user],
  )

  const ctx: PassengerCtx = useMemo(
    () => ({
      route: stack[stack.length - 1],
      go,
      replace,
      back,
      tab,
      user,
      login: finishLogin,
      logout: () => {
        authApi.logout().catch(() => {})
        setUser(null)
        setReports([])
        setStack([{ name: 'home', key: keySeq++ }])
        toast('Anda telah keluar.', { tone: 'info' })
      },
      requireAuth,
      reports,
      setReports,
      updateReport: (id, patch) => setReports((rs) => rs.map((r) => (r.id === id ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r))),
      draft,
      setDraft,
      unread,
      setUnread,
      expireSession: () => {
        setUser(null)
        setGate({ reason: 'Sesi berakhir. Masuk lagi untuk melanjutkan, data Anda aman.', intent: () => {}, successMsg: 'Berhasil masuk. Anda kembali ke halaman terakhir.', expired: true })
      },
      loading,
      refreshReports,
    }),
    [stack, go, replace, back, tab, user, finishLogin, requireAuth, reports, draft, unread, toast, loading, refreshReports],
  )

  const top = stack[stack.length - 1]
  const showNav = TAB_ROUTES.includes(top.name)

  return (
    <Ctx.Provider value={ctx}>
      <div className="relative flex h-full flex-col overflow-hidden bg-canvas">
        {offline && <OfflineBanner />}
        {returningPayment ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-tint text-primary">
              <Loader2 className="size-7 animate-spin" aria-hidden />
            </span>
            <p className="text-base font-bold text-ink">Memuat status pembayaran...</p>
            <p className="text-xs leading-5 text-muted">Mohon tunggu sebentar</p>
          </div>
        ) : (
          <>
            <div className="relative min-h-0 flex-1">
              {stack.map((r, i) => (
                <div key={r.key} className="absolute inset-0" hidden={i !== stack.length - 1}>
                  {renderRoute(r)}
                </div>
              ))}
            </div>
            {showNav && <BottomNav />}
          </>
        )}
        <LoginGate
          gate={gate}
          hasDraft={!!draft && !user}
          onClose={() => setGate(null)}
          onClearDraft={() => {
            setDraft(null)
            toast('Draf dihapus dari perangkat ini.', { tone: 'info' })
          }}
          onGoAuth={(mode) => {
            pending.current = gate
            setGate(null)
            go('auth', { mode })
          }}
        />
      </div>
    </Ctx.Provider>
  )
}

function renderRoute(r: Route) {
  const p = r.params ?? {}
  switch (r.name) {
    case 'home':
      return <HomeScreen />
    case 'auth':
      return <AuthScreen mode={p.mode} />
    case 'reports':
      return <ReportsScreen />
    case 'wizard':
      return <WizardScreen />
    case 'wizardSuccess':
      return <WizardSuccess id={p.id} count={p.count} />
    case 'detail':
      return <DetailScreen id={p.id} />
    case 'edit':
      return <EditScreen id={p.id} />
    case 'tracking':
      return <TrackingScreen id={p.id} />
    case 'candidates':
      return <CandidatesScreen id={p.id} />
    case 'claim':
      return <ClaimScreen id={p.id} candidates={p.candidates} />
    case 'bast':
      return <BastScreen id={p.id} />
    case 'shipping':
      return <ShippingScreen id={p.id} autoSync={Boolean(p.autoSync)} />
    case 'notifications':
      return <NotificationsScreen />
    case 'profile':
      return <ProfileScreen />
    case 'help':
      return <HelpScreen />
    case 'system':
      return <SystemScreen kind={p.kind} />
  }
}

function LoginGate({
  gate,
  hasDraft,
  onClose,
  onGoAuth,
  onClearDraft,
}: {
  gate: Gate | null
  hasDraft: boolean
  onClose: () => void
  onGoAuth: (mode: 'login' | 'register') => void
  onClearDraft: () => void
}) {
  return (
    <Sheet open={!!gate} onClose={onClose} title="Masuk untuk melanjutkan">
      {gate && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 rounded-2xl bg-tint p-3.5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-sm leading-5 text-ink">{gate.reason}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="cta" size="lg" full icon={LogIn} onClick={() => onGoAuth('login')}>
              Masuk
            </Button>
            <Button variant="outline" size="lg" full onClick={() => onGoAuth('register')}>
              Daftar Akun
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="min-h-11 rounded-xl px-2 text-sm font-semibold text-muted hover:text-ink">
              Nanti dulu
            </button>
            {hasDraft && (
              <button onClick={onClearDraft} className="min-h-11 rounded-xl px-2 text-xs font-semibold text-danger hover:underline">
                Perangkat bersama? Hapus draf
              </button>
            )}
          </div>
          {hasDraft && <p className="-mt-2 text-xs text-muted">Draf tamu tersimpan di perangkat ini dan terhapus otomatis setelah 24 jam.</p>}
        </div>
      )}
    </Sheet>
  )
}
