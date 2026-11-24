export const STATIONS = [
  { code: 'BOO', name: 'Bogor', line: 'Lin Bogor' },
  { code: 'CTA', name: 'Cilebut', line: 'Lin Bogor' },
  { code: 'DP', name: 'Depok', line: 'Lin Bogor' },
  { code: 'UI', name: 'Universitas Indonesia', line: 'Lin Bogor' },
  { code: 'MRI', name: 'Manggarai', line: 'Lin Bogor' },
  { code: 'JAKK', name: 'Jakarta Kota', line: 'Lin Bogor' },
  { code: 'THB', name: 'Tanah Abang', line: 'Lin Rangkasbitung' },
  { code: 'SUD', name: 'Sudirman', line: 'Lin Cikarang' },
  { code: 'BKS', name: 'Bekasi', line: 'Lin Cikarang' },
  { code: 'TNG', name: 'Tangerang', line: 'Lin Tangerang' },
  { code: 'DU', name: 'Duri', line: 'Lin Tangerang' },
  { code: 'SRP', name: 'Serpong', line: 'Lin Rangkasbitung' },
]

export const CATEGORIES = ['Elektronik', 'Non Elektronik', 'Uang Tunai']
export const NON_SHIPPABLE = ['Uang Tunai']

export const COLORS = [
  { name: 'Hitam', hex: '#1f2933' },
  { name: 'Putih', hex: '#ffffff' },
  { name: 'Silver', hex: '#c3ccd3' },
  { name: 'Biru', hex: '#318FB5' },
  { name: 'Merah', hex: '#d64545' },
  { name: 'Coklat', hex: '#8a5a3b' },
  { name: 'Hijau', hex: '#38B26F' },
  { name: 'Kuning', hex: '#f2c94c' },
]

export type ReportStatus = 'diterima' | 'pencarian' | 'kandidat' | 'ditinjau' | 'perlu_info' | 'ditolak' | 'bast' | 'dikirim' | 'selesai' | 'dibatalkan' | 'kedaluwarsa'

export type ReportItem = { sub: string; name: string; category: string; color: string }
export type Report = {
  id: string
  items: ReportItem[]
  from: string
  to: string
  date: string
  time: string
  position: string
  secret: string
  photo?: string
  status: ReportStatus
  candidates: number
  notify: boolean
  history: { t: string; text: string }[]
  updated: string
  attempts?: number
  bastCode?: string
  qrCode?: string
  awb?: string
}

export const STATUS_META: Record<ReportStatus, { label: string; tone: 'success' | 'info' | 'coral' | 'warn' | 'danger' | 'neutral'; action?: boolean; locked?: boolean }> = {
  diterima: { label: 'Laporan Diterima', tone: 'info' },
  pencarian: { label: 'Dalam Pencarian', tone: 'info' },
  kandidat: { label: 'Butuh Verifikasi', tone: 'coral', action: true },
  ditinjau: { label: 'Klaim Ditinjau', tone: 'info', locked: true },
  perlu_info: { label: 'Perlu Info', tone: 'warn', action: true },
  ditolak: { label: 'Klaim Belum Disetujui', tone: 'danger', action: true },
  bast: { label: 'BAST Terbit', tone: 'success', action: true, locked: true },
  dikirim: { label: 'Dalam Pengiriman', tone: 'success', locked: true },
  selesai: { label: 'Sudah Kembali', tone: 'success' },
  dibatalkan: { label: 'Dibatalkan', tone: 'neutral' },
  kedaluwarsa: { label: 'Masa Simpan Berakhir', tone: 'neutral' },
}

