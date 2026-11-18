import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpDown, Bell, Check, ChevronRight, FileClock, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { CATEGORIES, FEED, STATUS_META, STATIONS } from '../lib/data'
import { Badge, Button, CategoryBadge, cx, EmptyState, ErrorState, inputCls, Logo, Pill, ProgressRing, RouteConnector, Sheet, Skeleton, useCountUp } from '../lib/ui'
import { homeApi } from '../lib/api'
import { useApp } from './ctx'
import { SectionTitle } from './shell'

const CATS = ['Semua Kategori', ...CATEGORIES]

export function HomeScreen() {
  const { user, go, reports, unread, requireAuth, draft, setDraft } = useApp()
  const [cat, setCat] = useState('Semua Kategori')
  const [from, setFrom] = useState('St. Bogor')
  const [to, setTo] = useState('St. Manggarai')
  const [picker, setPicker] = useState<'from' | 'to' | null>(null)
  const [howSheet, setHowSheet] = useState(false)
  const [feedState, setFeedState] = useState<'normal' | 'loading' | 'empty' | 'error'>('loading')
  const [feedData, setFeedData] = useState<any[]>(FEED)
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    homeApi.feed()
      .then((data) => {
        if (data && data.length > 0) setFeedData(data)
        setFeedState('normal')
      })
      .catch(() => setFeedState('normal'))
  }, [])

  const active = user ? reports.filter((r) => !['selesai', 'dibatalkan', 'kedaluwarsa'].includes(r.status)) : []
  const feed = feedData.filter(
    (f) =>
      (cat === 'Semua Kategori' || f.cat === cat) &&
      (from === 'Semua Stasiun' ? true : f.from === from.replace('St. ', '')),
  )
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
              <p className="mt-3 text-[22px] font-bold leading-7">{user ? `Halo, ${user.name}!` : 'Halo, Tamu'}</p>
              <p className="text-[13px] text-white/85">{user ? 'Semoga perjalanan Anda lancar hari ini.' : 'Lihat transparansi layanan atau buat laporan tanpa antre.'}</p>
            </div>
            {user ? (
              <div className="flex items-center gap-1 self-start">
                <button aria-label={`Notifikasi, ${unread} belum dibaca`} onClick={() => go('notifications')} className="relative flex size-11 items-center justify-center rounded-full hover:bg-white/10">
                  <Bell className="size-5" aria-hidden />
                  {unread > 0 && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full border-2 border-primary bg-coral" />}
                </button>
                <button aria-label="Buka profil" onClick={() => go('profile')} className="flex size-11 items-center justify-center rounded-full">
                  <span className="flex size-9 items-center justify-center rounded-full bg-white text-sm font-bold text-primary">MR</span>
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
                  return (
                    <button
                      key={r.id}
                      onClick={() => go('tracking', { id: r.id })}
                      className={cx('flex w-full shrink-0 snap-center items-center gap-3 rounded-[20px] bg-white p-4 text-left', m.action ? 'border-2 border-primary' : 'border border-line')}
                    >
                      <CategoryBadge category={r.items[0].category} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Laporan Aktif</p>
                        <p className="truncate text-sm font-bold text-ink">
                          #{r.id}: {r.status === 'kandidat' ? 'Kandidat Barang Ditemukan' : m.label}
                        </p>
                        <Badge tone={m.tone} className="mt-1.5">
                          {m.label}
                        </Badge>
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
            <button onClick={() => (user ? startReport() : requireAuth('Masuk untuk melacak laporan Anda dan mendapat kabar saat barang ditemukan.', () => go('reports'), 'Berhasil masuk.'))} className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-accent bg-white/70 p-4 text-left">
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
          <section className="rounded-[20px] border border-line bg-white p-4" aria-label="Filter rute">
            <SectionTitle>Riwayat Barang Kembali</SectionTitle>
            <div className="flex items-center gap-2 rounded-2xl bg-tint/60 p-2 pl-3">
              <div className="flex-1">
                <RouteConnector gap="gap-1" from={from} to={to} fromLabel="Dari" toLabel="Ke" onFrom={() => setPicker('from')} onTo={() => setPicker('to')} />
              </div>
              <button
                aria-label="Tukar rute"
                onClick={() => {
                  setFrom(to)
                  setTo(from)
                }}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-white text-primary hover:bg-tint"
              >
                <ArrowUpDown className="size-5" aria-hidden />
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

          {/* Feed */}
          <section aria-label="Daftar barang yang sudah kembali" className="flex flex-col gap-2.5">
            {effective === 'loading' &&
              [0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-4">
                  <Skeleton className="size-11 rounded-2xl" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            {effective === 'error' && (
              <div className="rounded-[20px] border border-line bg-white">
                <ErrorState
                  title="Gagal memuat riwayat."
                  onRetry={() => {
                    setFeedState('loading')
                    setTimeout(() => setFeedState('normal'), 800)
                  }}
                />
              </div>
            )}
            {effective === 'empty' && (
              <div className="rounded-[20px] border border-line bg-white">
                <EmptyState
                  icon={Search}
                  title="Belum ada riwayat untuk rute ini."
                  body="Coba ubah stasiun atau kategori untuk melihat barang lain yang sudah kembali."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCat('Semua Kategori')
                        setFrom('Semua Stasiun')
                        setTo('St. Manggarai')
                        setFeedState('normal')
                      }}
                    >
                      Reset Filter
                    </Button>
                  }
                />
              </div>
            )}
            {effective === 'normal' && (
              <>
                {feed.map((f) => (
                  <article key={f.bast} className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-3.5">
                    <CategoryBadge category={f.cat} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">
                        {f.item} • St. {f.from} ⟶ St. {f.to}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {f.who} • BAST #{f.bast} • {f.when}
                      </p>
                    </div>
                    <Badge tone="success" icon={Check}>
                      Sudah Kembali
                    </Badge>
                  </article>
                ))}
                <p className="flex items-center justify-center gap-1.5 px-4 text-center text-xs text-muted">
                  <ShieldCheck className="size-3.5 shrink-0" aria-hidden /> Foto barang tidak ditampilkan demi mencegah penipuan.
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
        allowLines={picker === 'from'}
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
    </div>
  )
}

function BentoMetrics({ onHow }: { onHow: () => void }) {
  const [stats, setStats] = useState({ total: 396, returned: 342, ratio: 86.4, in_progress: 54 })

  useEffect(() => {
    homeApi.stats()
      .then((data) => {
        if (data && data.total !== undefined) setStats(data)
      })
      .catch(() => {})
  }, [])

  const ratio = useCountUp(stats.ratio, 800, 1)
  const created = useCountUp(stats.total, 800)
  const returned = useCountUp(stats.returned, 800)
  return (
    <button onClick={onHow} aria-label="Transparansi layanan November 2026. Ketuk untuk melihat cara kami menghitung." className="rounded-[20px] border border-line bg-white p-4 text-left shadow-[0_12px_32px_-18px_rgba(24,54,74,0.45)]">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-tint text-primary">
          <ShieldCheck className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-bold text-ink">Transparansi Layanan</p>
          <p className="text-[11px] font-medium text-muted">November 2026</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#1f7a4a]">
          <span className="lf-live size-2 rounded-full bg-success" aria-hidden />
          LIVE
        </span>
      </div>
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
          <span className="h-full rounded-l-full bg-success" style={{ width: `${Math.min(100, Math.max(0, stats.ratio))}%` }} />
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
    </button>
  )
}

export function StationPicker({ open, onClose, onPick, allowLines }: { open: boolean; onClose: () => void; onPick: (v: string) => void; allowLines?: boolean }) {
  const [q, setQ] = useState('')
  const [selectedLine, setSelectedLine] = useState('Semua Lin')
  const [dynamicStations, setDynamicStations] = useState(STATIONS)

  useEffect(() => {
    if (!open) return
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
  }, [open])

  const lines = ['Semua Lin', ...new Set(dynamicStations.map((s) => s.line))]
  const list = dynamicStations.filter(
    (s) =>
      (selectedLine === 'Semua Lin' || s.line === selectedLine) &&
      (s.name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase())),
  )

  return (
    <Sheet open={open} onClose={onClose} title="Pilih Stasiun">
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
