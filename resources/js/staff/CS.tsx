import { useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, Archive, ArrowLeft, Camera, Check, CheckCircle2, Clock, Flag, Info, Keyboard, Link2, Lock, MessageSquare, Pencil, Plus, QrCode, RefreshCw, ScanLine, Search, ShieldCheck, UserCheck, Users, X, XCircle } from 'lucide-react'
import { COLORS, STATIONS, type Claim, type InvItem, type InvStatus } from '../lib/data'
import { Badge, Banner, Button, CategoryBadge, Checkbox, cx, EmptyState, Field, inputCls, useCategories, useToast } from '../lib/ui'
import { Drawer, Modal, PageHead, Panel, Tabs, td, th, useStaff } from './common'
import { staffApi, uploadApi } from '../lib/api'

const statusTone: Record<InvStatus, 'info' | 'warn' | 'success' | 'neutral'> = { Tersimpan: 'info', 'Dalam Klaim': 'warn', Selesai: 'success', Diarsipkan: 'neutral' }
const statusIcon = { Tersimpan: Lock, 'Dalam Klaim': Clock, Selesai: CheckCircle2, Diarsipkan: Archive }

/* ---------------- Inventory ---------------- */
export function InventoryPage() {
  const { inventory, nav, staffUser } = useStaff()
  const { categories: CATEGORIES } = useCategories()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Semua')
  const [st, setSt] = useState('Semua')
  const [drawer, setDrawer] = useState(false)
  const list = inventory.filter((i) => i.status !== 'Diarsipkan' && (cat === 'Semua' || i.cat === cat) && (st === 'Semua' || i.status === st) && (i.code + i.name).toLowerCase().includes(q.toLowerCase()))

  const stationName = staffUser?.station ?? 'Jakarta Kota'

  return (
    <>
      <PageHead
        title="Inventaris Barang Temuan"
        sub={`Posko CS St. ${stationName} • Terintegrasi PostgreSQL`}
        actions={
          <Button variant="cta" icon={Plus} onClick={() => setDrawer(true)}>
            Catat Barang Temuan Baru
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-4 gap-3">
        {[
          ['Tersimpan', inventory.filter((i) => i.status === 'Tersimpan').length, Lock, 'text-primary bg-tint'],
          ['Dalam Klaim', inventory.filter((i) => i.status === 'Dalam Klaim').length, Clock, 'text-warn bg-warn-soft'],
          ['Selesai bulan ini', inventory.filter((i) => i.status === 'Selesai').length, CheckCircle2, 'text-success bg-mint'],
          ['Kedaluwarsa ≤ 3 hari', inventory.filter((i) => i.status === 'Tersimpan' && i.expiresIn <= 3).length, AlertTriangle, 'text-[#c2410c] bg-[#fff1e6]'],
        ].map(([l, v, Icon, c]) => {
          const I = Icon as typeof Lock
          return (
            <div key={l as string} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
              <span className={cx('flex size-11 items-center justify-center rounded-xl', c as string)}>
                <I className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-bold text-ink">{v as number}</p>
                <p className="text-xs text-muted">{l as string}</p>
              </div>
            </div>
          )
        })}
      </div>
      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-3 size-4 text-soft" aria-hidden />
            <label htmlFor="inv-q" className="sr-only">
              Cari barang
            </label>
            <input id="inv-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode atau nama barang" className={inputCls() + ' h-10 pl-9'} />
          </div>
          <label className="sr-only" htmlFor="inv-cat">
            Kategori
          </label>
          <select id="inv-cat" value={cat} onChange={(e) => setCat(e.target.value)} className={inputCls() + ' h-10 w-44'}>
            {['Semua', ...CATEGORIES].map((c) => (
              <option key={c} value={c}>
                {c === 'Semua' ? 'Semua Kategori' : c}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="inv-st">
            Status
          </label>
          <select id="inv-st" value={st} onChange={(e) => setSt(e.target.value)} className={inputCls() + ' h-10 w-40'}>
            {['Semua', 'Tersimpan', 'Dalam Klaim', 'Selesai'].map((c) => (
              <option key={c} value={c}>
                {c === 'Semua' ? 'Semua Status' : c}
              </option>
            ))}
          </select>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={ScanLine} title="Belum ada barang temuan." body="Catat barang yang diserahkan petugas kereta atau penumpang lain." action={<Button variant="cta" size="sm" icon={Plus} onClick={() => setDrawer(true)}>Catat Barang Temuan Baru</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f6fafc]">
                <tr>
                  {['Kode Barang', 'Kategori', 'Deskripsi Publik', 'Stasiun', 'Tanggal Temu', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((i) => {
                  const I = statusIcon[i.status]
                  return (
                    <tr key={i.code} className="border-t border-line hover:bg-tint/40">
                      <td className={td + ' whitespace-nowrap font-mono font-bold'}>{i.code}</td>
                      <td className={td + ' whitespace-nowrap'}>
                        <span className="flex items-center gap-2">
                          <CategoryBadge category={i.cat} size={30} /> {i.cat}
                        </span>
                      </td>
                      <td className={td}>
                        {i.name}
                        {i.status === 'Tersimpan' && i.expiresIn <= 3 && (
                          <Badge tone="warn" icon={AlertTriangle} className="ml-2 bg-[#fff1e6] text-[#c2410c]">
                            Kedaluwarsa dalam {i.expiresIn} hari
                          </Badge>
                        )}
                      </td>
                      <td className={td + ' whitespace-nowrap'}>St. {i.station}</td>
                      <td className={td + ' whitespace-nowrap text-muted'}>{i.found}</td>
                      <td className={td + ' whitespace-nowrap'}>
                        <Badge tone={statusTone[i.status]} icon={I}>
                          {i.status}
                        </Badge>
                      </td>
                      <td className={td + ' whitespace-nowrap'}>
                        <Button variant="ghost" size="sm" onClick={() => nav('item', { code: i.code })}>
                          Lihat Detail
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <ItemDrawer open={drawer} onClose={() => setDrawer(false)} />
    </>
  )
}

function ItemDrawer({ open, onClose, edit }: { open: boolean; onClose: () => void; edit?: InvItem }) {
  const { inventory, setInventory, refreshDashboard, staffUser } = useStaff()
  const { categories: CATEGORIES } = useCategories()
  const toast = useToast()
  const claimLocked = edit?.status === 'Dalam Klaim'
  const defStation = staffUser?.station && staffUser.station !== 'Pusat' ? staffUser.station : 'Jakarta Kota'
  const nowIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const blank = { cat: '', name: '', color: '', station: defStation, found: nowIso, detail: '', serial: '', locker: '', notes: '', photo_url: '' }
  const [f, setF] = useState(edit ? { cat: edit.cat, name: edit.name, color: edit.color, station: edit.station, found: nowIso, photo_url: (edit.secret as any)?.photo || '', ...edit.secret } : blank)
  const isPresetColor = !f.color || COLORS.some((c) => c.name === f.color)
  const [customColorMode, setCustomColorMode] = useState(!isPresetColor)
  const [customHex, setCustomHex] = useState('#318FB5')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadApi.upload(file)
      set('photo_url', res.url)
      setErrors((er) => ({ ...er, photo: '' }))
      toast('Foto barang berhasil diunggah.')
    } catch (err: any) {
      toast(err.message || 'Gagal mengunggah foto barang.', { tone: 'danger' })
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    const er: Record<string, string> = {}
    if (!f.cat) er.cat = 'Pilih salah satu kategori.'
    if (f.name.trim().length < 3) er.name = 'Kolom ini wajib diisi.'
    if (!edit && !f.photo_url) er.photo = 'Foto asli barang wajib diunggah oleh petugas.'
    setErrors(er)
    if (Object.keys(er).length) return
    setBusy(true)
    try {
      if (edit) {
        const res = await staffApi.cs.updateFoundItem(edit.code, f)
        setInventory((inv) => inv.map((i) => (i.code === edit.code ? res.item : i)))
        toast('Data barang diperbarui. Tercatat di log audit.')
      } else {
        const res = await staffApi.cs.storeFoundItem(f)
        setInventory((inv) => [res.item, ...inv])
        toast(`Barang ${res.item.code} tersimpan. Sistem mencocokkan dengan ${res.matches} laporan.`)
        setF(blank)
      }
      if (refreshDashboard) refreshDashboard()
      onClose()
    } catch (error: any) {
      toast(error.message || 'Gagal menyimpan barang.', { tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const pub = claimLocked
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={edit ? `Ubah Data ${edit.code}` : 'Catat Barang Temuan Baru'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="cta" onClick={save} loading={busy}>
            Simpan Barang
          </Button>
        </>
      }
    >
      {claimLocked && (
        <Banner tone="warn" icon={Lock} className="mb-4">
          Kategori terkunci karena sudah ada klaim aktif. Saat status "Dalam Klaim", hanya catatan CS yang dapat diubah.
        </Banner>
      )}
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-white">1</span> Atribut Publik
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Kategori" required error={errors.cat}>
          {(a) => (
            <select {...a} disabled={pub} value={f.cat} onChange={(e) => set('cat', e.target.value)} className={inputCls(!!errors.cat) + ' h-11 disabled:opacity-60'}>
              <option value="">Pilih kategori</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Nama Umum" required error={errors.name}>
          {(a) => <input {...a} disabled={pub} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Laptop silver" className={inputCls(!!errors.name) + ' h-11 disabled:opacity-60'} />}
        </Field>
        <Field label="Warna">
          {(a) => (
            <div className="flex flex-col gap-2">
              <select
                {...a}
                disabled={pub}
                value={customColorMode ? '__custom__' : f.color}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomColorMode(true)
                    set('color', '')
                  } else {
                    setCustomColorMode(false)
                    set('color', e.target.value)
                  }
                }}
                className={inputCls() + ' h-11 disabled:opacity-60'}
              >
                <option value="">Pilih warna</option>
                {COLORS.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value="__custom__">Lainnya (Isi / Pilih Warna)...</option>
              </select>
              {customColorMode && (
                <div className="flex items-center gap-2">
                  <label className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-line bg-white" title="Pilih warna dari Color Picker">
                    <input
                      type="color"
                      disabled={pub}
                      value={customHex}
                      onChange={(e) => {
                        setCustomHex(e.target.value)
                        if (!f.color.trim()) set('color', `Kustom (${e.target.value.toUpperCase()})`)
                      }}
                      className="absolute inset-0 size-12 -translate-x-1 -translate-y-1 cursor-pointer border-0 p-0 opacity-0"
                    />
                    <span className="size-6 rounded-lg border border-black/10" style={{ background: customHex }} />
                  </label>
                  <input
                    type="text"
                    disabled={pub}
                    value={f.color}
                    onChange={(e) => set('color', e.target.value)}
                    placeholder="Ketik warna (misal: Rose Gold, Ungu)"
                    className={inputCls() + ' h-10 flex-1 text-xs'}
                  />
                </div>
              )}
            </div>
          )}
        </Field>
        <Field label="Stasiun Temu">
          {(a) => (
            <select {...a} disabled={pub} value={f.station} onChange={(e) => set('station', e.target.value)} className={inputCls() + ' h-11 disabled:opacity-60'}>
              {STATIONS.map((s) => (
                <option key={s.code} value={s.name}>
                  St. {s.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="col-span-2">
          <Field label="Waktu Temu">{(a) => <input {...a} disabled={pub} type="datetime-local" value={f.found} onChange={(e) => set('found', e.target.value)} className={inputCls() + ' h-11 disabled:opacity-60'} />}</Field>
        </div>
      </div>
      <div className="mt-6 rounded-2xl bg-tint p-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
          <Lock className="size-4 text-primary" aria-hidden /> Detail Rahasia Gudang
        </h3>
        <p className="mb-4 text-xs font-semibold text-primary-dark">Tidak ditampilkan ke publik. Dipakai untuk Blind Verification.</p>
        <div className="flex flex-col gap-4">
          <Field label="Detail Ciri Barang">{(a) => <textarea {...a} disabled={pub} rows={2} value={f.detail} onChange={(e) => set('detail', e.target.value)} placeholder="Merek, isi, stiker, goresan" className={inputCls() + ' resize-none bg-white py-2.5 disabled:opacity-60'} />}</Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nomor Seri" error={errors.serial}>
              {(a) => <input {...a} disabled={pub} value={f.serial} onChange={(e) => set('serial', e.target.value)} placeholder="C02XK1ZJ7QX2" className={inputCls(!!errors.serial) + ' h-11 bg-white font-mono disabled:opacity-60'} />}
            </Field>
            <Field label="Lokasi Loker">{(a) => <input {...a} disabled={pub} value={f.locker} onChange={(e) => set('locker', e.target.value)} placeholder="Loker B-04" className={inputCls() + ' h-11 bg-white disabled:opacity-60'} />}</Field>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">
              Foto Asli Barang <span className="text-cta">*</span>
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Upload foto barang"
              onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
            />
            {f.photo_url ? (
              <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-white p-3">
                <img src={f.photo_url} alt="Foto Barang" className="size-14 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">Foto barang tersimpan</p>
                  <p className="text-[11px] text-muted">Aman di posko CS</p>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => fileRef.current?.click()}>Ganti</Button>
              </div>
            ) : (
              <button
                type="button"
                disabled={pub || uploading}
                onClick={() => fileRef.current?.click()}
                className={cx(
                  'flex h-20 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-white text-sm font-bold text-primary disabled:opacity-60 hover:bg-tint/50',
                  errors.photo ? 'border-danger text-danger' : 'border-accent',
                )}
              >
                <Camera className="size-5" aria-hidden /> {uploading ? 'Mengunggah...' : 'Ambil / Unggah Foto Barang'}
              </button>
            )}
            {errors.photo && (
              <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
                <AlertCircle className="size-3.5" aria-hidden /> {errors.photo}
              </p>
            )}
          </div>
          <Field label="Catatan CS">{(a) => <textarea {...a} rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Kondisi barang, saksi, dll." className={inputCls() + ' resize-none bg-white py-2.5'} />}</Field>
        </div>
      </div>
    </Drawer>
  )
}

/* ---------------- Item detail ---------------- */
export function ItemDetailPage() {
  const { inventory, setInventory, params, nav, refreshDashboard } = useStaff()
  const toast = useToast()
  const item = inventory.find((i) => i.code === params.code) ?? inventory[0]
  const [edit, setEdit] = useState(false)
  const [match, setMatch] = useState(false)
  const [archive, setArchive] = useState(false)
  const [statusMenu, setStatusMenu] = useState(false)
  const [reason, setReason] = useState('')
  const [linked, setLinked] = useState<string | null>(null)
  const [mq, setMq] = useState('')
  const [activeReports, setActiveReports] = useState<Array<{ id: string; who: string; desc: string; route: string; score: string }>>([])

  useEffect(() => {
    staffApi.cs.reports({ q: mq, cat: item?.cat })
      .then(setActiveReports)
      .catch(() => {})
  }, [mq, item?.cat])

  if (!item) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">Barang tidak ditemukan.</p>
        <Button onClick={() => nav('inventory')} className="mt-4">Kembali ke Inventaris</Button>
      </div>
    )
  }

  const handleStatusChange = async (s: InvStatus) => {
    try {
      setStatusMenu(false)
      const res = await staffApi.cs.changeStatus(item.code, s)
      setInventory((inv) => inv.map((i) => (i.code === item.code ? res.item : i)))
      toast(`Status diubah ke "${s}".`)
      if (refreshDashboard) refreshDashboard()
    } catch (error: any) {
      toast(error.message || 'Gagal mengubah status.', { tone: 'danger' })
    }
  }

  const handleArchive = async () => {
    try {
      const res = await staffApi.cs.changeStatus(item.code, 'Diarsipkan', reason)
      setInventory((inv) => inv.map((i) => (i.code === item.code ? res.item : i)))
      setArchive(false)
      toast(`${item.code} diarsipkan. Tercatat di log audit.`)
      if (refreshDashboard) refreshDashboard()
    } catch (error: any) {
      toast(error.message || 'Gagal mengarsipkan barang.', { tone: 'danger' })
    }
  }

  const handleManualMatch = async (reportId: string) => {
    try {
      await staffApi.cs.manualMatch(item.code, reportId)
      setLinked(reportId)
      toast(`Ditautkan ke ${reportId}. Penumpang menerima notifikasi kandidat.`)
      if (refreshDashboard) refreshDashboard()
    } catch (error: any) {
      toast(error.message || 'Gagal menautkan laporan.', { tone: 'danger' })
    }
  }

  return (
    <>
      <button onClick={() => nav('inventory')} className="mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Kembali ke Inventaris
      </button>
      <PageHead
        title={`${item.code} • ${item.name}`}
        sub={
          <span className="flex items-center gap-2">
            <Badge tone={statusTone[item.status]}>{item.status}</Badge> Ditemukan {item.found} • St. {item.station}
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" icon={Pencil} disabled={item.status === 'Diarsipkan'} onClick={() => setEdit(true)}>
              Ubah Data
            </Button>
            <Button variant="outline" size="sm" icon={Link2} disabled={item.status !== 'Tersimpan'} onClick={() => setMatch(true)}>
              Cocokkan Manual
            </Button>
            <div className="relative">
              <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => setStatusMenu(!statusMenu)} aria-expanded={statusMenu} disabled={item.status === 'Diarsipkan'}>
                Ubah Status
              </Button>
              {statusMenu && (
                <div role="menu" className="absolute right-0 top-11 z-20 w-48 rounded-xl border border-line bg-white py-1 shadow-lg">
                  {(['Tersimpan', 'Dalam Klaim', 'Selesai'] as InvStatus[]).map((s) => (
                    <button
                      key={s}
                      role="menuitem"
                      onClick={() => handleStatusChange(s)}
                      className="flex min-h-10 w-full items-center px-4 text-left text-sm hover:bg-tint"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="danger" size="sm" icon={Archive} disabled={item.status === 'Diarsipkan'} onClick={() => setArchive(true)}>
              Arsipkan
            </Button>
          </>
        }
      />
      {item.status === 'Diarsipkan' && (
        <Banner tone="neutral" icon={Archive} className="mb-4">
          Barang ini diarsipkan dan tidak dapat diklaim lagi.
        </Banner>
      )}
      <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-4">
        <Panel title="Atribut Publik">
          <dl className="flex flex-col gap-3 p-5 text-sm">
            <div className="flex items-center gap-3">
              <CategoryBadge category={item.cat} />
              <div>
                <dt className="text-xs text-muted">Kategori</dt>
                <dd className="font-bold">{item.cat}</dd>
              </div>
            </div>
            {[
              ['Nama Umum', item.name],
              ['Warna', item.color],
              ['Stasiun Temu', `St. ${item.station}`],
              ['Waktu Temu', item.found],
              ['Sisa Masa Simpan', `${item.expiresIn} hari`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <section className="min-w-0 rounded-2xl border border-[#bfe0ee] bg-tint p-5">
          <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-ink">
            <Lock className="size-4 shrink-0 text-primary" aria-hidden /> Detail Rahasia Gudang
          </h2>
          <p className="mb-4 text-xs font-semibold text-primary-dark">Tidak ditampilkan ke publik.</p>
          {(() => {
            const secretPhoto = (item.secret as any)?.photo
            return secretPhoto && (secretPhoto.startsWith('/storage/') || secretPhoto.startsWith('http')) ? (
              <a href={secretPhoto} target="_blank" rel="noreferrer" className="mb-4 block overflow-hidden rounded-xl border border-line bg-white">
                <img src={secretPhoto} alt={item.name} className="h-40 w-full object-cover" />
              </a>
            ) : (
              <div className="mb-4 flex h-40 items-center justify-center rounded-xl bg-white/80 text-sm font-semibold text-muted">
                <Camera className="mr-2 size-5" aria-hidden /> Foto asli gudang (khusus petugas)
              </div>
            )
          })()}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-muted">Detail</dt>
              <dd className="break-words font-semibold">{item.secret.detail}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted">Nomor Seri</dt>
              <dd className="break-all font-mono font-semibold">{item.secret.serial}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted">Lokasi Loker</dt>
              <dd className="break-words font-semibold">{item.secret.locker}</dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-muted">Catatan CS</dt>
              <dd className="break-words font-semibold">{item.secret.notes}</dd>
            </div>
          </dl>
        </section>
        <div className="flex flex-col gap-4">
          <Panel title="Status Timeline">
            <ol className="flex flex-col gap-3 p-5 text-sm">
              {[
                ['12:30', 'Dicatat oleh Petugas CS'],
                ['13:45', 'Dicocokkan dengan laporan'],
                ...(item.status !== 'Tersimpan' ? [['14:02', 'Klaim verifikasi masuk']] : []),
                ...(linked ? [['15:40', `Ditautkan manual ke ${linked}`]] : []),
              ].map(([t, x]) => (
                <li key={t + x} className="flex gap-3">
                  <span className="w-12 font-bold tabular-nums">{t}</span>
                  <span className="text-muted">{x}</span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Kandidat Pelapor">
            <ul className="flex flex-col p-2">
              {activeReports.slice(0, 3).map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-tint/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.id}</p>
                    <p className="truncate text-xs text-muted">{r.who} • {r.desc}</p>
                  </div>
                  <Badge tone={r.score === 'Tinggi' ? 'success' : 'warn'} className="shrink-0">{r.score}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {edit && <ItemDrawer open onClose={() => setEdit(false)} edit={item} />}

      <Modal
        open={match}
        onClose={() => setMatch(false)}
        title="Cocokkan Manual"
        sub={`Cari laporan untuk ${item.code} berdasarkan kategori dan rute`}
        width="max-w-[640px]"
        footer={
          <Button variant="ghost" onClick={() => setMatch(false)}>
            Tutup
          </Button>
        }
      >
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 size-4 text-soft" aria-hidden />
            <input aria-label="Cari laporan" value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Nomor laporan atau deskripsi" className={inputCls() + ' h-10 pl-9'} />
          </div>
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Laporan Aktif yang Cocok</p>
        <ul className="flex flex-col gap-2">
          {activeReports.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <CategoryBadge category={item.cat} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {r.id} • {r.desc}
                </p>
                <p className="truncate text-xs text-muted">
                  {r.who} • {r.route}
                </p>
              </div>
              <Badge tone={r.score === 'Tinggi' ? 'success' : 'warn'} className="shrink-0">{r.score}</Badge>
              <Button
                size="sm"
                icon={Link2}
                className="shrink-0"
                disabled={linked === r.id}
                onClick={() => handleManualMatch(r.id)}
              >
                {linked === r.id ? 'Tertaut' : 'Tautkan ke Laporan'}
              </Button>
            </li>
          ))}
          {activeReports.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">Tidak ada laporan aktif untuk kategori ini.</p>
          )}
        </ul>
      </Modal>

      <Modal
        open={archive}
        onClose={() => setArchive(false)}
        title={`Arsipkan ${item.code}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchive(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={!reason}
              onClick={handleArchive}
            >
              Arsipkan Barang
            </Button>
          </>
        }
      >
        <Banner tone="warn" icon={AlertTriangle} className="mb-4">
          Barang yang diarsipkan tidak dapat diklaim lagi. Tindakan tercatat di log audit.
        </Banner>
        <Field label="Alasan Arsip" required>
          {(a) => (
            <select {...a} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls() + ' h-11'}>
              <option value="">Pilih alasan</option>
              {['Masa simpan berakhir', 'Dihibahkan / disposisi', 'Salah input', 'Dikembalikan langsung'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          )}
        </Field>
      </Modal>
    </>
  )
}

/* ---------------- Claims queue ---------------- */
function SlaBadge({ min }: { min: number }) {
  if (min < 0) return <Badge tone="danger" icon={AlertCircle}>Lewat {Math.abs(min)} mnt</Badge>
  if (min < 60) return <Badge tone="warn" icon={Clock}>{min} mnt</Badge>
  return <Badge tone="success" icon={Clock}>{Math.floor(min / 60)} j {min % 60} mnt</Badge>
}

export function ClaimsPage() {
  const { claims, setClaims } = useStaff()
  const toast = useToast()
  const [tab, setTab] = useState<Claim['tab']>('baru')
  const [sel, setSel] = useState<string[]>([])
  const [open, setOpen] = useState<Claim | null>(null)
  const count = (t: Claim['tab']) => claims.filter((c) => c.tab === t).length
  const list = claims.filter((c) => c.tab === tab)
  const withKtpCount = claims.filter((c) => !!c.ktpPhoto).length
  const urgentCount = claims.filter((c) => c.tab !== 'selesai' && c.slaMin <= 60).length

  return (
    <>
      <PageHead title="Antrian Klaim" sub="Verifikasi buta: cocokkan jawaban penumpang dengan data gudang tanpa memperlihatkan foto ke publik." />
      <div className="mb-4 grid grid-cols-4 gap-3">
        {[
          { label: 'Total Antrian Klaim', val: claims.length, sub: `${count('baru')} klaim baru masuk`, tone: 'text-primary' },
          { label: 'Perlu Verifikasi Segera', val: count('baru') + count('ditinjau'), sub: `${urgentCount} mendekati batas SLA`, tone: 'text-coral' },
          { label: 'Dokumen & KTP Terunggah', val: withKtpCount, sub: 'Siap dicek identitas & foto', tone: 'text-ink' },
          { label: 'Klaim Selesai Diverifikasi', val: count('selesai'), sub: 'BAST telah diterbitkan', tone: 'text-success' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold text-muted">{s.label}</p>
            <p className={cx('mt-1 text-2xl font-extrabold tabular-nums', s.tone)}>{s.val}</p>
            <p className="mt-0.5 text-[11px] text-muted">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={tab}
          onChange={(v) => (setTab(v), setSel([]))}
          items={[
            { v: 'baru', l: `Baru (${count('baru')})` },
            { v: 'ditinjau', l: `Sedang Ditinjau (${count('ditinjau')})` },
            { v: 'info', l: `Perlu Info (${count('info')})` },
            { v: 'selesai', l: `Selesai (${count('selesai')})` },
          ]}
        />
      </div>
      <Panel>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="text-sm font-semibold text-muted">{sel.length ? `${sel.length} dipilih` : 'Aksi'}</span>
          <Button
            size="sm"
            variant="outline"
            icon={UserCheck}
            disabled={!sel.length}
            onClick={() => {
              setClaims((cs) => cs.map((c) => (sel.includes(c.no) ? { ...c, handler: 'Anda' } : c)))
              toast(`${sel.length} klaim ditetapkan ke Anda.`)
              setSel([])
            }}
          >
            Tetapkan ke Saya
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={Flag}
            disabled={!sel.length}
            onClick={() => {
              setClaims((cs) => cs.map((c) => (sel.includes(c.no) ? { ...c, priority: true } : c)))
              toast('Ditandai prioritas.')
              setSel([])
            }}
          >
            Tandai Prioritas
          </Button>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Tidak ada klaim pada tab ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f6fafc]">
                <tr>
                  <th className={th + ' w-10'}>
                    <span className="sr-only">Pilih</span>
                  </th>
                  {['No. Klaim', 'Pelapor', 'Kategori', 'Barang', 'Diajukan', 'Sisa SLA', 'Ditangani Oleh', 'Aksi'].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.no} className="border-t border-line hover:bg-tint/40">
                    <td className="px-3">
                      <Checkbox checked={sel.includes(c.no)} onChange={(v) => setSel((s) => (v ? [...s, c.no] : s.filter((x) => x !== c.no)))} />
                    </td>
                    <td className={td + ' whitespace-nowrap font-mono font-bold'}>
                      <div>
                        {c.no}
                        {c.priority && <Flag className="ml-1.5 inline size-3.5 text-coral" aria-label="Prioritas" />}
                      </div>
                      <Badge tone={c.isClaimSubmitted === false || (c.id !== undefined && c.id < 0) ? 'neutral' : 'success'} className="mt-1">
                        {c.isClaimSubmitted === false || (c.id !== undefined && c.id < 0) ? 'Laporan Awal (Belum Klaim)' : 'Klaim + KTP'}
                      </Badge>
                    </td>
                    <td className={td}>{c.reporter}</td>
                    <td className={td + ' whitespace-nowrap'}>
                      <div className="flex items-center gap-2">
                        <CategoryBadge category={c.category || 'Elektronik'} size={28} />
                        <Badge tone={c.category === 'Uang Tunai' ? 'warn' : c.category === 'Non Elektronik' ? 'neutral' : 'info'}>
                          {c.category || 'Elektronik'}
                        </Badge>
                      </div>
                    </td>
                    <td className={td}>
                      {c.item} <span className="text-muted">• {c.itemCode}</span>
                    </td>
                    <td className={td + ' whitespace-nowrap text-muted'}>{c.submitted}</td>
                    <td className={td + ' whitespace-nowrap'}>{c.tab === 'selesai' ? <Badge tone="neutral">Selesai</Badge> : <SlaBadge min={c.slaMin} />}</td>
                    <td className={td + ' whitespace-nowrap'}>{c.handler ?? <span className="text-soft">—</span>}</td>
                    <td className={td + ' whitespace-nowrap'}>
                      <Button
                        size="sm"
                        variant={c.tab === 'selesai' ? 'ghost' : 'primary'}
                        onClick={() => {
                          if (c.tab === 'baru') {
                            setClaims((cs) => cs.map((x) => (x.no === c.no ? { ...x, tab: 'ditinjau', handler: 'Anda' } : x)))
                          }
                          setOpen(c)
                        }}
                      >
                        Detail Klaim
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {open && <VerifyModal claim={open} onClose={() => setOpen(null)} />}
    </>
  )
}

const CHECKS = ['Nomor seri cocok', 'Isi tas / detail cocok', 'Warna dominan cocok', 'Identitas sesuai NIK']

function VerifyModal({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const { setClaims, inventory, setInventory, refreshDashboard } = useStaff()
  const toast = useToast()
  const item: InvItem = inventory.find((i) => i.code === claim.itemCode) ?? {
    code: claim.itemCode || claim.no,
    cat: claim.category || 'Elektronik',
    name: claim.item,
    color: 'Hitam',
    station: claim.itemCode?.replace('St. ', '') || 'Manggarai',
    found: `Dilaporkan ${claim.submitted}`,
    status: 'Dalam Klaim',
    expiresIn: 30,
    secret: {
      detail: claim.answer || 'Sesuai deskripsi laporan kehilangan penumpang',
      serial: '-',
      locker: 'Loker Posko CS',
      notes: `Laporan #${claim.no} oleh ${claim.reporter}`,
    },
  }
  const [checks, setChecks] = useState<string[]>([])
  const [mode, setMode] = useState<'main' | 'approve' | 'reject' | 'info'>('main')
  const [tpl, setTpl] = useState('Ciri tidak sesuai')
  const [note, setNote] = useState('')
  const [infoMsg, setInfoMsg] = useState('Mohon unggah foto label nomor seri atau bukti kepemilikan lainnya.')
  const [busy, setBusy] = useState(false)
  const enough = checks.length >= 2
  const isStage1Only = claim.isClaimSubmitted === false || (claim.id !== undefined && claim.id < 0)

  const handleApprove = async () => {
    setBusy(true)
    try {
      const claimId = claim.id ?? 1
      const res = await staffApi.cs.verifyClaim(claimId, { action: 'approve' })
      setInventory((inv) => inv.map((i) => (i.code === item?.code ? { ...i, status: 'Dalam Klaim' } : i)))
      setClaims((cs) => cs.map((c) => (c.no === claim.no ? { ...c, tab: 'selesai', handler: 'Anda' } : c)))
      toast(`BAST #${res.bast ?? 'KCI-2026'} terbit. Penumpang menerima QR BAST.`)
      if (refreshDashboard) refreshDashboard()
      onClose()
    } catch (error: any) {
      toast(error.message || 'Gagal menyetujui klaim.', { tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    setBusy(true)
    try {
      const claimId = claim.id ?? 1
      await staffApi.cs.verifyClaim(claimId, { action: 'reject', note, template: tpl })
      setClaims((cs) => cs.map((c) => (c.no === claim.no ? { ...c, tab: 'selesai', handler: 'Anda' } : c)))
      toast('Klaim ditolak. Catatan dikirim ke penumpang.')
      if (refreshDashboard) refreshDashboard()
      onClose()
    } catch (error: any) {
      toast(error.message || 'Gagal menolak klaim.', { tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const handleInfo = async () => {
    setBusy(true)
    try {
      const claimId = claim.id ?? 1
      await staffApi.cs.verifyClaim(claimId, { action: 'info', message: infoMsg })
      setClaims((cs) => cs.map((c) => (c.no === claim.no ? { ...c, tab: 'info', handler: 'Anda' } : c)))
      toast('Permintaan info dikirim ke penumpang.')
      if (refreshDashboard) refreshDashboard()
      onClose()
    } catch (error: any) {
      toast(error.message || 'Gagal mengirim permintaan info.', { tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-[1100px]"
      title={`Verifikasi Klaim ${claim.no}`}
      sub={`${claim.item} • ${claim.itemCode} • Diajukan ${claim.submitted}`}
      footer={
        mode === 'main' ? (
          <>
            {!enough && !isStage1Only && (
              <p className="mr-auto flex items-center gap-1.5 text-[13px] font-semibold text-warn">
                <AlertCircle className="size-4" aria-hidden /> Minimal 2 poin kecocokan diperlukan untuk menyetujui.
              </p>
            )}
            <Button variant="cta" icon={XCircle} onClick={() => setMode('reject')} className="bg-coral">
              Tolak Klaim
            </Button>
            <Button variant="outline" icon={MessageSquare} onClick={() => setMode('info')}>
              Minta Info Tambahan
            </Button>
            <Button variant="success" icon={CheckCircle2} disabled={!enough || isStage1Only} onClick={() => setMode('approve')}>
              Setujui & Terbitkan BAST QR
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setMode('main')}>
            Kembali ke Verifikasi
          </Button>
        )
      }
    >
      {mode === 'main' && (
        <>
          {isStage1Only && (
            <Banner tone="warn" icon={Lock} className="mb-4">
              Tahap 1 (Laporan Awal): Penumpang belum mengajukan klaim resmi (KTP &amp; verifikasi buta belum diunggah). Tautkan barang temuan lewat menu Inventaris → Cocokkan Manual agar penumpang melengkapi KTP &amp; bukti terlebih dahulu.
            </Banner>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px_1fr]">
          <section className="min-w-0 rounded-2xl border-2 border-primary bg-white p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
              <UserCheck className="size-4 shrink-0 text-primary" aria-hidden /> Detail Klaim, Dokumen & Jawaban Penumpang
            </h3>
            <dl className="flex flex-col gap-2.5 text-[13px]">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f6fafc] p-2.5">
                <div className="min-w-0">
                  <dt className="text-[11px] text-muted">Pelapor</dt>
                  <dd className="break-words font-bold text-ink">{claim.reporterFull || claim.reporter}</dd>
                  {claim.reporterContact && <dd className="break-all text-[11px] text-muted">{claim.reporterContact}</dd>}
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] text-muted">NIK Identitas</dt>
                  <dd className="break-all font-mono font-bold text-ink">{claim.nik || 'Belum dicantumkan'}</dd>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Kategori & Nama Barang</dt>
                  <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 font-bold text-ink">
                    <Badge tone={(claim.category || item?.cat) === 'Uang Tunai' ? 'warn' : (claim.category || item?.cat) === 'Non Elektronik' ? 'neutral' : 'info'}>
                      {claim.category || item?.cat || 'Elektronik'}
                    </Badge>
                    <span className="break-words">{claim.item}</span>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Rute & Waktu Kejadian</dt>
                  <dd className="mt-0.5 break-words font-semibold text-ink">{claim.route || `St. ${item.station}`}</dd>
                  <dd className="break-words text-[11px] text-muted">{claim.incidentTime || claim.submitted} • {claim.position || 'Gerbong KRL'}</dd>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0 overflow-hidden rounded-xl border border-line p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-1">
                    <dt className="truncate text-[11px] font-semibold text-muted">Foto Identitas (KTP)</dt>
                    <Badge tone={claim.ktpPhoto ? 'success' : 'neutral'} className="shrink-0">{claim.ktpPhoto ? 'Terunggah' : 'Belum Ada'}</Badge>
                  </div>
                  {claim.ktpPhoto ? (
                    claim.ktpPhoto.startsWith('/storage/') || claim.ktpPhoto.startsWith('/api/private-files/') || claim.ktpPhoto.startsWith('http') ? (
                      <a href={claim.ktpPhoto} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-line">
                        <img src={claim.ktpPhoto} alt="KTP Penumpang" className="h-24 w-full object-cover hover:opacity-90" />
                      </a>
                    ) : (
                      <div className="flex h-20 min-w-0 flex-col items-center justify-center rounded-lg bg-mint/60 px-2 text-center text-xs font-semibold text-success">
                        <CheckCircle2 className="mb-1 size-4 shrink-0" aria-hidden />
                        <span className="w-full truncate">{claim.ktpPhoto.split('/').pop() || claim.ktpPhoto}</span>
                      </div>
                    )
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-lg bg-[#f6fafc] text-[11px] text-muted">
                      Belum mengunggah KTP
                    </div>
                  )}
                </div>

                <div className="min-w-0 overflow-hidden rounded-xl border border-line p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-1">
                    <dt className="truncate text-[11px] font-semibold text-muted">Foto Referensi Barang</dt>
                    <Badge tone={claim.referencePhoto ? 'info' : 'neutral'} className="shrink-0">{claim.referencePhoto ? 'Ada Foto' : 'Tidak Ada'}</Badge>
                  </div>
                  {claim.referencePhoto ? (
                    claim.referencePhoto.startsWith('/storage/') || claim.referencePhoto.startsWith('http') ? (
                      <a href={claim.referencePhoto} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-line">
                        <img src={claim.referencePhoto} alt="Foto Referensi Penumpang" className="h-24 w-full object-cover hover:opacity-90" />
                      </a>
                    ) : (
                      <div className="flex h-20 min-w-0 flex-col items-center justify-center rounded-lg bg-tint px-2 text-center text-xs font-semibold text-primary">
                        <Camera className="mb-1 size-4 shrink-0" aria-hidden />
                        <span className="w-full truncate">{claim.referencePhoto.split('/').pop() || claim.referencePhoto}</span>
                      </div>
                    )
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-lg bg-[#f6fafc] text-[11px] text-muted">
                      Tidak ada foto referensi
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <dt className="text-xs text-muted">Jawaban Ciri Rahasia Penumpang</dt>
                <dd className="mt-1 break-words rounded-xl bg-tint p-2.5 font-medium leading-5 text-ink">
                  {claim.answer || 'Tidak ada catatan ciri rahasia tambahan.'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="flex flex-col rounded-2xl border border-line bg-[#fafcfd] p-4">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
              <ShieldCheck className="size-4 text-primary" aria-hidden /> Checklist Kecocokan
            </h3>
            <p className="mb-2 text-xs text-muted">Centang poin yang sesuai antara kedua sisi.</p>
            {CHECKS.map((c) => (
              <Checkbox key={c} checked={checks.includes(c)} onChange={(v) => setChecks((s) => (v ? [...s, c] : s.filter((x) => x !== c)))}>
                {c}
              </Checkbox>
            ))}
            <div className="mt-auto pt-3">
              <div className="h-2 overflow-hidden rounded-full bg-[#e6edf1]">
                <div className={cx('h-full rounded-full transition-all', enough ? 'bg-success' : 'bg-[#f2c94c]')} style={{ width: `${(checks.length / 4) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-xs font-bold text-ink" aria-live="polite">
                {checks.length} dari 4 poin cocok
              </p>
            </div>
          </section>

          <WarehouseCard item={item} />
          </div>
        </>
      )}

      {mode === 'approve' && (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-mint text-success">
            <QrCode className="size-7" aria-hidden />
          </span>
          <p className="text-lg font-bold text-ink">Terbitkan BAST untuk {claim.reporter}?</p>
          <p className="text-sm text-muted">Tindakan tersimpan ke PostgreSQL dan tercatat di log audit. Penumpang langsung dapat mengakses QR BAST di menu pelacakan.</p>
          <div className="mt-2 flex gap-2">
            <Button variant="ghost" onClick={() => setMode('main')}>
              Batal
            </Button>
            <Button variant="success" icon={Check} loading={busy} onClick={handleApprove}>
              Ya, Terbitkan BAST
            </Button>
          </div>
        </div>
      )}

      {mode === 'info' && (
        <div className="mx-auto flex max-w-lg flex-col gap-4 py-2">
          <Field label="Pesan ke penumpang" counter={`${infoMsg.length}/300`}>
            {(a) => <textarea {...a} rows={4} maxLength={300} value={infoMsg} onChange={(e) => setInfoMsg(e.target.value)} className={inputCls() + ' resize-none py-3'} />}
          </Field>
          <p className="text-xs text-muted">Status klaim menjadi "Perlu Info". Penumpang memiliki waktu 24 jam untuk melengkapi.</p>
          <Button variant="primary" icon={MessageSquare} disabled={infoMsg.trim().length < 10} loading={busy} onClick={handleInfo}>
            Kirim Permintaan Info
          </Button>
        </div>
      )}

      {mode === 'reject' && (
        <div className="mx-auto flex max-w-lg flex-col gap-4 py-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">Template alasan</p>
            <div className="flex flex-wrap gap-2">
              {['Ciri tidak sesuai', 'Identitas tidak valid', 'Data kurang spesifik'].map((t) => (
                <button key={t} onClick={() => setTpl(t)} aria-pressed={tpl === t} className={cx('h-10 rounded-full px-4 text-[13px] font-semibold', tpl === t ? 'bg-primary text-white' : 'bg-tint text-primary')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Field label="Catatan untuk penumpang" required counter={`${note.length}/300`} error={note.length > 0 && note.trim().length < 15 ? 'Alasan penolakan wajib diisi (min. 15 karakter).' : undefined} helper="Minimal 15 karakter.">
            {(a) => <textarea {...a} rows={4} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jelaskan dengan sopan apa yang belum sesuai" className={inputCls() + ' resize-none py-3'} />}
          </Field>
          <Button variant="cta" icon={X} className="bg-coral" disabled={note.trim().length < 15} loading={busy} onClick={handleReject}>
            Tolak Klaim
          </Button>
        </div>
      )}
    </Modal>
  )
}

function WarehouseCard({ item }: { item?: InvItem }) {
  if (!item) return null
  const secretPhoto = (item.secret as any)?.photo
  return (
    <section className="min-w-0 rounded-2xl bg-tint p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <Lock className="size-4 shrink-0 text-primary" aria-hidden /> Data Rahasia Gudang
      </h3>
      {secretPhoto && (secretPhoto.startsWith('/storage/') || secretPhoto.startsWith('http')) ? (
        <a href={secretPhoto} target="_blank" rel="noreferrer" className="mb-3 block overflow-hidden rounded-xl border border-line bg-white">
          <img src={secretPhoto} alt={item.name} className="h-28 w-full object-cover" />
        </a>
      ) : (
        <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-white/80 text-xs font-semibold text-muted">
          <Camera className="mr-1.5 size-4" aria-hidden /> Foto asli gudang ({item.code})
        </div>
      )}
      <dl className="flex flex-col gap-2 text-[13px]">
        <div className="min-w-0">
          <dt className="text-xs text-muted">Catatan Rahasia CS</dt>
          <dd className="break-words font-semibold leading-5">
            {item.secret.detail}. {item.secret.notes}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted">Nomor Seri</dt>
          <dd className="break-all font-mono font-bold">{item.secret.serial}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted">Lokasi Loker</dt>
          <dd className="break-words font-bold">
            {item.secret.locker} • St. {item.station}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/* ---------------- Handover (scan QR) ---------------- */
export function HandoverPage() {
  const { refreshDashboard } = useStaff()
  const toast = useToast()
  const [scan, setScan] = useState<'idle' | 'scanning' | 'valid' | 'invalid' | 'used' | 'shipping' | 'done'>('idle')
  const [code, setCode] = useState('KCI-2026-089')
  const [pendingBasts, setPendingBasts] = useState<Array<{ kode: string; qr: string; report?: string; owner: string; item: string }>>([])
  const [bastData, setBastData] = useState<any>(null)
  const [verified, setVerified] = useState(false)
  const [proxy, setProxy] = useState(false)
  const [proxyDocs, setProxyDocs] = useState({ letter: false, ktp: false })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const loadBasts = () => {
      staffApi.cs.dashboard()
        .then((res) => {
          if (res.pending_basts) {
            setPendingBasts(res.pending_basts)
            if (res.pending_basts.length > 0 && code === 'KCI-2026-089') {
              setCode(res.pending_basts[0].kode)
            }
          }
        })
        .catch(() => {})
    }
    loadBasts()
    const t = setInterval(loadBasts, 3000)
    return () => clearInterval(t)
  }, [])

  const runWithCode = async (targetCode: string) => {
    setCode(targetCode)
    setScan('scanning')
    setVerified(false)
    try {
      const res = await staffApi.cs.handover(targetCode.trim(), false)
      setScan(res.result as any)
      if (res.bast) setBastData(res.bast)
    } catch (error: any) {
      setScan('invalid')
    }
  }

  const run = async () => {
    await runWithCode(code)
  }

  const confirmHandover = async () => {
    setBusy(true)
    try {
      await staffApi.cs.handover(code.trim(), true)
      setScan('done')
      toast('Serah terima dikonfirmasi. Status laporan berubah menjadi Selesai.')
      if (refreshDashboard) refreshDashboard()
    } catch (error: any) {
      toast(error.message || 'Gagal konfirmasi serah terima.', { tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const ready = verified && (!proxy || (proxyDocs.letter && proxyDocs.ktp))

  return (
    <>
      <PageHead title="Serah Terima" sub="Pindai QR BAST penumpang untuk menyerahkan barang di Posko CS." />
      <div className="grid grid-cols-[1fr_1.1fr] gap-4">
        <Panel title="Pemindai">
          <div className="p-5">
            <div className="relative mx-auto flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[#0f2533]">
              <div className="absolute inset-[18%] rounded-2xl border-[3px] border-dashed border-accent/80" aria-hidden />
              {scan === 'scanning' && <div className="lf-scanline absolute inset-x-[18%] h-0.5 bg-coral shadow-[0_0_12px_#F47C6D]" aria-hidden />}
              <div className="relative text-center text-white/80">
                <ScanLine className="mx-auto size-10" aria-hidden />
                <p className="mt-2 text-sm font-semibold" aria-live="polite">
                  {scan === 'scanning' ? 'Memindai...' : 'Arahkan QR ke kamera atau gunakan scanner USB'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="primary" icon={Camera} onClick={run} loading={scan === 'scanning'} className="flex-1">
                Pindai dengan Kamera
              </Button>
              <Button variant="outline" icon={ScanLine} onClick={run}>
                Scanner USB
              </Button>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <Field label="Masukkan Kode Manual" helper="Kode BAST atau string QR unik (contoh: QR-BAST-089-7QX2 atau KCI-2026-089)">
                {(a) => (
                  <div className="flex gap-2">
                    <input {...a} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="KCI-___-____" className={inputCls() + ' h-11 font-mono tracking-wider'} />
                    <Button variant="tint" icon={Keyboard} disabled={code.length < 4} onClick={run}>
                      Cek
                    </Button>
                  </div>
                )}
              </Field>
              {pendingBasts.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-bold text-muted">BAST Aktif Siap Serah Terima (Klik untuk memindai):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pendingBasts.map((b) => (
                      <button
                        key={b.kode}
                        type="button"
                        onClick={() => runWithCode(b.kode)}
                        className="rounded-lg border border-primary/30 bg-tint px-2.5 py-1.5 text-left text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors"
                      >
                        {b.kode} • {b.item} ({b.owner})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Konfirmasi Serah Terima">
          <div className="p-5">
            {(scan === 'idle' || scan === 'scanning') && <EmptyState icon={QrCode} title="Belum ada BAST dipindai." body="Detail BAST, pemilik, dan barang akan muncul di sini." />}
            {scan === 'invalid' && (
              <div className="flex flex-col items-center gap-3 py-8 text-center" role="alert">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
                  <XCircle className="size-7" aria-hidden />
                </span>
                <p className="text-base font-bold text-ink">QR / Kode BAST tidak valid atau tidak ditemukan.</p>
                <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => setScan('idle')}>
                  Pindai Ulang
                </Button>
              </div>
            )}
            {scan === 'used' && (
              <div className="flex flex-col items-center gap-3 py-8 text-center" role="alert">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-warn-soft text-warn">
                  <AlertCircle className="size-7" aria-hidden />
                </span>
                <p className="text-base font-bold text-ink">BAST ini sudah pernah diserahterimakan sebelumnya.</p>
                <Button variant="outline" size="sm" onClick={() => setScan('idle')}>Pindai Lain</Button>
              </div>
            )}
            {scan === 'shipping' && (
              <div className="flex flex-col items-center gap-3 py-8 text-center" role="alert">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-warn-soft text-warn">
                  <AlertCircle className="size-7" aria-hidden />
                </span>
                <p className="text-base font-bold text-ink">Barang ini dijadwalkan via ekspedisi, bukan diambil di posko.</p>
                <Button variant="outline" size="sm" onClick={() => setScan('idle')}>Pindai Lain</Button>
              </div>
            )}
            {scan === 'done' && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="lf-pop flex size-16 items-center justify-center rounded-full bg-success text-white">
                  <Check className="size-9" strokeWidth={3} aria-hidden />
                </span>
                <p className="text-lg font-bold text-ink">Serah terima selesai</p>
                <p className="max-w-sm text-sm text-muted">BAST berstatus Selesai. Status laporan di aplikasi penumpang berubah menjadi Selesai dan dicatat di database.</p>
                <Button variant="outline" size="sm" onClick={() => setScan('idle')}>
                  Pindai BAST Berikutnya
                </Button>
              </div>
            )}
            {scan === 'valid' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-2xl bg-mint p-3">
                  <CheckCircle2 className="size-5 text-success" aria-hidden />
                  <p className="flex-1 text-sm font-bold text-ink">BAST #{bastData?.kode ?? code} valid</p>
                  <Badge tone="success">Ambil di Stasiun</Badge>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-4">
                  <div className="flex h-24 items-center justify-center rounded-xl bg-[#f1f5f8] text-center text-[11px] font-semibold text-muted">KTP (ringkas)</div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                    <div>
                      <dt className="text-xs text-muted">Pemilik</dt>
                      <dd className="font-bold">{bastData?.owner ?? 'Penumpang KRL'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Barang</dt>
                      <dd className="font-bold">{bastData?.item ?? 'Barang Temuan KRL'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Lokasi Loker</dt>
                      <dd className="font-bold">{bastData?.locker || 'Loker Posko CS'}</dd>
                    </div>
                  </dl>
                </div>
                <Checkbox checked={proxy} onChange={setProxy}>
                  Diwakilkan?
                </Checkbox>
                {proxy && (
                  <div className="-mt-2 flex flex-col gap-1 rounded-2xl bg-tint p-3">
                    <p className="text-xs font-semibold text-primary-dark">Wajib untuk pengambilan oleh wakil:</p>
                    <Checkbox checked={proxyDocs.letter} onChange={(v) => setProxyDocs({ ...proxyDocs, letter: v })}>
                      Surat kuasa bertanda tangan pemilik
                    </Checkbox>
                    <Checkbox checked={proxyDocs.ktp} onChange={(v) => setProxyDocs({ ...proxyDocs, ktp: v })}>
                      KTP asli pengambil sudah difoto
                    </Checkbox>
                  </div>
                )}
                <div className="rounded-2xl border-2 border-primary p-3">
                  <Checkbox checked={verified} onChange={setVerified}>
                    <b>Identitas fisik pemilik sudah dicocokkan</b>
                  </Checkbox>
                </div>
                <Button
                  variant="success"
                  size="lg"
                  icon={Check}
                  disabled={!ready}
                  loading={busy}
                  onClick={confirmHandover}
                >
                  Konfirmasi Serah Terima
                </Button>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  )
}
