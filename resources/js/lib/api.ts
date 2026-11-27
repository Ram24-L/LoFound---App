/**
 * API client for LoFound Laravel backend.
 * Uses session-based auth (cookies) with CSRF token from XSRF-TOKEN cookie.
 */

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

const PASSENGER_TOKEN_KEY = 'lofound_passenger_token'
const STAFF_TOKEN_KEY = 'lofound_staff_token'

export function setTabToken(kind: 'passenger' | 'staff', token: string | null) {
  if (typeof window === 'undefined') return
  const key = kind === 'staff' ? STAFF_TOKEN_KEY : PASSENGER_TOKEN_KEY
  if (token) {
    window.sessionStorage.setItem(key, token)
    if (kind === 'passenger') {
      try {
        window.localStorage.setItem(key, token)
      } catch { }
    }
  } else {
    window.sessionStorage.removeItem(key)
    if (kind === 'passenger') {
      try {
        window.localStorage.removeItem(key)
      } catch { }
    }
  }
}

export function getTabToken(kind: 'passenger' | 'staff'): string | null {
  if (typeof window === 'undefined') return null
  const key = kind === 'staff' ? STAFF_TOKEN_KEY : PASSENGER_TOKEN_KEY
  const fromSession = window.sessionStorage.getItem(key)
  if (fromSession) return fromSession
  if (kind === 'passenger') {
    try {
      const fromLocal = window.localStorage.getItem(key)
      if (fromLocal) {
        window.sessionStorage.setItem(key, fromLocal)
        return fromLocal
      }
    } catch { }
  }
  return null
}

async function request<T = unknown>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  const metaCsrf = typeof document !== 'undefined'
    ? document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content
    : null
  if (metaCsrf) headers['X-CSRF-TOKEN'] = metaCsrf

  const xsrf = getCookie('XSRF-TOKEN')
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf

  const isStaffUrl = url.startsWith('/api/staff')
  const tabToken = getTabToken(isStaffUrl ? 'staff' : 'passenger')
  if (tabToken) {
    headers['X-Tab-Token'] = tabToken
  }

  const opts: RequestInit = {
    method,
    headers,
    credentials: 'same-origin',
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(url, opts)

  if (res.status === 419) {
    // CSRF token expired — refetch and retry once
    await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' }).catch(() => { })
    const retryXsrf = getCookie('XSRF-TOKEN')
    if (retryXsrf) headers['X-XSRF-TOKEN'] = retryXsrf
    const retry = await fetch(url, { ...opts, headers })
    if (!retry.ok) throw await parseError(retry)
    return retry.json()
  }

  if (!res.ok) throw await parseError(res)
  return res.json()
}

function sanitizeErrorMessage(raw: unknown, status: number): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    return status >= 500
      ? 'Terjadi gangguan pada server. Silakan coba beberapa saat lagi.'
      : 'Terjadi kesalahan. Silakan coba lagi.'
  }

  const looksTechnical =
    /SQLSTATE|PDOException|QueryException|Connection:\s*pgsql|insert\s+into|update\s+.*set|delete\s+from|select\s+.*from|stack trace|vendor\/laravel/i.test(raw) ||
    raw.length > 200

  if (looksTechnical) {
    return status >= 500
      ? 'Terjadi gangguan pada sistem saat memproses data. Silakan coba lagi.'
      : 'Permintaan tidak dapat diproses. Periksa kembali data Anda.'
  }

  return raw
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const json = await res.json()
    return {
      status: res.status,
      message: sanitizeErrorMessage(json.message || json.error, res.status),
      errors: json.errors,
    }
  } catch {
    return {
      status: res.status,
      message: res.status >= 500
        ? 'Terjadi gangguan pada server. Silakan coba beberapa saat lagi.'
        : 'Terjadi kesalahan jaringan.',
    }
  }
}

export type ApiError = {
  status: number
  message: string
  errors?: Record<string, string[]>
}

export const api = {
  get: <T = unknown>(url: string) => request<T>('GET', url),
  post: <T = unknown>(url: string, body?: unknown) => request<T>('POST', url, body),
  patch: <T = unknown>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: <T = unknown>(url: string) => request<T>('DELETE', url),
}

// ========================
// Typed endpoint helpers
// ========================

