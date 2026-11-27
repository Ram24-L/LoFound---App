import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, BellRing, Check, ChevronDown, Clock, FileCheck2, Hourglass, Info, Lock, MessageSquareWarning, RefreshCw, Search, ShieldCheck, Ticket, Upload, X, XCircle } from 'lucide-react'
import { CANDIDATES as STATIC_CANDIDATES, type ReportStatus } from '../lib/data'
import { Badge, Banner, Button, CategoryBadge, Checkbox, cx, Dialog, EmptyState, ErrorState, Field, inputCls, RadioDot, Skeleton, Toggle, useToast } from '../lib/ui'
import { reportApi, uploadApi } from '../lib/api'
import { cleanCourierName, getShippingSummary } from '../lib/shipping'
import { useApp } from './ctx'
import { Screen, TopBar } from './shell'

type View = ReportStatus | 'multi' | 'error'

export function TrackingScreen({ id }: { id: string }) {
  const { reports, go, updateReport, refreshReports } = useApp()
  const toast = useToast()
  const r = reports.find((x) => x.id === id)!
  const [itemTab, setItemTab] = useState(0)
  const [loadErr, setLoadErr] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pull, setPull] = useState(0)
  const [candidatesList, setCandidatesList] = useState<any[]>([])
  const startY = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const view: View = loadErr ? 'error' : r.status === 'kandidat' && r.candidates > 1 ? 'multi' : r.status

  // Fetch real candidates from API when status is kandidat
  useEffect(() => {
    if (r.status === 'kandidat' || r.status === 'ditinjau') {
      reportApi.candidates(id)
        .then((data) => {
          if (data && data.length > 0) setCandidatesList(data)
        })
        .catch(() => {})
    }
  }, [id, r.status])

  const setView = (v: View) => {
    setLoadErr(v === 'error')
    if (v === 'error') return
    if (v === 'multi') updateReport(id, { status: 'kandidat', candidates: 3 })
    else updateReport(id, { status: v, candidates: v === 'pencarian' || v === 'diterima' ? 0 : 1 })
  }
  const refresh = async () => {
    setRefreshing(true)
    try {
      await refreshReports()
      // Also re-fetch candidates
      if (r.status === 'kandidat') {
        const data = await reportApi.candidates(id)
        if (data && data.length > 0) setCandidatesList(data)
      }
    } catch {}
    setRefreshing(false)
    toast('Status laporan diperbarui.')
  }

  const s = r.status
  const order: ReportStatus[] = ['diterima', 'pencarian', 'kandidat', 'bast', 'selesai']
  const phase = s === 'ditinjau' || s === 'perlu_info' || s === 'ditolak' ? 2 : s === 'dikirim' ? 3 : s === 'kedaluwarsa' ? 2 : Math.max(0, order.indexOf(s))
  const item = r.items[itemTab] ?? r.items[0]

  const findHistTime = (keywords: string[]) => {
    const found = [...(r.history || [])].reverse().find((h) => keywords.some((kw) => h.text.toLowerCase().includes(kw.toLowerCase())))
    return found?.t
  }

  const createdTime = findHistTime(['dibuat']) || r.time
  const searchTime = findHistTime(['diaktifkan', 'pencarian', 'dibuat']) || r.time
  const candTime = findHistTime(['kandidat', 'ditautkan', 'klaim diajukan']) || (phase >= 2 ? r.updated : undefined)
  const bastTime = findHistTime(['disetujui', 'bast']) || (phase >= 3 ? r.updated : undefined)
  const doneTime = findHistTime(['serah terima', 'ekspedisi', 'kurir', 'tiba', 'selesai']) || (s === 'selesai' || s === 'dikirim' ? r.updated : undefined)

  const choseStationPickup = r.history?.some((h) => h.text.toLowerCase().includes('ambil mandiri'))

  const steps = [
    { t: 'Laporan Diterima', time: createdTime },
    { t: 'Dalam Pencarian Petugas', time: searchTime },
    { t: s === 'pencarian' || s === 'diterima' ? 'Kandidat Barang Cocok' : 'Kandidat Barang Cocok Ditemukan!', time: candTime },
    { t: 'Verifikasi Klaim CS & Penerbitan BAST Digital', time: bastTime },
    {
      t: s === 'dikirim' ? 'Pengiriman via Ekspedisi' : choseStationPickup ? `Pengambilan Mandiri di Posko St. ${r.originStation || r.to}` : 'Pengambilan di Stasiun / Pengiriman Ekspedisi',
      time: doneTime,
    },
  ]
  const activeIdx = s === 'diterima' ? 0 : s === 'pencarian' ? 1 : phase === 2 ? 2 : phase === 3 ? (s === 'bast' || s === 'dikirim' ? 4 : 3) : s === 'selesai' ? 5 : 2

  return (
    <Screen header={<TopBar title="Lacak Laporan" sub="Tarik ke bawah untuk memperbarui" right={<Button variant="ghost" size="sm" icon={RefreshCw} onClick={refresh} aria-label="Perbarui status" />} />}>
      <div
        ref={scrollRef}
        className="flex flex-col gap-3 p-5"
        onTouchStart={(e) => {
          const sc = scrollRef.current?.parentElement
          startY.current = sc && sc.scrollTop <= 0 ? e.touches[0].clientY : null
        }}
        onTouchMove={(e) => startY.current !== null && setPull(Math.max(0, Math.min(80, e.touches[0].clientY - startY.current)))}
        onTouchEnd={() => {
          if (pull > 60) refresh()
          setPull(0)
          startY.current = null
        }}
        style={{ transform: pull ? `translateY(${pull / 2}px)` : undefined }}
      >
        {/* Header card */}
        <section className="relative overflow-hidden rounded-[20px] bg-primary p-4 text-white">
          <div aria-hidden className="absolute -right-10 -top-10 size-32 rounded-full bg-accent/30" />
          <p className="relative text-xs font-bold tracking-wide text-white/80">#{r.id}</p>
          <p className="relative mt-0.5 break-words text-lg font-bold leading-6">{r.items[0].name}</p>
          {r.items.length > 1 && <p className="relative text-xs text-white/80">+{r.items.length - 1} barang lain dalam laporan ini</p>}
          <div className="relative mt-3 flex items-center gap-2 text-[13px]">
            <span className="size-3 rounded-full border-2 border-white" aria-hidden />
            <span className="font-semibold">Dilaporkan {r.time}</span>
            <span className="flex-1 border-t-2 border-dashed border-white/50" aria-hidden />
            <span className="size-3 rounded-full border-2 border-coral" aria-hidden />
            <span className="font-semibold">Update {r.updated}</span>
          </div>
          <Button variant="white" size="sm" className="relative mt-3" onClick={() => go('detail', { id })}>
            Lihat Detail
          </Button>
        </section>

        {r.items.length > 1 && (
          <div role="tablist" aria-label="Barang dalam laporan" className="-mx-5 flex gap-2 overflow-x-auto px-5 lf-noscroll">
            {r.items.map((it, i) => (
              <button key={it.sub} role="tab" aria-selected={itemTab === i} onClick={() => setItemTab(i)} className={cx('flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-bold', itemTab === i ? 'bg-ink text-white' : 'border border-line bg-white text-ink')}>
                <span className="text-[11px] opacity-70">-{it.sub}</span> {it.name.split(' ').slice(0, 2).join(' ')}
              </button>
            ))}
          </div>
        )}

        {refreshing ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-[20px]" />)
        ) : view === 'error' ? (
          <div className="rounded-[20px] border border-line bg-white">
            <ErrorState title="Gagal memuat status." onRetry={() => setLoadErr(false)} />
          </div>
        ) : (
          <ol className="relative flex flex-col gap-2.5" aria-label="Tahapan laporan">
            <span aria-hidden className="absolute bottom-6 left-[27px] top-6 border-l-2 border-dashed border-[#a9cfdf]" />
            {steps.map((st, i) => {
              const done = i < activeIdx
              const active = i === activeIdx
              return (
                <li key={i} className={cx('relative rounded-[20px] bg-white p-4', active ? 'border-2 border-primary' : 'border border-line', !done && !active && 'opacity-70')}>
                  <div className="flex items-start gap-3">
                    <span className={cx('z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2', done ? 'border-success bg-success text-white' : active ? 'border-primary bg-white' : 'border-[#c4d3db] bg-white')}>
                      {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : active ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cx('text-sm font-bold', active || done ? 'text-ink' : 'text-muted')}>{st.t}</p>
                      <p className="text-xs text-muted">{st.time ? `${st.time} WIB` : 'Menunggu'}</p>
                    </div>
                    {done && (
                      <Badge tone="success" icon={Check}>
                        Selesai
                      </Badge>
                    )}
                    {active && i === 2 && s === 'kandidat' && <Badge tone="coral">Butuh Verifikasi</Badge>}
                    {active && i === 2 && s === 'ditinjau' && <Badge tone="info" icon={Clock}>Ditinjau CS</Badge>}
                    {active && i === 2 && s === 'perlu_info' && <Badge tone="warn" icon={MessageSquareWarning}>Perlu Info</Badge>}
                    {active && i === 2 && s === 'ditolak' && <Badge tone="danger" icon={XCircle}>Belum Disetujui</Badge>}
                    {active && i === 4 && s === 'bast' && !choseStationPickup && <Badge tone="coral">Pilih Metode</Badge>}
                    {active && i === 4 && s === 'bast' && choseStationPickup && <Badge tone="success">Siap Diambil</Badge>}
                    {active && i === 4 && s === 'dikirim' && (() => {
                      const shipMeta = getShippingSummary({ shippingStatus: r.shippingStatus, reportStatus: r.status, awb: r.awb })
                      return <Badge tone={shipMeta.shortTone}>{shipMeta.shortBadge}</Badge>
                    })()}
                  </div>
                  {active && activePanel(i)}
                </li>
              )
            })}
          </ol>
        )}
        {r.items.length > 1 && !refreshing && view !== 'error' && <p className="text-center text-xs text-muted">Menampilkan progres untuk #{r.id}-{item.sub}</p>}
        {s === 'selesai' && !refreshing && view !== 'error' && (r.awb || r.shippingCourier) && (
          <div className="rounded-[20px] border border-[#c6efd8] bg-mint p-4">
            <p className="text-xs font-bold text-success">Pengiriman Telah Selesai</p>
            <p className="mt-1 text-xs text-muted">
              {cleanCourierName(r.shippingCourier)} {r.awb ? `• Resi ${r.awb}` : ''}
            </p>
            <Button variant="outline" size="sm" full icon={Ticket} className="mt-3 bg-white" onClick={() => go('shipping', { id })}>
              Lihat Resi & Riwayat Pengiriman
            </Button>
          </div>
        )}
      </div>
    </Screen>
  )

  function activePanel(step: number) {
    if (step === 0 || step === 1)
      return (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="flex items-start gap-2.5 rounded-2xl bg-tint p-3 text-[13px] leading-5 text-ink">
            <Search className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 break-words">
              Laporan Anda sedang dicocokkan secara internal oleh Petugas CS berdasarkan ciri rahasia Anda. Tombol klaim otomatis terbuka setelah CS menautkan kandidat yang cocok.
            </span>
          </div>
          <button onClick={refresh} className="min-h-10 rounded-xl border border-dashed border-[#b9c7d0] text-[11px] font-semibold text-muted hover:bg-tint">
            Periksa Status Terbaru
          </button>
        </div>
      )
    if (step === 2) {
      if (s === 'kedaluwarsa')
        return (
          <Banner tone="neutral" icon={Hourglass} className="mt-3">
            Masa penyimpanan berakhir. Hubungi Posko CS.
          </Banner>
        )
      if (view === 'multi')
        return (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-start gap-2.5 rounded-2xl bg-tint p-3 text-[13px] leading-5 text-ink">
              <BellRing className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Sistem menemukan 3 kandidat yang mungkin cocok.
            </div>
            <Button variant="cta" full onClick={() => go('candidates', { id })}>
              Lihat Kandidat <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        )
      if (s === 'kandidat')
        return (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-start gap-2.5 rounded-2xl bg-tint p-3 text-[13px] leading-5 text-ink">
              <BellRing className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Sistem menemukan {candidatesList.length || 1} kandidat barang yang cocok dengan laporan Anda.
            </div>
            <Button variant="cta" full onClick={() => go('candidates', { id })}>
              Ajukan Klaim Kepemilikan <ArrowRight className="size-4" aria-hidden />
            </Button>
            <p className="flex items-center justify-center gap-1 text-xs text-muted">
              <Hourglass className="size-3.5" aria-hidden /> Kandidat ditahan untuk Anda selama 3×24 jam.
            </p>
          </div>
        )
      if (s === 'ditinjau')
        return (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2.5 rounded-2xl bg-tint p-3 text-[13px] text-ink">
              <Clock className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">
                <b>Klaim Sedang Ditinjau CS</b>
                <br />
                Rata-rata 2 jam. Kami kabari begitu ada keputusan.
              </span>
            </div>
            <button onClick={refresh} className="min-h-10 rounded-xl border border-dashed border-[#b9c7d0] text-[11px] font-semibold text-muted hover:bg-tint">
              Periksa Status Terbaru
            </button>
          </div>
        )
      if (s === 'perlu_info')
        return (
          <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-warn-soft p-3">
            <p className="text-xs font-bold text-warn">Pesan dari Petugas CS • Rina K.</p>
            <p className="text-[13px] leading-5 text-ink">"Mohon unggah foto label nomor seri di bagian bawah laptop atau bukti pembelian agar kami dapat memastikan kepemilikan."</p>
            <Button variant="cta" full onClick={() => go('candidates', { id })}>
              Lengkapi Data
            </Button>
            <p className="flex items-center gap-1 text-xs text-warn">
              <Hourglass className="size-3.5" aria-hidden /> Batas 24 jam • sisa 21:40:12
            </p>
          </div>
        )
      if (s === 'ditolak') {
        const left = r.attempts ?? 2
        return (
          <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-danger-soft p-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-danger">
              <XCircle className="size-4" aria-hidden /> Klaim belum dapat disetujui
            </p>
            <p className="text-[13px] leading-5 text-ink">
              <b>Alasan:</b> Ciri tidak sesuai. Ciri yang Anda sebutkan belum cocok dengan catatan gudang. Coba jelaskan detail lain seperti isi sleeve atau nomor seri.
            </p>
            {left > 0 ? (
              <Button variant="outline" full onClick={() => go('candidates', { id })}>
                Ajukan Ulang (sisa {left} kesempatan)
              </Button>
            ) : (
              <p className="text-[13px] font-semibold text-ink">Silakan datang langsung ke Posko CS.</p>
            )}
          </div>
        )
      }
    }
    if (step === 4) {
      if (s === 'dikirim') {
        const st = (r.shippingStatus || '').toLowerCase()
        const isIssue = ['courier_not_found', 'cancelled', 'rejected', 'disposed', 'return_in_transit', 'returned'].includes(st)
        const isHold = st === 'on_hold'
        const msg =
          st === 'courier_not_found'
            ? 'Kendala kurir: Tidak ada kurir tersedia saat penjemputan. Petugas logistik akan menjadwalkan ulang.'
            : st === 'cancelled' || st === 'rejected' || st === 'disposed'
              ? `Pengiriman terkendala (${st}). Hubungi atau tunggu penjadwalan ulang dari petugas logistik.`
              : st === 'return_in_transit' || st === 'returned'
                ? 'Paket dikembalikan ke Posko CS karena pengantaran gagal.'
                : isHold
                  ? 'Pengiriman tertunda sementara oleh pihak kurir.'
                  : r.awb
                    ? `Barang sedang dalam pengiriman via ekspedisi (Nomor Resi: ${r.awb}).`
                    : 'Metode pengiriman ekspedisi telah diproses & lunas. Paket sedang disiapkan oleh Petugas Logistik KAI.'
        return (
          <div className="mt-3 flex flex-col gap-3">
            <div
              className={cx(
                'flex items-start gap-2.5 rounded-2xl p-3 text-[13px] leading-5 text-ink',
                isIssue ? 'bg-danger-soft' : isHold ? 'bg-warn-soft' : 'bg-mint'
              )}
            >
              {isIssue || isHold ? (
                <AlertCircle className={cx('mt-0.5 size-4 shrink-0', isIssue ? 'text-danger' : 'text-warn')} aria-hidden />
              ) : (
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              )}
              <span className="min-w-0 flex-1 break-words">{msg}</span>
            </div>
            <Button variant="cta" full icon={Ticket} onClick={() => go('shipping', { id })}>
              Lihat Status Paket & Resi
            </Button>
            <button onClick={refresh} className="min-h-10 rounded-xl border border-dashed border-[#b9c7d0] text-[11px] font-semibold text-muted hover:bg-tint">
              Periksa Status Pengiriman
            </button>
          </div>
        )
      }
      if (choseStationPickup)
        return (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-start gap-2.5 rounded-2xl bg-mint p-3 text-[13px] leading-5 text-ink">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span className="min-w-0 flex-1 break-words">
                Pengambilan mandiri di Posko CS St. {r.originStation || r.to} telah dikonfirmasi. Tunjukkan kode QR BAST #{r.bastCode || 'KCI-2026-089'} kepada petugas saat mengambil barang.
              </span>
            </div>
            <Button variant="cta" full icon={Ticket} onClick={() => go('bast', { id })}>
              Tampilkan Tiket & QR BAST Digital
            </Button>
          </div>
        )
      return (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-start gap-2.5 rounded-2xl bg-mint p-3 text-[13px] leading-5 text-ink">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <span className="min-w-0 flex-1 break-words">Klaim disetujui. BAST Digital #{r.bastCode || 'KCI-2026-089'} sudah terbit. Pilih cara pengambilan barang.</span>
          </div>
          <Button variant="cta" full icon={Ticket} onClick={() => go('bast', { id })}>
            Lihat BAST Digital & Pilih Metode
          </Button>
        </div>
      )
    }
    return null
  }
}