export const INITIAL_REPORTS: Report[] = [
  {
    id: 'LPR-2026-042',
    items: [
      { sub: 'A', name: 'MacBook Air M2 Silver + Sleeve Hitam', category: 'Elektronik', color: 'Silver' },
      { sub: 'B', name: 'Payung Lipat Hitam', category: 'Non Elektronik', color: 'Hitam' },
    ],
    from: 'Bogor',
    to: 'Manggarai',
    date: '2 Nov 2026',
    time: '10:15',
    position: 'Gerbong 4 - Rak Atas',
    secret: 'Stiker NASA di pojok kanan bawah, wallpaper foto kucing oranye, nomor seri berakhiran ...7QX2',
    photo: 'referensi_macbook.jpg',
    status: 'kandidat',
    candidates: 1,
    notify: true,
    history: [
      { t: '10:15', text: 'Dibuat' },
      { t: '11:02', text: 'Diubah: warna' },
      { t: '13:45', text: 'Kandidat barang ditemukan' },
    ],
    updated: '13:45',
    attempts: 2,
  },
  {
    id: 'LPR-2026-039',
    items: [{ sub: 'A', name: 'Dompet Kulit Coklat + KMT', category: 'Non Elektronik', color: 'Coklat' }],
    from: 'Depok',
    to: 'Tanah Abang',
    date: '30 Okt 2026',
    time: '07:40',
    position: 'Gerbong 2 - Kursi Prioritas',
    secret: 'Ada foto keluarga dan kartu perpustakaan atas nama saya',
    status: 'pencarian',
    candidates: 0,
    notify: true,
    history: [{ t: '07:40', text: 'Dibuat' }],
    updated: '08:10',
  },
  ...(
    [
      ['LPR-2026-031', 'Tas Ransel Biru Eiger', 'Non Elektronik', 'Biru', 'Bekasi', 'Sudirman', '21 Okt 2026'],
      ['LPR-2026-027', 'Earphone TWS Putih', 'Elektronik', 'Putih', 'Depok', 'Manggarai', '15 Okt 2026'],
      ['LPR-2026-022', 'Payung Merah', 'Non Elektronik', 'Merah', 'Tangerang', 'Duri', '9 Okt 2026'],
      ['LPR-2026-018', 'Kartu Multi Trip', 'Non Elektronik', 'Biru', 'Bogor', 'Jakarta Kota', '2 Okt 2026'],
      ['LPR-2026-011', 'Jaket Denim', 'Non Elektronik', 'Biru', 'Serpong', 'Tanah Abang', '24 Sep 2026'],
    ] as const
  ).map(([id, name, category, color, from, to, date]) => ({
    id,
    items: [{ sub: 'A', name, category, color }],
    from,
    to,
    date,
    time: '08:00',
    position: 'Gerbong 3',
    secret: 'Ciri rahasia tersimpan',
    status: 'selesai' as ReportStatus,
    candidates: 1,
    notify: true,
    history: [
      { t: '08:00', text: 'Dibuat' },
      { t: '15:00', text: 'Serah terima selesai' },
    ],
    updated: '15:00',
  })),
  {
    id: 'LPR-2026-015',
    items: [{ sub: 'A', name: 'Botol Minum Tumbler', category: 'Non Elektronik', color: 'Hijau' }],
    from: 'Cilebut',
    to: 'Depok',
    date: '18 Sep 2026',
    time: '17:20',
    position: 'Gerbong 6',
    secret: '-',
    status: 'dibatalkan',
    candidates: 0,
    notify: false,
    history: [
      { t: '17:20', text: 'Dibuat' },
      { t: '19:00', text: 'Dibatalkan: Barang sudah ditemukan sendiri' },
    ],
    updated: '19:00',
  },
]

export const FEED = [
  { cat: 'Elektronik', item: 'Laptop', from: 'Bogor', to: 'Jakarta Kota', who: 'Sdr. M***', bast: 'KCI-089', when: 'Hari ini, 14:20', line: 'Lin Bogor' },
  { cat: 'Non Elektronik', item: 'Dompet & KMT', from: 'Depok', to: 'Manggarai', who: 'Sdri. A***', bast: 'KCI-088', when: 'Hari ini, 11:05', line: 'Lin Bogor' },
  { cat: 'Non Elektronik', item: 'Tas Ransel', from: 'Bekasi', to: 'Sudirman', who: 'Sdr. R***', bast: 'KCI-086', when: 'Kemarin', line: 'Lin Cikarang' },
  { cat: 'Non Elektronik', item: 'Botol Minum', from: 'Bogor', to: 'Manggarai', who: 'Sdri. N***', bast: 'KCI-084', when: 'Kemarin', line: 'Lin Bogor' },
  { cat: 'Elektronik', item: 'Ponsel', from: 'Tangerang', to: 'Duri', who: 'Sdr. F***', bast: 'KCI-081', when: '31 Okt', line: 'Lin Tangerang' },
  { cat: 'Non Elektronik', item: 'Tas Laptop', from: 'Universitas Indonesia', to: 'Manggarai', who: 'Sdri. D***', bast: 'KCI-079', when: '30 Okt', line: 'Lin Bogor' },
]

