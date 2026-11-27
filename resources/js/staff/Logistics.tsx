import { useEffect, useState } from 'react'
import { AlertCircle, Copy, Printer, Truck, Zap } from 'lucide-react'
import { SHIPMENTS, type Shipment } from '../lib/data'
import { Badge, Banner, Button, EmptyState, Field, inputCls, useToast } from '../lib/ui'
import { Modal, PageHead, Panel, Tabs, td, th } from './common'
import { staffApi } from '../lib/api'
import { downloadPdfDocument } from '../lib/export'

export function ShippingQueuePage() {
  const toast = useToast()
  const [rows, setRows] = useState<any[]>(SHIPMENTS)
  const [tab, setTab] = useState<Shipment['status']>('Menunggu Resi')
  const [open, setOpen] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [manual, setManual] = useState('')
  const [manualErr, setManualErr] = useState('')
  const [awb, setAwb] = useState('')

  const fetchShipments = () => {
    staffApi.logistics.inventory()
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

  const close = () => {
    setOpen(null)
    setErr('')
    setManual('')
    setManualErr('')
    setAwb('')
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
      toast('Resi dibuat otomatis dan tersimpan ke PostgreSQL. Penumpang telah dikabari.')
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

  const handleMarkShipped = async (r: any) => {
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

  const handleMarkDelivered = async (r: any) => {
    try {
      const bastId = r.id ?? 1
      await staffApi.logistics.shipOrder(bastId, r.awb || 'KALOG-RESISYSTEM', 'delivered')
      setRows((rs) => rs.map((x) => (x.no === r.no ? { ...x, status: 'Selesai' } : x)))
      toast('Simulasi selesai: Pesanan telah tiba di tujuan. Status laporan penumpang berubah menjadi Sudah Kembali!')
      fetchShipments()
    } catch (error: any) {
      toast(error.message || 'Gagal menyelesaikan pesanan.', { tone: 'danger' })
    }
  }

  const handleSyncTracking = async (r: any) => {
    try {
      const res = await staffApi.logistics.syncTracking(r.id)
      toast(`Status kurir diperbarui: ${res.shipping_status}${res.awb ? ` (${res.awb})` : ''}`)
      fetchShipments()
    } catch (error: any) {
      toast(error.message || 'Gagal menyinkronkan tracking Biteship.', { tone: 'danger' })
    }
  }

  return (
    <>
      <PageHead title="Antrian Pengiriman" sub="Pengiriman ekspedisi yang sudah dibayar penumpang dan diproses tim Logistik KAI." />
      <div className="mb-4 flex items-center gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { v: 'Menunggu Resi', l: `Menunggu Resi (${count('Menunggu Resi')})` },
            { v: 'Dikemas', l: `Dikemas (${count('Dikemas')})` },
            { v: 'Dikirim', l: `Dikirim (${count('Dikirim')})` },
            { v: 'Selesai', l: `Tiba di Tujuan (${count('Selesai')})` },
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
                  {['No. Laporan', 'Penerima', 'Kurir', 'Tujuan', 'Dibayar', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.no} className="border-t border-line hover:bg-tint/40">
                    <td className={td + ' whitespace-nowrap font-mono font-bold'}>{r.no}</td>
                    <td className={td}>{r.recipient}</td>
                    <td className={td}>{r.courier}</td>
                    <td className={td}>{r.dest}</td>
                    <td className={td + ' whitespace-nowrap text-muted'}>{r.paid}</td>
                    <td className={td + ' whitespace-nowrap'}>
                      <Badge tone={r.status === 'Menunggu Resi' ? 'warn' : r.status === 'Dikemas' ? 'info' : 'success'}>
                        {r.status === 'Selesai' ? 'Tiba di Tujuan' : r.status}
                      </Badge>
                      {r.awb && <span className="ml-2 font-mono text-xs text-muted">{r.awb}</span>}
                    </td>
                    <td className={td + ' whitespace-nowrap'}>
                      {r.status === 'Menunggu Resi' ? (
                        <Button size="sm" onClick={() => setOpen(r)}>
                          Buat Resi
                        </Button>
                      ) : r.status === 'Dikemas' ? (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="primary" onClick={() => handleMarkShipped(r)}>
                            Tandai Dikirim
                          </Button>
                          <Button size="sm" variant="success" onClick={() => handleMarkDelivered(r)}>
                            Simulasi Tiba
                          </Button>
                          {(r.biteship_order_id || r.biteship_tracking_id) && (
                            <Button size="sm" variant="outline" onClick={() => handleSyncTracking(r)}>
                              Sync Kurir
                            </Button>
                          )}
                        </div>
                      ) : r.status === 'Dikirim' ? (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="success" onClick={() => handleMarkDelivered(r)}>
                            Simulasi Pesanan Tiba (Selesai)
                          </Button>
                          {(r.biteship_order_id || r.biteship_tracking_id) && (
                            <Button size="sm" variant="outline" onClick={() => handleSyncTracking(r)}>
                              Sync Kurir
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Badge tone="success">Selesai Diterima</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={!!open}
        onClose={close}
        title="Buat Nomor Resi"
        sub={open ? `${open.no} • ${open.recipient} • ${open.courier}` : ''}
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
            <Button
              variant="outline"
              icon={Printer}
              onClick={() => {
                downloadPdfDocument({
                  filename: `Label_Pengiriman_${awb}.pdf`,
                  title: `LABEL PENGIRIMAN EKSPEDISI #${awb}`,
                  subtitle: 'LoFound Logistik - KAI Commuter Lost & Found',
                  badge: 'SIAP KIRIM',
                  rows: [
                    ['Nomor Resi (AWB)', awb],
                    ['Nomor Laporan', open?.no || '-'],
                    ['Nama Penerima', open?.recipient || '-'],
                    ['Jasa Kurir', open?.courier || 'KAI Logistik Express'],
                    ['Alamat Tujuan', open?.dest || '-'],
                    ['Status Ongkir', `LUNAS (${open?.paid || '-'})`],
                  ],
                  footerNote: 'Tempelkan label ini pada paket barang temuan sebelum diserahkan ke kurir ekspedisi.',
                })
                toast(`Label_Pengiriman_${awb}.pdf berhasil diunduh.`)
              }}
            >
              Cetak Label Barcode PDF
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button
              variant="cta"
              size="lg"
              icon={Zap}
              loading={busy}
              onClick={handleGenerateAwb}
            >
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
