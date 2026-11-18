/**
 * Real client-side PDF, Excel (.xlsx/.csv), and PNG Ticket generator for LoFound.
 * Zero external dependencies — generates valid PDF 1.4 documents, SpreadsheetML Excel files, and Canvas PNGs.
 */

function sanitizePdfText(str: string): string {
  return String(str ?? '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

export function downloadPdfDocument(opts: {
  filename: string
  title: string
  subtitle: string
  badge?: string
  rows: Array<[string, string]>
  footerNote?: string
  tableHeaders?: string[]
  tableRows?: string[][]
}) {
  const lines: string[] = []

  // Header Banner (#18364A)
  lines.push('0.094 0.212 0.290 rg')
  lines.push('40 740 515 62 re f')

  // Brand & Title in White
  lines.push('1 1 1 rg')
  lines.push('BT /F2 18 Tf 56 776 Td (' + sanitizePdfText(opts.title) + ') Tj ET')
  lines.push('BT /F1 10 Tf 56 756 Td (' + sanitizePdfText(opts.subtitle) + ') Tj ET')

  if (opts.badge) {
    lines.push('0.220 0.698 0.435 rg')
    lines.push('430 758 110 26 re f')
    lines.push('1 1 1 rg')
    lines.push('BT /F2 10 Tf 442 767 Td (' + sanitizePdfText(opts.badge) + ') Tj ET')
  }

  let y = 710

  // Key-Value rows
  for (const [k, v] of opts.rows) {
    lines.push('0.945 0.965 0.976 rg')
    lines.push(`40 ${y - 6} 515 24 re f`)
    lines.push('0.420 0.486 0.533 rg')
    lines.push(`BT /F1 10 Tf 52 ${y} Td (${sanitizePdfText(k)}) Tj ET`)
    lines.push('0.094 0.212 0.290 rg')
    lines.push(`BT /F2 10 Tf 210 ${y} Td (${sanitizePdfText(v)}) Tj ET`)
    y -= 28
  }

  // Optional Table
  if (opts.tableHeaders && opts.tableRows && opts.tableRows.length > 0) {
    y -= 10
    lines.push('0.192 0.561 0.710 rg')
    lines.push(`40 ${y - 6} 515 22 re f`)
    lines.push('1 1 1 rg')
    const colW = Math.floor(500 / opts.tableHeaders.length)
    opts.tableHeaders.forEach((h, idx) => {
      lines.push(`BT /F2 9 Tf ${48 + idx * colW} ${y} Td (${sanitizePdfText(h)}) Tj ET`)
    })
    y -= 24

    for (const r of opts.tableRows.slice(0, 18)) {
      if (y < 70) break
      lines.push('0.094 0.212 0.290 rg')
      r.forEach((cell, idx) => {
        lines.push(`BT /F1 8 Tf ${48 + idx * colW} ${y} Td (${sanitizePdfText(cell).slice(0, 28)}) Tj ET`)
      })
      lines.push('0.88 0.91 0.93 RG 0.5 w')
      lines.push(`40 ${y - 5} m 555 ${y - 5} l S`)
      y -= 18
    }
  }

  // Footer
  if (opts.footerNote) {
    lines.push('0.420 0.486 0.533 rg')
    lines.push(`BT /F1 9 Tf 40 42 Td (${sanitizePdfText(opts.footerNote)}) Tj ET`)
  }

  const streamContent = lines.join('\n')

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj',
    `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += obj + '\n'
  }
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  const blob = new Blob([pdf], { type: 'application/pdf' })
  triggerDownload(blob, opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`)
}

export function downloadExcelFile(opts: {
  filename: string
  sheetName?: string
  headers: string[]
  rows: Array<Array<string | number>>
}) {
  const esc = (v: string | number) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const headerCells = opts.headers
    .map((h) => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${esc(h)}</Data></Cell>`)
    .join('')

  const bodyRows = opts.rows
    .map(
      (r) =>
        `<Row>${r
          .map((c) => {
            const isNum = typeof c === 'number'
            return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${esc(c)}</Data></Cell>`
          })
          .join('')}</Row>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="sHeader">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#18364A" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${esc(opts.sheetName || 'Laporan LoFound')}">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  triggerDownload(blob, opts.filename)
}

export function downloadTicketImage(opts: {
  filename: string
  bastCode: string
  qrCode: string
  owner: string
  item: string
  route: string
  date: string
}) {
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 960
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background
  ctx.fillStyle = '#E3EEF4'
  ctx.fillRect(0, 0, 720, 960)

  // Card
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(48, 48, 624, 864)

  // Header
  ctx.fillStyle = '#18364A'
  ctx.fillRect(48, 48, 624, 96)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(`TIKET BAST DIGITAL #${opts.bastCode}`, 80, 106)

  // Details
  ctx.fillStyle = '#18364A'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText('LoFound - KAI Commuter Lost & Found', 80, 195)

  const fields: Array<[string, string]> = [
    ['Pemilik', opts.owner],
    ['Barang', opts.item],
    ['Rute & Posko', opts.route],
    ['Tanggal', opts.date],
    ['Kode QR / BAST', opts.qrCode],
    ['Status', '100% VALID - DISETUJUI CS'],
  ]

  let y = 250
  for (const [k, v] of fields) {
    ctx.fillStyle = '#6B7C88'
    ctx.font = '16px sans-serif'
    ctx.fillText(k, 80, y)
    ctx.fillStyle = '#18364A'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText(String(v).slice(0, 42), 80, y + 28)
    y += 74
  }

  // Footer box
  ctx.fillStyle = '#EAF6EE'
  ctx.fillRect(80, 740, 560, 110)
  ctx.fillStyle = '#1F7A4A'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(`KODE SERAH TERIMA: ${opts.qrCode}`, 110, 790)
  ctx.font = '15px sans-serif'
  ctx.fillText('Tunjukkan tiket ini beserta KTP asli kepada Petugas Posko CS.', 110, 822)

  canvas.toBlob((blob) => {
    if (blob) triggerDownload(blob, opts.filename.endsWith('.png') ? opts.filename : `${opts.filename}.png`)
  }, 'image/png')
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
