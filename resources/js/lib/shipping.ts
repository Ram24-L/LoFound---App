export const FAILED_SHIP_STATUSES = ['courier_not_found', 'cancelled', 'rejected', 'disposed'] as const
export const RETURN_SHIP_STATUSES = ['return_in_transit', 'returned'] as const
export const HOLD_SHIP_STATUSES = ['on_hold'] as const

export const SHIPPING_MILESTONES = ['Dikemas', 'Dijemput', 'Dikirim', 'Tiba'] as const

export function calcPackageMetrics(params: {
  weightGrams?: number | null
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
}) {
  const actualGrams = Math.max(50, Math.round(params.weightGrams || 1000))
  const l = params.lengthCm && params.lengthCm > 0 ? Math.round(params.lengthCm) : null
  const w = params.widthCm && params.widthCm > 0 ? Math.round(params.widthCm) : null
  const h = params.heightCm && params.heightCm > 0 ? Math.round(params.heightCm) : null
  const volumetricGrams = l && w && h ? Math.ceil(((l * w * h) / 6000) * 1000) : null
  const chargeableGrams = Math.max(actualGrams, volumetricGrams ?? 0)
  return {
    actualGrams,
    lengthCm: l,
    widthCm: w,
    heightCm: h,
    volumetricGrams,
    chargeableGrams,
    dimensionsText: l && w && h ? `${l} × ${w} × ${h} cm` : null,
    kgText: (chargeableGrams / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 }),
    actualKgText: (actualGrams / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 }),
  }
}

export function cleanCourierName(name: string | null | undefined): string {
  const raw = (name || '').trim()
  if (!raw) return 'Ekspedisi'
  const parts = raw.split(/\s+/)
  if (parts.length >= 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts.slice(1).join(' ')
  }
  return raw
}