/* ---------------- Multiple candidates ---------------- */
export function CandidatesScreen({ id }: { id: string }) {
  const { replace, updateReport, back } = useApp()
  const toast = useToast()
  const [multi, setMulti] = useState(false)
  const [candsList, setCandsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<string[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [noneDialog, setNoneDialog] = useState(false)

  useEffect(() => {
    setLoading(true)
    reportApi.candidates(id)
      .then((data) => {
        setCandsList(Array.isArray(data) ? data : [])
      })
      .catch(() => setCandsList([]))
      .finally(() => setLoading(false))
  }, [id])

  const choose = (cid: string) => setSel((s) => (multi ? (s.includes(cid) ? s.filter((x) => x !== cid) : [...s, cid]) : [cid]))
  const matchMeta = { Tinggi: { w: 'w-full', c: 'bg-success', tone: 'success' as const }, Sedang: { w: 'w-2/3', c: 'bg-[#f2c94c]', tone: 'warn' as const }, Rendah: { w: 'w-1/3', c: 'bg-coral', tone: 'coral' as const } }

  return (
    <Screen
      header={<TopBar title="Kandidat Barang" sub={`#${id} • ${candsList.length} kandidat`} />}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            variant="cta"
            size="lg"
            full
            disabled={!sel.length}
            onClick={() => {
              setSkipped(candsList.map((c) => c.id).filter((x) => !sel.includes(x)))
              replace('claim', { id, candidates: sel })
            }}
          >
            Ajukan Klaim ({sel.length || 0} barang)
          </Button>
          <Button variant="ghost" full onClick={() => setNoneDialog(true)}>
            Tidak ada yang cocok
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <Banner tone="info" icon={Lock}>
          Demi keamanan, foto barang tidak ditampilkan. Pilih berdasarkan ciri umum di bawah.
        </Banner>
        <div className="rounded-[20px] border border-line bg-white px-4">
          <Toggle
            checked={multi}
            onChange={(v) => {
              setMulti(v)
              setSel((s) => s.slice(0, 1))
            }}
            label="Klaim lebih dari satu barang"
            description="Untuk laporan berisi beberapa barang."
          />
        </div>
        <div role={multi ? 'group' : 'radiogroup'} aria-label="Daftar kandidat" className="flex flex-col gap-2.5">
          {!loading && candsList.length === 0 ? (
            <div className="rounded-[20px] border border-line bg-white">
              <EmptyState
                icon={Lock}
                title="Belum ada kandidat barang yang ditautkan petugas CS."
                body="Demi keamanan, daftar barang gudang hanya muncul setelah Petugas CS mencocokkan laporan Anda."
              />
            </div>
          ) : (
            candsList.map((c) => {
              const on = sel.includes(c.id)
              const mm = matchMeta[c.match as keyof typeof matchMeta] || matchMeta.Sedang
              return (
                <button key={c.id} role={multi ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => choose(c.id)} className={cx('flex items-start gap-3 rounded-[20px] bg-white p-4 text-left', on ? 'border-2 border-primary' : 'border border-line')}>
                  {multi ? (
                    <span className={cx('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2', on ? 'border-primary bg-primary text-white' : 'border-[#b9c7d0]')}>{on && <Check className="size-4" strokeWidth={3} aria-hidden />}</span>
                  ) : (
                    <span className="mt-0.5">
                      <RadioDot checked={on} />
                    </span>
                  )}
                  <CategoryBadge category={c.cat} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-bold text-ink">{c.desc}</p>
                    <p className="break-words text-xs text-muted">{c.found}</p>
                    <p className="break-words text-xs text-muted">{c.posko}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e6edf1]" aria-hidden>
                        <span className={cx('block h-full rounded-full', mm.w, mm.c)} />
                      </span>
                      <Badge tone={mm.tone}>Kecocokan {c.match}</Badge>
                      {skipped.includes(c.id) && <Badge tone="neutral">Dilewati</Badge>}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
        <p className="text-center text-xs text-muted">Kandidat yang tidak dipilih tetap ditahan 24 jam dengan label "Dilewati".</p>
      </div>
      <Dialog
        open={noneDialog}
        onClose={() => setNoneDialog(false)}
        icon={Search}
        title="Tandai tidak cocok?"
        actions={
          <>
            <Button
              full
              onClick={() => {
                updateReport(id, { status: 'pencarian', candidates: 0 })
                setNoneDialog(false)
                toast('Terima kasih. Petugas melanjutkan pencarian.')
                back()
              }}
            >
              Ya, Tidak Ada yang Cocok
            </Button>
            <Button variant="ghost" full onClick={() => setNoneDialog(false)}>
              Kembali
            </Button>
          </>
        }
      >
        Petugas akan melanjutkan pencarian.
      </Dialog>
    </Screen>
  )
}

/* ---------------- Claim (blind verification) ---------------- */
let nikOnFile = false

export function ClaimScreen({ id, candidates = ['FND-0412'] }: { id: string; candidates?: string[] }) {
  const { updateReport, back, reports, user } = useApp()
  const toast = useToast()
  const r = reports.find((x) => x.id === id)!
  const [apiCands, setApiCands] = useState<any[]>([])
  const ktpFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    reportApi.candidates(id)
      .then((data) => {
        if (data && data.length > 0) setApiCands(data)
      })
      .catch(() => {})
  }, [id])

  const cands = candidates.map((cid) => {
    const foundApi = apiCands.find((c) => c.id === cid)
    if (foundApi) return foundApi
    const foundStatic = STATIC_CANDIDATES.find((c) => c.id === cid)
    if (foundStatic) return foundStatic
    return {
      id: cid,
      cat: r?.items?.[0]?.category || 'Elektronik',
      desc: `${r?.items?.[0]?.name || 'Barang'} • ${cid}`,
      found: 'Ditemukan baru-baru ini',
      posko: `Posko CS St. ${r?.originStation || r?.to || 'Jakarta Kota'}`,
      match: 'Tinggi' as const,
    }
  })
  const [ktp, setKtp] = useState<'none' | 'ok' | 'failed' | 'blur' | 'uploading'>('none')
  const [ktpMeta, setKtpMeta] = useState<{ name: string; size: string; url: string } | null>(null)
  const [nik, setNik] = useState(user?.nik || '')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [openC, setOpenC] = useState<string | undefined>(candidates[0])
  const [extras, setExtras] = useState<string[]>([])
  const [agree, setAgree] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [removeKtp, setRemoveKtp] = useState(false)
  const needNik = !user?.nik

  const nikErr = needNik && nik.length !== 16 ? 'NIK terdiri dari 16 digit angka.' : ''
  const ansErr = (cid: string) => ((answers[cid] ?? '').trim().length < 10 ? 'Jelaskan lebih rinci agar CS dapat memverifikasi (min. 10 karakter).' : '')
  const valid = ktp === 'ok' && !nikErr && cands.every((c) => !ansErr(c.id)) && agree

  const handleKtpFile = async (f?: File) => {
    if (!f) return
    setKtp('uploading')
    try {
      const res = await uploadApi.upload(f, 'ktp')
      setKtpMeta({
        name: f.name,
        size: (f.size / 1024 / 1024).toFixed(1) + ' MB',
        url: res.url,
      })
      setKtp('ok')
    } catch {
      setKtpMeta({
        name: f.name || `Identitas_${(user?.name || 'Penumpang').replace(/\s+/g, '_')}.jpg`,
        size: ((f.size || 500000) / 1024 / 1024).toFixed(1) + ' MB',
        url: '',
      })
      setKtp('ok')
    }
  }

  const uploadKtp = () => {
    ktpFileRef.current?.click()
  }

  if (done)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-white px-8 text-center">
        <span className="lf-pop flex size-24 items-center justify-center rounded-full bg-mint text-success">
          <FileCheck2 className="size-12" aria-hidden />
        </span>
        <h1 className="text-[22px] font-bold text-ink" role="status">
          Klaim Terkirim
        </h1>
        <p className="text-sm leading-5 text-muted">CS akan meninjau dalam ± 2 jam kerja. Anda akan dikabari lewat WhatsApp/Email.</p>
        <p className="flex items-center gap-1.5 rounded-xl bg-tint px-3 py-2 text-xs text-primary-dark">
          <ShieldCheck className="size-4 shrink-0" aria-hidden /> Foto KTP hanya dilihat petugas CS dan dihapus otomatis setelah proses selesai.
        </p>
        <Button variant="cta" size="lg" full className="mt-4" onClick={back}>
          Kembali ke Status Laporan
        </Button>
      </div>
    )

  return (
    <Screen
      header={<TopBar title="Ajukan Klaim Kepemilikan" sub={`#${id}${cands.length > 1 ? ` • ${cands.length} barang` : ''}`} />}
      footer={
        <Button
          variant="cta"
          size="lg"
          full
          disabled={!valid}
          loading={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const res = await reportApi.claim(id, {
                candidates,
                answers,
                nik: nik || user?.nik || undefined,
                ktp_url: ktpMeta?.url || ktpMeta?.name || undefined,
              })
              nikOnFile = true
              updateReport(id, res.report)
              setBusy(false)
              setDone(true)
            } catch (err: any) {
              setBusy(false)
              toast(err.message || 'Gagal mengajukan klaim. Coba lagi.', { tone: 'danger' })
            }
          }}
        >
          {busy ? 'Mengirim...' : 'Kirim Bukti Klaim ke CS'}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex gap-3 rounded-[20px] bg-tint p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
            <Lock className="size-5" aria-hidden />
          </span>
          <p className="text-[13px] leading-5 text-ink">Demi keamanan (UU PDP & Anti-Fraud), foto asli barang di gudang disembunyikan. Silakan unggah bukti kepemilikan Anda.</p>
        </div>
        {r.status === 'ditolak' && (
          <Banner tone="warn" icon={Info}>
            Pengajuan ulang • sisa {r.attempts ?? 2} kesempatan.
          </Banner>
        )}

        <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted">
                Upload Foto Identitas Resmi (KTP / Kartu Pelajar) <span className="text-cta">*</span>
              </p>
            </div>
            <input
              ref={ktpFileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Unggah foto KTP"
              onChange={(e) => handleKtpFile(e.target.files?.[0])}
            />
            {ktp === 'none' || ktp === 'uploading' ? (
              <button type="button" onClick={uploadKtp} disabled={ktp === 'uploading'} className="flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-accent bg-tint/40 py-5 hover:bg-tint" aria-describedby="ktp-err">
                {ktp === 'uploading' ? <RefreshCw className="size-6 animate-spin text-primary" aria-hidden /> : <Upload className="size-6 text-primary" aria-hidden />}
                <span className="text-sm font-bold text-primary">{ktp === 'uploading' ? 'Mengunggah...' : 'Unggah Foto Identitas'}</span>
                <span className="text-xs text-muted">Pastikan seluruh kartu terlihat jelas</span>
              </button>
            ) : (
              <div className={cx('flex items-center gap-2 overflow-hidden rounded-2xl p-2.5 pl-3', ktp === 'ok' ? 'bg-mint' : 'bg-danger-soft')}>
                <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-xl bg-white', ktp === 'ok' ? 'text-success' : 'text-danger')}>{ktp === 'ok' ? <Check className="size-5" aria-hidden /> : <AlertCircle className="size-5" aria-hidden />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{ktpMeta?.name || `KTP_${(user?.name || 'Penumpang').replace(/\s+/g, '_')}.jpg`} ({ktpMeta?.size || '1.0 MB'})</p>
                  <p className={cx('text-xs font-semibold', ktp === 'ok' ? 'text-success' : 'text-danger')}>{ktp === 'ok' ? 'Terunggah' : ktp === 'failed' ? 'Gagal mengunggah' : 'Foto kurang jelas'}</p>
                </div>
                {ktp === 'ok' ? (
                  <>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={uploadKtp}>
                      Ganti Foto
                    </Button>
                    <button aria-label="Hapus foto identitas" onClick={() => setRemoveKtp(true)} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white">
                      <X className="size-4" aria-hidden />
                    </button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => {
                      setKtp('uploading')
                      setTimeout(() => setKtp('ok'), 600)
                    }}>
                    Ulangi
                  </Button>
                )}
              </div>
            )}
            <div id="ktp-err" aria-live="polite">
              {ktp === 'blur' && <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger"><AlertCircle className="size-3.5" aria-hidden />Foto kurang jelas. Pastikan seluruh kartu terlihat.</p>}
              {ktp === 'none' && touched.ktp && <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger"><AlertCircle className="size-3.5" aria-hidden />Foto identitas wajib diunggah.</p>}
            </div>
          </div>

          {needNik && (
            <Field label="NIK (16 digit)" required error={touched.nik ? nikErr : undefined} counter={`${nik.length}/16`} helper="NIK hanya diminta sekali dan disimpan terenkripsi.">
              {(a) => <input {...a} inputMode="numeric" maxLength={16} value={nik} onBlur={() => setTouched((t) => ({ ...t, nik: true, ktp: true }))} onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))} placeholder="3201xxxxxxxxxxxx" className={inputCls(!!(touched.nik && nikErr)) + ' h-12 tracking-wider'} />}
            </Field>
          )}

          {cands.map((c, i) => {
            const open = cands.length === 1 || openC === c.id
            const err = touched[c.id] ? ansErr(c.id) : ''
            return (
              <div key={c.id} className="rounded-2xl border border-line bg-[#fafcfd]">
                <button
                  type="button"
                  onClick={() => cands.length > 1 && setOpenC(open ? undefined : c.id)}
                  aria-expanded={open}
                  className="flex min-h-14 w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                >
                  <CategoryBadge category={c.cat} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={c.cat === 'Uang Tunai' ? 'warn' : c.cat === 'Non Elektronik' ? 'neutral' : 'info'}>
                        {c.cat}
                      </Badge>
                      <span className="font-mono text-[11px] font-semibold text-muted">#{c.id}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-bold text-ink">
                      {cands.length > 1 ? `Barang ${i + 1}: ` : ''}{c.desc.split(' •')[0]}
                    </p>
                  </div>
                  {!ansErr(c.id) && <Check className="size-4 shrink-0 text-success" aria-label="Lengkap" />}
                  {cands.length > 1 && <ChevronDown className={cx('size-5 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />}
                </button>
                {open && (
                  <div className="border-t border-line bg-white p-3.5 rounded-b-2xl">
                    <Field label="Jawaban Ciri Spesifik Rahasia" required counter={`${(answers[c.id] ?? '').length}/500`} error={err}>
                      {(a) => (
                        <textarea
                          {...a}
                          rows={4}
                          maxLength={500}
                          value={answers[c.id] ?? ''}
                          onBlur={() => setTouched((t) => ({ ...t, [c.id]: true }))}
                          onChange={(e) => setAnswers((s) => ({ ...s, [c.id]: e.target.value }))}
                          placeholder="Sebutkan isi di dalam tas, stiker khusus, wallpaper, atau nomor seri"
                          className={inputCls(!!err) + ' resize-none py-3'}
                        />
                      )}
                    </Field>
                  </div>
                )}
              </div>
            )
          })}

          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">Upload Bukti Tambahan (opsional, maks 3 file)</p>
            <div className="flex flex-wrap gap-2">
              {extras.map((x) => (
                <span key={x} className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full bg-tint pl-3 pr-1 text-xs font-semibold text-primary">
                  <span className="truncate">{x}</span>
                  <button aria-label={`Hapus ${x}`} onClick={() => setExtras((e) => e.filter((y) => y !== x))} className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-white">
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))}
              {extras.length < 3 && (
                <button onClick={() => setExtras((e) => [...e, ['Nota_Pembelian.pdf', 'Foto_Barang_Lama.jpg', 'Kotak_Serial.jpg'][e.length]])} className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-accent px-3 text-xs font-bold text-primary hover:bg-tint">
                  <Upload className="size-3.5" aria-hidden /> Tambah File
                </button>
              )}
            </div>
          </div>

          <Checkbox checked={agree} onChange={setAgree}>
            Saya menyatakan data dan jawaban ini benar. Klaim palsu dapat diproses sesuai hukum.
          </Checkbox>
        </section>
        <p className="flex items-start gap-1.5 px-1 text-xs leading-5 text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> Foto KTP hanya dilihat petugas CS dan dihapus otomatis setelah proses selesai.
        </p>
        {!valid && <p className="text-center text-xs text-muted">Lengkapi foto identitas, {needNik ? 'NIK, ' : ''}jawaban ciri rahasia, dan pernyataan untuk mengirim.</p>}
      </div>
      <Dialog
        open={removeKtp}
        onClose={() => setRemoveKtp(false)}
        title="Hapus foto identitas?"
        actions={
          <>
            <Button
              variant="danger"
              full
              onClick={() => {
                setKtp('none')
                setRemoveKtp(false)
              }}
            >
              Hapus
            </Button>
            <Button variant="ghost" full onClick={() => setRemoveKtp(false)}>
              Batal
            </Button>
          </>
        }
      >
        Anda perlu mengunggah ulang sebelum mengirim klaim.
      </Dialog>
    </Screen>
  )
}

