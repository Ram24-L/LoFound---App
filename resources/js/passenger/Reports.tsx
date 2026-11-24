import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckSquare, ChevronRight, Clock, Eye, EyeOff, FileText, Filter, History, ImageIcon, Lock, MoreVertical, Pencil, Plus, RefreshCw, Share2, XCircle } from 'lucide-react'
import { COLORS, STATUS_META, type Report } from '../lib/data'
import { Badge, Banner, Button, CategoryBadge, cx, Dialog, EmptyState, ErrorState, Field, IconButton, InlineRoute, inputCls, RadioDot, RouteConnector, Sheet, Skeleton, useCategories, useToast } from '../lib/ui'
import { reportApi } from '../lib/api'
import { useApp } from './ctx'
import { Screen, SectionTitle, TopBar } from './shell'

const ACTIVE = (r: Report) => !['selesai', 'dibatalkan', 'kedaluwarsa'].includes(r.status)
const EDITABLE = (r: Report) => r.status === 'diterima' || r.status === 'pencarian' || r.status === 'kandidat'
const CANCELLABLE = (r: Report) => ['diterima', 'pencarian', 'kandidat'].includes(r.status)

export function ReportsScreen() {
  const { reports, go, setReports, loading, refreshReports } = useApp()
  const toast = useToast()
  const [tab, setTab] = useState<'aktif' | 'selesai' | 'batal'>('aktif')
  const [select, setSelect] = useState(false)
  const [sel, setSel] = useState<string[]>([])
  const [confirm, setConfirm] = useState(false)
  const [tip, setTip] = useState<string | null>(null)
  const press = useRef<number>(0)
  const longPressed = useRef(false)

  const groups = {
    aktif: reports.filter(ACTIVE).sort((a, b) => Number(!!STATUS_META[b.status].action) - Number(!!STATUS_META[a.status].action)),
    selesai: reports.filter((r) => r.status === 'selesai'),
    batal: reports.filter((r) => r.status === 'dibatalkan' || r.status === 'kedaluwarsa'),
  }
  const list = groups[tab]
  const selected = reports.filter((r) => sel.includes(r.id))
  const canMerge = selected.length === 2 && selected[0].from === selected[1].from && selected[0].to === selected[1].to && selected[0].date === selected[1].date
  const canCancel = selected.length > 0 && selected.every(CANCELLABLE)

  const toggle = (r: Report) => {
    if (STATUS_META[r.status].locked) {
      setTip(r.id)
      setTimeout(() => setTip(null), 2200)
      return
    }
    setSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))
  }
  const exitSelect = () => {
    setSelect(false)
    setSel([])
  }

  return (
    <Screen
      header={
        <header className="shrink-0 border-b border-line bg-white px-5 pt-3">
          <div className="flex min-h-12 items-center gap-2">
            {select ? (
              <>
                <h1 className="flex-1 text-[18px] font-bold text-ink" aria-live="polite">
                  {sel.length} dipilih
                </h1>
                <Button variant="ghost" size="sm" onClick={exitSelect}>
                  Batal
                </Button>
              </>
            ) : (
              <>
                <h1 className="flex-1 text-[22px] font-bold text-ink">Laporan Saya</h1>
                <IconButton icon={Filter} label="Filter laporan" className="text-muted hover:bg-tint" />
                <IconButton icon={CheckSquare} label="Pilih beberapa laporan" onClick={() => setSelect(true)} className="text-muted hover:bg-tint" />
              </>
            )}
          </div>
          <div role="tablist" className="mt-2 mb-3 grid grid-cols-3 gap-1 rounded-full bg-tint p-1">
            {(
              [
                ['aktif', `Aktif (${groups.aktif.length})`],
                ['selesai', `Selesai (${groups.selesai.length})`],
                ['batal', `Dibatalkan (${groups.batal.length})`],
              ] as const
            ).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('h-10 rounded-full text-[13px] font-bold', tab === k ? 'bg-primary text-white' : 'text-primary')}>
                {l}
              </button>
            ))}
          </div>
        </header>
      }
      footer={
        select ? (
          <div className="grid grid-cols-3 gap-2">
            <Button variant="tint" size="sm" onClick={() => setSel(list.filter((r) => !STATUS_META[r.status].locked).map((r) => r.id))}>
              Pilih Semua
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canMerge}
              title={!canMerge ? 'Pilih 2 laporan dengan rute dan tanggal yang sama' : undefined}
              onClick={async () => {
                if (!canMerge) return
                try {
                  const res = await reportApi.merge([selected[0].id, selected[1].id])
                  setReports((rs) => rs.map((r) => (r.id === res.report.id ? res.report : r.id === selected[1].id ? { ...r, status: 'dibatalkan' } : r)))
                  toast('2 laporan digabungkan menjadi satu.')
                  exitSelect()
                } catch (err: any) {
                  toast(err.message || 'Gagal menggabungkan laporan.', { tone: 'danger' })
                }
              }}
            >
              Gabungkan
            </Button>
            <Button variant="danger" size="sm" disabled={!canCancel} onClick={() => setConfirm(true)}>
              Batalkan
            </Button>
          </div>
        ) : (
          <Button variant="cta" size="lg" full onClick={() => go('wizard')}>
            + Buat Laporan Baru
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-2.5 p-5">
        {loading &&
          [0, 1, 2].map((i) => (
            <div key={i} className="rounded-[20px] border border-line bg-white p-4">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-3 h-6 w-24 rounded-full" />
            </div>
          ))}
        {!loading && list.length === 0 && (
          <div className="rounded-[20px] border border-line bg-white">
            <EmptyState
              icon={FileText}
              title={tab === 'selesai' ? 'Tidak ada laporan selesai.' : tab === 'batal' ? 'Tidak ada laporan dibatalkan.' : 'Tidak ada laporan aktif.'}
              body={tab === 'aktif' ? 'Kehilangan barang di KRL? Laporkan sekarang, petugas akan langsung mencarinya.' : undefined}
              action={
                tab === 'aktif' ? (
                  <Button variant="cta" onClick={() => go('wizard')}>
                    Buat Laporan Pertama
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}
        {!loading &&
          list.map((r) => {
            const m = STATUS_META[r.status]
            const locked = select && m.locked
            const checked = sel.includes(r.id)
            return (
              <div key={r.id} className="relative">
                <button
                  onPointerDown={() => {
                    longPressed.current = false
                    press.current = window.setTimeout(() => {
                      longPressed.current = true
                      setSelect(true)
                      toggle(r)
                    }, 550)
                  }}
                  onPointerUp={() => clearTimeout(press.current)}
                  onPointerLeave={() => clearTimeout(press.current)}
                  onClick={() => {
                    if (longPressed.current) return void (longPressed.current = false)
                    return select ? toggle(r) : go(r.status === 'dibatalkan' || r.status === 'selesai' ? 'detail' : 'tracking', { id: r.id })
                  }}
                  aria-pressed={select ? checked : undefined}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-[20px] bg-white p-4 text-left transition-colors',
                    m.action && tab === 'aktif' ? 'border-2 border-primary' : 'border border-line',
                    checked && 'bg-tint',
                    locked && 'opacity-55',
                  )}
                >
                  {select && (
                    <span className={cx('flex size-6 shrink-0 items-center justify-center rounded-md border-2', checked ? 'border-primary bg-primary text-white' : 'border-[#b9c7d0] bg-white')}>
                      {locked ? <Lock className="size-3.5 text-muted" aria-hidden /> : checked && <CheckSquare className="size-4" aria-hidden />}
                    </span>
                  )}
                  <CategoryBadge category={r.items[0].category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      #{r.id} • {r.items[0].name}
                    </p>
                    {r.items.length > 1 && <p className="text-xs font-semibold text-primary">+{r.items.length - 1} barang lain</p>}
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {r.from} ⟶ {r.to} • {r.date}
                    </p>
                    <Badge tone={m.tone} className="mt-2" icon={m.locked ? Lock : r.status === 'selesai' ? CheckSquare : m.action ? AlertTriangle : Clock}>
                      {m.label}
                    </Badge>
                  </div>
                  {!select && <ChevronRight className="size-5 shrink-0 text-soft" aria-hidden />}
                </button>
                {tip === r.id && (
                  <div role="tooltip" className="lf-fade absolute right-4 top-2 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white">
                    Sedang diproses petugas.
                  </div>
                )}
              </div>
            )
          })}
        {select && <p className="text-center text-xs text-muted">"Gabungkan" aktif bila memilih 2 laporan dengan rute dan tanggal yang sama.</p>}
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        icon={AlertTriangle}
        tone="warn"
        title={`Batalkan ${sel.length} laporan?`}
        actions={
          <>
            <Button
              variant="danger"
              full
              onClick={async () => {
                try {
                  await reportApi.cancel(sel, 'Dibatalkan oleh penumpang')
                  setReports((rs) => rs.map((r) => (sel.includes(r.id) ? { ...r, status: 'dibatalkan' } : r)))
                  toast(`${sel.length} laporan dibatalkan.`)
                } catch (err: any) {
                  toast(err.message || 'Gagal membatalkan laporan.', { tone: 'danger' })
                }
                setConfirm(false)
                exitSelect()
              }}
            >
              Ya, Batalkan
            </Button>
            <Button variant="ghost" full onClick={() => setConfirm(false)}>
              Kembali
            </Button>
          </>
        }
      >
        Laporan yang sudah masuk tahap verifikasi tidak dapat dibatalkan.
      </Dialog>
    </Screen>
  )
}

/* ---------------- Detail ---------------- */
export function DetailScreen({ id }: { id: string }) {
  const { reports, go, updateReport } = useApp()
  const toast = useToast()
  const r = reports.find((x) => x.id === id)!
  const [menu, setMenu] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [cancel, setCancel] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const m = STATUS_META[r.status]

  return (
    <Screen
      header={
        <TopBar
          title="Detail Laporan"
          sub={`#${r.id}`}
          right={
            <div className="relative">
              <IconButton icon={MoreVertical} label="Menu laporan" aria-expanded={menu} onClick={() => setMenu(!menu)} className="text-muted hover:bg-tint" />
              {menu && (
                <div role="menu" className="lf-fade absolute right-1 top-12 z-30 w-60 overflow-hidden rounded-2xl border border-line bg-white py-1 shadow-xl">
                  {[
                    { l: 'Edit Laporan', icon: Pencil, run: () => go('edit', { id }), dis: !EDITABLE(r) },
                    { l: 'Batalkan Laporan', icon: XCircle, run: () => (CANCELLABLE(r) ? setCancel(true) : setBlocked(true)), dis: r.status === 'dibatalkan' },
                    { l: 'Bagikan Nomor Laporan', icon: Share2, run: () => toast(`Nomor #${r.id} disalin.`) },
                  ].map((it) => (
                    <button
                      key={it.l}
                      role="menuitem"
                      disabled={it.dis}
                      onClick={() => {
                        setMenu(false)
                        it.run()
                      }}
                      className={cx('flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold hover:bg-tint disabled:opacity-40', it.l.startsWith('Batal') ? 'text-danger' : 'text-ink')}
                    >
                      <it.icon className="size-4" aria-hidden /> {it.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
        />
      }
      footer={
        r.status === 'dibatalkan' ? (
          <Button
            variant="outline"
            size="lg"
            full
            icon={RefreshCw}
            onClick={async () => {
              try {
                const res = await reportApi.reactivate(id)
                updateReport(id, res.report)
                toast('Laporan diaktifkan kembali.')
              } catch (err: any) {
                toast(err.message || 'Gagal mengaktifkan kembali laporan.', { tone: 'danger' })
              }
            }}
          >
            Aktifkan Kembali
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Badge tone={m.tone} icon={m.locked ? Lock : Clock}>
            {m.label}
          </Badge>
          <span className="text-xs text-muted">Diperbarui {r.updated} WIB</span>
        </div>
        <DetailCard title="Info Barang">
          {r.items.map((it, i) => (
            <div key={it.sub} className={cx('flex items-center gap-3', i > 0 && 'mt-3 border-t border-line pt-3')}>
              <CategoryBadge category={it.category} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">{it.name}</p>
                <p className="text-xs text-muted">
                  #{r.id}-{it.sub} • {it.category} • {it.color}
                </p>
              </div>
              <span className="size-5 rounded-full border border-line" style={{ background: COLORS.find((c) => c.name === it.color)?.hex }} aria-hidden />
            </div>
          ))}
        </DetailCard>
        <DetailCard title="Rute & Waktu">
          <RouteConnector gap="gap-2" from={`St. ${r.from}`} to={`St. ${r.to}`} fromLabel="Keberangkatan" toLabel="Tujuan" />
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-tint px-3 py-1.5 font-semibold text-primary">
              {r.date} • {r.time} WIB
            </span>
            <span className="rounded-full bg-tint px-3 py-1.5 font-semibold text-primary">{r.position}</span>
          </div>
        </DetailCard>
        <DetailCard
          title={
            <span className="flex items-center gap-1.5">
              <Lock className="size-4 text-primary" aria-hidden /> Ciri Rahasia
            </span>
          }
          action={
            <Button variant="ghost" size="sm" icon={reveal ? EyeOff : Eye} onClick={() => setReveal(!reveal)} aria-pressed={reveal}>
              {reveal ? 'Sembunyikan' : 'Tampilkan'}
            </Button>
          }
        >
          <p className={cx('rounded-xl bg-tint p-3 text-sm leading-5', reveal ? 'text-ink' : 'select-none text-primary/60 tracking-[0.2em]')}>{reveal ? r.secret : '•••••••••••••••••••••••••••'}</p>
          <p className="mt-2 text-xs text-muted">Hanya dilihat Petugas CS saat verifikasi klaim.</p>
        </DetailCard>
        <DetailCard title="Foto Referensi">
          {r.photo ? (
            <div className="flex items-center gap-3 rounded-xl bg-tint p-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-white text-primary">
                <ImageIcon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{r.photo}</p>
                <p className="text-xs text-muted">Hanya terlihat oleh Anda dan petugas.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Tidak ada foto referensi.</p>
          )}
        </DetailCard>
        <DetailCard
          title={
            <span className="flex items-center gap-1.5">
              <History className="size-4 text-primary" aria-hidden /> Riwayat Perubahan
            </span>
          }
        >
          <ol className="flex flex-col gap-2.5">
            {r.history.map((h, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-12 shrink-0 font-bold tabular-nums text-ink">{h.t}</span>
                <span className="text-muted">{h.text}</span>
              </li>
            ))}
          </ol>
        </DetailCard>
      </div>

      <CancelSheet open={cancel} onClose={() => setCancel(false)} report={r} />
      <Dialog
        open={blocked}
        onClose={() => setBlocked(false)}
        icon={Lock}
        title="Tidak dapat dibatalkan"
        actions={
          <Button variant="primary" full onClick={() => setBlocked(false)}>
            Mengerti
          </Button>
        }
      >
        {r.status === 'bast' || r.status === 'dikirim' ? 'Laporan tidak dapat dibatalkan karena BAST sudah terbit.' : 'Laporan sedang diverifikasi petugas sehingga belum dapat dibatalkan.'}
      </Dialog>
    </Screen>
  )
}

function DetailCard({ title, children, action }: { title: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-line bg-white p-4">
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </section>
  )
}

export function CancelSheet({ open, onClose, report }: { open: boolean; onClose: () => void; report: Report }) {
  const { updateReport, back } = useApp()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [other, setOther] = useState('')
  const reasons = ['Barang sudah ditemukan sendiri', 'Salah membuat laporan', 'Lainnya']
  const valid = reason && (reason !== 'Lainnya' || other.trim().length >= 5)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Batalkan laporan ini?"
      footer={
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="lg"
            full
            disabled={!valid}
            onClick={async () => {
              const prev = report.status
              const fullReason = reason === 'Lainnya' ? other : reason
              try {
                await reportApi.cancel([report.id], fullReason)
                const nowHHMM = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
                updateReport(report.id, (r) => ({
                  status: 'dibatalkan',
                  history: [...r.history, { t: nowHHMM, text: `Dibatalkan: ${fullReason}` }],
                }))
                onClose()
                back()
                toast('Laporan dibatalkan.', {
                  action: {
                    label: 'Aktifkan Kembali',
                    run: async () => {
                      try {
                        const res = await reportApi.reactivate(report.id)
                        updateReport(report.id, res.report)
                      } catch {}
                    },
                  },
                  duration: 6000,
                })
              } catch (err: any) {
                toast(err.message || 'Gagal membatalkan laporan.', { tone: 'danger' })
              }
            }}
          >
            Ya, Batalkan
          </Button>
          <Button variant="ghost" full onClick={onClose}>
            Kembali
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted">
        Petugas akan menghentikan pencarian untuk #{report.id}. Anda masih bisa mengaktifkannya kembali dalam 24 jam.
      </p>
      <div role="radiogroup" aria-label="Alasan pembatalan" className="flex flex-col gap-2">
        {reasons.map((r) => (
          <button key={r} role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={cx('flex min-h-12 items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold text-ink', reason === r ? 'border-2 border-primary bg-tint' : 'border border-line')}>
            <RadioDot checked={reason === r} /> {r}
          </button>
        ))}
      </div>
      {reason === 'Lainnya' && (
        <div className="mt-3">
          <Field label="Tuliskan alasan Anda" counter={`${other.length}/200`}>
            {(a) => <textarea {...a} autoFocus maxLength={200} rows={3} value={other} onChange={(e) => setOther(e.target.value)} className={inputCls() + ' resize-none py-3'} placeholder="Contoh: barang sudah diambil teman saya" />}
          </Field>
        </div>
      )}
    </Sheet>
  )
}

/* ---------------- Edit ---------------- */
export function EditScreen({ id }: { id: string }) {
  const { reports, updateReport, back } = useApp()
  const { categories: CATEGORIES } = useCategories()
  const toast = useToast()
  const r = reports.find((x) => x.id === id)!
  const locked = r.candidates > 0
  const init = { name: r.items[0].name, color: r.items[0].color, position: r.position, secret: r.secret, category: r.items[0].category }
  const [f, setF] = useState(init)
  const [busy, setBusy] = useState(false)
  const changed = JSON.stringify(f) !== JSON.stringify(init)
  const nameErr = f.name.trim().length < 5 ? 'Tulis nama dan merek barang (min. 5 karakter).' : undefined

  return (
    <Screen
      header={<TopBar title="Ubah Laporan" sub={`#${r.id}`} />}
      footer={
        <Button
          variant="cta"
          size="lg"
          full
          disabled={!changed || !!nameErr}
          loading={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const res = await reportApi.update(id, {
                name: f.name,
                color: f.color,
                category: f.category,
                position: f.position,
                secret: f.secret,
              })
              updateReport(id, res.report)
              toast('Perubahan disimpan. Petugas akan diberi tahu.')
              back()
            } catch (err: any) {
              toast(err.message || 'Gagal menyimpan perubahan.', { tone: 'danger' })
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        {locked && (
          <Banner tone="info" icon={Lock}>
            Kategori dan rute tidak dapat diubah karena petugas sudah memproses laporan.
          </Banner>
        )}
        <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-4">
          <Field label={<span className="flex items-center gap-1">Kategori Barang {locked && <Lock className="size-3" aria-label="Terkunci" />}</span>} helper={locked ? 'Tidak dapat diubah karena petugas sudah memproses laporan.' : undefined}>
            {(a) => (
              <select {...a} disabled={locked} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inputCls() + ' h-12 disabled:opacity-60'}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Nama & Merek Barang" counter={`${f.name.length}/80`} error={nameErr}>
            {(a) => <input {...a} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls(!!nameErr) + ' h-12'} />}
          </Field>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">Warna Dominan</p>
            <ColorSwatches value={f.color} onChange={(c) => setF({ ...f, color: c })} />
          </div>
          <div className={cx('rounded-2xl bg-tint/60 p-3', locked && 'opacity-70')}>
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted">Rute {locked && <Lock className="size-3" aria-hidden />}</p>
            <InlineRoute from={`St. ${r.from}`} to={`St. ${r.to}`} className="text-sm font-bold text-ink" />
          </div>
          <Field label="Posisi Gerbong / Titik Terakhir">{(a) => <input {...a} value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} className={inputCls() + ' h-12'} />}</Field>
          <Field label="Deskripsi Ciri Khusus Rahasia" counter={`${f.secret.length}/500`} helper="Hanya dilihat Petugas CS saat verifikasi klaim.">
            {(a) => <textarea {...a} rows={4} maxLength={500} value={f.secret} onChange={(e) => setF({ ...f, secret: e.target.value })} className={inputCls() + ' resize-none py-3'} />}
          </Field>
        </section>
        {!changed && <p className="text-center text-xs text-muted">Belum ada perubahan untuk disimpan.</p>}
      </div>
    </Screen>
  )
}

export function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const isPreset = COLORS.some((c) => c.name.toLowerCase() === (value || '').toLowerCase())
  const [showCustom, setShowCustom] = useState(!isPreset && !!value)
  const [customHex, setCustomHex] = useState('#6366f1')
  const [customName, setCustomName] = useState(!isPreset && value ? value : '')

  return (
    <div className="flex flex-col gap-2.5">
      <div role="radiogroup" aria-label="Warna dominan" className="flex flex-wrap items-center gap-1.5">
        {COLORS.map((c) => {
          const active = value === c.name && !showCustom
          return (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={c.name}
              title={c.name}
              onClick={() => {
                setShowCustom(false)
                onChange(c.name)
              }}
              className="flex size-10 items-center justify-center rounded-full"
            >
              <span
                className={cx(
                  'flex size-8 items-center justify-center rounded-full border',
                  active ? 'ring-2 ring-primary ring-offset-2' : '',
                  c.name === 'Putih' ? 'border-[#cfd8de]' : 'border-transparent',
                )}
                style={{ background: c.hex }}
              >
                {active && (
                  <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke={['Putih', 'Kuning', 'Silver'].includes(c.name) ? '#18364A' : '#fff'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => {
            setShowCustom(true)
            if (customName.trim()) onChange(customName.trim())
          }}
          className={cx(
            'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors',
            showCustom || (!isPreset && !!value)
              ? 'border-primary bg-tint text-primary ring-2 ring-primary/30'
              : 'border-dashed border-accent bg-white text-primary hover:bg-tint',
          )}
        >
          <Plus className="size-3.5" aria-hidden />
          {!isPreset && value ? `Warna: ${value}` : 'Pilih / Isi Warna Lain'}
        </button>
      </div>

      {(showCustom || (!isPreset && !!value)) && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-[#f6fafc] p-2.5">
          <label className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-line bg-white shadow-sm" title="Pilih dari Color Picker">
            <input
              type="color"
              value={customHex}
              onChange={(e) => {
                setCustomHex(e.target.value)
                if (!customName.trim()) {
                  const label = `Kustom (${e.target.value.toUpperCase()})`
                  setCustomName(label)
                  onChange(label)
                }
              }}
              className="absolute inset-0 size-12 -translate-x-1 -translate-y-1 cursor-pointer border-0 p-0 opacity-0"
            />
            <span className="size-6 rounded-lg border border-black/10" style={{ background: customHex }} />
          </label>
          <input
            type="text"
            value={customName}
            onChange={(e) => {
              setCustomName(e.target.value)
              onChange(e.target.value)
            }}
            placeholder="Ketik warna (misal: Ungu, Rose Gold, Abu-abu, Krem)"
            className={inputCls() + ' h-10 flex-1 bg-white text-xs'}
          />
        </div>
      )}
    </div>
  )
}

