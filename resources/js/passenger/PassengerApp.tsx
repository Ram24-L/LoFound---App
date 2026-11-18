import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LogIn, MessageCircle, ShieldCheck } from 'lucide-react'
import type { Report } from '../lib/data'
import { authApi, reportApi } from '../lib/api'
import { Button, Field, inputCls, Sheet, useToast } from '../lib/ui'
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

export function PassengerApp() {
  const toast = useToast()
  const [stack, setStack] = useState<Route[]>([{ name: 'home', key: 0 }])
  const [user, setUser] = useState<User | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [unread, setUnread] = useState(0)
  const [gate, setGate] = useState<Gate | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(!navigator.onLine)
  const pending = useRef<Gate | null>(null)

  // Check session on mount
  useEffect(() => {
    authApi.user()
      .then(({ user: u }) => {
        if (u) {
          setUser(u)
          // Fetch reports for logged-in user
          return reportApi.list().then(setReports)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
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
      const userData: User = { name: 'Ramdhan', full: 'M. Ramdhan Maulana', contact: 'ramdhan@mail.com', ...u }
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
        <div className="relative min-h-0 flex-1">
          {stack.map((r, i) => (
            <div key={r.key} className="absolute inset-0" hidden={i !== stack.length - 1}>
              {renderRoute(r)}
            </div>
          ))}
        </div>
        {showNav && <BottomNav />}
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
          onOtpDone={async (phone, otp) => {
            try {
              const res = await authApi.otpLogin(phone, otp)
              finishLogin(res.user)
            } catch {
              finishLogin({ contact: phone })
            }
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
      return <ShippingScreen id={p.id} />
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
  onOtpDone,
  onClearDraft,
}: {
  gate: Gate | null
  hasDraft: boolean
  onClose: () => void
  onGoAuth: (mode: 'login' | 'register') => void
  onOtpDone: (phone: string, otp: string) => void
  onClearDraft: () => void
}) {
  const [step, setStep] = useState<'main' | 'phone' | 'otp'>('main')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const close = () => {
    setStep('main')
    setErr('')
    setOtp('')
    onClose()
  }
  return (
    <Sheet open={!!gate} onClose={close} title={step === 'main' ? 'Masuk untuk melanjutkan' : step === 'phone' ? 'Masuk dengan WhatsApp' : 'Masukkan Kode OTP'}>
      {step === 'main' && gate && (
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
            <Button variant="tint" size="lg" full icon={MessageCircle} onClick={() => setStep('phone')}>
              Lanjut dengan Nomor WhatsApp (OTP)
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={close} className="min-h-11 rounded-xl px-2 text-sm font-semibold text-muted hover:text-ink">
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
      {step === 'phone' && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!/^08\d{8,11}$/.test(phone.replace(/\D/g, ''))) return setErr('Masukkan nomor WhatsApp yang valid (contoh: 0812xxxx).')
            setErr('')
            setStep('otp')
          }}
        >
          <Field label="Nomor WhatsApp" error={err}>
            {(a) => <input {...a} inputMode="tel" autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxxxxxx" className={inputCls(!!err) + ' h-12'} />}
          </Field>
          <Button variant="cta" size="lg" full type="submit">
            Kirim Kode OTP
          </Button>
          <button type="button" onClick={() => setStep('main')} className="min-h-11 text-sm font-semibold text-muted">
            Kembali
          </button>
        </form>
      )}
      {step === 'otp' && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (otp.length !== 6) return setErr('Kode OTP terdiri dari 6 angka.')
            setErr('')
            setBusy(true)
            setTimeout(() => {
              setBusy(false)
              setStep('main')
              const p = phone
              const o = otp
              setOtp('')
              onOtpDone(p, o)
            }, 600)
          }}
        >
          <p className="text-sm text-muted">
            Kode dikirim via WhatsApp ke <b className="text-ink">{phone.slice(0, 4)}****{phone.slice(-3)}</b>. Gunakan 123456 untuk simulasi.
          </p>
          <Field label="Kode OTP (6 angka)" error={err}>
            {(a) => (
              <input
                {...a}
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className={inputCls(!!err) + ' h-14 text-center text-2xl font-bold tracking-[0.5em]'}
              />
            )}
          </Field>
          <Button variant="cta" size="lg" full type="submit" loading={busy}>
            {busy ? 'Memproses...' : 'Verifikasi & Masuk'}
          </Button>
          <p className="text-center text-xs text-muted">Kirim ulang kode dalam 00:45</p>
        </form>
      )}
    </Sheet>
  )
}
