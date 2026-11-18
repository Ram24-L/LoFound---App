import { createContext, useContext } from 'react'
import type { Report } from '../lib/data'
import type { AuthUser } from '../lib/api'

export type RouteName =
  | 'home'
  | 'auth'
  | 'reports'
  | 'wizard'
  | 'wizardSuccess'
  | 'detail'
  | 'edit'
  | 'tracking'
  | 'candidates'
  | 'claim'
  | 'bast'
  | 'shipping'
  | 'notifications'
  | 'profile'
  | 'help'
  | 'system'

export type Route = { name: RouteName; params?: Record<string, any>; key: number }
export type User = AuthUser

export type Draft = {
  items: { name: string; category: string; color: string }[]
  from: string
  to: string
  date: string
  time: string
  position: string
  secret: string
  photo?: string
  notify: boolean
  step: 1 | 2
  savedAt: string
}

export type PassengerCtx = {
  route: Route
  go: (name: RouteName, params?: Record<string, any>) => void
  replace: (name: RouteName, params?: Record<string, any>) => void
  back: () => void
  tab: (name: 'home' | 'reports' | 'profile') => void
  user: User | null
  login: (u?: Partial<User>) => void
  logout: () => void
  requireAuth: (reason: string, intent: () => void, successMsg?: string) => void
  reports: Report[]
  setReports: React.Dispatch<React.SetStateAction<Report[]>>
  updateReport: (id: string, patch: Partial<Report> | ((r: Report) => Partial<Report>)) => void
  draft: Draft | null
  setDraft: (d: Draft | null) => void
  unread: number
  setUnread: (n: number) => void
  expireSession: () => void
  loading: boolean
  refreshReports: () => Promise<void>
}

export const Ctx = createContext<PassengerCtx>(null as unknown as PassengerCtx)
export const useApp = () => useContext(Ctx)
