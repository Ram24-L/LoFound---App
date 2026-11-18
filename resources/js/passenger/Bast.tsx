import { useEffect, useState } from 'react'
import { AlertCircle, Check, Clock, Copy, Download, ImageDown, Lock, MapPin, Maximize2, Package, ShieldCheck, Store, Truck, Users, X } from 'lucide-react'
import { NON_SHIPPABLE } from '../lib/data'
import { Badge, Banner, Button, cx, Field, inputCls, Pill, QRCode, RadioDot, RouteConnector, rupiah, Toggle, useAnimatedNumber, useToast } from '../lib/ui'
import { reportApi } from '../lib/api'
import { useApp } from './ctx'
import { Screen, TopBar } from './shell'

export function BastScreen({ id }: { id: string }) {
  const { reports, replace, updateReport, back, user } = useApp()
  const toast = useToast()
  const r = reports.find((x) => x.id === id)!
  const [method, setMethod] = useState<'A' | 'B'>('B')
  const [shippable] = useState(!r?.items?.some((i) => NON_SHIPPABLE.includes(i.category)))
  const [proxy, setProxy] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [pdf, setPdf] = useState<'idle' | 'busy' | 'error'>('idle')
  const [pdfFail] = useState(false)
  const [qrCode, setQrCode] = useState(r?.qrCode || r?.bastCode || 'KCI-2026-089')
  const bastTitleCode = r?.bastCode || qrCode
  const m = shippable ? method : 'A'

  useEffect(() => {
    if (r?.qrCode) setQrCode(r.qrCode)
    else if (r?.bastCode) setQrCode(r.bastCode)
  }, [r?.qrCode, r?.bastCode])

  return (
    <Screen
      header={<TopBar title="BAST Digital" sub={`#${id}`} />}
      footer={
        <Button
          variant="cta"
          size="lg"
          full
          onClick={async () => {
            if (m === 'B') return replace('shipping', { id })
            try {
              const res = await reportApi.bast(id, { method: 'stasiun' })
              if (res.qr) setQrCode(res.qr)
              updateReport(id, res.report)
            } catch {}
            toast('Metode pengambilan disimpan. Tunjukkan QR di Posko CS.')
            back()
          }}
        >
          {m === 'B' ? 'Lanjutkan' : 'Selesai'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        {/* Perforated ticket */}
        <article aria-label="Tiket BAST digital" className="relative rounded-[20px] bg-white shadow-[0_18px_40px_-20px_rgba(24,54,74,0.45)]">
          <div className="rounded-t-[20px] bg-primary px-4 py-3 text-center text-[11px] font-bold tracking-wider text-white">BERITA ACARA SERAH TERIMA (BAST) #{bastTitleCode}</div>
          <div className="px-5 pb-4 pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[26px] font-extrabold tabular-nums leading-8 text-ink">{r.time}</p>
                <p className="text-xs font-semibold text-muted">Lapor • {r.from}</p>
              </div>
              <div className="flex flex-1 items-center gap-1 px-1" aria-hidden>
                <span className="size-2.5 rounded-full border-2 border-primary" />
                <span className="flex-1 border-t-2 border-dashed border-[#a9cfdf]" />
                <span className="text-coral">➝</span>
              </div>
              <div className="text-right">
                <p className="text-[26px] font-extrabold tabular-nums leading-8 text-ink">{r.updated}</p>
                <p className="text-xs font-semibold text-muted">Disetujui • {r.to}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">{r.date}</span>
              <Badge tone="success" icon={Check}>
                100% Valid
              </Badge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 rounded-2xl bg-tint/60 p-3">
              <div className="col-span-2">
                <dt className="text-[11px] font-semibold text-muted">Pemilik</dt>
                <dd className="text-sm font-bold text-ink">{user?.full || user?.name || 'M. Ramdhan Maulana'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-muted">NIK</dt>
                <dd className="text-sm font-bold tabular-nums text-ink">3201************</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-muted">Barang</dt>
                <dd className="truncate text-sm font-bold text-ink">{r.items[0]?.name.split(' +')[0] || 'Barang'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] font-semibold text-muted">Lokasi Simpan</dt>
                <dd className="text-sm font-bold text-ink">Posko CS St. {r.to}</dd>
              </div>
            </dl>
          </div>
          {/* perforation */}
          <div className="relative flex items-center" aria-hidden>
            <span className="absolute -left-3 size-6 rounded-full bg-canvas" />
            <span className="mx-5 flex-1 border-t-2 border-dashed border-line" />
            <span className="absolute -right-3 size-6 rounded-full bg-canvas" />
          </div>
          <div className="flex flex-col items-center gap-2 px-5 pb-5 pt-4">
            <button onClick={() => setZoom(true)} aria-label="Perbesar kode QR" className="group relative rounded-2xl border border-line p-2.5 hover:border-primary">
              <QRCode value={qrCode} size={180} />
              <span className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-ink/80 text-white">
                <Maximize2 className="size-4" aria-hidden />
              </span>
            </button>
            <p className="text-xs text-muted">Kode BAST / QR</p>
            <p className="font-mono text-base font-bold tracking-[0.2em] text-ink">{qrCode}</p>
            <p className="text-[11px] font-semibold text-success">Tersedia offline</p>
            <div className="mt-1 grid w-full grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                loading={pdf === 'busy'}
                onClick={() => {
                  setPdf('busy')
                  setTimeout(() => {
                    if (pdfFail) return setPdf('error')
                    setPdf('idle')
                    toast('BAST_KCI-2026-089.pdf diunduh.')
                  }, 900)
                }}
              >
                Unduh PDF BAST
              </Button>
              <Button variant="tint" size="sm" icon={ImageDown} onClick={() => toast('Tiket disimpan ke galeri.')}>
                Simpan ke Galeri
              </Button>
            </div>
            {pdf === 'error' && (
              <p role="alert" className="flex items-center gap-1 text-xs font-medium text-danger">
                <AlertCircle className="size-3.5" aria-hidden /> Gagal membuat PDF. Coba lagi.
              </p>
            )}
          </div>
        </article>

        <section aria-labelledby="ret-title">
          <h2 id="ret-title" className="mb-3 text-[15px] font-bold text-ink">
            Pilih Metode Pengambilan
          </h2>
          <div role="radiogroup" className="flex flex-col gap-2.5">
            <MethodCard checked={m === 'A'} onClick={() => setMethod('A')} icon={Store} title="Ambil Mandiri di Stasiun" badge={<Badge tone="success">Gratis</Badge>}>
              <p>Posko CS St. Jakarta Kota</p>
              <p className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden /> 06:00–22:00 WIB
              </p>
              <button onClick={(e) => (e.stopPropagation(), toast('Membuka peta Posko CS...', { tone: 'info' }))} className="mt-1 inline-flex min-h-9 items-center gap-1 font-bold text-primary hover:underline">
                <MapPin className="size-3.5" aria-hidden /> Lihat di Peta
              </button>
            </MethodCard>
            <MethodCard checked={m === 'B'} disabled={!shippable} onClick={() => shippable && setMethod('B')} icon={shippable ? Truck : Lock} title="Kirim via Ekspedisi ke Rumah" badge={!shippable ? <Badge tone="neutral" icon={Lock}>Terkunci</Badge> : undefined}>
              <p>Estimasi 1–2 hari kerja • mulai Rp 18.000</p>
            </MethodCard>
            {!shippable && (
              <Banner tone="warn" icon={Lock}>
                Barang kategori ini tidak dapat dikirim demi keamanan. Silakan ambil di stasiun.
              </Banner>
            )}
          </div>
          {m === 'A' && (
            <div className="mt-3 rounded-[20px] border border-line bg-white px-4 py-1">
              <Toggle checked={proxy} onChange={setProxy} label="Diwakilkan?" description="Orang lain mengambil barang atas nama Anda." />
              {proxy && (
                <div className="flex flex-col gap-3 pb-4">
                  <Field label="Nama Pengambil">{(a) => <input {...a} className={inputCls() + ' h-12'} placeholder="Nama sesuai KTP" />}</Field>
                  <p className="flex items-start gap-1.5 rounded-xl bg-tint p-3 text-xs leading-5 text-primary-dark">
                    <Users className="mt-0.5 size-4 shrink-0" aria-hidden /> Pengambil wajib membawa surat kuasa bertanda tangan dan KTP asli miliknya.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="Kode QR diperbesar" className="lf-fade absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-white px-6">
          <button aria-label="Tutup" onClick={() => setZoom(false)} className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-tint text-ink">
            <X className="size-5" aria-hidden />
          </button>
          <p className="flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-xs font-bold text-success">☀ Kecerahan layar dinaikkan</p>
          <QRCode value="KCI-2026-089" size={280} />
          <p className="font-mono text-xl font-bold tracking-[0.25em] text-ink">KCI-089-7QX2</p>
          <p className="text-base font-bold text-ink">Tunjukkan ke petugas</p>
        </div>
      )}
    </Screen>
  )
}

function MethodCard({ checked, onClick, icon: Icon, title, children, badge, disabled }: { checked: boolean; onClick: () => void; icon: typeof Truck; title: string; children: React.ReactNode; badge?: React.ReactNode; disabled?: boolean }) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onClick()}
      className={cx('flex cursor-pointer items-start gap-3 rounded-[20px] bg-white p-4', checked ? 'border-2 border-primary' : 'border border-line', disabled && 'cursor-not-allowed bg-[#f5f7f8] opacity-70')}
    >
      <span className="mt-0.5">
        <RadioDot checked={checked} />
      </span>
      <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-xl', disabled ? 'bg-[#e8ecef] text-muted' : 'bg-tint text-primary')}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 text-xs leading-5 text-muted">
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm font-bold text-ink">{title}</p>
          {badge}
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------------- Shipping & payment ---------------- */
const COURIERS = [
  { k: 'KAI Logistik Express', price: 18000, eta: '1–2 hari' },
  { k: 'JNE Reguler', price: 16000, eta: '2–3 hari' },
  { k: 'Pos Indonesia', price: 14000, eta: '3–4 hari' },
]

export function ShippingScreen({ id }: { id: string }) {
  const { reports, updateReport, back, user, login } = useApp()
  const toast = useToast()
  const r = reports.find((x) => x.id === id)
  const [f, setF] = useState({ name: '', wa: '', addr: '', city: '', zip: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [courier, setCourier] = useState('KAI Logistik Express')
  const [insure, setInsure] = useState(true)
  const [pay, setPay] = useState<'qris' | 'ewallet'>('qris')
  const [phase, setPhase] = useState<'form' | 'paying' | 'pending' | 'paid'>('form')
  const [mode] = useState<'normal' | 'pending' | 'fail' | 'resi' | 'area'>('normal')
  const [payErr, setPayErr] = useState('')
  const [countdown, setCountdown] = useState(23 * 3600 + 59 * 60 + 12)
  const c = COURIERS.find((x) => x.k === courier)!
  const total = c.price + (insure ? 5000 : 0) + 2500
  const shown = useAnimatedNumber(total)

  // Real package status from backend (controlled by Petugas Logistik / Admin in /staff)
  const realAwb = r?.awb || 'Menunggu input resi petugas logistik'
  const pkgStep = r?.status === 'selesai' ? 2 : r?.awb ? 1 : 0

  useEffect(() => {
    if (phase !== 'pending') return
    const t = setInterval(() => setCountdown((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const fmt = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')

  const validate = () => {
    const er: Record<string, string> = {}
    if (!f.name.trim()) er.name = 'Kolom ini wajib diisi.'
    if (!/^08\d{8,11}$/.test(f.wa.replace(/\D/g, ''))) er.wa = 'Masukkan nomor WhatsApp yang valid (contoh: 0812xxxx).'
    if (!f.addr.trim()) er.addr = 'Alamat lengkap wajib diisi.'
    if (!f.city.trim()) er.city = 'Kolom ini wajib diisi.'
    if (!/^\d{5}$/.test(f.zip)) er.zip = 'Kode pos harus 5 digit.'
    if (!courier) er.courier = 'Pilih salah satu jasa kurir.'
    if (mode === 'area' && courier === 'JNE Reguler') er.courier = 'Kurir ini belum melayani area tersebut. Pilih kurir lain.'
    setErrors(er)
    return !Object.keys(er).length
  }
  const doPay = async () => {
    if (phase === 'paying') return // prevent double taps
    if (!validate()) return
    setPayErr('')
    setPhase('paying')
    try {
      const res = await reportApi.bast(id, {
        method: 'ekspedisi',
        courier,
        address: f.addr,
        city: f.city,
        zip: f.zip,
        name: f.name,
        wa: f.wa,
        insure,
        pay_method: pay,
      })
      updateReport(id, res.report)
      setPhase('paid')
    } catch (err: any) {
      setPhase('form')
      setPayErr(err.message || 'Pembayaran belum berhasil. Coba lagi atau ganti metode.')
    }
  }

  const inp = (k: keyof typeof f, label: string, ph: string, extra?: Partial<React.InputHTMLAttributes<HTMLInputElement>>) => (
    <Field label={label} required error={errors[k]}>
      {(a) => <input {...a} {...extra} value={f[k]} onChange={(e) => setF({ ...f, [k]: k === 'zip' ? e.target.value.replace(/\D/g, '') : e.target.value })} placeholder={ph} className={inputCls(!!errors[k]) + ' h-12'} />}
    </Field>
  )

  if (phase === 'paid')
    return (
      <Screen
        header={<TopBar title="Pembayaran Berhasil" sub={`#${id}`} />}
        footer={
          <Button variant="cta" size="lg" full onClick={back}>
            Kembali ke Status Laporan
          </Button>
        }
      >
        <div className="relative flex flex-col gap-4 overflow-hidden p-5">
          <Confetti />
          <section className="flex flex-col items-center gap-3 rounded-[20px] border border-[#c6efd8] bg-mint p-5 text-center">
            <span className="lf-pop flex size-16 items-center justify-center rounded-full bg-success text-white">
              <Check className="size-9" strokeWidth={3} aria-hidden />
            </span>
            <Badge tone="success" className="bg-white">
              LUNAS • Terkirim ke Antrian Logistik
            </Badge>
            <p className="text-[22px] font-bold text-ink">{rupiah(total)}</p>
            <p className="text-xs text-muted">
              Dibayar via {pay === 'qris' ? 'QRIS / Virtual Account' : 'E-Wallet'} • {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
            </p>
            <Button variant="outline" size="sm" icon={Download} onClick={() => toast(`Resi_Bayar_${id}.pdf diunduh.`)}>
              Unduh Resi Bayar PDF
            </Button>
          </section>
          <section className="rounded-[20px] border border-line bg-white p-4">
            <p className="text-xs font-semibold text-muted">Nomor Resi Kurir • {courier}</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="flex-1 font-mono text-[15px] font-bold tracking-wide text-ink">{realAwb}</p>
              {r?.awb && (
                <Button variant="tint" size="sm" icon={Copy} onClick={() => toast('Nomor resi disalin.')}>
                  Salin
                </Button>
              )}
            </div>
            <ol className="mt-4 flex flex-col gap-3">
              {['Menunggu dijemput kurir', 'Dalam perjalanan', 'Tiba'].map((st, i) => (
                <li key={st} className="flex items-center gap-3">
                  <span className={cx('flex size-6 items-center justify-center rounded-full border-2', i < pkgStep ? 'border-success bg-success text-white' : i === pkgStep ? 'border-primary' : 'border-[#c4d3db]')}>
                    {i < pkgStep ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i === pkgStep ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                  </span>
                  <span className={cx('flex-1 text-sm', i <= pkgStep ? 'font-bold text-ink' : 'text-muted')}>{st}</span>
                  {i === pkgStep && <Badge tone="info">Saat ini</Badge>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </Screen>
    )

  return (
    <Screen
      header={<TopBar title="Pengiriman Ekspedisi" sub={`#${id}`} />}
      footer={
        phase === 'pending' ? (
          <Button variant="cta" size="lg" full onClick={() => (setPhase('paid'), updateReport(id, { status: 'dikirim' }))}>
            Saya Sudah Bayar
          </Button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Button variant="cta" size="lg" full loading={phase === 'paying'} onClick={doPay}>
              {phase === 'paying' ? 'Memproses pembayaran...' : `Simulasikan Bayar Lunas (${rupiah(total)})`}
            </Button>
            <p className="text-center text-[11px] text-muted">Mode simulasi: tidak ada dana yang ditarik.</p>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-3 p-5">
        {phase === 'pending' && (
          <section className="flex flex-col items-center gap-2 rounded-[20px] border-2 border-primary bg-white p-4 text-center">
            <p className="text-xs font-semibold text-muted">Virtual Account BCA</p>
            <p className="font-mono text-xl font-bold tracking-wider text-ink">8808 0812 3456 7890</p>
            <Badge tone="warn" icon={Clock}>
              Bayar sebelum {fmt(countdown)}
            </Badge>
            <p className="text-xs text-muted">Total {rupiah(total)}. Status otomatis berubah setelah pembayaran diterima.</p>
          </section>
        )}
        <section className="rounded-[20px] border border-line bg-white p-4">
          <RouteConnector gap="gap-2" from="Posko CS St. Jakarta Kota" to={`Alamat Rumah: ${f.city || 'Bogor'}`} fromLabel="Dari" toLabel="Ke" />
        </section>
        <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-ink">Alamat Penerima</h2>
            {user?.address?.addr && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setF({
                    name: user.address?.name || user.full || '',
                    wa: user.address?.wa || '',
                    addr: user.address?.addr || '',
                    city: user.address?.city || '',
                    zip: user.address?.zip || '',
                  })
                }
              >
                Gunakan alamat tersimpan
              </Button>
            )}
          </div>
          {inp('name', 'Nama Penerima', 'Nama sesuai KTP', { autoComplete: 'name' })}
          {inp('wa', 'Nomor WhatsApp', '0812xxxxxxxx', { inputMode: 'tel' })}
          {inp('addr', 'Alamat Lengkap', 'Nama jalan, nomor rumah, RT/RW', { autoComplete: 'street-address' })}
          <div className="grid grid-cols-[1fr_110px] gap-3">
            {inp('city', 'Kota/Kecamatan', 'Bogor Tengah')}
            {inp('zip', 'Kode Pos', '16143', { inputMode: 'numeric', maxLength: 5 })}
          </div>
        </section>
        <section className="rounded-[20px] border border-line bg-white p-4">
          <h2 className="mb-3 text-[15px] font-bold text-ink">Jasa Kurir</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 lf-noscroll" role="radiogroup" aria-label="Jasa kurir">
            {COURIERS.map((co) => (
              <Pill key={co.k} active={courier === co.k} onClick={() => (setCourier(co.k), setErrors((e) => ({ ...e, courier: '' })))} icon={Package}>
                {co.k} • {rupiah(co.price)}
              </Pill>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Estimasi tiba {c.eta} kerja</p>
          <div aria-live="polite">
            {errors.courier && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
                <AlertCircle className="size-3.5" aria-hidden /> {errors.courier}
              </p>
            )}
          </div>
          <div className="mt-2 border-t border-line pt-1">
            <Toggle checked={insure} onChange={setInsure} label="Proteksi Asuransi Pengiriman (+Rp 5.000)" description="Ganti rugi hingga Rp 10.000.000 bila barang rusak/hilang." />
          </div>
        </section>
        <section className="rounded-xl bg-field p-4" aria-label="Rincian tagihan">
          <dl className="flex flex-col gap-2 text-sm">
            {[
              ['Ongkos Kirim', c.price],
              ['Biaya Asuransi', insure ? 5000 : 0],
              ['Biaya Layanan (Admin Fee)', 2500],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between text-muted">
                <dt>{l}</dt>
                <dd className="tabular-nums text-ink">{rupiah(v as number)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-[#d6d0d3] pt-2">
              <dt className="font-bold text-ink">Total Tagihan</dt>
              <dd className="text-lg font-bold tabular-nums text-ink" aria-live="polite">
                {rupiah(shown)}
              </dd>
            </div>
          </dl>
        </section>
        <section>
          <h2 className="mb-2 text-[15px] font-bold text-ink">Metode Pembayaran</h2>
          <div className="flex gap-2" role="radiogroup">
            <Pill active={pay === 'qris'} onClick={() => setPay('qris')}>
              QRIS / Virtual Account
            </Pill>
            <Pill active={pay === 'ewallet'} onClick={() => setPay('ewallet')}>
              E-Wallet
            </Pill>
          </div>
        </section>
        {payErr && (
          <Banner tone="danger" icon={AlertCircle}>
            {payErr}
          </Banner>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="size-4 text-primary" aria-hidden /> Barang dikemas dan disegel petugas logistik KAI sebelum diserahkan ke kurir.
        </p>
      </div>
    </Screen>
  )
}

function Confetti() {
  const colors = ['#318FB5', '#F47C6D', '#38B26F', '#5EB5D7', '#f2c94c']
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0">
      {Array.from({ length: 22 }, (_, i) => (
        <span key={i} className="lf-confetti absolute block h-2.5 w-1.5 rounded-sm" style={{ left: `${(i * 37) % 100}%`, background: colors[i % 5], animationDelay: `${(i % 6) * 0.08}s` }} />
      ))}
    </div>
  )
}