export const CANDIDATES = [
  { id: 'FND-0412', cat: 'Elektronik', desc: 'Laptop silver • Gerbong 4', found: 'Ditemukan 2 Nov, 12:30', posko: 'Posko CS St. Jakarta Kota', match: 'Tinggi' as const },
  { id: 'FND-0415', cat: 'Elektronik', desc: 'Laptop abu-abu • Gerbong 5', found: 'Ditemukan 2 Nov, 13:10', posko: 'Posko CS St. Manggarai', match: 'Sedang' as const },
  { id: 'FND-0409', cat: 'Non Elektronik', desc: 'Payung lipat hitam • Gerbong 4', found: 'Ditemukan 2 Nov, 12:45', posko: 'Posko CS St. Jakarta Kota', match: 'Tinggi' as const },
]

export const NOTIFS = [
  { id: 1, title: 'Kandidat barang ditemukan', body: '#LPR-2026-042 • 1 kandidat cocok di Posko CS St. Jakarta Kota.', t: '13:45', unread: true },
  { id: 2, title: 'Laporan sedang dicari', body: '#LPR-2026-042 • Petugas mulai mencari di Lin Bogor.', t: '10:30', unread: true },
  { id: 3, title: 'Laporan diterima', body: '#LPR-2026-039 • Laporan Anda sudah masuk ke sistem.', t: 'Kemarin', unread: false },
  { id: 4, title: 'Barang berhasil diterima', body: '#LPR-2026-031 • Terima kasih telah menggunakan LoFound.', t: '21 Okt', unread: false },
]

/* ---------- Staff data ---------- */
export type InvStatus = 'Tersimpan' | 'Dalam Klaim' | 'Selesai' | 'Diarsipkan'
export type InvItem = {
  code: string
  cat: string
  name: string
  color: string
  station: string
  found: string
  status: InvStatus
  expiresIn: number
  secret: { detail: string; serial: string; locker: string; notes: string }
}
export const INVENTORY: InvItem[] = [
  { code: 'FND-0412', cat: 'Elektronik', name: 'Laptop silver', color: 'Silver', station: 'Jakarta Kota', found: '2 Nov 2026, 12:30', status: 'Dalam Klaim', expiresIn: 28, secret: { detail: 'MacBook Air M2, stiker NASA pojok kanan bawah, sleeve hitam', serial: 'C02XK1ZJ7QX2', locker: 'Loker B-04', notes: 'Wallpaper foto kucing oranye. Baterai 40%.' } },
  { code: 'FND-0409', cat: 'Non Elektronik', name: 'Payung lipat hitam', color: 'Hitam', station: 'Jakarta Kota', found: '2 Nov 2026, 12:45', status: 'Tersimpan', expiresIn: 12, secret: { detail: 'Payung lipat 3, gagang kayu, merek Fibrella', serial: '-', locker: 'Rak P-11', notes: 'Satu ruas sedikit bengkok.' } },
  { code: 'FND-0415', cat: 'Elektronik', name: 'Laptop abu-abu', color: 'Silver', station: 'Manggarai', found: '2 Nov 2026, 13:10', status: 'Tersimpan', expiresIn: 28, secret: { detail: 'Lenovo ThinkPad, stiker kampus', serial: 'PF3AB91', locker: 'Loker A-02', notes: '-' } },
  { code: 'FND-0398', cat: 'Non Elektronik', name: 'Dompet coklat', color: 'Coklat', station: 'Jakarta Kota', found: '31 Okt 2026, 08:20', status: 'Tersimpan', expiresIn: 3, secret: { detail: 'Isi: KTP, 2 kartu ATM, uang Rp 54.000', serial: '-', locker: 'Brankas S-01', notes: 'Uang dihitung 2 petugas.' } },
  { code: 'FND-0391', cat: 'Non Elektronik', name: 'Tas ransel hitam', color: 'Hitam', station: 'Jakarta Kota', found: '29 Okt 2026, 18:02', status: 'Tersimpan', expiresIn: 2, secret: { detail: 'Isi: buku catatan, charger, botol minum', serial: '-', locker: 'Rak T-07', notes: '-' } },
  { code: 'FND-0377', cat: 'Non Elektronik', name: 'Jaket hoodie abu', color: 'Silver', station: 'Jakarta Kota', found: '27 Okt 2026, 21:15', status: 'Selesai', expiresIn: 20, secret: { detail: 'Hoodie Uniqlo ukuran L', serial: '-', locker: '-', notes: 'Diserahkan 30 Okt.' } },
  { code: 'FND-0231', cat: 'Elektronik', name: 'Ponsel hitam', color: 'Hitam', station: 'Jakarta Kota', found: '10 Okt 2026, 09:40', status: 'Selesai', expiresIn: 0, secret: { detail: 'Samsung A54', serial: '356789104455221', locker: '-', notes: '-' } },
]

