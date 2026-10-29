import { t } from '@/i18n'
export const PLAN_STATUS_TEXT: Record<string, string> = {
  get ACTIVE() {
    return t('ui.pending')
  },
  get PAUSED() {
    return t('ui.paused')
  },
  get RUNNING() {
    return t('ui.runningLabel')
  },
  get CANCELLED() {
    return t('ui.cancelled')
  },
  get FINISHED() {
    return t('ui.completedLabel')
  },
  get FAILED() {
    return t('ui.failed')
  },
}

export const RUN_STATUS_TEXT: Record<string, string> = {
  get GENERATING() {
    return t('ui.generating')
  },
  get REVIEWING() {
    return t('ui.reviewing')
  },
  get PUBLISHING() {
    return t('ui.publishing')
  },
  get SUCCEEDED() {
    return t('ui.succeeded')
  },
  get FAILED() {
    return t('ui.failed')
  },
  get REVIEW_REJECTED() {
    return t('ui.reviewRejected')
  },
}

export const PLAN_STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'badge-green',
  PAUSED: 'badge-yellow',
  RUNNING: 'badge-blue',
  CANCELLED: 'badge-gray',
  FINISHED: 'badge-purple',
  FAILED: 'badge-red',
}

export const RUN_STATUS_CLASS: Record<string, string> = {
  GENERATING: 'badge-blue',
  REVIEWING: 'badge-blue',
  PUBLISHING: 'badge-blue',
  SUCCEEDED: 'badge-green',
  FAILED: 'badge-red',
  REVIEW_REJECTED: 'badge-yellow',
}

export const BLOG_STATUS_TEXT: Record<number, string> = {
  get 0() {
    return t('ui.draft')
  },
  get 1() {
    return t('ui.published')
  },
  get [-1]() {
    return t('ui.trash')
  },
}

/** 后端 UTC Instant（如 2026-08-17T02:00:00Z）转本地可读时间 */
export function formatInstant(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}
