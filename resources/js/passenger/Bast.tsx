import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Clock, Copy, Download, ImageDown, Lock, MapPin, Maximize2, RefreshCw, RotateCcw, ShieldCheck, Store, Truck, Users, X } from 'lucide-react'
import { Badge, Banner, Button, cx, Field, inputCls, QRCode, RadioDot, RouteConnector, rupiah, Toggle, useAnimatedNumber, useCategories, useToast } from '../lib/ui'
import type { PackageSpecs, ShippingRateOption } from '../lib/data'
import { api, getTabToken, reportApi } from '../lib/api'
import { downloadPdfDocument, downloadTicketImage } from '../lib/export'
import { calcPackageMetrics, cleanCourierName, formatTrackingEvent, formatTrackingTimestamp, getShippingSummary, SHIPPING_MILESTONES } from '../lib/shipping'
import { useApp } from './ctx'
import { Screen, TopBar } from './shell'

export function BastScreen({ id }: { id: string }) {
  const { reports, replace, updateReport, back, user } = useApp()
  const { nonShippable } = useCategories()
  const toast = useToast()
  const r = reports.find((x) => x.id === id)!
  const [method, setMethod] = useState<'A' | 'B'>('B')
  const shippable = !r?.items?.some((i) => nonShippable.includes(i.category))
  const [proxy, setProxy] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [pdf, setPdf] = useState<'idle' | 'busy' | 'error'>('idle')
  const [qrCode, setQrCode] = useState(r?.qrCode || r?.bastCode || 'KCI-2026-089')
  const bastTitleCode = r?.bastCode || qrCode
  const m = shippable ? method : 'A'
  const poskoStation = r?.originStation || r?.to || 'Jakarta Kota'
  const poskoHours = r?.originHours || '04:00–24:00'
  const maskedNik = user?.nik ? `${user.nik.slice(0, 4)}************` : 'Terverifikasi'

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
              <div className="col-span-2 min-w-0">
                <dt className="text-[11px] font-semibold text-muted">Pemilik</dt>
                <dd className="break-words text-sm font-bold text-ink">{user?.full || user?.name || 'Penumpang KRL'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold text-muted">NIK</dt>
                <dd className="text-sm font-bold tabular-nums text-ink">{maskedNik}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold text-muted">Barang</dt>
                <dd className="truncate text-sm font-bold text-ink">{r.items[0]?.name.split(' +')[0] || 'Barang'}</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[11px] font-semibold text-muted">Lokasi Simpan</dt>
                <dd className="break-words text-sm font-bold text-ink">Posko CS St. {poskoStation}</dd>
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
            <p className="max-w-full break-all text-center font-mono text-base font-bold tracking-[0.2em] text-ink">{qrCode}</p>
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
                    downloadPdfDocument({
                      filename: `BAST_${bastTitleCode}.pdf`,
                      title: `BERITA ACARA SERAH TERIMA (BAST) #${bastTitleCode}`,
                      subtitle: 'LoFound - KAI Commuter Lost & Found Resmi',
                      badge: '100% VALID',
                      rows: [
                        ['Nomor Laporan', `#${r.id}`],
                        ['Kode BAST / QR', qrCode],
                        ['Nama Pemilik', user?.full || user?.name || 'Penumpang KRL'],
                        ['NIK', maskedNik],
                        ['Nama Barang', r.items[0]?.name || 'Barang Temuan'],
                        ['Kategori & Warna', `${r.items[0]?.category || '-'} / ${r.items[0]?.color || '-'}`],
                        ['Rute Kejadian', `St. ${r.from} -> St. ${r.to}`],
                        ['Tanggal Laporan', `${r.date}, ${r.time} WIB`],
                        ['Lokasi Pengambilan', `Posko CS St. ${poskoStation}`],
                      ],
                      footerNote: 'Dokumen BAST Digital sah diterbitkan secara elektronik oleh sistem LoFound KAI Commuter.',
                    })
                    setPdf('idle')
                    toast(`BAST_${bastTitleCode}.pdf berhasil diunduh.`)
                  }, 300)
                }}
              >
                Unduh PDF BAST
              </Button>
              <Button
                variant="tint"
                size="sm"
                icon={ImageDown}
                onClick={() => {
                  downloadTicketImage({
                    filename: `Tiket_BAST_${bastTitleCode}.png`,
                    bastCode: bastTitleCode,
                    qrCode,
                    owner: user?.full || user?.name || 'Penumpang KRL',
                    item: r.items[0]?.name || 'Barang Temuan',
                    route: `Posko CS St. ${poskoStation} (${r.from} -> ${r.to})`,
                    date: `${r.date} • ${r.updated} WIB`,
                  })
                  toast(`Tiket_BAST_${bastTitleCode}.png berhasil diunduh.`)
                }}
              >
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
              <p>Posko CS St. {poskoStation}</p>
              {r.originAddress && <p className="text-[11px] leading-4 text-muted">{r.originAddress}</p>}
              <p className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden /> {poskoHours} WIB
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const q = encodeURIComponent(r.originAddress || `Stasiun ${poskoStation}`)
                  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank', 'noopener,noreferrer')
                }}
                className="mt-1 inline-flex min-h-9 items-center gap-1 font-bold text-primary hover:underline"
              >
                <MapPin className="size-3.5" aria-hidden /> Lihat di Peta
              </button>
            </MethodCard>
            <MethodCard checked={m === 'B'} disabled={!shippable} onClick={() => shippable && setMethod('B')} icon={shippable ? Truck : Lock} title="Kirim via Ekspedisi ke Rumah" badge={!shippable ? <Badge tone="neutral" icon={Lock}>Terkunci</Badge> : undefined}>
              <p>Tarif kurir dihitung otomatis sesuai asal St. {poskoStation}, tujuan &amp; berat paket.</p>
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
          <QRCode value={qrCode} size={280} />
          <p className="max-w-full break-all text-center font-mono text-xl font-bold tracking-[0.25em] text-ink">{qrCode}</p>
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
const DEFAULT_COURIERS: ShippingRateOption[] = [
  { k: 'KAI Logistik Express', company: 'kalog', type: 'express', price: 18000, eta: '1–2 hari kerja', tag: 'Tercepat', desc: 'Layanan kilat resmi KAI Logistik', source: 'fallback' },
  { k: 'JNE Reguler', company: 'jne', type: 'reg', price: 16000, eta: '2–3 hari kerja', tag: 'Populer', desc: 'Pengiriman reguler ke seluruh kota', source: 'fallback' },
  { k: 'Pos Indonesia', company: 'pos', type: 'reg', price: 14000, eta: '3–4 hari kerja', tag: 'Hemat', desc: 'Tarif ekonomis & jangkauan luas', source: 'fallback' },
]

