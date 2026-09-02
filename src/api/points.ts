import { request } from './http'

export type PointsOverview = {
  balance: number
  consumedToday: number
  enablePreCheck: boolean
}

export type PointsLedgerItem = {
  id: number
  delta: number
  direction: 'credit' | 'debit'
  amount: number
  reason?: string
  remark?: string
  createdAt: string
}

export type PointsLedgerPage = {
  records: PointsLedgerItem[]
  total: number
}

export const pointsApi = {
  overview: () => request<PointsOverview>('/api/points', { method: 'GET' }),
  ledger: (page = 1, size = 20) =>
    request<PointsLedgerPage>(`/api/points/ledger?page=${page}&size=${size}`),
}

/** Backend amounts are milli-points: 1 point = 1000 milli-points. */
export function formatPoints(milliPoints: number): string {
  const points = Number(milliPoints) / 1000
  return Number.isInteger(points) ? String(points) : points.toFixed(3).replace(/\.?0+$/, '')
}
