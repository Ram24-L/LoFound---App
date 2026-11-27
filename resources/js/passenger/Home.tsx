import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, ArrowUpDown, Bell, ChevronRight, Download, FileClock, Search, Share, ShieldCheck, Trash2, User, X } from 'lucide-react'
import { STATUS_META, STATIONS } from '../lib/data'
import { Button, cx, EmptyState, ErrorState, inputCls, Logo, LogoMark, Pill, ProgressRing, RouteConnector, Sheet, Skeleton, useCategories, useCountUp, useToast } from '../lib/ui'
import { homeApi } from '../lib/api'
import { usePwaInstall } from '../lib/pwa'
import { useApp } from './ctx'
import { SectionTitle } from './shell'

const STATUS_TEXT_TONE: Record<string, string> = {
  success: 'text-[#1f7a4a]',
  info: 'text-primary-dark',
  coral: 'text-[#b8402f]',
  warn: 'text-warn',
  danger: 'text-danger',
  neutral: 'text-muted',
  primary: 'text-primary',
}

export function HomeScreen() {
  const { user, go, tab, reports, unread, requireAuth, draft, setDraft } = useApp()
  const { categories } = useCategories()
  const toast = useToast()
  const pwa = usePwaInstall()
  const CATS = ['Semua Kategori', ...categories]
  const [cat, setCat] = useState('Semua Kategori')
  const [from, setFrom] = useState('Semua Stasiun')
  const [to, setTo] = useState('Semua Stasiun')
  const [picker, setPicker] = useState<'from' | 'to' | null>(null)
  const [howSheet, setHowSheet] = useState(false)
  const [iosSheet, setIosSheet] = useState(false)
  const [feedState, setFeedState] = useState<'normal' | 'loading' | 'empty' | 'error'>('loading')
  const [feedData, setFeedData] = useState<any[]>([])
  const [showAllFeed, setShowAllFeed] = useState(false)
  const [slide, setSlide] = useState(0)

  const loadFeed = useCallback((showSkeleton = false) => {
    if (showSkeleton) setFeedState('loading')
    homeApi.feed()
      .then((data) => {
        setFeedData(Array.isArray(data) ? data : [])
        setFeedState('normal')
      })
      .catch(() => {
        setFeedState((cur) => (cur === 'loading' ? 'error' : cur))
      })
  }, [])

  useEffect(() => {
    loadFeed(true)
    const onFocus = () => loadFeed(false)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadFeed])

  const active = user ? reports.filter((r) => !['selesai', 'dibatalkan', 'kedaluwarsa'].includes(r.status)) : []
  const feed = feedData.filter(
    (f) =>
      (cat === 'Semua Kategori' || f.cat === cat) &&
      (from === 'Semua Stasiun' ? true : f.from === from.replace('St. ', '')) &&
      (to === 'Semua Stasiun' ? true : f.to === to.replace('St. ', '')),
  )
  const visibleFeed = showAllFeed ? feed : feed.slice(0, 3)

  useEffect(() => {
    setShowAllFeed(false)
  }, [cat, from, to])
  const effective = feedState === 'normal' && feed.length === 0 ? 'empty' : feedState

  const startReport = () => go('wizard')

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto lf-noscroll">
        {/* Header */}
        <header className="relative overflow-hidden bg-primary px-5 pb-[88px] pt-4 text-white">
          <div aria-hidden className="absolute -right-20 -top-24 size-64 rounded-full bg-accent/30" />
          <div className="relative flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <Logo light size="sm" />
              <h1 className="mt-3 text-[22px] font-bold leading-7">{user ? `Halo, ${user.name}!` : 'Halo, Tamu'}</h1>
              <p className="text-[13px] text-white/85">{user ? 'Semoga perjalanan Anda lancar hari ini.' : 'Lihat transparansi layanan atau buat laporan tanpa antre.'}</p>
            </div>
            {user ? (
              <div className="flex items-center gap-1 self-start">
                <button aria-label={`Notifikasi, ${unread} belum dibaca`} onClick={() => go('notifications')} className="relative flex size-11 items-center justify-center rounded-full hover:bg-white/10">
                  <Bell className="size-5" aria-hidden />
                  {unread > 0 && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full border-2 border-primary bg-coral" />}
                </button>
                <button aria-label="Buka profil" onClick={() => tab('profile')} className="flex size-11 items-center justify-center rounded-full">
                  <span className="flex size-9 items-center justify-center rounded-full bg-white text-primary">
                    <User className="size-5" aria-hidden />
                  </span>
                </button>
              </div>
            ) : (
              <Button variant="white" size="sm" className="self-start" onClick={() => go('auth', { mode: 'login' })}>
                Masuk
              </Button>
            )}
          </div>
        </header>

        <div className="relative z-10 -mt-[72px] flex flex-col gap-3 px-5 pb-6">
          <BentoMetrics onHow={() => setHowSheet(true)} />

          {/* Guest draft reminder */}
          {!user && draft && (
            <div className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn">
                <FileClock className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">Draf laporan tersimpan</p>
                <p className="text-xs text-muted">Terhapus otomatis dalam 24 jam di perangkat ini.</p>
              </div>
              <button aria-label="Hapus draf" onClick={() => setDraft(null)} className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-danger-soft hover:text-danger">
                <Trash2 className="size-4" aria-hidden />
              </button>
              <Button size="sm" variant="tint" onClick={startReport}>
                Lanjutkan
              </Button>
            </div>
          )}

          {/* Active report widget */}
          {active.length > 0 ? (
            <div>
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto lf-noscroll" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
                {active.map((r) => {
                  const m = STATUS_META[r.status]
                  const itemName = r.items?.[0]?.name || 'Barang Dilaporkan'
                  const extraCount = (r.items?.length ?? 1) - 1
                  return (
                    <button
                      key={r.id}
                      onClick={() => go('tracking', { id: r.id })}
                      className={cx('flex w-full shrink-0 snap-center items-center gap-3 rounded-[20px] bg-white p-4 text-left', m.action ? 'border-2 border-primary' : 'border border-line')}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Laporan Aktif</p>
                        <p className="mt-0.5 truncate text-sm font-bold text-ink">
                          {itemName}
                          {extraCount > 0 ? ` (+${extraCount} barang)` : ''}
                        </p>
                        <p className={cx('mt-2.5 text-xs font-semibold', STATUS_TEXT_TONE[m.tone] || 'text-muted')}>
                          {m.label}
                        </p>
                      </div>
                      <ArrowRight className="size-5 shrink-0 text-primary" aria-hidden />
                    </button>
                  )
                })}
              </div>
              {active.length > 1 && (
                <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
                  {active.map((r, i) => (
                    <span key={r.id} className={cx('h-1.5 rounded-full transition-all', i === slide ? 'w-5 bg-primary' : 'w-1.5 bg-[#b9d6e3]')} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => (user ? startReport() : requireAuth('Masuk untuk melacak laporan Anda dan mendapat kabar saat barang ditemukan.', () => tab('reports'), 'Berhasil masuk.'))} className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-accent bg-white/70 p-4 text-left">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-tint text-primary">
                <Search className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-ink">Barang tertinggal? Lapor dalam 2 menit.</span>
                <span className="block text-xs text-muted">{user ? 'Anda belum punya laporan aktif.' : 'Masuk untuk melacak laporan Anda.'}</span>
              </span>
              <ChevronRight className="size-5 text-primary" aria-hidden />
            </button>
          )}

          {/* Route filter */}
          <section className="rounded-2xl border border-line bg-white p-4" aria-label="Filter rute">
            <SectionTitle>Filter Rute &amp; Kategori</SectionTitle>
            <div className="flex items-center gap-2 rounded-xl bg-tint/60 px-3.5 py-3">
              <div className="flex-1">
                <RouteConnector gap="gap-4" from={from} to={to} fromLabel="Dari" toLabel="Ke" onFrom={() => setPicker('from')} onTo={() => setPicker('to')} />
              </div>
              <button
                aria-label="Tukar rute"
                onClick={() => {
                  setFrom(to)
                  setTo(from)
                }}
                className="flex size-10 items-center justify-center rounded-full border border-line bg-white text-primary hover:bg-tint"
              >
                <ArrowUpDown className="size-4" aria-hidden />
              </button>
            </div>
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 lf-noscroll" role="group" aria-label="Kategori">
              {CATS.map((c) => (
                <Pill key={c} active={cat === c} onClick={() => setCat(c)}>
                  {c}
                </Pill>
              ))}
            </div>
          </section>

          {!pwa.isInstalled && !pwa.dismissed && (pwa.canInstall || pwa.isIosPromptable) && (
            <div className="flex items-center gap-3 rounded-[20px] border border-[#bfe0ee] bg-white p-3.5 shadow-[0_8px_24px_-16px_rgba(49,143,181,0.4)]">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-line">
                <LogoMark className="h-full w-full" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">Pasang Aplikasi LoFound</p>
                <p className="text-xs text-muted">Akses lebih cepat dari layar utama tanpa membuka browser.</p>
              </div>
              <Button
                size="sm"
                variant="primary"
                icon={Download}
                className="shrink-0"
                onClick={async () => {
                  if (pwa.canInstall) {
                    const res = await pwa.promptInstall()
                    if (res === 'accepted') toast('Aplikasi LoFound sedang dipasang.')
                  } else {
                    setIosSheet(true)
                  }
                }}
              >
                Unduh
              </Button>
              <button
                type="button"
                aria-label="Tutup ajakan pasang aplikasi"
                onClick={pwa.dismiss}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-tint hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )}

          {/* Feed */}
          <section aria-label="Daftar barang yang sudah kembali" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between px-1 pt-1">
              <h3 className="text-[13px] font-bold text-ink">Baru Dikembalikan</h3>
              {effective === 'normal' && (
                <span className="text-[11px] font-medium tabular-nums text-muted">{feed.length} catatan</span>
              )}
            </div>
            {effective === 'loading' && (
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col gap-2 px-4 py-3.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-2.5 w-2/3" />
                  </div>
                ))}
              </div>
            )}
            {effective === 'error' && (
              <div className="rounded-2xl border border-line bg-white">
                <ErrorState title="Gagal memuat riwayat." onRetry={() => loadFeed(true)} />
              </div>
            )}
            {effective === 'empty' && (
              <div className="rounded-2xl border border-line bg-white">
                <EmptyState
                  icon={Search}
                  title="Belum ada riwayat pengembalian."
                  body={
                    feedData.length === 0
                      ? 'Belum ada laporan berstatus selesai untuk ditampilkan.'
                      : 'Coba ubah stasiun atau kategori untuk melihat barang lain yang sudah kembali.'
                  }
                  action={
                    (cat !== 'Semua Kategori' || from !== 'Semua Stasiun' || to !== 'Semua Stasiun') ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCat('Semua Kategori')
                          setFrom('Semua Stasiun')
                          setTo('Semua Stasiun')
                        }}
                      >
                        Reset Filter
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            )}
            {effective === 'normal' && (
              <>
                <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                  {visibleFeed.map((f, idx) => (
                    <article key={f.id || `${f.bast}-${idx}`} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14px] font-bold leading-5 text-ink">{f.item}</p>
                        <span className="shrink-0 pt-0.5 text-[11px] font-medium tabular-nums text-soft">
                          {f.when}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-ink/80">
                        St. {f.from} &rarr; St. {f.to}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] text-muted">
                        <span>
                          {f.who} &middot; <span className="font-mono font-semibold text-ink/75">#{f.bast}</span>
                        </span>
                        <span className="font-medium text-soft">{f.cat}</span>
                      </div>
                    </article>
                  ))}
                  {feed.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowAllFeed((v) => !v)}
                      className="flex min-h-11 w-full items-center justify-center bg-[#fafcfd] px-4 py-2.5 text-xs font-bold text-primary hover:bg-tint/60"
                    >
                      {showAllFeed ? 'Tampilkan lebih sedikit' : `Lainnya (${feed.length - 3} lagi)`}
                    </button>
                  )}
                </div>
                <p className="flex items-center justify-center gap-1.5 px-4 pt-1 text-center text-[11px] text-muted">
                  <ShieldCheck className="size-3.5 shrink-0" aria-hidden /> Foto barang disembunyikan untuk mencegah klaim palsu.
                </p>
              </>
            )}
          </section>
        </div>
      </main>

      <div className="shrink-0 bg-gradient-to-t from-canvas via-canvas to-canvas/0 px-5 pb-3 pt-2">
        <Button variant="cta" size="lg" full onClick={startReport}>
          + Buat Laporan Kehilangan
        </Button>
      </div>

      <StationPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        onPick={(v) => {
          if (picker === 'from') setFrom(v)
          else setTo(v)
          setPicker(null)
        }}
        allowLines
      />

      <Sheet open={howSheet} onClose={() => setHowSheet(false)} title="Cara kami menghitung">
        <div className="flex flex-col gap-3 text-sm leading-5 text-muted">
          {[
            ['Rasio Kembali', 'Jumlah barang yang sudah diserahterimakan dibagi seluruh barang yang cocok dengan laporan pada bulan berjalan.'],
            ['Laporan Dibuat', 'Jumlah laporan kehilangan yang dikirim penumpang pada bulan berjalan, termasuk yang masih dalam pencarian.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-tint p-3.5">
              <p className="font-bold text-ink">{t}</p>
              <p>{d}</p>
            </div>
          ))}
          <p className="text-xs">Data diperbarui setiap 15 menit dari seluruh Posko CS. Tidak ada data pribadi yang ditampilkan.</p>
        </div>
      </Sheet>

      <Sheet open={iosSheet} onClose={() => setIosSheet(false)} title="Pasang LoFound di iPhone / iPad">
        <div className="flex flex-col gap-3 text-sm leading-5 text-muted">
          <div className="flex items-start gap-3 rounded-2xl bg-tint p-3.5">
            <Share className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-bold text-ink">1. Ketuk ikon Bagikan (Share)</p>
              <p>Pada bilah bawah Safari, ketuk tombol kotak dengan panah ke atas.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-tint p-3.5">
            <Download className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-bold text-ink">2. Pilih &ldquo;Tambah ke Layar Utama&rdquo;</p>
              <p>Gulir daftar aksi lalu ketuk Tambah ke Layar Utama (Add to Home Screen).</p>
            </div>
          </div>
          <Button variant="primary" full onClick={() => setIosSheet(false)}>
            Mengerti
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function BentoMetrics({ onHow }: { onHow: () => void }) {
  const [stats, setStats] = useState<{ total: number; returned: number; ratio: number; in_progress: number } | null>(null)
  const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date())

  useEffect(() => {
    const loadStats = () => {
      homeApi.stats()
        .then((data) => {
          if (data && data.total !== undefined) setStats(data)
          else setStats({ total: 0, returned: 0, ratio: 0, in_progress: 0 })
        })
        .catch(() => setStats({ total: 0, returned: 0, ratio: 0, in_progress: 0 }))
    }
    loadStats()
    window.addEventListener('focus', loadStats)
    return () => window.removeEventListener('focus', loadStats)
  }, [])

  const ratio = useCountUp(stats?.ratio ?? 0, 800, 1)
  const created = useCountUp(stats?.total ?? 0, 800)
  const returned = useCountUp(stats?.returned ?? 0, 800)
  return (
    <button onClick={onHow} aria-label={`Transparansi layanan ${monthLabel}. Ketuk untuk melihat cara kami menghitung.`} className="rounded-[20px] border border-line bg-white p-4 text-left shadow-[0_12px_32px_-18px_rgba(24,54,74,0.45)]">
      <div className="mb-3.5 flex items-center gap-2.5">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-bold text-ink">Transparansi Layanan</p>
          <p className="text-[11px] font-medium text-muted">{monthLabel}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#1f7a4a]">
          <span className="lf-live size-2 rounded-full bg-success" aria-hidden />
          LIVE
        </span>
      </div>
      {stats === null ? (
        <div className="rounded-2xl bg-mint p-3.5" aria-busy="true" aria-label="Memuat statistik layanan">
          <div className="flex items-center gap-3.5">
            <Skeleton className="size-[72px] shrink-0 rounded-full bg-white/80" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-24 bg-white/80" />
              <Skeleton className="h-6 w-40 bg-white/80" />
              <Skeleton className="h-3 w-32 bg-white/80" />
            </div>
          </div>
          <Skeleton className="mt-3 h-2 w-full rounded-full bg-white/80" />
          <div className="mt-2 flex justify-between">
            <Skeleton className="h-3 w-24 bg-white/80" />
            <Skeleton className="h-3 w-24 bg-white/80" />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-mint p-3.5">
          <div className="flex items-center gap-3.5">
            <ProgressRing value={stats.ratio} size={72} stroke={7}>
              <span className="text-[15px] font-bold tabular-nums text-ink">{ratio}%</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[#1f7a4a]">Rasio Kembali</p>
              <p className="text-[20px] font-bold tabular-nums leading-7 text-ink">
                {returned} <span className="text-[14px] font-semibold text-muted">dari {created} laporan</span>
              </p>
              <p className="text-[12px] text-muted">sudah kembali ke pemiliknya</p>
            </div>
          </div>
          <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            <span className="h-full rounded-l-full bg-success transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, stats.ratio))}%` }} />
            <span className="h-full flex-1 rounded-r-full bg-white" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-[#1f7a4a]">
              <span className="size-2 rounded-full bg-success" /> Sudah kembali
            </span>
            <span className="flex items-center gap-1.5 text-muted">
              <span className="size-2 rounded-full border border-[#b9d6c6] bg-white" /> Dalam proses • {stats.in_progress}
            </span>
          </div>
        </div>
      )}
    </button>
  )
}

export function StationPicker({
  open,
  onClose,
  onPick,
  allowLines,
  title = 'Pilih Stasiun',
}: {
  open: boolean
  onClose: () => void
  onPick: (v: string) => void
  allowLines?: boolean
  title?: string
}) {
  const [q, setQ] = useState('')
  const [selectedLine, setSelectedLine] = useState('Semua Lin')
  const [dynamicStations, setDynamicStations] = useState(STATIONS)

  useEffect(() => {
    if (!open) return
    setQ('')
    setSelectedLine('Semua Lin')
    fetch('/api/stations', { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setDynamicStations(
            data.map((s: any) => ({
              code: s.kode || s.code,
              name: s.nama || s.name,
              line: s.lin || s.line,
            })),
          )
        }
      })
      .catch(() => {})
  }, [open, title])

  const lines = ['Semua Lin', ...new Set(dynamicStations.map((s) => s.line))]
  const list = dynamicStations.filter(
    (s) =>
      (selectedLine === 'Semua Lin' || s.line === selectedLine) &&
      (s.name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase())),
  )

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <label className="sr-only" htmlFor="st-search">
        Cari stasiun
      </label>
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 size-5 text-soft" aria-hidden />
        <input id="st-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari stasiun, contoh: Manggarai" className={inputCls() + ' h-12 pl-11'} />
      </div>
      <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-muted">Filter Berdasarkan Lin</p>
      <div className="flex flex-wrap gap-2">
        {lines.map((l) => (
          <Pill key={l} active={selectedLine === l} onClick={() => setSelectedLine(l)}>
            {l}
          </Pill>
        ))}
      </div>
      <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-muted">
        Stasiun {selectedLine !== 'Semua Lin' ? `(${selectedLine})` : ''}
      </p>
      <ul className="flex flex-col">
        {allowLines && selectedLine === 'Semua Lin' && !q && (
          <li>
            <button onClick={() => onPick('Semua Stasiun')} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-tint">
              <span className="w-12 rounded-lg bg-primary py-1 text-center text-[11px] font-bold text-white">ALL</span>
              <span className="flex-1 text-sm font-bold text-primary">Semua Stasiun</span>
              <span className="text-xs text-muted">Seluruh Rute</span>
            </button>
          </li>
        )}
        {list.map((s) => (
          <li key={s.code}>
            <button onClick={() => onPick('St. ' + s.name)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-tint">
              <span className="w-12 rounded-lg bg-tint py-1 text-center text-[11px] font-bold text-primary">{s.code}</span>
              <span className="flex-1 text-sm font-semibold text-ink">St. {s.name}</span>
              <span className="text-xs text-muted">{s.line}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <p className="py-6 text-center text-sm text-muted">Stasiun tidak ditemukan pada lin ini.</p>}
      </ul>
    </Sheet>
  )
}
