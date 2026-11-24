import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, CalendarClock, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, FileClock, ImageIcon, Info, Lock, LogOut, Trash2, X } from 'lucide-react'
import { STATUS_META, type Report } from '../lib/data'
import { Badge, Banner, Button, CategoryBadge, cx, Dialog, Field, inputCls, Pill, RouteConnector, Sheet, Toggle, useCategories, useToast } from '../lib/ui'
import { reportApi, uploadApi } from '../lib/api'
import { useApp, type Draft } from './ctx'
import { StationPicker } from './Home'
import { ColorSwatches } from './Reports'
import { Screen, TopBar } from './shell'

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_FULL_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const nowTimeStr = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const formatIndoDate = (d: Date) => `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`
const nowDateStr = () => formatIndoDate(new Date())
const parseIndoDate = (s: string): Date => {
  const parts = s.trim().split(/\s+/)
  if (parts.length === 3) {
    const day = Number(parts[0])
    const mon = MONTHS_ID.findIndex((m) => m.toLowerCase() === parts[1].toLowerCase())
    const yr = Number(parts[2])
    if (day && mon >= 0 && yr) return new Date(yr, mon, day)
  }
  return new Date()
}

type Item = { name: string; category: string; color: string }
const EMPTY_ITEM: Item = { name: '', category: '', color: '' }
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function WizardScreen() {
  const { draft, setDraft, user, requireAuth, reports, setReports, replace, back, updateReport } = useApp()
  const { categories: CATEGORIES, nonShippable: NON_SHIPPABLE } = useCategories()
  const toast = useToast()
  const initialDraft = useRef(draft)
  const [prompt, setPrompt] = useState(!!draft)
  const [step, setStep] = useState<1 | 2>(1)
  const [items, setItems] = useState<Item[]>([{ ...EMPTY_ITEM }])
  const [openIdx, setOpenIdx] = useState(0)
  const [route, setRoute] = useState(() => ({ from: 'Bogor', to: 'Manggarai', date: '', time: '' }))
  const [position, setPosition] = useState('')
  const [secret, setSecret] = useState('')
  const [photo, setPhoto] = useState<{ name: string; size: string } | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [notify, setNotify] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [limitMsg, setLimitMsg] = useState('')
  const [picker, setPicker] = useState<'from' | 'to' | null>(null)
  const [dateSheet, setDateSheet] = useState(false)
  const [exit, setExit] = useState(false)
  const [dup, setDup] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [dirty, setDirty] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Auto-save draft locally (guest or member) once the user starts typing
  useEffect(() => {
    if (!dirty || prompt) return
    const d: Draft = { items, ...route, position, secret, photo: photo?.name, notify, step, savedAt: nowTimeStr() }
    setDraft(d)
  }, [items, route, position, secret, photo, notify, step, dirty, prompt, setDraft])

  const touch = () => setDirty(true)
  const setItem = (i: number, patch: Partial<Item>) => {
    touch()
    setItems((its) => its.map((it, j) => (j === i ? { ...it, ...patch } : it)))
    setErrors((e) => ({ ...e, [`cat${i}`]: '', [`name${i}`]: '' }))
  }

  const validate1 = () => {
    const er: Record<string, string> = {}
    items.forEach((it, i) => {
      if (!it.category) er[`cat${i}`] = 'Pilih salah satu kategori.'
      if (it.name.trim().length < 5) er[`name${i}`] = 'Tulis nama dan merek barang (min. 5 karakter).'
    })
    setErrors(er)
    const firstBad = items.findIndex((_, i) => er[`cat${i}`] || er[`name${i}`])
    if (firstBad >= 0) setOpenIdx(firstBad)
    return Object.keys(er).length === 0
  }
  const routeErr = route.from === route.to ? 'Stasiun keberangkatan dan tujuan tidak boleh sama.' : ''
  const timeErr = route.date === nowDateStr() && route.time && toMin(route.time) > toMin(nowTimeStr()) ? 'Waktu tidak boleh melebihi saat ini.' : ''

  const findDupLocal = () =>
    reports.find(
      (r) =>
        !['selesai', 'dibatalkan', 'kedaluwarsa'].includes(r.status) &&
        r.from === route.from &&
        r.to === route.to &&
        r.date === route.date &&
        Math.abs(toMin(r.time) - toMin(route.time)) <= 120 &&
        r.items.some((ri) => items.some((it) => it.category === ri.category)),
    ) ?? null

  const doSubmit = async () => {
    setDup(null)
    setBusy(true)
    setFailed(false)
    try {
      const res = await reportApi.create({
        items: items.map((it) => ({
          name: it.name,
          category: it.category,
          color: it.color || 'Hitam',
        })),
        from: route.from,
        to: route.to,
        date: route.date,
        time: route.time,
        position: position || 'Tidak diketahui',
        secret: secret || '',
        notify,
        photo_url: photoUrl || undefined,
      })
      const rep = res.report
      setReports((rs) => [rep, ...rs])
      setDraft(null)
      replace('wizardSuccess', { id: rep.id, count: items.length })
    } catch (err: any) {
      setFailed(true)
      toast(err.message || 'Gagal mengirim laporan. Coba lagi.', { tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const checkAndSubmit = async () => {
    await doSubmit()
  }

  const send = () => {
    if (routeErr) {
      toast(routeErr, { tone: 'danger' })
      return
    }
    if (!route.date || !route.time) {
      toast('Pilih tanggal dan perkiraan jam terlebih dahulu.', { tone: 'warn' })
      setDateSheet(true)
      return
    }
    if (secret.length > 0 && secret.length < 10) {
      setErrors({ secret: 'Tambahkan sedikit detail lagi (min. 10 karakter).' })
      toast('Ciri rahasia minimal 10 karakter.', { tone: 'warn' })
      return
    }
    if (!user) {
      const localD = findDupLocal()
      return requireAuth(
        'Laporan Anda sudah siap. Masuk agar bisa dilacak dan Anda mendapat kabar saat barang ditemukan.',
        checkAndSubmit,
        localD ? 'Berhasil masuk. Kami menemukan laporan serupa.' : 'Berhasil masuk. Laporan Anda dikirim.'
      )
    }
    checkAndSubmit()
  }

  const onPhoto = async (f?: File) => {
    if (!f) return
    touch()
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setErrors((e) => ({ ...e, photo: 'Format harus JPG, PNG, atau WebP.' }))
    if (f.size > 5 * 1024 * 1024) return setErrors((e) => ({ ...e, photo: 'Ukuran foto melebihi 5 MB. Pilih foto lain.' }))
    setErrors((e) => ({ ...e, photo: '' }))
    try {
      const res = await uploadApi.upload(f)
      setPhoto({ name: f.name, size: (f.size / 1024 / 1024).toFixed(1) + ' MB' })
      setPhotoUrl(res.url)
      toast('Foto referensi berhasil diunggah.')
    } catch (err: any) {
      setErrors((e) => ({ ...e, photo: err.message || 'Gagal mengunggah foto.' }))
    }
  }

  const onBack = () => {
    if (step === 2) return setStep(1)
    if (dirty) return setExit(true)
    back()
  }

  return (
    <Screen
      header={
        <>
          <TopBar title="Buat Laporan Kehilangan" onBack={onBack} />
          <div className="shrink-0 border-b border-line bg-white px-5 pb-3">
            <ol className="flex items-center gap-2" aria-label="Langkah">
              {[
                [1, 'Identitas Barang'],
                [2, 'Rute & Ciri Rahasia'],
              ].map(([n, l], i) => (
                <li key={n} className="flex flex-1 items-center gap-2" aria-current={step === n ? 'step' : undefined}>
                  <span className={cx('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', step > (n as number) ? 'bg-success text-white' : step === n ? 'bg-primary text-white' : 'bg-tint text-primary')}>
                    {step > (n as number) ? <Check className="size-4" aria-hidden /> : n}
                  </span>
                  <span className={cx('text-xs font-bold', step === n ? 'text-ink' : 'text-muted')}>{l}</span>
                  {i === 0 && <span className="h-0.5 flex-1 rounded bg-line" aria-hidden />}
                </li>
              ))}
            </ol>
          </div>
        </>
      }
      footer={
        step === 1 ? (
          <Button variant="cta" size="lg" full onClick={() => validate1() && setStep(2)}>
            Lanjut ke Rute & Ciri <ArrowRight className="size-5" aria-hidden />
          </Button>
        ) : (
          <Button variant="cta" size="lg" full loading={busy} disabled={!!routeErr} onClick={send}>
            {busy ? 'Mengirim...' : items.length > 1 ? `Kirim Laporan (${items.length} barang)` : 'Kirim Laporan'}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3 p-5">
        {!user && (
          <Banner tone="info" icon={Info}>
            Anda mengisi sebagai tamu. Draf tersimpan di perangkat ini; masuk diperlukan saat mengirim.
          </Banner>
        )}
        {failed && (
          <Banner tone="danger" icon={AlertCircle} action={<Button size="sm" variant="outline" onClick={doSubmit}>Coba Lagi</Button>}>
            Laporan belum terkirim. Data Anda aman, coba lagi.
          </Banner>
        )}

        {step === 1 && (
          <>
            {items.map((it, i) => {
              const open = openIdx === i
              const ok = it.category && it.name.trim().length >= 5
              return (
                <section key={i} className={cx('rounded-[20px] bg-white', open && items.length > 1 ? 'border-2 border-primary' : 'border border-line')}>
                  {items.length > 1 && (
                    <div className="flex items-center gap-1 pl-4 pr-1">
                      <button onClick={() => setOpenIdx(open ? -1 : i)} aria-expanded={open} className="flex min-h-14 flex-1 items-center gap-2 text-left">
                        <span className="text-sm font-bold text-ink">
                          Barang {i + 1}
                          {it.name && `: ${it.name.slice(0, 22)}${it.name.length > 22 ? '…' : ''}`}
                        </span>
                        {ok && <Check className="size-4 text-success" aria-label="Lengkap" />}
                        <ChevronDown className={cx('ml-auto size-5 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
                      </button>
                      <button
                        aria-label={`Hapus barang ${i + 1}`}
                        onClick={() => {
                          if (items.length === 1) return setLimitMsg('Minimal 1 barang dalam laporan.')
                          setItems((its) => its.filter((_, j) => j !== i))
                          setOpenIdx(0)
                        }}
                        className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  )}
                  {(open || items.length === 1) && (
                    <div className={cx('flex flex-col gap-4 p-4', items.length > 1 && 'border-t border-line')}>
                      <div>
                        <p className="mb-2 text-xs font-semibold text-muted" id={`cat-l-${i}`}>
                          Kategori Barang <span className="text-cta">*</span>
                        </p>
                        <div role="group" aria-labelledby={`cat-l-${i}`} className="flex flex-wrap gap-2">
                          {CATEGORIES.map((c) => (
                            <Pill key={c} active={it.category === c} onClick={() => setItem(i, { category: c })}>
                              {c}
                            </Pill>
                          ))}
                        </div>
                        <div aria-live="polite">
                          {errors[`cat${i}`] && (
                            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
                              <AlertCircle className="size-3.5" aria-hidden /> {errors[`cat${i}`]}
                            </p>
                          )}
                        </div>
                        {NON_SHIPPABLE.includes(it.category) && (
                          <Banner tone="warn" icon={Lock} className="mt-2">
                            Barang kategori ini hanya dapat diambil langsung di stasiun.
                          </Banner>
                        )}
                      </div>
                      <Field label="Nama & Merek Barang" required counter={`${it.name.length}/80`} error={errors[`name${i}`]}>
                        {(a) => <input {...a} maxLength={80} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="MacBook Air M2 Silver + Sleeve Hitam" className={inputCls(!!errors[`name${i}`]) + ' h-12'} />}
                      </Field>
                      <div>
                        <p className="mb-1 text-xs font-semibold text-muted">Warna Dominan</p>
                        <ColorSwatches value={it.color} onChange={(c) => setItem(i, { color: c })} />
                      </div>
                    </div>
                  )}
                </section>
              )
            })}
            <button
              onClick={() => {
                if (items.length >= 5) return setLimitMsg('Batas maksimum 5 barang per laporan.')
                if (!validate1()) return
                touch()
                setItems((its) => [...its, { ...EMPTY_ITEM }])
                setOpenIdx(items.length)
              }}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent text-sm font-bold text-primary hover:bg-tint"
            >
              + Tambah Barang Lain <span className="font-semibold text-muted">({items.length}/5)</span>
            </button>
            <p aria-live="polite" className="text-center text-xs font-semibold text-warn">
              {limitMsg}
            </p>
            {items.length > 1 && <p className="text-center text-xs text-muted">Rute dan waktu diisi sekali untuk semua barang.</p>}
          </>
        )}

        {step === 2 && (
          <>
            <section className="rounded-[20px] border border-line bg-white p-4">
              <p className="mb-2 text-xs font-semibold text-muted">Pilih Rute</p>
              <RouteConnector gap="gap-2" from={route.from} to={route.to} fromLabel="St. Keberangkatan" toLabel="St. Tujuan" onFrom={() => setPicker('from')} onTo={() => setPicker('to')} />
              {routeErr && (
                <p role="alert" className="mt-2 flex items-center gap-1 text-xs font-medium text-danger">
                  <AlertCircle className="size-3.5" aria-hidden /> {routeErr}
                </p>
              )}
              <p className="mb-1.5 mt-3 text-xs font-semibold text-muted">Pilih Tanggal</p>
              <button onClick={() => setDateSheet(true)} className={cx('inline-flex min-h-11 items-center gap-2 rounded-full bg-tint px-4 text-[13px] font-bold', route.date ? 'text-primary' : 'text-muted', timeErr && 'ring-2 ring-danger/70')}>
                <CalendarClock className="size-4 text-primary" aria-hidden />
                {route.date ? `${route.date} • ${route.time} WIB` : 'Pilih tanggal'}
              </button>
              {timeErr && (
                <p role="alert" className="mt-2 flex items-center gap-1 text-xs font-medium text-danger">
                  <AlertCircle className="size-3.5" aria-hidden /> {timeErr}
                </p>
              )}
            </section>
            <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-4">
              <Field label="Posisi Gerbong / Titik Terakhir">
                {(a) => (
                  <input
                    {...a}
                    value={position}
                    onChange={(e) => {
                      touch()
                      setPosition(e.target.value)
                    }}
                    placeholder="Gerbong 4 - Rak Atas"
                    className={inputCls() + ' h-12'}
                  />
                )}
              </Field>
              <Field
                label={
                  <span className="inline-flex items-center gap-1">
                    <Lock className="size-3.5 text-primary" aria-hidden /> Deskripsi Ciri Khusus Rahasia
                  </span>
                }
                counter={`${secret.length}/500`}
                error={errors.secret}
                helper={
                  <span className="inline-flex items-center gap-1">
                    <Lock className="size-3" aria-hidden /> Hanya dilihat Petugas CS saat verifikasi klaim.
                  </span>
                }
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={4}
                    maxLength={500}
                    value={secret}
                    onChange={(e) => {
                      touch()
                      setSecret(e.target.value)
                      setErrors((er) => ({ ...er, secret: '' }))
                    }}
                    placeholder="Contoh: stiker khusus, isi tas, wallpaper, goresan, nomor seri"
                    className={inputCls(!!errors.secret) + ' resize-none py-3'}
                  />
                )}
              </Field>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted">Upload Foto Referensi</p>
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Pilih foto referensi" onChange={(e) => onPhoto(e.target.files?.[0])} />
                {photo ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-tint p-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-white text-primary">
                      <ImageIcon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{photo.name}</p>
                      <p className="text-xs text-muted">{photo.size}</p>
                    </div>
                    <Check className="size-5 text-success" aria-label="Terunggah" />
                    <button aria-label="Hapus foto" onClick={() => setPhoto(null)} className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-white">
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} className={cx('flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed bg-tint/40 py-5 hover:bg-tint', errors.photo ? 'border-danger' : 'border-accent')}>
                    <Camera className="size-6 text-primary" aria-hidden />
                    <span className="text-sm font-bold text-primary">Pilih atau Ambil Foto</span>
                    <span className="text-xs text-muted">Opsional • Maks 5 MB (JPG/PNG)</span>
                  </button>
                )}
                <div aria-live="polite">
                  {errors.photo && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
                      <AlertCircle className="size-3.5" aria-hidden /> {errors.photo}
                    </p>
                  )}
                </div>
              </div>
              <Toggle checked={notify} onChange={setNotify} label="Aktifkan Notifikasi Otomatis WA / Email" description="Kami kabari begitu ada barang yang cocok." />
            </section>
          </>
        )}
      </div>

      <StationPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        onPick={(v) => {
          touch()
          setRoute((r) => ({ ...r, [picker!]: v.replace('St. ', '') }))
          setPicker(null)
        }}
      />

      <IncidentDateTimeSheet
        open={dateSheet}
        date={route.date}
        time={route.time}
        onClose={() => setDateSheet(false)}
        onApply={(d, t) => {
          touch()
          setRoute((r) => ({ ...r, date: d, time: t }))
          setDateSheet(false)
        }}
      />

      {/* Duplicate detection */}
      <Sheet open={!!dup && Array.isArray(dup.items) && dup.items.length > 0} onClose={() => setDup(null)} title="Sepertinya Anda sudah melapor">
        {dup && Array.isArray(dup.items) && dup.items.length > 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-5 text-muted">Laporan serupa sudah ada. Membuat laporan ganda dapat memperlambat pencarian.</p>
            <div className="flex items-center gap-3 rounded-[20px] border-2 border-primary p-3.5">
              <CategoryBadge category={dup.items[0]?.category || 'Elektronik'} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  #{dup.id} • {dup.items[0]?.name || 'Barang'}
                </p>
                <p className="text-xs text-muted">
                  {dup.from} ⟶ {dup.to} • {dup.date}, {dup.time}
                </p>
                <Badge tone={STATUS_META[dup.status].tone} className="mt-1.5">
                  {STATUS_META[dup.status].label}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="cta" size="lg" full onClick={() => replace('tracking', { id: dup.id })}>
                Lihat Laporan Lama
              </Button>
              <Button
                variant="outline"
                size="lg"
                full
                onClick={() => {
                  updateReport(dup.id, (r) => ({
                    items: [...r.items, ...items.map((it, i) => ({ ...it, color: it.color || 'Hitam', sub: String.fromCharCode(65 + r.items.length + i) }))],
                    history: [...r.history, { t: '15:20', text: `Ditambah ${items.length} barang` }],
                  }))
                  setDraft(null)
                  toast(`Barang digabungkan ke #${dup.id}.`)
                  replace('tracking', { id: dup.id })
                }}
              >
                Gabungkan ke Laporan Lama
              </Button>
              <Button variant="ghost" full onClick={doSubmit}>
                Tetap Buat Laporan Baru
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Dialog
        open={prompt && !!initialDraft.current?.items?.length}
        onClose={() => setPrompt(false)}
        icon={FileClock}
        title="Lanjutkan draf laporan Anda?"
        actions={
          <>
            <Button
              variant="cta"
              full
              onClick={() => {
                const d = initialDraft.current!
                if (d?.items?.length) setItems(d.items)
                if (d?.from && d?.to) setRoute({ from: d.from, to: d.to, date: d.date || nowDateStr(), time: d.time || nowTimeStr() })
                setPosition(d?.position || '')
                setSecret(d?.secret || '')
                setNotify(d?.notify ?? true)
                setStep(d?.step || 1)
                setDirty(true)
                setPrompt(false)
              }}
            >
              Lanjutkan
            </Button>
            <Button
              variant="ghost"
              full
              onClick={() => {
                setDraft(null)
                setPrompt(false)
              }}
            >
              Mulai Baru
            </Button>
          </>
        }
      >
        Draf terakhir disimpan pukul {initialDraft.current?.savedAt ?? '-'} WIB{initialDraft.current?.items?.[0]?.name ? ` • "${initialDraft.current.items[0].name}"` : ''}.
      </Dialog>

      <Dialog
        open={exit}
        onClose={() => setExit(false)}
        icon={LogOut}
        tone="warn"
        title="Keluar dari formulir?"
        actions={
          <>
            <Button
              variant="primary"
              full
              onClick={() => {
                setExit(false)
                toast('Draf disimpan.', { tone: 'info' })
                back()
              }}
            >
              Keluar & Simpan Draf
            </Button>
            <Button variant="ghost" full onClick={() => setExit(false)}>
              Lanjut Mengisi
            </Button>
          </>
        }
      >
        Data yang belum dikirim akan disimpan sebagai draf.
      </Dialog>
    </Screen>
  )
}

export function WizardSuccess({ id, count = 1 }: { id: string; count?: number }) {
  const { replace, tab } = useApp()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-white px-8 text-center">
      <span className="lf-pop flex size-24 items-center justify-center rounded-full bg-mint">
        <svg viewBox="0 0 48 48" className="size-14" aria-hidden>
          <circle cx="24" cy="24" r="22" fill="#38B26F" />
          <path className="lf-draw" d="M14 25l7 7 13-15" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h1 className="text-[22px] font-bold text-ink" role="status">
        Laporan Terkirim!
      </h1>
      <p className="text-sm text-muted">
        Nomor laporan Anda <b className="text-ink">#{id}</b>
      </p>
      {count > 1 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className="rounded-full bg-tint px-3 py-1 text-xs font-bold text-primary">
              #{id}-{String.fromCharCode(65 + i)}
            </span>
          ))}
        </div>
      )}
      <p className="max-w-72 text-[13px] leading-5 text-muted">Petugas CS di sepanjang rute akan mulai mencari. Kami kabari lewat WhatsApp/Email begitu ada kecocokan.</p>
      <div className="mt-4 flex w-full flex-col gap-2">
        <Button variant="cta" size="lg" full onClick={() => replace('tracking', { id })}>
          Lacak Laporan
        </Button>
        <Button variant="outline" size="lg" full onClick={() => tab('home')}>
          Kembali ke Beranda
        </Button>
      </div>
    </div>
  )
}