import type { Claim, InvItem, PackageSpecs, Report, Shipment, ShippingRateOption, TrackingHistoryEntry } from './data'

export type SavedAddress = {
  label?: string
  name: string
  wa: string
  addr: string
  city: string
  zip: string
}

export type AuthUser = {
  name: string
  full: string
  contact: string
  nik?: string | null
  address?: SavedAddress | null
}

export const authApi = {
  login: async (contact: string, password: string, remember = true) => {
    const res = await api.post<{ token?: string; user: AuthUser }>('/api/auth/login', { contact, password, remember })
    if (res.token) setTabToken('passenger', res.token)
    return res
  },
  register: async (name: string, contact: string, password: string, otp?: string) => {
    const res = await api.post<{ token?: string; user: AuthUser }>('/api/auth/register', { name, contact, password, otp })
    if (res.token) setTabToken('passenger', res.token)
    return res
  },
  sendOtp: async (contact: string, purpose?: 'login' | 'register') => {
    return api.post<{ sent: boolean; channel?: 'email' | 'whatsapp'; live?: boolean; expires_in: number; dev_otp?: string | null }>('/api/auth/otp/send', { contact, purpose })
  },
  logout: async () => {
    try {
      await api.post('/api/auth/logout')
    } finally {
      setTabToken('passenger', null)
    }
  },
  deleteAccount: async () => {
    const res = await api.delete<{ ok: boolean }>('/api/auth/account')
    setTabToken('passenger', null)
    return res
  },
  user: async () => {
    const res = await api.get<{ token?: string; user: AuthUser | null }>('/api/auth/user')
    if (res.token) setTabToken('passenger', res.token)
    return res
  },
  updateProfile: (data: { name?: string; nik?: string | null; address?: SavedAddress | null; password?: string }) =>
    api.patch<{ user: AuthUser }>('/api/auth/profile', data),
  transactions: () =>
    api.get<Array<{ id: number; bast_code: string; report_code: string; item: string; courier: string; amount: number; status: string; awb?: string; address?: string; date: string }>>('/api/transactions'),
  deleteTransaction: (id: number) =>
    api.delete<{ ok: boolean }>(`/api/transactions/${id}`),
}

export const homeApi = {
  stats: () => api.get<{ total: number; returned: number; ratio: number; in_progress: number }>('/api/home-stats'),
  feed: () => api.get<Array<{ cat: string; item: string; from: string; to: string; who: string; bast: string; when: string; line: string }>>('/api/home-feed'),
}

export const uploadApi = {
  upload: async (file: File, purpose: 'ktp' | 'general' = 'general') => {
    const buildHeaders = () => {
      const headers: Record<string, string> = { Accept: 'application/json' }
      const metaCsrf = typeof document !== 'undefined'
        ? document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content
        : null
      if (metaCsrf) headers['X-CSRF-TOKEN'] = metaCsrf
      const xsrf = getCookie('XSRF-TOKEN')
      if (xsrf) headers['X-XSRF-TOKEN'] = xsrf
      const isStaffPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/staff')
      const tabToken = isStaffPage
        ? (getTabToken('staff') || getTabToken('passenger'))
        : (getTabToken('passenger') || getTabToken('staff'))
      if (tabToken) headers['X-Tab-Token'] = tabToken
      return headers
    }

    const sendUpload = () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('purpose', purpose)
      return fetch('/api/upload', {
        method: 'POST',
        headers: buildHeaders(),
        credentials: 'same-origin',
        body: fd,
      })
    }

    let res = await sendUpload()
    if (res.status === 419) {
      await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' }).catch(() => { })
      res = await sendUpload()
    }
    if (!res.ok) throw await parseError(res)
    return res.json() as Promise<{ url: string; filename: string; size: string }>
  },
}

