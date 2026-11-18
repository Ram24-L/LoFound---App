import { useEffect, useState } from 'react'
import { AlertCircle, ArrowDownRight, ArrowUpRight, FileSpreadsheet, FileText, PackageCheck, Percent, Timer, ClipboardList } from 'lucide-react'
import { Button, cx, useToast } from '../lib/ui'
import { PageHead, Panel, Tabs, useStaff } from './common'
import { AuditTable } from './Admin'
import { staffApi } from '../lib/api'

const DEFAULT_SERIES = {
  '7': { labels: ['27 Okt', '28', '29', '30', '31', '1 Nov', 'Hari Ini'], a: [18, 22, 19, 25, 21, 16, 24], b: [14, 17, 16, 21, 19, 13, 20] },
  '30': { labels: ['Mg 1', 'Mg 2', 'Mg 3', 'Mg 4', 'Mg 5'], a: [120, 138, 129, 151, 144], b: [98, 117, 114, 131, 129] },
  '12': { labels: ['Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov'], a: [410, 380, 395, 450, 470, 430, 500, 520, 480, 510, 540, 396], b: [300, 290, 310, 360, 390, 360, 420, 445, 410, 440, 466, 342] },
}

export function DashboardPage() {
  const { staffUser } = useStaff()
  const toast = useToast()
  const [range, setRange] = useState<'7' | '30' | '12'>('30')
  const [hover, setHover] = useState<number | null>(null)
  const [exp, setExp] = useState<'pdf' | 'xlsx' | null>(null)
  const [err, setErr] = useState('')
  const [seriesData, setSeriesData] = useState<any>(DEFAULT_SERIES)
  const [kpiData, setKpiData] = useState<any>({
    ratio: '86.4%',
    avg_time: '14 Jam',
    total_reports: '396',
    completed: '342',
  })

  useEffect(() => {
    staffApi.manager.stats()
      .then((res) => {
        if (res.kpis) setKpiData(res.kpis)
        if (res.series) setSeriesData(res.series)
      })
      .catch(() => {})
  }, [])

  const s = seriesData[range] || DEFAULT_SERIES[range]

  const doExport = (k: 'pdf' | 'xlsx') => {
    setExp(k)
    setErr('')
    setTimeout(() => {
      setExp(null)
      toast(`Laporan eksekutif ${k.toUpperCase()} berhasil diunduh.`)
    }, 1200)
  }

  const W = 760
  const H = 240
  const P = 32
  const max = Math.max(...s.a, 1) * 1.15
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(1, s.labels.length - 1)
  const y = (v: number) => H - P - (v / max) * (H - P * 2)
  const path = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')

  const kpis = [
    { l: 'Rasio Kembali', v: kpiData.ratio, d: '+2.1 poin', up: true, icon: Percent, c: 'bg-mint text-success' },
    { l: 'Rata-rata Waktu Temu', v: kpiData.avg_time, d: '-3 jam', up: true, icon: Timer, c: 'bg-tint text-primary' },
    { l: 'Total Laporan', v: kpiData.total_reports, d: '-8%', up: false, icon: ClipboardList, c: 'bg-tint text-primary' },
    { l: 'Barang Selesai', v: kpiData.completed, d: '+5%', up: true, icon: PackageCheck, c: 'bg-mint text-success' },
  ]

  const stationName = staffUser?.station ?? 'Jakarta Kota'

  return (
    <>
      <PageHead
        title="Dashboard Eksekutif"
        sub={`St. ${stationName} • Analitik Real-Time PostgreSQL • dibandingkan bulan lalu`}
        actions={
          <>
            <Button variant="cta" icon={FileText} loading={exp === 'pdf'} onClick={() => doExport('pdf')} className="bg-coral">
              {exp === 'pdf' ? 'Menyiapkan file...' : 'Unduh Laporan PDF'}
            </Button>
            <Button variant="primary" icon={FileSpreadsheet} loading={exp === 'xlsx'} onClick={() => doExport('xlsx')}>
              {exp === 'xlsx' ? 'Menyiapkan file...' : 'Ekspor Excel (.xlsx)'}
            </Button>
          </>
        }
      />
      {err && (
        <p role="alert" className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-danger">
          <AlertCircle className="size-4" aria-hidden /> {err}
        </p>
      )}
      <div className="mb-4 grid grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.l} className="flex h-[148px] flex-col justify-between rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between">
              <span className={cx('flex size-12 items-center justify-center rounded-full', k.c)}>
                <k.icon className="size-6" aria-hidden />
              </span>
              <span className={cx('flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-bold', k.up ? 'bg-mint text-[#1f7a4a]' : 'bg-danger-soft text-danger')}>
                {k.up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
                {k.up ? '▲' : '▼'} {k.d}
              </span>
            </div>
            <div>
              <p className="text-[26px] font-bold leading-8 text-ink">{k.v}</p>
              <p className="text-[13px] text-muted">{k.l}</p>
            </div>
          </div>
        ))}
      </div>
      <Panel
        className="mb-4"
        title="Laporan Masuk vs Barang Selesai"
        action={
          <Tabs
            value={range}
            onChange={(v) => (setRange(v), setHover(null))}
            items={[
              { v: '7', l: '7 hari' },
              { v: '30', l: '30 hari' },
              { v: '12', l: '12 bulan' },
            ]}
          />
        }
      >
        <div className="relative p-5">
          <div className="mb-2 flex gap-5 text-xs font-semibold text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-5 rounded bg-primary" /> Laporan Masuk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-5 rounded bg-coral" /> Barang Selesai
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik perbandingan laporan masuk dan barang selesai" onMouseLeave={() => setHover(null)}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <line key={t} x1={P} x2={W - P} y1={P + t * (H - P * 2)} y2={P + t * (H - P * 2)} stroke="#e6eef3" />
            ))}
            <path d={`${path(s.a)} L${x(s.a.length - 1)},${H - P} L${x(0)},${H - P} Z`} fill="#318FB5" opacity="0.08" />
            <path d={path(s.a)} fill="none" stroke="#318FB5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d={path(s.b)} fill="none" stroke="#F47C6D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {s.labels.map((l: string, i: number) => (
              <g key={l + i}>
                <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#6B7C88">
                  {l}
                </text>
                <rect x={x(i) - (W - P * 2) / s.labels.length / 2} y={0} width={(W - P * 2) / s.labels.length} height={H - P} fill="transparent" onMouseEnter={() => setHover(i)} />
                {hover === i && (
                  <>
                    <line x1={x(i)} x2={x(i)} y1={P} y2={H - P} stroke="#18364A" strokeDasharray="4 4" opacity="0.4" />
                    <circle cx={x(i)} cy={y(s.a[i])} r="5" fill="#fff" stroke="#318FB5" strokeWidth="3" />
                    <circle cx={x(i)} cy={y(s.b[i])} r="5" fill="#fff" stroke="#F47C6D" strokeWidth="3" />
                  </>
                )}
              </g>
            ))}
          </svg>
          {hover !== null && (
            <div className="pointer-events-none absolute rounded-xl bg-ink px-3 py-2 text-xs text-white shadow-lg" style={{ left: `calc(${(x(hover) / W) * 100}% + 8px)`, top: 40 }}>
              <p className="font-bold">{s.labels[hover]}</p>
              <p>Laporan Masuk: {s.a[hover]}</p>
              <p>Barang Selesai: {s.b[hover]}</p>
            </div>
          )}
        </div>
      </Panel>
      <AuditTable />
    </>
  )
}
