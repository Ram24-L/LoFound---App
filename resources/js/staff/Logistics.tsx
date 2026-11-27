import { useEffect, useState } from 'react'
import { AlertCircle, Check, Clock, Copy, Eye, MapPin, Package, Phone, Printer, RefreshCw, RotateCcw, Truck, X, Zap } from 'lucide-react'
import { SHIPMENTS, type Shipment } from '../lib/data'
import { Badge, Banner, Button, cx, EmptyState, Field, inputCls, rupiah, useToast } from '../lib/ui'
import { Modal, PageHead, Panel, Tabs, td, th } from './common'
import { staffApi } from '../lib/api'
import { downloadPdfDocument } from '../lib/export'
import {
  calcPackageMetrics,
  cleanCourierName,
  formatTrackingEvent,
  formatTrackingTimestamp,
  getShippingSummary,
  SHIPPING_MILESTONES,
} from '../lib/shipping'

export function ShippingQueuePage() {
  const toast = useToast()
  const [rows, setRows] = useState<Shipment[]>(SHIPMENTS)
  const [tab, setTab] = useState<Shipment['status']>('Menunggu Resi')
  const [open, setOpen] = useState<Shipment | null>(null)
  const [detailNo, setDetailNo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [manual, setManual] = useState('')
  const [manualErr, setManualErr] = useState('')
  const [awb, setAwb] = useState('')

  const fetchShipments = () => {
    staffApi.logistics
      .inventory()
      .then((res) => {
        if (res.shipments && res.shipments.length > 0) {
          setRows(res.shipments)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchShipments()
    const t = setInterval(fetchShipments, 3000)
    return () => clearInterval(t)
  }, [])

  const list = rows.filter((r) => r.status === tab)
  const count = (s: Shipment['status']) => rows.filter((r) => r.status === s).length
  const detailRow = detailNo ? rows.find((x) => x.no === detailNo) ?? null : null

  const close = () => {
    setOpen(null)
    setErr('')
    setManual('')
    setManualErr('')
    setAwb('')
  }

  const printLabel = (r: Shipment, labelAwb: string) => {
    const pkg = calcPackageMetrics({
      weightGrams: r.weight_grams,
      lengthCm: r.length_cm,
      widthCm: r.width_cm,
      heightCm: r.height_cm,
    })
    downloadPdfDocument({
      filename: `Label_Pengiriman_${labelAwb}.pdf`,
      title: `LABEL PENGIRIMAN EKSPEDISI #${labelAwb}`,
      subtitle: 'LoFound Logistik - KAI Commuter Lost & Found',
      badge: 'SIAP KIRIM',
      rows: [
        ['Nomor Resi (AWB)', labelAwb],
        ['Nomor Laporan', r.no || '-'],
        ['Kode BAST', r.bast_code || '-'],
        ['Barang', r.item_name || 'Barang Temuan'],
        ['Berat & Dimensi', `${pkg.chargeableGrams.toLocaleString('id-ID')} g (${pkg.kgText} kg)${pkg.dimensionsText ? ` • ${pkg.dimensionsText}` : ''}`],
        ['Nama Penerima', r.recipient || '-'],
        ['No. Telepon', r.recipient_phone || '-'],
        ['Jasa Kurir', cleanCourierName(r.courier)],
        ['Alamat Tujuan', r.dest || '-'],
        ['Status Ongkir', `${r.ongkir ? rupiah(r.ongkir) + ' • ' : ''}LUNAS (${r.paid || '-'})`],
      ],
      footerNote: 'Tempelkan label ini pada paket barang temuan sebelum diserahkan ke kurir ekspedisi.',
    })
    toast(`Label_Pengiriman_${labelAwb}.pdf berhasil diunduh.`)
  }

  const handleGenerateAwb = async () => {
    if (!open) return
    setBusy(true)
    setErr('')
    try {
      const bastId = open.id ?? 1
      const res = await staffApi.logistics.shipOrder(bastId, '', 'pack')
      setAwb(res.awb)
      setRows((rs) => rs.map((r) => (r.no === open.no ? { ...r, awb: res.awb, status: 'Dikemas' } : r)))
      toast('Resi dibuat otomatis dan tersimpan. Penumpang telah dikabari.')
      fetchShipments()
    } catch (error: any) {
      setErr(error.message || 'Gagal generate resi. Coba lagi atau gunakan manual.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveManualAwb = async () => {
    if (!open) return
    if (rows.some((r) => r.awb === manual && r.no !== open.no)) {
      return setManualErr('Nomor resi sudah dipakai pada pengiriman lain.')
    }
    setManualErr('')
    setBusy(true)
    try {
      const bastId = open.id ?? 1
      const res = await staffApi.logistics.shipOrder(bastId, manual, 'pack')
      setAwb(res.awb)
      setRows((rs) => rs.map((r) => (r.no === open.no ? { ...r, awb: res.awb, status: 'Dikemas' } : r)))
      toast('Resi manual disimpan ke database.')
      fetchShipments()
    } catch (error: any) {
      setManualErr(error.message || 'Gagal menyimpan resi.')
    } finally {
      setBusy(false)
    }
  }

  const handleMarkShipped = async (r: Shipment) => {
    try {
      const bastId = r.id ?? 1
      await staffApi.logistics.shipOrder(bastId, r.awb || 'KALOG-RESISYSTEM', 'ship')
      setRows((rs) => rs.map((x) => (x.no === r.no ? { ...x, status: 'Dikirim' } : x)))
      toast('Ditandai sudah diserahkan ke kurir. Status laporan penumpang berubah menjadi Dikirim.')
      fetchShipments()
    } catch (error: any) {
      toast(error.message || 'Gagal memperbarui status pengiriman.', { tone: 'danger' })
    }
  }

  const handleMarkDelivered = async (r: Shipment) => {
    try {
      const bastId = r.id ?? 1
      await staffApi.logistics.shipOrder(bastId, r.awb || 'KALOG-RESISYSTEM', 'delivered')
      setRows((rs) => rs.map((x) => (x.no === r.no ? { ...x, status: 'Selesai', shipping_status: 'delivered' } : x)))
      toast('Pengiriman telah selesai: Paket diterima di tujuan.')
      fetchShipments()
    } catch (error: any) {
      toast(error.message || 'Gagal menyelesaikan pengiriman.', { tone: 'danger' })
    }
  }

  const handleSyncTracking = async (r: Shipment) => {
    if (!r.id || syncingId === r.id) return
    setSyncingId(r.id)
    try {
      const res = await staffApi.logistics.syncTracking(r.id)
      const label = getShippingSummary({ shippingStatus: res.shipping_status, awb: res.awb }).shortBadge
      toast(`Status kurir diperbarui: ${label}${res.awb ? ` (${res.awb})` : ''}`)
      fetchShipments()
    } catch (error: any) {
      toast(error.message || 'Gagal menyinkronkan tracking kurir.', { tone: 'danger' })
    } finally {
      setSyncingId(null)
    }
  }

  const detailMeta = detailRow
    ? getShippingSummary({
        shippingStatus: detailRow.shipping_status,
        staffStatus: detailRow.status,
        awb: detailRow.awb,
      })
    : null

  return (
    <>
      <PageHead title="Antrian Pengiriman" sub="Pengiriman ekspedisi yang sudah dibayar penumpang dan diproses tim Logistik KAI." />
      <div className="mb-4 flex items-center gap-3 overflow-x-auto">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { v: 'Menunggu Resi', l: `Menunggu Resi (${count('Menunggu Resi')})` },
            { v: 'Dikemas', l: `Dikemas (${count('Dikemas')})` },
            { v: 'Dikirim', l: `Dikirim (${count('Dikirim')})` },
            { v: 'Bermasalah', l: `Kendala (${count('Bermasalah')})` },
            { v: 'Selesai', l: `Pengiriman Selesai (${count('Selesai')})` },
          ]}
        />
      </div>
      <Panel>
        {list.length === 0 ? (
          <EmptyState icon={Truck} title="Tidak ada pengiriman pada status ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f6fafc]">
                <tr>
                  {['No. Laporan', 'Penerima', 'Kurir', 'Tujuan', 'Dibayar', 'Status Kurir', 'Aksi'].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const meta = getShippingSummary({
                    shippingStatus: r.shipping_status,
                    staffStatus: r.status,
                    awb: r.awb,
                  })
                  const latestEvent =
                    r.tracking_history && r.tracking_history.length > 0
                      ? formatTrackingEvent(r.tracking_history[r.tracking_history.length - 1])
                      : null

                  return (
                    <tr key={r.no} className="border-t border-line hover:bg-tint/40">
                      <td className={td + ' whitespace-nowrap'}>
                        <p className="font-mono font-bold text-ink">{r.no}</p>
                        {r.item_name && <p className="max-w-[160px] truncate text-xs text-muted">{r.item_name}</p>}
                      </td>
                      <td className={td}>
                        <p className="font-semibold text-ink">{r.recipient}</p>
                        {r.recipient_phone && <p className="text-xs tabular-nums text-muted">{r.recipient_phone}</p>}
                      </td>
                      <td className={td}>
                        <p className="font-medium text-ink">{cleanCourierName(r.courier)}</p>
                        {typeof r.ongkir === 'number' && r.ongkir > 0 && (
                          <p className="text-xs font-semibold tabular-nums text-muted">{rupiah(r.ongkir)}</p>
                        )}
                      </td>
                      <td className={td + ' max-w-[200px]'}>
                        <p className="line-clamp-2 text-xs leading-4 text-ink">{r.dest}</p>
                      </td>
                      <td className={td + ' whitespace-nowrap text-muted'}>{r.paid}</td>
                      <td className={td + ' whitespace-nowrap'}>
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={meta.shortTone}>{meta.shortBadge}</Badge>
                          {r.awb && <span className="font-mono text-xs text-muted">{r.awb}</span>}
                          {latestEvent && (
                            <span className="max-w-[210px] truncate text-[11px] text-soft">{latestEvent.title}</span>
                          )}
                        </div>
                      </td>
                      <td className={td + ' whitespace-nowrap'}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" icon={Eye} onClick={() => setDetailNo(r.no)}>
                            Detail
                          </Button>
                          {r.status === 'Menunggu Resi' ? (
                            <Button size="sm" onClick={() => setOpen(r)}>
                              Buat Resi
                            </Button>
                          ) : r.status === 'Bermasalah' ? (
                            <>
                              <Button size="sm" variant="cta" onClick={() => setOpen(r)}>
                                Buat Ulang Resi
                              </Button>
                              {(r.biteship_order_id || r.biteship_tracking_id) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={RefreshCw}
                                  loading={syncingId === r.id}
                                  onClick={() => handleSyncTracking(r)}
                                >
                                  Sync
                                </Button>
                              )}
                            </>
                          ) : r.status === 'Dikemas' ? (
                            <>
                              <Button size="sm" variant="primary" onClick={() => handleMarkShipped(r)}>
                                Tandai Dikirim
                              </Button>
                              <Button size="sm" variant="success" onClick={() => handleMarkDelivered(r)}>
                                Konfirmasi Tiba
                              </Button>
                              {(r.biteship_order_id || r.biteship_tracking_id) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={RefreshCw}
                                  loading={syncingId === r.id}
                                  onClick={() => handleSyncTracking(r)}
                                >
                                  Sync
                                </Button>
                              )}
                            </>
                          ) : r.status === 'Dikirim' ? (
                            <>
                              <Button size="sm" variant="success" onClick={() => handleMarkDelivered(r)}>
                                Konfirmasi Tiba
                              </Button>
                              {(r.biteship_order_id || r.biteship_tracking_id) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={RefreshCw}
                                  loading={syncingId === r.id}
                                  onClick={() => handleSyncTracking(r)}
                                >
                                  Sync
                                </Button>
                              )}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Modal Detail & Prosedur Pengiriman (selaras tampilan pelanggan) */}
      <Modal
        open={!!detailRow && !!detailMeta}
        onClose={() => setDetailNo(null)}
        width="max-w-[680px]"
        title="Detail & Lacak Pengiriman"
        sub={detailRow ? `${detailRow.no}${detailRow.bast_code ? ` • ${detailRow.bast_code}` : ''} • ${detailRow.item_name || 'Barang Temuan'}` : ''}
        footer={
          detailRow && (
            <>
              {(detailRow.biteship_order_id || detailRow.biteship_tracking_id) && (
                <Button
                  variant="outline"
                  icon={RefreshCw}
                  loading={syncingId === detailRow.id}
                  onClick={() => handleSyncTracking(detailRow)}
                >
                  Sync Status Kurir
                </Button>
              )}
              {detailRow.awb && (
                <Button variant="outline" icon={Printer} onClick={() => printLabel(detailRow, detailRow.awb!)}>
                  Cetak Label PDF
                </Button>
              )}
              {(detailRow.status === 'Menunggu Resi' || detailRow.status === 'Bermasalah') && (
                <Button
                  variant="cta"
                  icon={Zap}
                  onClick={() => {
                    const target = detailRow
                    setDetailNo(null)
                    setOpen(target)
                  }}
                >
                  {detailRow.status === 'Bermasalah' ? 'Buat Ulang Resi' : 'Buat Resi'}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setDetailNo(null)}>
                Tutup
              </Button>
            </>
          )
        }
      >
        {detailRow && detailMeta && (
          <div className="flex flex-col gap-4">
            {/* Hero Status Card */}
            <section
              className={cx(
                'flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between',
                detailMeta.isIssue
                  ? 'border-[#f5c2bc] bg-[#fff5f4]'
                  : detailMeta.isShipHold
                    ? 'border-[#f3d9a4] bg-warn-soft'
                    : detailMeta.isDelivered
                      ? 'border-[#c6efd8] bg-mint'
                      : 'border-[#b9deec] bg-tint/70'
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cx(
                    'flex size-11 shrink-0 items-center justify-center rounded-full text-white',
                    detailMeta.isIssue
                      ? 'bg-danger'
                      : detailMeta.isShipHold
                        ? 'bg-warn'
                        : detailMeta.isDelivered
                          ? 'bg-success'
                          : 'bg-primary'
                  )}
                >
                  {detailMeta.isShipReturn ? (
                    <RotateCcw className="size-5" aria-hidden />
                  ) : detailMeta.isShipFailed || detailMeta.isShipHold ? (
                    <AlertCircle className="size-5" aria-hidden />
                  ) : detailMeta.isDelivered ? (
                    <Check className="size-6" strokeWidth={3} aria-hidden />
                  ) : (
                    <Truck className="size-5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">{detailMeta.heroTitle}</p>
                  <Badge tone={detailMeta.shortTone} className="mt-1 bg-white">
                    {detailMeta.heroBadge}
                  </Badge>
                </div>
              </div>
              {typeof detailRow.ongkir === 'number' && detailRow.ongkir > 0 && (
                <div className="text-left sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ongkir Terbayar</p>
                  <p className="text-lg font-extrabold tabular-nums text-ink">{rupiah(detailRow.ongkir)}</p>
                </div>
              )}
            </section>

            {/* 4-stage Shopee-style Milestone Progress Bar */}
            <section className="rounded-2xl border border-line bg-white p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Tahapan Pengiriman</p>
              <div className="relative grid grid-cols-4 gap-1" aria-label="Progres pengiriman">
                <div className="absolute left-[12.5%] right-[12.5%] top-3 h-0.5 bg-[#e1e8ed]" aria-hidden />
                <div
                  className="absolute left-[12.5%] top-3 h-0.5 bg-success transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, (detailMeta.milestoneDoneCount - (detailMeta.isDelivered ? 1 : 0)) / 3) * 75)}%`,
                  }}
                  aria-hidden
                />
                {SHIPPING_MILESTONES.map((label, idx) => {
                  const isDone = idx < detailMeta.milestoneDoneCount
                  const isCurr = idx === detailMeta.milestoneActiveIdx
                  const isErrorNode = detailMeta.isIssue && idx === 0
                  const isHoldNode = detailMeta.isShipHold && idx === 0
                  return (
                    <div key={label} className="relative z-10 flex flex-col items-center gap-1.5 text-center">
                      <span
                        className={cx(
                          'flex size-6 items-center justify-center rounded-full border-2',
                          isErrorNode
                            ? 'border-danger bg-danger text-white ring-4 ring-[#fde2e0]'
                            : isHoldNode
                              ? 'border-warn bg-warn text-white ring-4 ring-warn-soft'
                              : isDone
                                ? 'border-success bg-success text-white'
                                : isCurr
                                  ? 'border-primary bg-white ring-4 ring-tint'
                                  : 'border-[#c4d3db] bg-white'
                        )}
                      >
                        {isErrorNode ? (
                          <X className="size-3.5" strokeWidth={3} aria-hidden />
                        ) : isHoldNode ? (
                          <Clock className="size-3" strokeWidth={2.5} aria-hidden />
                        ) : isDone ? (
                          <Check className="size-3.5" strokeWidth={3} aria-hidden />
                        ) : isCurr ? (
                          <span className="size-2 rounded-full bg-primary" />
                        ) : null}
                      </span>
                      <span
                        className={cx(
                          'text-[11px]',
                          isErrorNode
                            ? 'font-bold text-danger'
                            : isHoldNode
                              ? 'font-bold text-warn'
                              : isDone || isCurr
                                ? 'font-bold text-ink'
                                : 'font-medium text-muted'
                        )}
                      >
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Metadata & Waybill Card */}
            <section className="rounded-2xl border border-line bg-[#f9fbfc] p-4">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 ring-1 ring-line">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Nomor Resi (AWB) • {cleanCourierName(detailRow.courier)}
                  </p>
                  <p className={cx('mt-0.5', detailRow.awb ? 'break-all font-mono text-sm font-bold text-ink' : 'text-xs font-semibold text-muted')}>
                    {detailRow.awb || 'Belum diterbitkan'}
                  </p>
                </div>
                {detailRow.awb && (
                  <Button
                    size="sm"
                    variant="tint"
                    icon={Copy}
                    onClick={() => {
                      navigator.clipboard?.writeText(detailRow.awb!)
                      toast('Nomor resi disalin.')
                    }}
                  >
                    Salin
                  </Button>
                )}
              </div>

              <div className="mt-3 grid gap-2.5 text-xs sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Package className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-muted">Barang & Penerima</p>
                    <p className="font-bold text-ink">{detailRow.item_name || 'Barang Temuan'}</p>
                    <p className="text-ink">{detailRow.recipient}</p>
                    {(() => {
                      const pkg = calcPackageMetrics({
                        weightGrams: detailRow.weight_grams,
                        lengthCm: detailRow.length_cm,
                        widthCm: detailRow.width_cm,
                        heightCm: detailRow.height_cm,
                      })
                      return (
                        <p className="mt-0.5 text-[11px] font-medium text-muted">
                          Berat {pkg.chargeableGrams.toLocaleString('id-ID')} g ({pkg.kgText} kg)
                          {pkg.dimensionsText ? ` • ${pkg.dimensionsText}` : ''}
                        </p>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-muted">Kontak & Order Ekspedisi</p>
                    <p className="font-semibold tabular-nums text-ink">{detailRow.recipient_phone || '-'}</p>
                    {detailRow.biteship_order_id && (
                      <p className="truncate font-mono text-[11px] text-muted">Order: {detailRow.biteship_order_id}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-muted">Alamat Pengiriman</p>
                    <p className="leading-4 text-ink">
                      {detailRow.dest}
                      {detailRow.destination_postal_code && !detailRow.dest.includes(detailRow.destination_postal_code)
                        ? ` (${detailRow.destination_postal_code})`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Shopee-style Vertical Tracking Timeline */}
            <section className="rounded-2xl border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Riwayat Perjalanan Paket</p>
                {detailRow.tracking_history && detailRow.tracking_history.length > 0 && (
                  <span className="text-[11px] font-semibold text-soft">{detailRow.tracking_history.length} pembaruan</span>
                )}
              </div>

              {detailRow.tracking_history && detailRow.tracking_history.length > 0 ? (
                <ol className="relative flex flex-col gap-4 pl-5">
                  <span aria-hidden className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-[#e3eaef]" />
                  {[...detailRow.tracking_history].reverse().map((h, idx) => {
                    const isLatest = idx === 0
                    const ev = formatTrackingEvent(h)
                    const dotClass =
                      ev.tone === 'danger'
                        ? isLatest
                          ? 'bg-danger ring-4 ring-[#fde2e0]'
                          : 'bg-danger/70'
                        : ev.tone === 'warn'
                          ? isLatest
                            ? 'bg-warn ring-4 ring-warn-soft'
                            : 'bg-warn/70'
                          : ev.tone === 'success'
                            ? isLatest
                              ? 'bg-success ring-4 ring-mint'
                              : 'bg-success/80'
                            : isLatest
                              ? 'bg-primary ring-4 ring-tint'
                              : 'bg-[#cbd7df]'
                    const titleClass =
                      ev.tone === 'danger'
                        ? 'text-danger'
                        : ev.tone === 'warn'
                          ? 'text-warn'
                          : ev.tone === 'success'
                            ? isLatest
                              ? 'text-success'
                              : 'text-ink'
                            : isLatest
                              ? 'text-primary-dark'
                              : 'text-ink'
                    return (
                      <li key={idx} className="relative flex flex-col gap-0.5">
                        <span aria-hidden className={cx('absolute -left-5 top-1 size-3.5 rounded-full border-2 border-white', dotClass)} />
                        <p className={cx('text-xs font-bold leading-4', titleClass)}>{ev.title}</p>
                        {ev.desc && <p className="text-[11px] leading-4 text-muted">{ev.desc}</p>}
                        {h.updated_at && (
                          <p className="text-[11px] tabular-nums text-soft">{formatTrackingTimestamp(h.updated_at)}</p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="rounded-xl bg-field px-3 py-2.5 text-xs text-muted">
                  Menunggu pembaruan status dari kurir ekspedisi. Klik <span className="font-semibold text-ink">Buat Resi</span> atau{' '}
                  <span className="font-semibold text-ink">Sync Status Kurir</span> jika resi sudah terbit.
                </p>
              )}
            </section>
          </div>
        )}
      </Modal>

      <Modal
        open={!!open}
        onClose={close}
        title="Buat Nomor Resi"
        sub={open ? `${open.no} • ${open.recipient} • ${cleanCourierName(open.courier)}` : ''}
        footer={
          <Button variant="ghost" onClick={close}>
            Tutup
          </Button>
        }
      >
        {awb ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-mint p-4">
            <Badge tone="success" className="self-start bg-white">
              Resi Terbit
            </Badge>
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 break-all font-mono text-lg font-bold text-ink">{awb}</p>
              <Button
                size="sm"
                variant="tint"
                className="shrink-0"
                icon={Copy}
                onClick={() => {
                  navigator.clipboard?.writeText(awb)
                  toast('Nomor resi disalin.')
                }}
              >
                Salin
              </Button>
            </div>
            {open && (
              <Button variant="outline" icon={Printer} onClick={() => printLabel(open, awb)}>
                Cetak Label Barcode PDF
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button variant="cta" size="lg" icon={Zap} loading={busy} onClick={handleGenerateAwb}>
              {busy ? 'Menghubungi API Kurir...' : 'Generate Nomor Resi Otomatis via API Kurir'}
            </Button>
            <Button variant="outline" icon={Printer} disabled>
              Cetak Label Barcode PDF
            </Button>
            {err && (
              <Banner tone="danger" icon={AlertCircle}>
                {err}
              </Banner>
            )}
            <div className="my-2 flex items-center gap-3 text-xs font-bold uppercase text-soft" aria-hidden>
              <span className="h-px flex-1 bg-line" /> atau <span className="h-px flex-1 bg-line" />
            </div>
            <Field label="Masukkan Nomor Resi Manual (AWB)" error={manualErr}>
              {(a) => (
                <div className="flex gap-2">
                  <input
                    {...a}
                    value={manual}
                    onChange={(e) => setManual(e.target.value.toUpperCase())}
                    placeholder="Nomor resi dari kurir (contoh: KALOG-12345678ID)"
                    className={inputCls(!!manualErr) + ' h-11 font-mono'}
                  />
                  <Button
                    variant="primary"
                    disabled={manual.length < 6 || busy}
                    loading={busy}
                    onClick={handleSaveManualAwb}
                  >
                    Simpan
                  </Button>
                </div>
              )}
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}