export const reportApi = {
  list: () => api.get<Report[]>('/api/reports'),
  create: (data: {
    items: { name: string; category: string; color: string }[]
    from: string; to: string; date: string; time: string
    position?: string; secret?: string; notify?: boolean; photo_url?: string
  }) => api.post<{ report: Report }>('/api/reports', data),
  checkDuplicate: (data: { from: string; to: string; date: string; time: string; category: string }) =>
    api.post<{ duplicate: boolean | Report | null; report?: Report | null }>('/api/reports/check-duplicate', data),
  update: (kode: string, data: Record<string, unknown>) =>
    api.patch<{ report: Report; changes: string[] }>(`/api/reports/${kode}`, data),
  cancel: (ids: string[], reason: string) =>
    api.post<{ cancelled: number }>('/api/reports/cancel', { ids, reason }),
  reactivate: (kode: string) =>
    api.post<{ report: Report }>(`/api/reports/${kode}/reactivate`),
  merge: (ids: [string, string]) =>
    api.post<{ report: Report }>('/api/reports/merge', { ids }),
  candidates: (kode: string) =>
    api.get<Array<{ id: string; cat: string; desc: string; found: string; posko: string; match: 'Tinggi' | 'Sedang' | 'Rendah' }>>(`/api/reports/${kode}/candidates`),
  claim: (kode: string, data: { candidates: string[]; answers: Record<string, string>; nik?: string; ktp_url?: string }) =>
    api.post<{ report: Report }>(`/api/reports/${kode}/claim`, data),
  bast: (kode: string, data: Record<string, unknown>) =>
    api.post<{
      bast: string
      qr: string
      order_id?: string
      payment_url?: string | null
      snap_token?: string | null
      midtrans_mode?: 'production' | 'sandbox' | 'simulation'
      report: Report
    }>(`/api/reports/${kode}/bast`, data),
  syncPayment: (kode: string) =>
    api.post<{
      payment_status: 'lunas' | 'pending' | 'gagal'
      transaction_status: string
      payment_type?: string | null
      message?: string
      report: Report
    }>(`/api/reports/${kode}/bast/sync-payment`),
  cancelPayment: (kode: string) =>
    api.post<{
      ok: boolean
      message?: string
      report: Report
    }>(`/api/reports/${kode}/bast/cancel-payment`),
  shippingRates: (postal_code: string, report_code?: string) =>
    api.post<{
      configured: boolean
      source: string
      origin?: { station_name: string; postal_code: string; address: string }
      package?: PackageSpecs
      couriers: ShippingRateOption[]
    }>(
      '/api/shipping/rates',
      { postal_code, ...(report_code ? { report_code } : {}) },
    ),
  syncShipping: (kode: string) =>
    api.post<{
      shipping_status: string
      awb?: string | null
      history: TrackingHistoryEntry[]
      report: Report
    }>(`/api/reports/${kode}/bast/sync-shipping`),
  notifications: () =>
    api.get<Array<{ id: number; report_id: string; title: string; body: string; t: string; unread: boolean }>>('/api/notifications'),
}

export type StaffUser = {
  id: number
  name: string
  email: string
  role: 'cs' | 'logistik' | 'admin' | 'manager' | 'debug'
  station: string
  initials: string
}