export function normalizeShipStatus(status: string | null | undefined): string {
  return (status || '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
}

export function formatTrackingTimestamp(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })} WIB`
}

export function formatTrackingEvent(entry: { status?: string; note?: string; updated_at?: string }): {
  title: string
  desc: string
  tone: 'success' | 'info' | 'warn' | 'danger'
} {
  const norm = normalizeShipStatus(entry.status || entry.note)
  const dict: Record<string, { title: string; desc: string; tone: 'success' | 'info' | 'warn' | 'danger' }> = {
    confirmed: {
      title: 'Pesanan Pengiriman Dikonfirmasi',
      desc: 'Nomor resi telah terbit dan paket siap diserahkan ke kurir.',
      tone: 'info',
    },
    scheduled: {
      title: 'Penjemputan Dijadwalkan',
      desc: 'Penjemputan paket telah dijadwalkan bersama pihak kurir.',
      tone: 'info',
    },
    allocated: {
      title: 'Kurir Ditugaskan',
      desc: 'Kurir sedang bersiap menjemput paket di Posko CS.',
      tone: 'info',
    },
    picking_up: {
      title: 'Kurir Menuju Lokasi Penjemputan',
      desc: 'Kurir dalam perjalanan menjemput paket dari Posko CS.',
      tone: 'info',
    },
    picked: {
      title: 'Paket Telah Dijemput Kurir',
      desc: 'Paket telah diserahkan ke kurir dan menuju gudang sortir.',
      tone: 'info',
    },
    in_transit: {
      title: 'Paket Dalam Perjalanan',
      desc: 'Paket sedang dalam perjalanan menuju kota tujuan.',
      tone: 'info',
    },
    dropping_off: {
      title: 'Paket Sedang Diantar ke Alamat',
      desc: 'Kurir sedang menuju alamat penerima.',
      tone: 'info',
    },
    on_hold: {
      title: 'Pengiriman Tertunda Sementara',
      desc: 'Kurir mengalami kendala penjemputan/antar dan akan menjadwalkan ulang.',
      tone: 'warn',
    },
    delivered: {
      title: 'Paket Telah Diterima',
      desc: 'Paket telah tiba di alamat tujuan dan diterima.',
      tone: 'success',
    },
    courier_not_found: {
      title: 'Kurir Penjemput Tidak Ditemukan',
      desc: 'Tidak ada kurir tersedia saat ini. Petugas logistik akan menjadwalkan ulang penjemputan.',
      tone: 'danger',
    },
    cancelled: {
      title: 'Pengiriman Dibatalkan',
      desc: 'Order pengiriman dibatalkan. Petugas logistik akan memproses pengiriman ulang.',
      tone: 'danger',
    },
    rejected: {
      title: 'Paket Ditolak Penerima',
      desc: 'Pengiriman ditolak saat pengantaran dan akan dikembalikan ke posko.',
      tone: 'danger',
    },
    disposed: {
      title: 'Pengiriman Tidak Dapat Diteruskan',
      desc: 'Paket tidak dapat diteruskan oleh ekspedisi. Hubungi Posko CS untuk informasi lanjut.',
      tone: 'danger',
    },
    return_in_transit: {
      title: 'Paket Sedang Dikembalikan ke Posko',
      desc: 'Pengiriman gagal diterima dan sedang dalam perjalanan kembali ke Posko CS.',
      tone: 'danger',
    },
    returned: {
      title: 'Paket Kembali ke Posko CS',
      desc: 'Paket telah diterima kembali di Posko CS. Hubungi petugas untuk pengiriman ulang.',
      tone: 'danger',
    },
    price_updated: {
      title: 'Penyesuaian Ongkir Kurir',
      desc: 'Terdapat penyesuaian biaya ongkir berdasarkan berat/volume aktual di ekspedisi.',
      tone: 'warn',
    },
  }

  const mapped = dict[norm] ?? {
    title: entry.status || 'Pembaruan Pengiriman',
    desc: '',
    tone: 'info' as const,
  }
  const noteRaw = (entry.note || '').trim()
  const isRawCode =
    !noteRaw ||
    normalizeShipStatus(noteRaw) === norm ||
    /^(confirmed|scheduled|allocated|picking_up|picked|in_transit|dropping_off|on_hold|delivered|courier_not_found|cancelled|rejected|disposed|return_in_transit|returned|price_updated)$/i.test(
      noteRaw
    )

  return {
    title: mapped.title,
    desc: !isRawCode ? noteRaw : mapped.desc,
    tone: mapped.tone,
  }
}

export type ShippingSummary = {
  shipNorm: string
  isShipFailed: boolean
  isShipReturn: boolean
  isShipHold: boolean
  isIssue: boolean
  isDelivered: boolean
  isTransit: boolean
  topTitle: string
  heroTitle: string
  heroBadge: string
  shortBadge: string
  shortTone: 'success' | 'info' | 'warn' | 'danger'
  milestoneDoneCount: number
  milestoneActiveIdx: number
}

export function getShippingSummary(params: {
  shippingStatus?: string | null
  reportStatus?: string | null
  staffStatus?: string | null
  awb?: string | null
}): ShippingSummary {
  const { shippingStatus, reportStatus, staffStatus, awb } = params
  const shipNorm = normalizeShipStatus(shippingStatus)
  const isShipFailed = (FAILED_SHIP_STATUSES as readonly string[]).includes(shipNorm)
  const isShipReturn = (RETURN_SHIP_STATUSES as readonly string[]).includes(shipNorm)
  const isShipHold = (HOLD_SHIP_STATUSES as readonly string[]).includes(shipNorm)
  const isIssue = isShipFailed || isShipReturn
  const isDelivered = !isIssue && (reportStatus === 'selesai' || staffStatus === 'Selesai' || shipNorm === 'delivered')
  const isTransit =
    !isDelivered &&
    !isIssue &&
    !isShipHold &&
    (['picked', 'dropping_off', 'in_transit'].includes(shipNorm) || (shipNorm === '' && Boolean(awb)))

  const heroTransit = !isDelivered && !isIssue && !isShipHold && ['picking_up', 'picked', 'in_transit', 'dropping_off'].includes(shipNorm)

  const topTitle = isShipFailed
    ? 'Kendala Pengiriman'
    : isShipReturn
      ? 'Pengembalian Paket'
      : isShipHold
        ? 'Pengiriman Tertunda'
        : isDelivered
          ? 'Pengiriman Telah Selesai'
          : heroTransit
            ? 'Lacak Pengiriman'
            : 'Status Pengiriman'

  const heroTitle =
    shipNorm === 'courier_not_found'
      ? 'Kurir Tidak Ditemukan'
      : shipNorm === 'cancelled'
        ? 'Pengiriman Dibatalkan Kurir'
        : shipNorm === 'rejected'
          ? 'Paket Ditolak Saat Pengiriman'
          : shipNorm === 'disposed'
            ? 'Pengiriman Gagal Diteruskan'
            : shipNorm === 'returned'
              ? 'Paket Kembali ke Posko CS'
              : shipNorm === 'return_in_transit'
                ? 'Paket Sedang Dikembalikan'
                : isShipHold
                  ? 'Pengiriman Tertunda Sementara'
                  : isDelivered
                    ? 'Paket Telah Diterima'
                    : shipNorm === 'dropping_off'
                      ? 'Kurir Menuju Alamat Anda'
                      : shipNorm === 'in_transit'
                        ? 'Paket Dalam Perjalanan'
                        : shipNorm === 'picked'
                          ? 'Paket Dijemput Kurir'
                          : shipNorm === 'picking_up'
                            ? 'Kurir Menuju Posko CS'
                            : awb
                              ? 'Menunggu Penjemputan Kurir'
                              : 'Pembayaran Berhasil'

  const heroBadge = isShipFailed
    ? 'KENDALA KURIR • Dijadwalkan Ulang Logistik'
    : isShipReturn
      ? 'RETUR KE POSKO • Hubungi Petugas CS'
      : isShipHold
        ? 'ON HOLD • Pengiriman Tertunda Sementara'
        : isDelivered
          ? 'TERKIRIM • Pengiriman Telah Selesai'
          : shipNorm === 'dropping_off'
            ? 'DIANTAR KURIR • Siapkan Penerima'
            : heroTransit
              ? 'DALAM PENGIRIMAN • Pantau Berkala'
              : awb
                ? 'LUNAS • Menunggu Penjemputan Kurir'
                : 'LUNAS • Sedang Disiapkan Logistik'

  let shortBadge = 'Menunggu Resi'
  let shortTone: 'success' | 'info' | 'warn' | 'danger' = 'warn'

  if (isDelivered) {
    shortBadge = 'Pengiriman Telah Selesai'
    shortTone = 'success'
  } else if (shipNorm === 'courier_not_found') {
    shortBadge = 'Kurir Tidak Ditemukan'
    shortTone = 'danger'
  } else if (shipNorm === 'cancelled') {
    shortBadge = 'Dibatalkan Kurir'
    shortTone = 'danger'
  } else if (shipNorm === 'rejected') {
    shortBadge = 'Paket Ditolak'
    shortTone = 'danger'
  } else if (shipNorm === 'disposed') {
    shortBadge = 'Gagal Terkirim'
    shortTone = 'danger'
  } else if (isShipReturn) {
    shortBadge = 'Retur ke Posko'
    shortTone = 'danger'
  } else if (staffStatus === 'Bermasalah') {
    shortBadge = 'Kendala Kurir'
    shortTone = 'danger'
  } else if (isShipHold) {
    shortBadge = 'Tertunda (On Hold)'
    shortTone = 'warn'
  } else if (shipNorm === 'dropping_off') {
    shortBadge = 'Diantar ke Alamat'
    shortTone = 'info'
  } else if (shipNorm === 'in_transit') {
    shortBadge = 'Dalam Perjalanan'
    shortTone = 'info'
  } else if (shipNorm === 'picked') {
    shortBadge = 'Dijemput Kurir'
    shortTone = 'info'
  } else if (shipNorm === 'picking_up') {
    shortBadge = 'Kurir Menuju Posko'
    shortTone = 'info'
  } else if (shipNorm === 'allocated') {
    shortBadge = 'Kurir Ditugaskan'
    shortTone = 'info'
  } else if (shipNorm === 'scheduled') {
    shortBadge = 'Penjemputan Dijadwalkan'
    shortTone = 'info'
  } else if (shipNorm === 'confirmed' || awb || staffStatus === 'Dikemas' || staffStatus === 'Dikirim') {
    shortBadge = staffStatus === 'Dikirim' ? 'Dalam Perjalanan' : 'Menunggu Penjemputan'
    shortTone = 'info'
  }

  const milestoneDoneCount = isDelivered
    ? 4
    : isShipFailed || isShipReturn || isShipHold
      ? 0
      : ['in_transit', 'dropping_off'].includes(shipNorm)
        ? 2
        : shipNorm === 'picked' || isTransit
          ? 1
          : 0

  const milestoneActiveIdx = isDelivered
    ? -1
    : isShipFailed || isShipReturn || isShipHold
      ? 0
      : ['in_transit', 'dropping_off'].includes(shipNorm)
        ? 2
        : shipNorm === 'picked'
          ? 1
          : 0

  return {
    shipNorm,
    isShipFailed,
    isShipReturn,
    isShipHold,
    isIssue,
    isDelivered,
    isTransit,
    topTitle,
    heroTitle,
    heroBadge,
    shortBadge,
    shortTone,
    milestoneDoneCount,
    milestoneActiveIdx,
  }
}
