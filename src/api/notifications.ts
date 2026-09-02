import { request } from './http'

export type NotificationItem = {
  id: number
  type: string
  title: string
  message: string | null
  planId: number | null
  runId: number | null
  isRead: boolean
  createdAt: string
}

export type NotificationListResult = {
  records: NotificationItem[]
  total: number
  unreadCount: number
}

const toQuery = (params: Record<string, number>) =>
  `?${Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&')}`

export const notificationsApi = {
  list: ({ page = 1, size = 20 }: { page?: number; size?: number } = {}) =>
    request<NotificationListResult>(`/api/notifications${toQuery({ page, size })}`),
  unreadCount: () => request<number>('/api/notifications/unread-count'),
  markRead: (id: number) => request<void>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request<void>('/api/notifications/read-all', { method: 'PATCH' }),
}