export const staffApi = {
  auth: {
    login: async (email: string, password: string) => {
      const res = await api.post<{ token?: string; user: StaffUser }>('/api/staff/auth/login', { email, password })
      if (res.token) setTabToken('staff', res.token)
      return res
    },
    logout: async () => {
      try {
        await api.post('/api/staff/auth/logout')
      } finally {
        setTabToken('staff', null)
      }
    },
    user: async () => {
      if (!getTabToken('staff')) return { user: null }
      const res = await api.get<{ token?: string; user: StaffUser | null }>('/api/staff/auth/user')
      if (res.token) setTabToken('staff', res.token)
      return res
    },
  },
  cs: {
    dashboard: () =>
      api.get<{
        inventory: InvItem[]
        claims: Claim[]
        counts: Record<string, number>
        pending_basts?: Array<{ kode: string; qr: string; report?: string; owner: string; item: string }>
      }>('/api/staff/cs/dashboard'),
    reports: (params?: { q?: string; cat?: string }) => {
      const sp = new URLSearchParams()
      if (params?.q) sp.set('q', params.q)
      if (params?.cat) sp.set('cat', params.cat)
      const q = sp.toString()
      return api.get<Array<{ id: string; who: string; desc: string; route: string; score: string }>>(`/api/staff/cs/reports${q ? '?' + q : ''}`)
    },
    storeFoundItem: (data: Record<string, unknown>) =>
      api.post<{ item: InvItem; matches: number }>('/api/staff/cs/found-items', data),
    updateFoundItem: (kode: string, data: Record<string, unknown>) =>
      api.patch<{ item: InvItem }>(`/api/staff/cs/found-items/${kode}`, data),
    changeStatus: (kode: string, status: string, reason?: string) =>
      api.post<{ item: InvItem }>(`/api/staff/cs/found-items/${kode}/status`, { status, reason }),
    manualMatch: (kode: string, reportKode: string) =>
      api.post<{ ok: boolean }>(`/api/staff/cs/found-items/${kode}/match`, { report_kode: reportKode }),
    verifyClaim: (id: number, data: { action: 'approve' | 'reject' | 'info'; note?: string; template?: string; message?: string }) =>
      api.post<{ claim?: Claim; bast?: string }>(`/api/staff/cs/claims/${id}/verify`, data),
    handover: (qrCode: string, confirm = false) =>
      api.post<{ result: string; message: string; bast?: any }>('/api/staff/cs/bast/handover', { qr_code: qrCode, confirm }),
  },
  logistics: {
    inventory: () =>
      api.get<{ shipments: Shipment[]; items: any[] }>('/api/staff/logistics/inventory'),
    updateItem: (id: number, data: Record<string, unknown>) =>
      api.patch<{ item: any }>(`/api/staff/logistics/found-items/${id}`, data),
    shipOrder: (id: number, awb: string, action: 'pack' | 'ship' | 'delivered') =>
      api.post<{ bast: any; status: string; awb: string; message: string }>(`/api/staff/logistics/shipments/${id}/ship`, { awb, action }),
    syncTracking: (id: number) =>
      api.post<{ ok: boolean; shipping_status: string; awb?: string | null; history: TrackingHistoryEntry[] }>(`/api/staff/logistics/shipments/${id}/sync-tracking`),
  },
  admin: {
    users: () => api.get<any[]>('/api/staff/admin/users'),
    storeUser: (data: { name: string; email: string; role: string; station?: string }) =>
      api.post<{ user: any }>('/api/staff/admin/users', data),
    updateUser: (id: number, data: { name?: string; station?: string; active?: boolean }) =>
      api.patch<{ ok: boolean }>(`/api/staff/admin/users/${id}`, data),
    categories: () => api.get<any[]>('/api/staff/admin/categories'),
    storeCategory: (data: { name: string; retention?: number; shippable?: boolean }) =>
      api.post<{ category: any }>('/api/staff/admin/categories', data),
    updateCategory: (id: number, data: { retention?: number; shippable?: boolean; active?: boolean; icon?: string }) =>
      api.patch<{ ok: boolean }>(`/api/staff/admin/categories/${id}`, data),
    deleteCategory: (id: number) =>
      api.delete<{ deleted: boolean; deactivated?: boolean }>(`/api/staff/admin/categories/${id}`),
    stations: () => api.get<any[]>('/api/staff/admin/stations'),
    storeStation: (data: { code: string; name: string; line: string; hours?: string; address?: string; postal_code?: string; phone?: string; active?: boolean }) =>
      api.post<{ station: any }>('/api/staff/admin/stations', data),
    updateStation: (id: number, data: { code?: string; name?: string; line?: string; hours?: string; address?: string; postal_code?: string; phone?: string; active?: boolean }) =>
      api.patch<{ station: any }>(`/api/staff/admin/stations/${id}`, data),
    deleteStation: (id: number) =>
      api.delete<{ deleted: boolean; deactivated?: boolean }>(`/api/staff/admin/stations/${id}`),
    auditLogs: (params?: { actor?: string; q?: string }) => {
      const sp = new URLSearchParams()
      if (params?.actor) sp.set('actor', params.actor)
      if (params?.q) sp.set('q', params.q)
      const q = sp.toString()
      return api.get<any[]>(`/api/staff/admin/audit-logs${q ? '?' + q : ''}`)
    },
  },
  manager: {
    stats: () =>
      api.get<{
        kpis: Record<string, string>
        series: Record<string, { labels: string[]; a: number[]; b: number[] }>
        export_rows?: Array<{ kode: string; tanggal: string; pelapor: string; kategori: string; barang: string; warna: string; rute: string; status: string }>
      }>('/api/staff/manager/stats'),
  },
}
