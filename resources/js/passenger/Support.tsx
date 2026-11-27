import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BellOff, Check, ChevronDown, ChevronRight, CircleHelp, Compass, Download, FileLock2, History, KeyRound, LogOut, MapPin, MessageCircle, Pencil, Plus, Search, ServerCrash, Share, ShieldAlert, Smartphone, Trash2, User, Wrench, BellRing, Clock } from 'lucide-react'
import { NOTIFS } from '../lib/data'
import { Badge, Button, cx, Dialog, EmptyState, Field, inputCls, LogoMark, rupiah, Sheet, Toggle, useToast } from '../lib/ui'
import { authApi, reportApi, type SavedAddress } from '../lib/api'
import { usePwaInstall } from '../lib/pwa'
import { useApp } from './ctx'
import { Screen, TopBar } from './shell'

export function NotificationsScreen() {
  const { setUnread, go, user } = useApp()
  const toast = useToast()
  const [items, setItems] = useState<Array<{ id: number; report_id?: string; title: string; body: string; t: string; unread: boolean }>>([])
  const [tab, setTab] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    if (!user) {
      setItems(NOTIFS)
      return
    }
    reportApi.notifications()
      .then((data) => {
        setItems(data)
        setUnread(data.filter((n) => n.unread).length)
      })
      .catch(() => setItems([]))
  }, [user, setUnread])

  const list = tab === 'all' ? items : items.filter((n) => n.unread)
  const sync = (next: typeof items) => {
    setItems(next)
    setUnread(next.filter((n) => n.unread).length)
  }
  return (
    <Screen
      header={
        <>
          <TopBar
            title="Notifikasi"
            right={
              <Button variant="ghost" size="sm" disabled={!items.some((n) => n.unread)} onClick={() => (sync(items.map((n) => ({ ...n, unread: false }))), toast('Semua notifikasi ditandai dibaca.'))}>
                Tandai Semua Dibaca
              </Button>
            }
          />
          <div className="shrink-0 border-b border-line bg-white px-5 pb-3">
            <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-tint p-1">
              {(
                [
                  ['all', 'Semua'],
                  ['unread', `Belum Dibaca (${items.filter((n) => n.unread).length})`],
                ] as const
              ).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('h-10 rounded-full text-[13px] font-bold', tab === k ? 'bg-primary text-white' : 'text-primary')}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-2 p-5">
        {list.length === 0 && (
          <div className="rounded-[20px] border border-line bg-white">
            <EmptyState icon={BellOff} title="Belum ada notifikasi." body="Kabar terbaru tentang laporan Anda akan muncul di sini." />
          </div>
        )}
        {list.map((n) => (
          <SwipeRow key={n.id} onDelete={() => (sync(items.filter((x) => x.id !== n.id)), toast('Notifikasi dihapus.', { tone: 'info' }))}>
            <button
              onClick={() => {
                sync(items.map((x) => (x.id === n.id ? { ...x, unread: false } : x)))
                if (n.report_id) go('tracking', { id: n.report_id })
              }}
              className={cx('flex w-full items-start gap-3 rounded-[20px] border p-4 text-left', n.unread ? 'border-primary/40 bg-white' : 'border-line bg-white/70')}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-tint text-primary">
                <BellRing className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 break-words text-sm font-bold text-ink">{n.title}</span>
                  {n.unread && <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label="Belum dibaca" />}
                </span>
                <span className="mt-0.5 block break-words text-xs leading-5 text-muted">{n.body}</span>
                <span className="mt-1 flex items-center gap-1 text-[11px] text-soft">
                  <Clock className="size-3" aria-hidden /> {n.t}
                </span>
              </span>
            </button>
          </SwipeRow>
        ))}
        {list.length > 0 && <p className="text-center text-xs text-muted">Geser ke kiri untuk menghapus.</p>}
      </div>
    </Screen>
  )
}

function SwipeRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [dx, setDx] = useState(0)
  const start = useRef<number | null>(null)
  return (
    <div className="relative overflow-hidden rounded-[20px]">
      <button onClick={onDelete} aria-label="Hapus notifikasi" className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-danger text-white">
        <Trash2 className="size-5" aria-hidden />
      </button>
      <div
        className="relative bg-canvas transition-transform"
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={(e) => (start.current = e.clientX)}
        onPointerMove={(e) => start.current !== null && setDx(Math.min(0, Math.max(-80, e.clientX - start.current + (dx === -80 ? -80 : 0))))}
        onPointerUp={() => {
          start.current = null
          setDx((d) => (d < -40 ? -80 : 0))
        }}
        onPointerLeave={() => {
          if (start.current === null) return
          start.current = null
          setDx((d) => (d < -40 ? -80 : 0))
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function ProfileScreen() {
  const { user, login, logout, go } = useApp()
  const toast = useToast()
  const pwa = usePwaInstall()
  const [installSheet, setInstallSheet] = useState(false)
  const [notif, setNotif] = useState({ wa: true, email: true, push: false })
  const [section, setSection] = useState<string | null>(null)
  const [del, setDel] = useState<0 | 1 | 2>(0)
  const [confirmText, setConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Profile Data Diri & Password state
  const [editNik, setEditNik] = useState(user?.nik || '')
  const [newPw, setNewPw] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Saved Address CRUD state (no pre-fill)
  const [editingAddr, setEditingAddr] = useState(false)
  const [addrForm, setAddrForm] = useState<SavedAddress>({
    label: user?.address?.label || 'Rumah',
    name: user?.address?.name || user?.full || '',
    wa: user?.address?.wa || '',
    addr: user?.address?.addr || '',
    city: user?.address?.city || '',
    zip: user?.address?.zip || '',
  })

  // Transactions CRUD state (no pre-fill, loaded from DB)
  const [trxList, setTrxList] = useState<Array<{ id: number; bast_code: string; report_code: string; item: string; courier: string; amount: number; status: string; awb?: string; address?: string; date: string }>>([])
  const [loadingTrx, setLoadingTrx] = useState(false)

  useEffect(() => {
    setEditNik(user?.nik || '')
    if (user?.address) {
      setAddrForm({
        label: user.address.label || 'Rumah',
        name: user.address.name || user.full || '',
        wa: user.address.wa || '',
        addr: user.address.addr || '',
        city: user.address.city || '',
        zip: user.address.zip || '',
      })
    }
  }, [user])

  useEffect(() => {
    if (section === 'trx' && user) {
      setLoadingTrx(true)
      authApi.transactions()
        .then(setTrxList)
        .catch(() => {})
        .finally(() => setLoadingTrx(false))
    }
  }, [section, user])

  const initials = (user?.full || user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  const handleSaveAddress = async () => {
    if (!addrForm.addr.trim() || !addrForm.city.trim()) {
      toast('Alamat lengkap dan kota wajib diisi.', { tone: 'info' })
      return
    }
    setSavingProfile(true)
    try {
      const res = await authApi.updateProfile({ address: addrForm })
      login(res.user)
      setEditingAddr(false)
      toast('Alamat berhasil disimpan ke profil.')
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan alamat.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleDeleteAddress = async () => {
    setSavingProfile(true)
    try {
      const res = await authApi.updateProfile({ address: null })
      login(res.user)
      setAddrForm({ label: 'Rumah', name: user?.full || '', wa: '', addr: '', city: '', zip: '' })
      setEditingAddr(false)
      toast('Alamat tersimpan dihapus.')
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus alamat.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleDeleteTransaction = async (id: number) => {
    try {
      await authApi.deleteTransaction(id)
      setTrxList((prev) => prev.filter((t) => t.id !== id))
      toast('Riwayat transaksi dihapus.')
    } catch (err: any) {
      toast(err.message || 'Gagal menghapus riwayat transaksi.')
    }
  }

  const rows: { k: string; l: string; icon: typeof User; danger?: boolean; run?: () => void }[] = [
    { k: 'data', l: 'Data Diri', icon: User },
    { k: 'pw', l: 'Ubah Kata Sandi', icon: KeyRound },
    { k: 'notif', l: 'Pengaturan Notifikasi', icon: BellRing },
    { k: 'addr', l: 'Alamat Tersimpan', icon: MapPin },
    { k: 'trx', l: 'Riwayat Transaksi', icon: History },
    { k: 'help', l: 'Bantuan', icon: CircleHelp, run: () => go('help') },
    { k: 'privacy', l: 'Kebijakan Privasi', icon: FileLock2 },
    { k: 'del', l: 'Hapus Akun', icon: Trash2, danger: true, run: () => setDel(1) },
  ]
  return (
    <Screen>
      <header className="bg-primary px-5 pb-6 pt-5 text-white">
        <h1 className="text-[22px] font-bold">Profil</h1>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold text-primary">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{user?.full}</p>
            <p className="truncate text-xs text-white/80">{user?.contact}</p>
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-3 rounded-[20px] border border-[#bfe0ee] bg-white p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-line">
            <LogoMark className="h-full w-full" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Aplikasi LoFound</p>
            <p className="text-xs text-muted">
              {pwa.isInstalled
                ? 'Aplikasi sudah terpasang di perangkat ini.'
                : 'Akses lebih cepat langsung dari layar utama perangkat Anda.'}
            </p>
          </div>
          {pwa.isInstalled ? (
            <Badge tone="success" icon={Check} className="shrink-0">
              Terpasang
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="primary"
              icon={Download}
              className="shrink-0"
              onClick={async () => {
                if (pwa.canInstall) {
                  const res = await pwa.promptInstall()
                  if (res === 'accepted') toast('Aplikasi LoFound sedang dipasang.')
                  else if (res === 'unavailable') setInstallSheet(true)
                } else {
                  setInstallSheet(true)
                }
              }}
            >
              Unduh
            </Button>
          )}
        </div>
        <ul className="overflow-hidden rounded-[20px] border border-line bg-white">
          {rows.map((r, i) => (
            <li key={r.k} className={cx(i > 0 && 'border-t border-line')}>
              <button onClick={() => (r.run ? r.run() : setSection(section === r.k ? null : r.k))} aria-expanded={!r.run ? section === r.k : undefined} className={cx('flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-semibold hover:bg-tint/50', r.danger ? 'text-danger' : 'text-ink')}>
                <r.icon className={cx('size-5', r.danger ? 'text-danger' : 'text-primary')} aria-hidden />
                <span className="flex-1">{r.l}</span>
                {r.run ? <ChevronRight className="size-4 text-soft" aria-hidden /> : <ChevronDown className={cx('size-4 text-soft transition-transform', section === r.k && 'rotate-180')} aria-hidden />}
              </button>
              {section === r.k && (
                <div className="lf-fade border-t border-line bg-[#fafcfd] px-4 py-3 text-sm text-muted">
                  {r.k === 'notif' && (
                    <div className="flex flex-col">
                      <Toggle checked={notif.wa} onChange={(v) => setNotif({ ...notif, wa: v })} label="WhatsApp" />
                      <Toggle checked={notif.email} onChange={(v) => setNotif({ ...notif, email: v })} label="Email" />
                      <Toggle checked={notif.push} onChange={(v) => setNotif({ ...notif, push: v })} label="Push Notifikasi" />
                    </div>
                  )}
                  {r.k === 'data' && (
                    <div className="flex flex-col gap-3">
                      <dl className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[13px]">
                        <dt>Nama</dt>
                        <dd className="min-w-0 break-words font-semibold text-ink">{user?.full}</dd>
                        <dt>Kontak</dt>
                        <dd className="min-w-0 break-all font-semibold text-ink">{user?.contact}</dd>
                        <dt>NIK</dt>
                        <dd className="font-semibold text-ink">{user?.nik || 'Belum diisi'}</dd>
                      </dl>
                      <Field label="Simpan / Ubah NIK (16 digit)">
                        {(a) => (
                          <div className="flex gap-2">
                            <input
                              {...a}
                              maxLength={16}
                              value={editNik}
                              onChange={(e) => setEditNik(e.target.value.replace(/\D/g, ''))}
                              placeholder="3201xxxxxxxxxxxx"
                              className={inputCls() + ' h-10 font-mono text-xs'}
                            />
                            <Button
                              size="sm"
                              disabled={editNik.length !== 16 || savingProfile}
                              loading={savingProfile}
                              onClick={async () => {
                                setSavingProfile(true)
                                try {
                                  const res = await authApi.updateProfile({ nik: editNik })
                                  login(res.user)
                                  toast('NIK disimpan ke profil.')
                                } catch {}
                                setSavingProfile(false)
                              }}
                            >
                              Simpan
                            </Button>
                          </div>
                        )}
                      </Field>
                    </div>
                  )}
                  {r.k === 'pw' && (
                    <div className="flex flex-col gap-3">
                      <Field label="Kata Sandi Lama">{(a) => <input {...a} type="password" className={inputCls() + ' h-11'} />}</Field>
                      <Field label="Kata Sandi Baru" helper="Minimal 8 karakter, kombinasi huruf dan angka.">
                        {(a) => <input {...a} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputCls() + ' h-11'} />}
                      </Field>
                      <Button
                        size="sm"
                        disabled={newPw.length < 8 || savingProfile}
                        loading={savingProfile}
                        onClick={async () => {
                          setSavingProfile(true)
                          try {
                            await authApi.updateProfile({ password: newPw })
                            setNewPw('')
                            toast('Kata sandi berhasil diperbarui.')
                            setSection(null)
                          } catch (err: any) {
                            toast(err.message || 'Gagal memperbarui kata sandi.')
                          } finally {
                            setSavingProfile(false)
                          }
                        }}
                      >
                        Simpan Kata Sandi
                      </Button>
                    </div>
                  )}
                  {r.k === 'addr' && (
                    <div className="flex flex-col gap-3">
                      {!editingAddr && user?.address?.addr ? (
                        <div className="flex items-start justify-between gap-2 rounded-xl border border-line bg-white p-3">
                          <div className="min-w-0 flex-1 break-words text-[13px]">
                            <p className="font-bold text-ink">
                              {user.address.label || 'Rumah'} • {user.address.name} ({user.address.wa})
                            </p>
                            <p className="mt-0.5 text-muted">
                              {user.address.addr}, {user.address.city} {user.address.zip}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditingAddr(true)}>
                              Ubah
                            </Button>
                            <Button size="sm" variant="ghost" icon={Trash2} onClick={handleDeleteAddress} className="text-danger">
                              Hapus
                            </Button>
                          </div>
                        </div>
                      ) : !editingAddr ? (
                        <div className="flex flex-col items-start gap-2">
                          <p className="text-[13px] text-muted">Belum ada alamat pengiriman yang disimpan.</p>
                          <Button size="sm" variant="outline" icon={Plus} onClick={() => setEditingAddr(true)}>
                            Tambah Alamat Baru
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-white p-3">
                          <Field label="Label Alamat (Rumah / Kantor)">
                            {(a) => <input {...a} value={addrForm.label || ''} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} placeholder="Rumah" className={inputCls() + ' h-10'} />}
                          </Field>
                          <Field label="Nama Penerima">
                            {(a) => <input {...a} value={addrForm.name} onChange={(e) => setAddrForm({ ...addrForm, name: e.target.value })} placeholder="Nama penerima" className={inputCls() + ' h-10'} />}
                          </Field>
                          <Field label="Nomor WhatsApp">
                            {(a) => <input {...a} value={addrForm.wa} onChange={(e) => setAddrForm({ ...addrForm, wa: e.target.value })} placeholder="0812xxxxxxxx" className={inputCls() + ' h-10'} />}
                          </Field>
                          <Field label="Alamat Lengkap">
                            {(a) => <input {...a} value={addrForm.addr} onChange={(e) => setAddrForm({ ...addrForm, addr: e.target.value })} placeholder="Nama jalan, nomor rumah, RT/RW" className={inputCls() + ' h-10'} />}
                          </Field>
                          <div className="grid grid-cols-[1fr_100px] gap-2">
                            <Field label="Kota/Kecamatan">
                              {(a) => <input {...a} value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} placeholder="Kota / Kecamatan" className={inputCls() + ' h-10'} />}
                            </Field>
                            <Field label="Kode Pos">
                              {(a) => <input {...a} maxLength={5} value={addrForm.zip} onChange={(e) => setAddrForm({ ...addrForm, zip: e.target.value.replace(/\D/g, '') })} placeholder="16143" className={inputCls() + ' h-10'} />}
                            </Field>
                          </div>
                          <div className="mt-1 flex gap-2">
                            <Button size="sm" variant="primary" loading={savingProfile} onClick={handleSaveAddress}>
                              Simpan Alamat
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingAddr(false)}>
                              Batal
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {r.k === 'trx' && (
                    <div className="flex flex-col gap-2">
                      {loadingTrx ? (
                        <p className="text-xs text-muted">Memuat riwayat transaksi...</p>
                      ) : trxList.length === 0 ? (
                        <p className="text-[13px] text-muted">Belum ada riwayat transaksi pengiriman ekspedisi.</p>
                      ) : (
                        trxList.map((t) => (
                          <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 text-[13px]">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-ink">
                                {rupiah(t.amount)} • Ongkir #{t.report_code}
                              </p>
                              <p className="truncate text-xs text-muted">
                                {t.item} • {t.courier} {t.awb ? `(${t.awb})` : ''}
                              </p>
                              <p className="text-[11px] text-soft">{t.date}</p>
                            </div>
                            <Badge tone="success" className="shrink-0">{t.status === 'selesai' ? 'Selesai' : 'Lunas'}</Badge>
                            <button
                              aria-label="Hapus riwayat transaksi"
                              onClick={() => handleDeleteTransaction(t.id)}
                              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  {r.k === 'privacy' && <p className="text-[13px] leading-5">Data pribadi diproses sesuai UU No. 27/2022 tentang Pelindungan Data Pribadi. Foto KTP dihapus otomatis setelah proses klaim selesai; NIK selalu disamarkan.</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
        <Button variant="outline" size="lg" full icon={LogOut} onClick={logout}>
          Keluar
        </Button>
      </div>
      <Sheet open={installSheet} onClose={() => setInstallSheet(false)} title="Pasang Aplikasi LoFound">
        <div className="flex flex-col gap-3 text-sm leading-5 text-muted">
          <div className="flex items-start gap-3 rounded-2xl bg-tint p-3.5">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-bold text-ink">Android / Chrome / Edge Desktop</p>
              <p>Ketuk ikon <strong className="text-ink">Pasang Aplikasi</strong> di bilah alamat browser atau buka menu <strong className="text-ink">⋮</strong> → <strong className="text-ink">Tambahkan ke layar utama</strong>.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-tint p-3.5">
            <Share className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-bold text-ink">iPhone / iPad (Safari)</p>
              <p>Ketuk tombol <strong className="text-ink">Bagikan (Share)</strong> di bilah bawah Safari lalu pilih <strong className="text-ink">Tambah ke Layar Utama</strong>.</p>
            </div>
          </div>
          <Button variant="primary" full onClick={() => setInstallSheet(false)}>
            Mengerti
          </Button>
        </div>
      </Sheet>
      <Dialog
        open={del === 1}
        onClose={() => setDel(0)}
        icon={AlertTriangle}
        tone="danger"
        title="Hapus akun Anda?"
        actions={
          <>
            <Button variant="danger" full onClick={() => setDel(2)}>
              Lanjutkan
            </Button>
            <Button variant="ghost" full onClick={() => setDel(0)}>
              Batal
            </Button>
          </>
        }
      >
        Seluruh laporan aktif akan dibatalkan dan data pribadi dihapus dalam 30 hari. BAST yang sudah terbit tetap tersimpan untuk keperluan audit.
      </Dialog>
      <Dialog
        open={del === 2}
        onClose={() => !deletingAccount && setDel(0)}
        title="Konfirmasi terakhir"
        actions={
          <>
            <Button
              variant="danger"
              full
              disabled={confirmText.trim() !== 'HAPUS' || deletingAccount}
              onClick={async () => {
                setDeletingAccount(true)
                try {
                  await authApi.deleteAccount()
                  setDel(0)
                  setConfirmText('')
                  await logout()
                  toast('Akun berhasil dihapus permanen.')
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Gagal menghapus akun.', { tone: 'danger' })
                } finally {
                  setDeletingAccount(false)
                }
              }}
            >
              {deletingAccount ? 'Menghapus...' : 'Hapus Akun Permanen'}
            </Button>
            <Button variant="ghost" full disabled={deletingAccount} onClick={() => setDel(0)}>
              Batal
            </Button>
          </>
        }
      >
        <Field label='Ketik "HAPUS" untuk mengonfirmasi'>{(a) => <input {...a} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={inputCls() + ' h-11'} />}</Field>
      </Dialog>
    </Screen>
  )
}

const FAQ = [
  ['Berapa lama barang disimpan?', 'Barang Elektronik dan Non Elektronik disimpan 30 hari, sedangkan Uang Tunai disimpan 90 hari.'],
  ['Mengapa foto barang tidak ditampilkan?', 'Untuk mencegah klaim palsu. Anda membuktikan kepemilikan dengan menyebutkan ciri rahasia yang hanya diketahui pemilik.'],
  ['Apakah saya harus login untuk melapor?', 'Tidak. Anda bisa mengisi laporan sebagai tamu. Login hanya diperlukan saat mengirim agar laporan bisa dilacak.'],
  ['Bisakah barang dikirim ke rumah?', 'Bisa untuk kategori Elektronik dan Non Elektronik dengan ongkos kirim. Uang Tunai wajib diambil langsung di stasiun.'],
  ['Bagaimana jika klaim saya ditolak?', 'Anda dapat mengajukan ulang hingga 2 kali dengan bukti tambahan. Setelah itu, silakan datang langsung ke Posko CS.'],
]

export function HelpScreen() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(0)
  const toast = useToast()
  const list = FAQ.filter(([t, d]) => (t + d).toLowerCase().includes(q.toLowerCase()))
  return (
    <Screen
      header={<TopBar title="Bantuan" />}
      footer={
        <Button variant="cta" size="lg" full icon={MessageCircle} onClick={() => toast('Membuka WhatsApp CS KAI Commuter...', { tone: 'info' })}>
          Hubungi CS via WhatsApp
        </Button>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 size-5 text-soft" aria-hidden />
          <label htmlFor="faq-q" className="sr-only">
            Cari bantuan
          </label>
          <input id="faq-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pertanyaan..." className={inputCls() + ' h-12 bg-white pl-11'} />
        </div>
        <ul className="overflow-hidden rounded-[20px] border border-line bg-white">
          {list.map(([t, d], i) => (
            <li key={t} className={cx(i > 0 && 'border-t border-line')}>
              <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-bold text-ink">
                <span className="flex-1">{t}</span>
                <ChevronDown className={cx('size-4 text-soft transition-transform', open === i && 'rotate-180')} aria-hidden />
              </button>
              {open === i && <p className="px-4 pb-4 text-[13px] leading-5 text-muted">{d}</p>}
            </li>
          ))}
          {list.length === 0 && <EmptyState icon={Search} title="Pertanyaan tidak ditemukan." body="Coba kata kunci lain atau hubungi CS." />}
        </ul>
      </div>
    </Screen>
  )
}

const SYS = {
  '404': { icon: Compass, title: 'Halaman tidak ditemukan', body: 'Tautan mungkin sudah tidak berlaku atau alamatnya keliru.' },
  '403': { icon: ShieldAlert, title: 'Akses dibatasi', body: 'Anda tidak memiliki akses ke halaman ini.' },
  '500': { icon: ServerCrash, title: 'Terjadi gangguan', body: 'Terjadi gangguan. Coba lagi sebentar lagi.' },
  maint: { icon: Wrench, title: 'Sedang pemeliharaan', body: 'Sistem sedang dalam pemeliharaan. Kembali pukul 02:00 WIB.' },
} as const

export function SystemScreen({ kind: initial = '404' }: { kind?: keyof typeof SYS }) {
  const { tab } = useApp()
  const [kind, setKind] = useState<keyof typeof SYS>(initial)
  const s = SYS[kind]
  return (
    <Screen header={<TopBar title="Halaman Sistem" />}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex gap-2">
          {(Object.keys(SYS) as (keyof typeof SYS)[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={cx('h-9 rounded-full px-3 text-xs font-bold', kind === k ? 'bg-ink text-white' : 'bg-white text-muted')}>
              {k === 'maint' ? 'Pemeliharaan' : k}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3 rounded-[24px] border border-line bg-white px-6 py-12 text-center">
          {kind !== 'maint' && <p className="text-5xl font-extrabold tracking-tight text-tint [-webkit-text-stroke:2px_#318FB5]">{kind}</p>}
          <span className="flex size-16 items-center justify-center rounded-3xl bg-tint text-primary">
            <s.icon className="size-8" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-ink">{s.title}</h2>
          <p className="max-w-64 text-sm text-muted">{s.body}</p>
          {kind !== 'maint' && (
            <Button variant="cta" className="mt-2" onClick={() => tab('home')}>
              Kembali ke Beranda
            </Button>
          )}
        </div>
      </div>
    </Screen>
  )
}