export type Claim = {
  id?: number
  no: string
  reporter: string
  reporterFull?: string
  reporterContact?: string
  nik?: string | null
  ktpPhoto?: string | null
  referencePhoto?: string | null
  route?: string
  incidentTime?: string
  position?: string
  category?: string
  item: string
  itemCode: string
  submitted: string
  slaMin: number
  handler?: string
  tab: 'baru' | 'ditinjau' | 'info' | 'selesai'
  dispute?: boolean
  lockedBy?: string
  priority?: boolean
  status?: string
  answer?: string
  note?: string
  isClaimSubmitted?: boolean
  reportStatus?: string
}
export const CLAIMS: Claim[] = [
  { no: 'KLM-2026-118', reporter: 'M. R****** M******', item: 'Laptop silver', itemCode: 'FND-0412', submitted: '14:02', slaMin: 95, tab: 'baru', dispute: true },
  { no: 'KLM-2026-117', reporter: 'S. A****', item: 'Dompet coklat', itemCode: 'FND-0398', submitted: '13:20', slaMin: 42, tab: 'baru' },
  { no: 'KLM-2026-116', reporter: 'D. P*****', item: 'Tas ransel hitam', itemCode: 'FND-0391', submitted: '11:48', slaMin: -15, tab: 'baru' },
  { no: 'KLM-2026-115', reporter: 'R. H*****', item: 'Payung lipat hitam', itemCode: 'FND-0409', submitted: '11:10', slaMin: 130, tab: 'baru', lockedBy: 'Dewi Lestari' },
  { no: 'KLM-2026-112', reporter: 'A. W*****', item: 'Ponsel biru', itemCode: 'FND-0402', submitted: '10:05', slaMin: 25, tab: 'ditinjau', handler: 'Anda' },
  { no: 'KLM-2026-110', reporter: 'N. K*****', item: 'Kacamata', itemCode: 'FND-0399', submitted: '09:30', slaMin: 70, tab: 'ditinjau', handler: 'Budi S.' },
  { no: 'KLM-2026-108', reporter: 'F. Z****', item: 'Earphone putih', itemCode: 'FND-0388', submitted: 'Kemarin', slaMin: 300, tab: 'info', handler: 'Anda' },
  { no: 'KLM-2026-101', reporter: 'T. M*****', item: 'Hoodie abu', itemCode: 'FND-0377', submitted: '30 Okt', slaMin: 0, tab: 'selesai', handler: 'Anda' },
]

export type Shipment = { id?: number; no: string; recipient: string; courier: string; dest: string; paid: string; status: 'Menunggu Resi' | 'Dikemas' | 'Dikirim' | 'Selesai'; awb?: string }
export const SHIPMENTS: Shipment[] = [
  { no: 'LPR-2026-042', recipient: 'M. Ramdhan M.', courier: 'KAI Logistik Express', dest: 'Bogor Tengah, Bogor', paid: '2 Nov, 15:10', status: 'Menunggu Resi' },
  { no: 'LPR-2026-036', recipient: 'Siti A.', courier: 'JNE Reguler', dest: 'Beji, Depok', paid: '2 Nov, 09:44', status: 'Menunggu Resi' },
  { no: 'LPR-2026-033', recipient: 'Yoga P.', courier: 'Pos Indonesia', dest: 'Serpong, Tangsel', paid: '1 Nov, 16:20', status: 'Dikemas', awb: 'POS-77120931' },
  { no: 'LPR-2026-029', recipient: 'Lina M.', courier: 'KAI Logistik Express', dest: 'Bekasi Barat', paid: '31 Okt, 11:02', status: 'Dikirim', awb: 'KALOG-99210044ID' },
]

