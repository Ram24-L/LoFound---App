import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, MailCheck } from 'lucide-react'
import { Banner, Button, Checkbox, cx, Field, IconButton, inputCls, Logo, Sheet, TrainArt } from '../lib/ui'
import { authApi } from '../lib/api'
import { useApp } from './ctx'

function strength(pw: string) {
  let s = 0
  if (pw.length >= 8) s++
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) s++
  if (/[A-Z]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s++
  return s
}

export function AuthScreen({ mode: initial = 'login' }: { mode?: 'login' | 'register' }) {
  const { back, login } = useApp()
  const [mode, setMode] = useState<'login' | 'register'>(initial)
  const [f, setF] = useState({ name: '', contact: '', pw: '', pw2: '' })
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tries, setTries] = useState(0)
  const [busy, setBusy] = useState(false)
  const [otpStep, setOtpStep] = useState(false)
  const [otp, setOtp] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [resendSec, setResendSec] = useState(0)
  const [resending, setResending] = useState(false)
  const [reset, setReset] = useState<'closed' | 'form' | 'sent'>('closed')
  const [resetContact, setResetContact] = useState('')
  const locked = tries >= 5
  const reg = mode === 'register'
  const st = strength(f.pw)

  useEffect(() => {
    if (!otpStep || resendSec <= 0) return
    const t = window.setTimeout(() => setResendSec((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [otpStep, resendSec])

  const sendRegisterOtp = async () => {
    const res = await authApi.sendOtp(f.contact, 'register')
    setDevOtp(res.dev_otp ?? null)
    setResendSec(45)
  }

  const validContact = (v: string) => /^\S+@\S+\.\S+$/.test(v) || /^08\d{8,11}$/.test(v.replace(/\D/g, ''))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (locked) return
    const er: Record<string, string> = {}
    if (reg && !f.name.trim()) er.name = 'Kolom ini wajib diisi.'
    if (!f.contact.trim()) er.contact = 'Kolom ini wajib diisi.'
    else if (!validContact(f.contact)) er.contact = 'Masukkan email atau nomor WhatsApp yang valid (contoh: 0812xxxx).'
    if (!f.pw) er.pw = 'Kolom ini wajib diisi.'
    else if (reg && st < 2) er.pw = 'Minimal 8 karakter, kombinasi huruf dan angka.'
    if (reg && f.pw2 !== f.pw) er.pw2 = 'Konfirmasi kata sandi belum sama.'
    setErrors(er)
    if (Object.keys(er).length) return

    setBusy(true)
    if (reg) {
      try {
        await sendRegisterOtp()
        setOtpStep(true)
      } catch (err: any) {
        setErrors({ contact: err.message || 'Gagal mengirim kode OTP.' })
      } finally {
        setBusy(false)
      }
      return
    }

    try {
      const res = await authApi.login(f.contact, f.pw, remember)
      login(res.user)
    } catch (err: any) {
      setTries((t) => t + 1)
      setErrors({ pw: err.message || 'Email/nomor atau kata sandi tidak sesuai.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas lf-noscroll">
      <div className="relative shrink-0 overflow-hidden bg-primary px-5 pb-20 pt-3 text-white">
        <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-accent/30" />
        <div aria-hidden className="absolute -left-10 top-24 size-32 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between">
          <IconButton icon={ArrowLeft} label="Kembali" onClick={back} className="-ml-3 hover:bg-white/10" />
          <Logo light size="sm" />
          <span className="size-11" />
        </div>
        <TrainArt className="relative mx-auto mt-3 w-full max-w-[300px]" />
        <p className="relative mt-3 text-center text-[15px] font-semibold leading-5 text-white/95">Lapor & Temukan Barang Tertinggal Tanpa Antre</p>
      </div>

      <div className="relative z-10 -mt-14 px-5 pb-8">
        <div className="rounded-[24px] border border-line bg-white p-5 shadow-[0_12px_32px_-16px_rgba(24,54,74,0.35)]">
          <div role="tablist" aria-label="Pilih mode" className="grid grid-cols-2 gap-1 rounded-full bg-tint p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m)
                  setErrors({})
                  setOtpStep(false)
                }}
                className={cx('h-11 rounded-full text-sm font-bold transition-colors', mode === m ? 'bg-primary text-white shadow' : 'text-primary')}
              >
                {m === 'login' ? 'Masuk' : 'Daftar Akun'}
              </button>
            ))}
          </div>

          {otpStep ? (
            <form
              className="mt-5 flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault()
                if (otp.length !== 6) return setErrors({ otp: 'Kode OTP terdiri dari 6 angka.' })
                setBusy(true)
                try {
                  const res = await authApi.register(f.name, f.contact, f.pw, otp)
                  login(res.user)
                } catch (err: any) {
                  setErrors({ otp: err.message || 'Pendaftaran gagal.' })
                } finally {
                  setBusy(false)
                }
              }}
            >
              <div className="flex flex-col gap-2 rounded-2xl bg-mint p-3 text-sm text-[#1f7a4a]">
                <div className="flex items-center gap-3">
                  <MailCheck className="size-5 shrink-0" aria-hidden />
                  <span>Masukkan 6 digit kode verifikasi yang dikirim ke <b>{f.contact}</b>.</span>
                </div>
                {devOtp && (
                  <p className="rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold text-primary">
                    Mode Dev (SMTP/WA belum diisi): Kode OTP Anda {devOtp}
                  </p>
                )}
              </div>
              <Field label="Kode OTP (6 angka)" error={errors.otp}>
                {(a) => <input {...a} autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className={inputCls(!!errors.otp) + ' h-14 text-center text-2xl font-bold tracking-[0.5em]'} />}
              </Field>
              <Button variant="cta" size="lg" full type="submit" loading={busy}>
                {busy ? 'Memproses...' : 'Buat Akun & Masuk'}
              </Button>
              <div className="text-center text-xs">
                {resendSec > 0 ? (
                  <p className="text-muted">Kirim ulang kode dalam 00:{String(resendSec).padStart(2, '0')}</p>
                ) : (
                  <button
                    type="button"
                    disabled={resending}
                    onClick={async () => {
                      setResending(true)
                      setErrors((er) => ({ ...er, otp: '' }))
                      try {
                        await sendRegisterOtp()
                      } catch (err: any) {
                        setErrors((er) => ({ ...er, otp: err.message || 'Gagal mengirim ulang kode OTP.' }))
                      } finally {
                        setResending(false)
                      }
                    }}
                    className="min-h-10 font-bold text-primary hover:underline disabled:opacity-50"
                  >
                    {resending ? 'Mengirim ulang...' : 'Kirim Ulang Kode'}
                  </button>
                )}
              </div>
            </form>
          ) : (
            <form className="mt-5 flex flex-col gap-4" onSubmit={submit} noValidate>
              {tries > 0 && !locked && (
                <Banner tone="danger" icon={AlertCircle}>
                  Email/nomor atau kata sandi tidak sesuai. Sisa percobaan: {5 - tries}.
                </Banner>
              )}
              {locked && (
                <Banner tone="danger" icon={Lock}>
                  Akun dikunci 15 menit. Gunakan Lupa Kata Sandi.
                </Banner>
              )}
              {reg && (
                <Field label="Nama Lengkap" error={errors.name}>
                  {(a) => <input {...a} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nama lengkap sesuai KTP" className={inputCls(!!errors.name) + ' h-12'} />}
                </Field>
              )}
              <Field label="Email / Nomor WhatsApp" error={errors.contact}>
                {(a) => <input {...a} autoComplete="username" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="nama@email.com atau 0812xxxx" className={inputCls(!!errors.contact) + ' h-12'} />}
              </Field>
              <Field label="Kata Sandi" error={errors.pw} helper={reg ? 'Minimal 8 karakter, kombinasi huruf dan angka.' : undefined}>
                {(a) => (
                  <div className="relative">
                    <input {...a} type={show ? 'text' : 'password'} autoComplete={reg ? 'new-password' : 'current-password'} value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} placeholder="••••••••" className={inputCls(!!errors.pw) + ' h-12 pr-12'} />
                    <IconButton type="button" icon={show ? EyeOff : Eye} label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} onClick={() => setShow(!show)} className="absolute right-0.5 top-0.5 text-muted hover:text-ink" />
                  </div>
                )}
              </Field>
              {reg && f.pw && (
                <div aria-live="polite">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className={cx('h-1.5 flex-1 rounded-full', i < st ? (st === 1 ? 'bg-coral' : st === 2 ? 'bg-[#f2c94c]' : 'bg-success') : 'bg-[#e1e7eb]')} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted">Kekuatan: {['Lemah', 'Lemah', 'Cukup', 'Kuat'][st]}</p>
                </div>
              )}
              {reg && (
                <Field label="Konfirmasi Kata Sandi" error={errors.pw2}>
                  {(a) => <input {...a} type={show ? 'text' : 'password'} value={f.pw2} onChange={(e) => setF({ ...f, pw2: e.target.value })} placeholder="Ulangi kata sandi" className={inputCls(!!errors.pw2) + ' h-12'} />}
                </Field>
              )}
              {reg && <p className="rounded-xl bg-tint px-3 py-2 text-xs text-primary-dark">NIK hanya diminta sekali, saat Anda mengajukan klaim.</p>}
              {!reg && (
                <div className="-my-1 flex items-center justify-between">
                  <Checkbox checked={remember} onChange={setRemember}>
                    Ingat Sesi Saya
                  </Checkbox>
                  <button type="button" onClick={() => setReset('form')} className="min-h-11 text-[13px] font-bold text-primary hover:underline">
                    Lupa Kata Sandi?
                  </button>
                </div>
              )}
              <Button variant="cta" size="lg" full type="submit" loading={busy} disabled={locked}>
                {busy ? 'Memproses...' : reg ? 'Buat Akun & Masuk' : 'Masuk ke Portal'}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-xs leading-5 text-muted">
            Dengan masuk, Anda menyetujui <button className="font-bold text-primary underline">Kebijakan Privasi (UU PDP)</button>.
          </p>
        </div>
      </div>

      <Sheet open={reset !== 'closed'} onClose={() => setReset('closed')} title="Atur Ulang Kata Sandi">
        {reset === 'form' ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">Masukkan email atau nomor WhatsApp akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru.</p>
            <Field label="Email / Nomor WhatsApp">{(a) => <input {...a} value={resetContact} onChange={(e) => setResetContact(e.target.value)} placeholder="nama@mail.com" className={inputCls() + ' h-12'} />}</Field>
            <Button variant="cta" size="lg" full onClick={() => setReset('sent')} disabled={!validContact(resetContact)}>
              Kirim Tautan Reset
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="lf-pop flex size-16 items-center justify-center rounded-3xl bg-mint text-success">
              <MailCheck className="size-8" aria-hidden />
            </span>
            <p className="text-sm text-ink">
              Tautan reset dikirim ke <b>{resetContact.includes('@') ? resetContact.slice(0, 2) + '***@' + resetContact.split('@')[1] : 'ra***@mail.com'}</b>
            </p>
            <p className="text-xs text-muted">Tautan berlaku 30 menit. Periksa folder spam bila belum masuk.</p>
            <Button variant="outline" full onClick={() => setReset('closed')}>
              Kembali ke Masuk
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