function formatPaymentMethod(paymentType: string | null | undefined): string {
  if (!paymentType) return 'Pembayaran Digital'
  const map: Record<string, string> = {
    qris: 'QRIS',
    bank_transfer: 'Transfer Bank / Virtual Account',
    echannel: 'Mandiri Bill',
    cstore: 'Gerai Retail',
    credit_card: 'Kartu Kredit / Debit',
    gopay: 'GoPay',
    shopeepay: 'ShopeePay',
    dana: 'DANA',
  }
  return map[paymentType.toLowerCase()] || paymentType.replace(/_/g, ' ').toUpperCase()
}

type ShippingFormData = { name: string; wa: string; addr: string; city: string; zip: string }
type ShippingDraft = { f?: Partial<ShippingFormData>; courier?: string; insure?: boolean }

function loadShippingDraft(id: string): ShippingDraft | null {
  try {
    const raw = localStorage.getItem(`lofound_shipping_draft_${id}`)
    if (!raw) return null
    return JSON.parse(raw) as ShippingDraft
  } catch {
    return null
  }
}

export function ShippingScreen({ id, autoSync = false }: { id: string; autoSync?: boolean }) {
  const { reports, updateReport, back, user } = useApp()
  const toast = useToast()
  const r = reports.find((x) => x.id === id)
  const initialDraft = loadShippingDraft(id)

  const [f, setF] = useState<ShippingFormData>(() => ({
    name: initialDraft?.f?.name ?? '',
    wa: initialDraft?.f?.wa ?? '',
    addr: initialDraft?.f?.addr ?? '',
    city: initialDraft?.f?.city ?? '',
    zip: initialDraft?.f?.zip ?? '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [couriers, setCouriers] = useState<ShippingRateOption[]>(DEFAULT_COURIERS)
  const [pkgSpecs, setPkgSpecs] = useState<PackageSpecs | null>(null)
  const [originInfo, setOriginInfo] = useState<{ station_name: string; postal_code: string; address: string } | null>(null)
  const [overrideAmount, setOverrideAmount] = useState<number | null>(null)
  const [ratesLoading, setRatesLoading] = useState(false)
  const [courier, setCourier] = useState(initialDraft?.courier || r?.shippingCourier || DEFAULT_COURIERS[0].k)
  const [insure, setInsure] = useState(() => (typeof initialDraft?.insure === 'boolean' ? initialDraft.insure : true))
  const [phase, setPhase] = useState<'form' | 'paying' | 'pending' | 'paid'>(() => {
    if (r?.status === 'dikirim' || r?.status === 'selesai') return 'paid'
    if (r?.paymentStatus === 'pending' && (r?.paymentUrl || r?.snapToken)) return 'pending'
    return 'form'
  })
  const [mode] = useState<'normal' | 'pending' | 'fail' | 'resi' | 'area'>('normal')
  const [payErr, setPayErr] = useState('')
  const [checking, setChecking] = useState(false)
  const [syncingTrack, setSyncingTrack] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(r?.paymentUrl ?? null)
  const [orderId, setOrderId] = useState<string | null>(r?.paymentOrderId ?? r?.bastCode ?? null)
  const [paymentType, setPaymentType] = useState<string | null>(r?.paymentType ?? null)
  const [countdown, setCountdown] = useState(23 * 3600 + 59 * 60 + 12)
  const autoSyncedRef = useRef(false)
  const lastReturnSyncRef = useRef(0)
  const c = couriers.find((x) => x.k === courier) ?? couriers[0] ?? DEFAULT_COURIERS[0]
  const rawTotal = c.price + (insure ? 5000 : 0) + 2500
  const total = overrideAmount ?? rawTotal
  const displayedAmount = r?.shippingAmount && phase !== 'form' ? r.shippingAmount : total
  const shown = useAnimatedNumber(total)

  // Real package status from backend (controlled by Petugas Logistik / Biteship Webhook)
  const courierLabel = cleanCourierName(r?.shippingCourier || courier)
  const realAwb = r?.awb || 'Menunggu nomor resi kurir'
  const shipSummary = getShippingSummary({
    shippingStatus: r?.shippingStatus,
    reportStatus: r?.status,
    awb: r?.awb,
  })
  const {
    shipNorm,
    isShipFailed,
    isShipReturn,
    isShipHold,
    isDelivered,
    milestoneDoneCount,
    milestoneActiveIdx,
  } = shipSummary

  useEffect(() => {
    if (phase === 'paid') return
    let cancelled = false
    api
      .get<{ override_amount?: number | null }>('/api/payment/config')
      .then((res) => {
        if (!cancelled && res.override_amount && res.override_amount > 0) {
          setOverrideAmount(res.override_amount)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'form') return
    if (!/^\d{5}$/.test(f.zip)) {
      setCouriers(DEFAULT_COURIERS)
      return
    }
    let cancelled = false
    setRatesLoading(true)
    reportApi
      .shippingRates(f.zip, id)
      .then((res) => {
        if (cancelled) return
        if (res.origin) setOriginInfo(res.origin)
        if (res.package) setPkgSpecs(res.package)
        if (!res.couriers?.length) return
        setCouriers(res.couriers)
        setCourier((cur) => (res.couriers.some((opt) => opt.k === cur) ? cur : res.couriers[0].k))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [f.zip, phase])

  useEffect(() => {
    if (r?.status === 'dikirim' || r?.status === 'selesai') {
      setPhase('paid')
    }
    if (r?.paymentUrl) {
      setPaymentUrl(r.paymentUrl)
    }
  }, [r?.status, r?.paymentUrl])

  useEffect(() => {
    if (phase === 'paid') {
      try {
        localStorage.removeItem(`lofound_shipping_draft_${id}`)
        localStorage.removeItem('lofound_payment_resume')
      } catch {}
      return
    }
    try {
      localStorage.setItem(`lofound_shipping_draft_${id}`, JSON.stringify({ f, courier, insure }))
    } catch {}
  }, [id, f, courier, insure, phase])

  useEffect(() => {
    if (!autoSync || autoSyncedRef.current || phase === 'paid') return
    autoSyncedRef.current = true
    void checkPaymentStatus(true)
  }, [autoSync, phase])

  useEffect(() => {
    const handleReturn = () => {
      if (document.visibilityState === 'hidden') return
      setRedirecting(false)
      if (phase === 'paying') {
        setPhase(paymentUrl ? 'pending' : 'form')
      }
      if ((phase === 'pending' || paymentUrl) && Date.now() - lastReturnSyncRef.current > 4000) {
        lastReturnSyncRef.current = Date.now()
        void checkPaymentStatus(true)
      }
    }
    window.addEventListener('pageshow', handleReturn)
    document.addEventListener('visibilitychange', handleReturn)
    return () => {
      window.removeEventListener('pageshow', handleReturn)
      document.removeEventListener('visibilitychange', handleReturn)
    }
  }, [phase, paymentUrl])

  useEffect(() => {
    if (phase !== 'pending') return
    const t = setInterval(() => setCountdown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [phase])

  const fmt = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')

  const checkPaymentStatus = async (silentPending = false) => {
    if (checking) return
    setChecking(true)
    setPayErr('')
    try {
      const res = await reportApi.syncPayment(id)
      updateReport(id, res.report)
      if (res.payment_type) setPaymentType(res.payment_type)

      if (res.payment_status === 'lunas') {
        setPhase('paid')
        toast('Pembayaran berhasil dikonfirmasi!')
      } else if (res.payment_status === 'gagal') {
        setPhase('form')
        setPaymentUrl(null)
        setPayErr('Pembayaran kedaluwarsa atau dibatalkan. Silakan buat transaksi baru.')
      } else if (!silentPending) {
        toast(res.message || 'Pembayaran masih menunggu penyelesaian.', { tone: 'info' })
      }
    } catch (err: any) {
      if (!silentPending) {
        toast(err.message || 'Belum dapat memeriksa status pembayaran.', { tone: 'danger' })
      }
    } finally {
      setChecking(false)
    }
  }

  const handleCancelPayment = async () => {
    if (cancelling) return
    setCancelling(true)
    setPayErr('')
    try {
      const res = await reportApi.cancelPayment(id)
      updateReport(id, res.report)
      setPaymentUrl(null)
      setOrderId(null)
      setPhase('form')
      toast('Pembayaran dibatalkan. Anda dapat mengubah pengiriman atau membuat pembayaran baru.')
    } catch (err: any) {
      toast(err.message || 'Gagal membatalkan pembayaran.', { tone: 'danger' })
    } finally {
      setCancelling(false)
    }
  }

  const redirectToPayment = (url: string | null | undefined) => {
    if (url) {
      try {
        sessionStorage.setItem('lofound_payment_return', id)
        localStorage.setItem(
          'lofound_payment_resume',
          JSON.stringify({
            reportId: id,
            tabToken: getTabToken('passenger'),
            ts: Date.now(),
          }),
        )
      } catch {}
      setRedirecting(true)
      window.location.assign(url)
      return
    }

    toast('Halaman pembayaran belum siap. Silakan coba lagi.', { tone: 'danger' })
  }

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
    if (phase === 'paying' || redirecting) return // prevent double taps
    if (!validate()) return
    setPayErr('')
    setPhase('paying')
    try {
      const res = await reportApi.bast(id, {
        method: 'ekspedisi',
        courier,
        courier_company: c.company,
        courier_type: c.type,
        address: f.addr,
        city: f.city,
        zip: f.zip,
        name: f.name,
        wa: f.wa,
        insure,
      })
      updateReport(id, res.report)
      if (res.order_id) setOrderId(res.order_id)
      if (res.payment_url) {
        setPaymentUrl(res.payment_url)
        setPhase('pending')
        redirectToPayment(res.payment_url)
        return
      }
      setPhase('paid')
    } catch (err: any) {
      setRedirecting(false)
      setPhase('form')
      setPayErr(err.message || 'Pembayaran belum berhasil. Coba lagi atau ganti metode.')
    }
  }

  const inp = (k: keyof typeof f, label: string, ph: string, extra?: Partial<React.InputHTMLAttributes<HTMLInputElement>>) => (
    <Field label={label} required error={errors[k]}>
      {(a) => <input {...a} {...extra} value={f[k]} onChange={(e) => setF({ ...f, [k]: k === 'zip' ? e.target.value.replace(/\D/g, '') : e.target.value })} placeholder={ph} className={inputCls(!!errors[k]) + ' h-12'} />}
    </Field>
  )

  const paymentMethodLabel = formatPaymentMethod(paymentType)

  if (phase === 'paid') {
    const isIssue = shipSummary.isIssue
    const heroIsTransit = !isDelivered && !isIssue && !isShipHold && (shipNorm === 'dropping_off' || shipNorm === 'in_transit' || shipNorm === 'picked')
    const { topTitle, heroTitle, heroBadge } = shipSummary

    return (
      <Screen
        header={<TopBar title={topTitle} sub={`#${id}`} />}
        footer={
          <Button variant="cta" size="lg" full onClick={back}>
            Kembali ke Status Laporan
          </Button>
        }
      >
        <div className="relative flex flex-col gap-4 overflow-hidden p-5">
          {!heroIsTransit && !isIssue && !isShipHold && <Confetti />}
          <section
            className={cx(
              'flex flex-col items-center gap-2.5 rounded-[20px] border p-5 text-center',
              isIssue
                ? 'border-[#f5c2bc] bg-[#fff5f4]'
                : isShipHold
                  ? 'border-[#f3d9a4] bg-warn-soft'
                  : heroIsTransit
                    ? 'border-[#b9deec] bg-tint/70'
                    : 'border-[#c6efd8] bg-mint'
            )}
          >
            <span
              className={cx(
                'lf-pop flex size-14 items-center justify-center rounded-full text-white',
                isIssue ? 'bg-danger' : isShipHold ? 'bg-warn' : heroIsTransit ? 'bg-primary' : 'bg-success'
              )}
            >
              {isShipReturn ? (
                <RotateCcw className="size-7" aria-hidden />
              ) : isShipFailed || isShipHold ? (
                <AlertCircle className="size-7" aria-hidden />
              ) : heroIsTransit ? (
                <Truck className="size-7" aria-hidden />
              ) : (
                <Check className="size-8" strokeWidth={3} aria-hidden />
              )}
            </span>
            <p className="text-base font-extrabold text-ink">{heroTitle}</p>
            <Badge tone={isIssue ? 'danger' : isShipHold ? 'warn' : heroIsTransit ? 'info' : 'success'} className="bg-white">
              {heroBadge}
            </Badge>
            <p className="text-[22px] font-bold tabular-nums text-ink">{rupiah(displayedAmount)}</p>
            <p className="text-xs text-muted">
              Dibayar via {paymentMethodLabel}
              {orderId ? ` • ${orderId}` : ''}
            </p>
            {(isIssue || isShipHold) && (
              <p className="max-w-xs text-xs leading-5 text-ink/85">
                {isShipFailed
                  ? 'Tenang, ongkir Anda aman. Petugas logistik kami telah menerima kendala ini dan akan menjadwalkan ulang penjemputan kurir tanpa biaya tambahan.'
                  : isShipReturn
                    ? 'Paket dikembalikan ke Posko CS demi keamanan barang Anda. Petugas akan membantu penjadwalan ulang atau pengambilan di stasiun.'
                    : 'Kurir sedang menjadwalkan ulang pengantaran paket Anda. Pantau pembaruan status secara berkala.'}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={() => {
                downloadPdfDocument({
                  filename: `Resi_Bayar_${id}.pdf`,
                  title: `BUKTI PEMBAYARAN ONGKIR #${id}`,
                  subtitle: 'LoFound - Pengiriman Ekspedisi Barang Temuan KRL',
                  badge: 'LUNAS',
                  rows: [
                    ['Nomor Laporan', `#${id}`],
                    ['Kode Transaksi', orderId || r?.bastCode || '-'],
                    ['Barang', r?.items?.[0]?.name || 'Barang Temuan'],
                    ['Jasa Kurir', courierLabel],
                    ['Nomor Resi (AWB)', realAwb],
                    ['Total Pembayaran', rupiah(displayedAmount)],
                    ['Metode Bayar', paymentMethodLabel],
                    ['Status Pengiriman', heroTitle],
                  ],
                  footerNote: 'Bukti pembayaran sah layanan pengiriman barang temuan LoFound KAI Commuter.',
                })
                toast(`Resi_Bayar_${id}.pdf berhasil diunduh.`)
              }}
            >
              Unduh Resi Bayar PDF
            </Button>
          </section>

          <section className="rounded-[20px] border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Informasi Pengiriman</p>
                <p className="truncate text-sm font-bold text-ink">{courierLabel}</p>
              </div>
              {(r?.biteshipOrderId || r?.biteshipTrackingId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={RefreshCw}
                  loading={syncingTrack}
                  onClick={async () => {
                    if (syncingTrack) return
                    setSyncingTrack(true)
                    try {
                      const res = await reportApi.syncShipping(id)
                      updateReport(id, res.report)
                      toast('Status pelacakan kurir diperbarui.')
                    } catch (err: any) {
                      toast(err.message || 'Belum dapat memperbarui pelacakan.', { tone: 'danger' })
                    } finally {
                      setSyncingTrack(false)
                    }
                  }}
                >
                  Perbarui
                </Button>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-field px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-muted">Nomor Resi (AWB)</p>
                <p className={cx('mt-0.5', r?.awb ? 'break-all font-mono text-sm font-bold tracking-wide text-ink' : 'text-xs font-semibold text-muted')}>
                  {realAwb}
                </p>
              </div>
              {r?.awb && (
                <Button
                  variant="tint"
                  size="sm"
                  className="shrink-0"
                  icon={Copy}
                  onClick={() => {
                    navigator.clipboard?.writeText(r.awb!)
                    toast('Nomor resi disalin.')
                  }}
                >
                  Salin
                </Button>
              )}
            </div>

            {r?.shippingAddress && (
              <div className="mt-3 flex items-start gap-2 text-xs text-muted">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="leading-4 text-ink">{r.shippingAddress}</span>
              </div>
            )}

            {/* Shopee-style 4-stage milestone progress bar */}
            <div className="relative mt-5 grid grid-cols-4 gap-1" aria-label="Progres pengiriman">
              <div className="absolute left-[12.5%] right-[12.5%] top-3 h-0.5 bg-[#e1e8ed]" aria-hidden />
              <div
                className="absolute left-[12.5%] top-3 h-0.5 bg-success transition-all"
                style={{ width: `${Math.min(100, Math.max(0, (milestoneDoneCount - (isDelivered ? 1 : 0)) / 3) * 75)}%` }}
                aria-hidden
              />
              {SHIPPING_MILESTONES.map((label, idx) => {
                const isDone = idx < milestoneDoneCount
                const isCurr = idx === milestoneActiveIdx
                const isErrorNode = isIssue && idx === 0
                const isHoldNode = isShipHold && idx === 0
                return (
                  <div key={label} className="relative z-10 flex flex-col items-center gap-1.5 text-center">
                    <span
                      className={cx(
                        'flex size-6 items-center justify-center rounded-full border-2',
                        isErrorNode
                          ? 'border-danger bg-danger text-white ring-4 ring-[#fde2e0]'
                          : isHoldNode
                            ? 'border-warn bg-warn text-white ring-4 ring-warn-soft'
                            : isDone
                              ? 'border-success bg-success text-white'
                              : isCurr
                                ? 'border-primary bg-white ring-4 ring-tint'
                                : 'border-[#c4d3db] bg-white'
                      )}
                    >
                      {isErrorNode ? (
                        <X className="size-3.5" strokeWidth={3} aria-hidden />
                      ) : isHoldNode ? (
                        <Clock className="size-3" strokeWidth={2.5} aria-hidden />
                      ) : isDone ? (
                        <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      ) : isCurr ? (
                        <span className="size-2 rounded-full bg-primary" />
                      ) : null}
                    </span>
                    <span
                      className={cx(
                        'text-[11px]',
                        isErrorNode
                          ? 'font-bold text-danger'
                          : isHoldNode
                            ? 'font-bold text-warn'
                            : isDone || isCurr
                              ? 'font-bold text-ink'
                              : 'font-medium text-muted'
                      )}
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Shopee-style vertical shipment timeline */}
            {r?.trackingHistory && r.trackingHistory.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-3 text-xs font-bold text-ink">Riwayat Perjalanan Paket</p>
                <ol className="relative flex flex-col gap-4 pl-5">
                  <span aria-hidden className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-[#e3eaef]" />
                  {[...r.trackingHistory].reverse().map((h, idx) => {
                    const isLatest = idx === 0
                    const ev = formatTrackingEvent(h)
                    const dotClass =
                      ev.tone === 'danger'
                        ? isLatest
                          ? 'bg-danger ring-4 ring-[#fde2e0]'
                          : 'bg-danger/70'
                        : ev.tone === 'warn'
                          ? isLatest
                            ? 'bg-warn ring-4 ring-warn-soft'
                            : 'bg-warn/70'
                          : ev.tone === 'success'
                            ? isLatest
                              ? 'bg-success ring-4 ring-mint'
                              : 'bg-success/80'
                            : isLatest
                              ? 'bg-primary ring-4 ring-tint'
                              : 'bg-[#cbd7df]'
                    const titleClass =
                      ev.tone === 'danger'
                        ? 'text-danger'
                        : ev.tone === 'warn'
                          ? 'text-warn'
                          : ev.tone === 'success'
                            ? isLatest
                              ? 'text-success'
                              : 'text-ink'
                            : isLatest
                              ? 'text-primary-dark'
                              : 'text-ink'
                    return (
                      <li key={idx} className="relative flex flex-col gap-0.5">
                        <span aria-hidden className={cx('absolute -left-5 top-1 size-3.5 rounded-full border-2 border-white', dotClass)} />
                        <p className={cx('text-xs font-bold leading-4', titleClass)}>{ev.title}</p>
                        {ev.desc && <p className="text-[11px] leading-4 text-muted">{ev.desc}</p>}
                        {h.updated_at && (
                          <p className="text-[11px] tabular-nums text-soft">
                            {formatTrackingTimestamp(h.updated_at)}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}
          </section>
        </div>
      </Screen>
    )
  }

  return (
    <Screen
      header={<TopBar title="Pengiriman Ekspedisi" sub={`#${id}`} />}
      footer={
        phase === 'pending' ? (
          <Button
            variant="cta"
            size="lg"
            full
            loading={redirecting}
            onClick={() => (paymentUrl ? redirectToPayment(paymentUrl) : void checkPaymentStatus(false))}
          >
            {redirecting ? 'Mengalihkan...' : 'Lanjutkan Pembayaran'}
          </Button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Button variant="cta" size="lg" full loading={phase === 'paying' || redirecting} onClick={doPay}>
              {redirecting ? 'Mengalihkan...' : phase === 'paying' ? 'Memproses...' : `Bayar Sekarang (${rupiah(total)})`}
            </Button>
            <p className="text-center text-[11px] text-muted">Pembayaran aman dan terverifikasi otomatis.</p>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-3 p-5">
        {phase === 'pending' && (
          <>
            <section className="flex flex-col items-center gap-2.5 rounded-[20px] border-2 border-primary bg-white p-4 text-center">
              <Badge tone="info">Menunggu Pembayaran</Badge>
              <p className="text-xs font-semibold text-muted">Kode Tagihan • {orderId || r?.bastCode}</p>
              <p className="text-2xl font-extrabold tabular-nums text-ink">{rupiah(displayedAmount)}</p>
              <Badge tone="warn" icon={Clock}>
                Selesaikan dalam {fmt(countdown)}
              </Badge>
              <p className="text-xs leading-5 text-muted">
                Selesaikan pembayaran melalui tombol <strong>Lanjutkan Pembayaran</strong> di bawah. Setelah selesai, status pesanan akan diperbarui otomatis.
              </p>
            </section>
            <section className="rounded-[20px] border border-line bg-white p-4">
              <h2 className="mb-3 text-[15px] font-bold text-ink">Ringkasan Pengiriman</h2>
              <dl className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Penerima</dt>
                  <dd className="text-right font-semibold text-ink">
                    {f.name || user?.full || 'Penumpang KRL'}
                    {f.wa ? ` (${f.wa})` : ''}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted">Alamat Tujuan</dt>
                  <dd className="text-right font-semibold text-ink">
                    {f.addr ? [f.addr, f.city, f.zip].filter(Boolean).join(', ') : r?.shippingAddress || '-'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Jasa Kurir</dt>
                  <dd className="text-right font-semibold text-ink">{r?.shippingCourier || courier}</dd>
                </div>
                <div className="mt-1 flex justify-between border-t border-line pt-2 text-sm">
                  <dt className="font-bold text-ink">Total Tagihan</dt>
                  <dd className="font-extrabold tabular-nums text-ink">{rupiah(displayedAmount)}</dd>
                </div>
              </dl>
              <p className="mt-3 rounded-xl bg-tint/60 px-3 py-2 text-[11px] leading-4 text-primary-dark">
                Ingin mengubah alamat atau kurir? Klik <strong>Batalkan & Buat Ulang Pembayaran</strong> di bawah.
              </p>
            </section>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="md" full loading={checking} icon={RefreshCw} onClick={() => checkPaymentStatus(false)}>
                {checking ? 'Memeriksa...' : 'Cek Status Pembayaran'}
              </Button>
              <Button
                variant="outline"
                size="md"
                full
                loading={cancelling}
                icon={RotateCcw}
                onClick={handleCancelPayment}
                className="!border-[#e57373] !bg-[#fff1f0] !text-danger hover:!bg-[#ffe2e0]"
              >
                {cancelling ? 'Membatalkan...' : 'Batalkan & Buat Ulang Pembayaran'}
              </Button>
            </div>
          </>
        )}
        {phase !== 'pending' && (
          <>
            <section className="rounded-[20px] border border-line bg-white p-4">
              {(() => {
                const origName = originInfo?.station_name || r?.originStation || r?.to || 'Jakarta Kota'
                const origZip = originInfo?.postal_code || r?.originPostalCode
                return (
                  <RouteConnector
                    gap="gap-2"
                    from={`Posko CS St. ${origName}${origZip ? ` (${origZip})` : ''}`}
                    to={`Alamat Rumah: ${f.city || 'Isi kota tujuan'}`}
                    fromLabel="Dari"
                    toLabel="Ke"
                  />
                )
              })()}
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
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-ink">Opsi Pengiriman</h2>
                <span className="text-xs font-medium text-muted">{ratesLoading ? 'Memuat tarif...' : 'Pilih kurir'}</span>
              </div>
              {(() => {
                const m = calcPackageMetrics({
                  weightGrams: pkgSpecs?.weight_grams ?? r?.packageWeightGrams ?? 1000,
                  lengthCm: pkgSpecs?.length_cm ?? r?.packageLengthCm ?? null,
                  widthCm: pkgSpecs?.width_cm ?? r?.packageWidthCm ?? null,
                  heightCm: pkgSpecs?.height_cm ?? r?.packageHeightCm ?? null,
                })
                return (
                  <p className="mb-3 rounded-xl bg-tint/60 px-3 py-2 text-[11px] font-medium text-primary-dark">
                    Berat terhitung: <strong className="font-bold">{m.kgText} kg</strong> ({m.chargeableGrams.toLocaleString('id-ID')} g)
                    {m.dimensionsText ? ` • Dimensi ${m.dimensionsText}` : ''}
                  </p>
                )
              })()}
              <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Opsi pengiriman">
                {couriers.map((co) => {
                  const active = courier === co.k
                  return (
                    <button
                      key={co.k}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setCourier(co.k)
                        setErrors((e) => ({ ...e, courier: '' }))
                      }}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition',
                        active
                          ? 'border-2 border-primary bg-tint/45 shadow-[0_6px_18px_-12px_rgba(49,143,181,0.55)]'
                          : 'border border-line bg-white hover:border-[#b7ced9]'
                      )}
                    >
                      <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-xl', active ? 'bg-primary text-white' : 'bg-tint text-primary')}>
                        <Truck className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-ink">{co.k}</span>
                          {co.tag && (
                            <span
                              className={cx(
                                'rounded-md px-1.5 py-0.5 text-[10px] font-bold',
                                active ? 'bg-primary text-white' : 'bg-tint text-primary-dark'
                              )}
                            >
                              {co.tag}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-muted">Estimasi tiba {co.eta}</p>
                        <p className="text-[11px] text-muted/80">{co.desc}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="text-sm font-extrabold tabular-nums text-ink">{rupiah(co.price)}</span>
                        <span
                          className={cx(
                            'flex size-5 items-center justify-center rounded-full border-2 transition',
                            active ? 'border-primary bg-primary text-white' : 'border-[#c4d3db] bg-white'
                          )}
                          aria-hidden
                        >
                          {active && <Check className="size-3" strokeWidth={3} />}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div aria-live="polite">
                {errors.courier && (
                  <p className="mt-2 flex items-center gap-1 text-xs font-medium text-danger">
                    <AlertCircle className="size-3.5" aria-hidden /> {errors.courier}
                  </p>
                )}
              </div>
              <div className="mt-3 border-t border-line pt-1">
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
                {overrideAmount !== null && overrideAmount < rawTotal && (
                  <div className="flex justify-between font-medium text-success">
                    <dt>Potongan Penyesuaian Tarif</dt>
                    <dd className="tabular-nums">-{rupiah(rawTotal - overrideAmount)}</dd>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t border-[#d6d0d3] pt-2">
                  <dt className="font-bold text-ink">Total Tagihan</dt>
                  <dd className="text-lg font-bold tabular-nums text-ink" aria-live="polite">
                    {rupiah(shown)}
                  </dd>
                </div>
              </dl>
            </section>
          </>
        )}
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
