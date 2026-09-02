export const PLAN_STATUS_TEXT: Record<string, string> = {
  ACTIVE: '待执行',
  PAUSED: '已暂停',
  RUNNING: '运行中',
  CANCELLED: '已取消',
  FINISHED: '已完成',
  FAILED: '失败',
}

export const RUN_STATUS_TEXT: Record<string, string> = {
  GENERATING: '生成中',
  REVIEWING: '审核中',
  PUBLISHING: '发布中',
  SUCCEEDED: '成功',
  FAILED: '失败',
  REVIEW_REJECTED: '审核拒绝',
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
  0: '草稿',
  1: '已发布',
  [-1]: '回收站',
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