export const STAFF_USERS = [
  { name: 'Rina Kurniasih', email: 'rina.k@kci.id', role: 'Petugas CS', station: 'Jakarta Kota', active: true },
  { name: 'Dewi Lestari', email: 'dewi.l@kci.id', role: 'Petugas CS', station: 'Jakarta Kota', active: true },
  { name: 'Budi Santoso', email: 'budi.s@kci.id', role: 'Petugas CS', station: 'Manggarai', active: true },
  { name: 'Agus Pratama', email: 'agus.p@kci.id', role: 'Petugas Logistik', station: 'Jakarta Kota', active: true },
  { name: 'Hendra Wijaya', email: 'hendra.w@kci.id', role: 'Administrator Sistem', station: 'Pusat', active: true },
  { name: 'Ir. Sutrisno', email: 'sutrisno@kci.id', role: 'Kepala Stasiun', station: 'Jakarta Kota', active: true },
  { name: 'Maya Sari', email: 'maya.s@kci.id', role: 'Petugas CS', station: 'Bogor', active: false },
]

export const ADMIN_CATEGORIES = [
  { name: 'Elektronik', retention: 30, shippable: true, active: true, used: 12 },
  { name: 'Non Elektronik', retention: 30, shippable: true, active: true, used: 39 },
  { name: 'Uang Tunai', retention: 90, shippable: false, active: true, used: 2 },
]

export const AUDIT = [
  { t: '2 Nov, 14:20', who: 'Rina K. (CS)', act: 'Setujui klaim & terbitkan BAST', obj: 'KLM-2026-109 • BAST #KCI-2026-089', res: 'Berhasil' },
  { t: '2 Nov, 13:45', who: 'Sistem', act: 'Cocokkan otomatis', obj: 'FND-0412 → LPR-2026-042', res: 'Berhasil' },
  { t: '2 Nov, 12:30', who: 'Dewi L. (CS)', act: 'Catat barang temuan', obj: 'FND-0412', res: 'Berhasil' },
  { t: '2 Nov, 11:15', who: 'Budi S. (CS)', act: 'Tolak klaim', obj: 'KLM-2026-104', res: 'Ditolak: Ciri tidak sesuai' },
  { t: '2 Nov, 10:02', who: 'Agus P. (Logistik)', act: 'Input resi manual', obj: 'LPR-2026-029', res: 'Berhasil' },
  { t: '2 Nov, 09:10', who: 'Hendra W. (Admin)', act: 'Ubah retention_days', obj: 'Kategori Payung (30 → 14)', res: 'Berhasil' },
  { t: '1 Nov, 21:40', who: 'Dewi L. (CS)', act: 'Arsipkan barang', obj: 'FND-0350 • Masa simpan berakhir', res: 'Berhasil' },
  { t: '1 Nov, 16:22', who: 'Rina K. (CS)', act: 'Konfirmasi serah terima', obj: 'BAST #KCI-2026-086', res: 'Berhasil' },
  { t: '1 Nov, 15:05', who: 'Sistem', act: 'Login gagal (5x)', obj: 'Akun petugas maya.s@kci.id', res: 'Dikunci 15 menit' },
  { t: '1 Nov, 10:30', who: 'Hendra W. (Admin)', act: 'Nonaktifkan staf', obj: 'maya.s@kci.id', res: 'Berhasil' },
  { t: '31 Okt, 18:12', who: 'Budi S. (CS)', act: 'Minta info tambahan', obj: 'KLM-2026-098', res: 'Perlu Info' },
  { t: '31 Okt, 14:00', who: 'Agus P. (Logistik)', act: 'Generate resi via API', obj: 'LPR-2026-026', res: 'Berhasil' },
]