function IncidentDateTimeSheet({
  open,
  date,
  time,
  onClose,
  onApply,
}: {
  open: boolean
  date: string
  time: string
  onClose: () => void
  onApply: (date: string, time: string) => void
}) {
  const [draftDate, setDraftDate] = useState(() => date || nowDateStr())
  const [draftTime, setDraftTime] = useState(() => time || nowTimeStr())
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseIndoDate(date || nowDateStr())
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1)
  })

  useEffect(() => {
    if (!open) return
    const d = date || nowDateStr()
    const t = time || nowTimeStr()
    setDraftDate(d)
    setDraftTime(t)
    const parsed = parseIndoDate(d)
    setViewMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1))
  }, [open, date, time])

  const today = new Date()
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const isToday = draftDate === formatIndoDate(todayMid)
  const liveNowTime = nowTimeStr()
  const timeErr = isToday && draftTime && toMin(draftTime) > toMin(liveNowTime)
    ? `Waktu yang dipilih melewati jam saat ini (${liveNowTime} WIB).`
    : ''

  // Build Monday-first calendar grid for viewMonth
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7 // Mon=0 .. Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const canGoNextMonth = year < todayMid.getFullYear() || (year === todayMid.getFullYear() && month < todayMid.getMonth())

  const cells: Array<{ day: number; dateObj: Date; str: string } | null> = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d)
    cells.push({ day: d, dateObj, str: formatIndoDate(dateObj) })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Kapan barang tertinggal?"
      footer={
        <div className="flex flex-col gap-2">
          <p className="text-center text-xs text-muted">
            Waktu saat ini: <span className="font-semibold text-ink">{formatIndoDate(today)}, {liveNowTime} WIB</span>
          </p>
          <Button
            full
            size="lg"
            disabled={!!timeErr}
            className="bg-ink text-white hover:bg-[#122938]"
            onClick={() => onApply(draftDate, draftTime)}
          >
            Terapkan Tanggal &amp; Jam
          </Button>
        </div>
      }
    >
      {/* Interactive Mini Calendar */}
      <p className="mb-2 text-xs font-semibold text-muted">Pilih Tanggal</p>
      <div className="rounded-2xl border border-line bg-[#f7fbfd] p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              aria-label="Bulan sebelumnya"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              className="flex size-8 items-center justify-center rounded-xl border border-line bg-white text-ink hover:bg-tint"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <p className="text-sm font-bold text-ink">
              {MONTHS_FULL_ID[month]} {year}
            </p>
            <button
              type="button"
              aria-label="Bulan berikutnya"
              disabled={!canGoNextMonth}
              onClick={() => canGoNextMonth && setViewMonth(new Date(year, month + 1, 1))}
              className="flex size-8 items-center justify-center rounded-xl border border-line bg-white text-ink hover:bg-tint disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((wd) => (
              <span key={wd} className="py-1">
                {wd}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (!cell) return <span key={`empty-${idx}`} />
              const isFuture = cell.dateObj > todayMid
              const isSelected = cell.str === draftDate
              const isCellToday = cell.dateObj.getTime() === todayMid.getTime()
              return (
                <button
                  key={cell.str}
                  type="button"
                  disabled={isFuture}
                  onClick={() => setDraftDate(cell.str)}
                  className={cx(
                    'flex h-9 w-full items-center justify-center rounded-xl text-xs transition-colors',
                    isFuture
                      ? 'cursor-not-allowed text-muted opacity-35'
                      : isSelected
                        ? 'bg-ink font-bold text-white shadow-sm'
                        : isCellToday
                          ? 'bg-tint font-bold text-primary ring-1 ring-primary/40 hover:bg-tint/80'
                          : 'font-semibold text-ink hover:bg-white',
                  )}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>
        </div>

      {/* Time Picker */}
      <div className="mt-4">
        <Field label="Perkiraan Jam (WIB)" error={timeErr}>
          {(a) => (
            <input
              {...a}
              type="time"
              value={draftTime}
              onChange={(e) => setDraftTime(e.target.value)}
              className={inputCls(!!timeErr) + ' h-12'}
            />
          )}
        </Field>
      </div>
    </Sheet>
  )
}

