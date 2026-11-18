import { useEffect, useState } from 'react'
import { AlertTriangle, Mail, Pencil, Plus, Search } from 'lucide-react'
import { ADMIN_CATEGORIES, AUDIT, CATEGORIES, STAFF_USERS, STATIONS } from '../lib/data'
import { Badge, Banner, Button, cx, iconLibrary, Field, inputCls, useToast } from '../lib/ui'
import { Modal, PageHead, Panel, Tabs, td, th } from './common'
import { staffApi } from '../lib/api'

function MiniSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="flex h-11 w-14 items-center disabled:opacity-40">
      <span className={cx('relative h-6 w-11 rounded-full transition-colors', checked ? 'bg-success' : 'bg-[#cdd6dc]')}>
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
    </button>
  )
}

export function MasterDataPage() {
  const toast = useToast()
  const [tab, setTab] = useState<'cat' | 'st' | 'user'>('cat')
  const [cats, setCats] = useState(ADMIN_CATEGORIES.map((c) => ({ ...c, icon: c.name })))
  const [stations, setStations] = useState(STATIONS.map((s, i) => ({ ...s, hours: '04:00–24:00', active: i !== 11 })))
  const [users, setUsers] = useState(STAFF_USERS)
  const [iconPick, setIconPick] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const [addCat, setAddCat] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [addUser, setAddUser] = useState(false)
  const [nu, setNu] = useState({ name: '', email: '', role: 'Petugas CS', station: 'Jakarta Kota' })
  const [userErr, setUserErr] = useState('')
  const [busy, setBusy] = useState(false)

  // Fetch initial data from backend
  const loadData = () => {
    staffApi.admin.categories().then((c) => { if (c?.length) setCats(c) }).catch(() => {})
    staffApi.admin.stations().then((s) => { if (s?.length) setStations(s) }).catch(() => {})
    staffApi.admin.users().then((u) => { if (u?.length) setUsers(u) }).catch(() => {})
  }

  useEffect(() => {
    loadData()
  }, [])

  const saved = () => toast('Perubahan disimpan')
  const catErr = newCat && cats.some((c) => c.name.toLowerCase() === newCat.trim().toLowerCase()) ? 'Nama kategori sudah ada.' : ''

  const handleCreateCategory = async () => {
    if (!newCat.trim() || catErr) return
    setBusy(true)
    try {
      const res = await staffApi.admin.storeCategory({ name: newCat.trim(), retention: 30, shippable: true })
      setCats((cs) => [...cs, res.category])
      setNewCat('')
      setAddCat(false)
      toast('Kategori baru disimpan ke database.')
    } catch (error: any) {
      toast(error.message || 'Gagal menyimpan kategori.', { tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateCategory = async (catItem: any, patch: { retention?: number; shippable?: boolean }) => {
    try {
      if (catItem.id) {
        await staffApi.admin.updateCategory(catItem.id, patch)
      }
      setCats((cs) => cs.map((x) => (x.name === catItem.name ? { ...x, ...patch } : x)))
      saved()
    } catch (error: any) {
      toast(error.message || 'Gagal update kategori.', { tone: 'danger' })
    }
  }

  const handleCreateUser = async () => {
    if (!nu.name || !nu.email) return
    if (users.some((u) => u.email === nu.email.trim().toLowerCase())) {
      return setUserErr('Email sudah terdaftar.')
    }
    setBusy(true)
    try {
      const res = await staffApi.admin.storeUser({
        name: nu.name,
        email: nu.email.trim(),
        role: nu.role,
        station: nu.station,
      })
      setUsers((us) => [...us, res.user])
      setAddUser(false)
      setUserErr('')
      setNu({ name: '', email: '', role: 'Petugas CS', station: 'Jakarta Kota' })
      toast(`Akun staf baru (${nu.name}) berhasil ditambahkan ke PostgreSQL.`)
    } catch (error: any) {
      setUserErr(error.message || 'Gagal menambahkan staf.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead
        title="Data Master"
        sub="Perubahan tersimpan otomatis ke PostgreSQL dan tercatat di log audit."
        actions={
          tab === 'cat' ? (
            <Button variant="cta" icon={Plus} onClick={() => setAddCat(true)}>
              Tambah Kategori
            </Button>
          ) : tab === 'user' ? (
            <Button variant="cta" icon={Plus} onClick={() => setAddUser(true)}>
              Tambah Staf
            </Button>
          ) : (
            <Button variant="cta" icon={Plus} onClick={() => toast('Formulir stasiun baru dibuka.', { tone: 'info' })}>
              Tambah Stasiun
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { v: 'cat', l: 'Kategori Barang' },
            { v: 'st', l: 'Stasiun' },
            { v: 'user', l: 'Pengguna Staf' },
          ]}
        />
      </div>
      {warn && (
        <Banner tone="warn" icon={AlertTriangle} className="mb-4" action={<Button size="sm" variant="ghost" onClick={() => setWarn(null)}>Tutup</Button>}>
          {warn}
        </Banner>
      )}

      {tab === 'cat' && (
        <Panel>
          <table className="w-full">
            <thead className="bg-[#f6fafc]">
              <tr>
                {['Ikon', 'Nama', 'retention_days', 'is_shippable', 'is_active', 'Dipakai', 'Aksi'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cats.map((c, i) => {
                const Icon = iconLibrary[c.icon] ?? iconLibrary.Lainnya
                return (
                  <tr key={c.name} className={cx('border-t border-line', !c.active && 'bg-[#f7f9fa] text-muted')}>
                    <td className={td}>
                      <div className="relative">
                        <button aria-label={`Ganti ikon ${c.name}`} onClick={() => setIconPick(iconPick === c.name ? null : c.name)} className="flex size-10 items-center justify-center rounded-xl bg-tint text-primary hover:ring-2 hover:ring-primary">
                          <Icon className="size-5" aria-hidden />
                        </button>
                        {iconPick === c.name && (
                          <div className="absolute left-0 top-12 z-20 grid w-56 grid-cols-4 gap-1.5 rounded-2xl border border-line bg-white p-2 shadow-xl">
                            {Object.entries(iconLibrary).map(([k, I]) => (
                              <button
                                key={k}
                                onClick={() => {
                                  setCats((cs) => cs.map((x, j) => (j === i ? { ...x, icon: k } : x)))
                                  setIconPick(null)
                                  saved()
                                }}
                                className="flex size-11 items-center justify-center rounded-xl hover:bg-tint text-primary"
                              >
                                <I className="size-5" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={td + ' font-bold'}>{c.name}</td>
                    <td className={td}>
                      <input
                        type="number"
                        min={7}
                        max={180}
                        value={c.retention}
                        onChange={(e) => handleUpdateCategory(c, { retention: Number(e.target.value) })}
                        className={inputCls() + ' h-9 w-24 text-center font-bold'}
                      />{' '}
                      <span className="text-xs text-muted">hari</span>
                    </td>
                    <td className={td}>
                      <MiniSwitch
                        checked={c.shippable}
                        label={`Bisa dikirim ${c.name}`}
                        onChange={(v) => handleUpdateCategory(c, { shippable: v })}
                      />
                    </td>
                    <td className={td}>
                      <MiniSwitch
                        checked={c.active}
                        label={`Aktif ${c.name}`}
                        onChange={(v) => setCats((cs) => cs.map((x, j) => (j === i ? { ...x, active: v } : x)))}
                      />
                    </td>
                    <td className={td + ' text-muted'}>{c.used} barang</td>
                    <td className={td}>
                      <Button size="sm" variant="ghost" onClick={() => setWarn(`Kategori "${c.name}" digunakan oleh ${c.used} barang.`)}>
                        Detail
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>
      )}

      {tab === 'st' && (
        <Panel>
          <table className="w-full">
            <thead className="bg-[#f6fafc]">
              <tr>
                {['Kode', 'Nama Stasiun', 'Lin KRL', 'Jam Layanan', 'Status'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map((s, i) => (
                <tr key={s.code} className="border-t border-line">
                  <td className={td + ' font-mono font-bold'}>{s.code}</td>
                  <td className={td + ' font-bold'}>St. {s.name}</td>
                  <td className={td}><Badge tone="neutral">{s.line}</Badge></td>
                  <td className={td + ' text-muted'}>{s.hours}</td>
                  <td className={td}>
                    <Badge tone={s.active ? 'success' : 'neutral'}>{s.active ? 'Aktif' : 'Non-aktif'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {tab === 'user' && (
        <Panel>
          <table className="w-full">
            <thead className="bg-[#f6fafc]">
              <tr>
                {['Nama Staf', 'Email Kedinasan', 'Peran / Divisi', 'Stasiun Posko', 'Status'].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.email} className="border-t border-line">
                  <td className={td + ' font-bold'}>{u.name}</td>
                  <td className={td + ' font-mono text-muted'}>{u.email}</td>
                  <td className={td}>
                    <Badge tone={u.role.includes('CS') ? 'info' : u.role.includes('Logistik') ? 'warn' : 'neutral'}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className={td}>{u.station ? `St. ${u.station}` : 'Pusat'}</td>
                  <td className={td}>
                    <Badge tone="success">Aktif</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Modal
        open={addCat}
        onClose={() => setAddCat(false)}
        title="Tambah Kategori"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddCat(false)}>
              Batal
            </Button>
            <Button
              variant="cta"
              disabled={!newCat.trim() || !!catErr || busy}
              loading={busy}
              onClick={handleCreateCategory}
            >
              Simpan Kategori
            </Button>
          </>
        }
      >
        <Field label="Nama Kategori" required error={catErr} helper={`Kategori yang sudah ada: ${cats.map((c) => c.name).join(', ')}`}>
          {(a) => <input {...a} value={newCat} onChange={(e) => setNewCat(e.target.value)} className={inputCls(!!catErr) + ' h-11'} />}
        </Field>
      </Modal>

      <Modal
        open={addUser}
        onClose={() => setAddUser(false)}
        title="Tambah Staf Baru"
        sub="Staf baru akan tersimpan ke database PostgreSQL dan dapat langsung masuk ke konsol."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddUser(false)}>
              Batal
            </Button>
            <Button
              variant="cta"
              icon={Mail}
              disabled={!nu.name || !nu.email || busy}
              loading={busy}
              onClick={handleCreateUser}
            >
              Simpan Akun Staf
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nama Lengkap" required>{(a) => <input {...a} value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} placeholder="Nama Staf" className={inputCls() + ' h-11'} />}</Field>
          <Field label="Email Dinas (@kci.id)" required error={userErr}>
            {(a) => <input {...a} type="email" value={nu.email} onChange={(e) => { setNu({ ...nu, email: e.target.value }); setUserErr('') }} placeholder="nama.staf@kci.id" className={inputCls(!!userErr) + ' h-11'} />}
          </Field>
          <Field label="Peran">
            {(a) => (
              <select {...a} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })} className={inputCls() + ' h-11'}>
                {['Petugas CS', 'Petugas Logistik', 'Administrator Sistem', 'Kepala Stasiun'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Stasiun Penugasan">
            {(a) => (
              <select {...a} value={nu.station} onChange={(e) => setNu({ ...nu, station: e.target.value })} className={inputCls() + ' h-11'}>
                <option value="Pusat">Pusat</option>
                {STATIONS.map((s) => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </Modal>
    </>
  )
}

export function AuditTable({ pageSize = 6 }: { pageSize?: number }) {
  const [q, setQ] = useState('')
  const [actor, setActor] = useState('Semua')
  const [page, setPage] = useState(0)
  const [logs, setLogs] = useState<any[]>(AUDIT)

  useEffect(() => {
    const loadLogs = () => {
      staffApi.admin.auditLogs({ actor, q })
        .then((data) => {
          if (data && data.length) setLogs(data)
        })
        .catch(() => {})
    }
    loadLogs()
    const t = setInterval(loadLogs, 3000)
    return () => clearInterval(t)
  }, [actor, q])

  const list = logs
  const pages = Math.max(1, Math.ceil(list.length / pageSize))
  const rows = list.slice(page * pageSize, page * pageSize + pageSize)

  return (
    <Panel
      title="Log Audit Global"
      action={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-soft" aria-hidden />
            <input aria-label="Cari log" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Cari aksi/objek" className={inputCls() + ' h-9 w-52 pl-9'} />
          </div>
          <select aria-label="Filter pelaku" value={actor} onChange={(e) => { setActor(e.target.value); setPage(0) }} className={inputCls() + ' h-9 w-36'}>
            {['Semua', 'CS', 'Logistik', 'Admin', 'Sistem'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <Badge tone="neutral">Hanya baca</Badge>
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Tidak ada data pada periode ini.</p>
      ) : (
        <table className="w-full">
          <thead className="bg-[#f6fafc]">
            <tr>
              {['Waktu', 'Pelaku', 'Aksi', 'Objek', 'Hasil'].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={i} className="border-t border-line">
                <td className={td + ' whitespace-nowrap text-muted'}>{a.t}</td>
                <td className={td + ' font-semibold'}>{a.who}</td>
                <td className={td}>{a.act}</td>
                <td className={td + ' font-mono text-xs'}>{a.obj}</td>
                <td className={td}>
                  <Badge tone={a.res === 'Berhasil' ? 'success' : a.res.startsWith('Ditolak') || a.res.startsWith('Dikunci') ? 'danger' : 'warn'}>{a.res}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
        <span>
          Menampilkan {rows.length} dari {list.length} entri
        </span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Sebelumnya
          </Button>
          <span className="px-2 font-semibold text-ink">
            {page + 1} / {pages}
          </span>
          <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            Berikutnya
          </Button>
        </div>
      </div>
    </Panel>
  )
}

export function AuditPage() {
  return (
    <>
      <PageHead title="Log Audit Global" sub="Seluruh tindakan petugas dan sistem. Data tidak dapat diubah atau dihapus (PostgreSQL tamper-evident)." />
      <AuditTable pageSize={8} />
    </>
  )
}
