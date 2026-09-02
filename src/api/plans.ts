import { request } from './http'

export type PlanStatus = 'ACTIVE' | 'PAUSED' | 'RUNNING' | 'CANCELLED' | 'FINISHED' | 'FAILED'
export type RunStatus =
  'GENERATING' | 'REVIEWING' | 'PUBLISHING' | 'SUCCEEDED' | 'FAILED' | 'REVIEW_REJECTED'
export type RunTrigger = 'SCHEDULED' | 'MANUAL'

export type Plan = {
  id: number
  topic: string
  topics: string[]
  nextTopicIndex?: number
  audience?: string | null
  tone?: string | null
  timezone: string
  triggerTime?: string | null
  triggerTimes: string[]
  syncCsdn: boolean
  syncJuejin: boolean
  runOnce: boolean
  nextRunAt?: string | null
  lastRunAt?: string | null
  status: PlanStatus
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  csdnAuthorized?: boolean
  juejinAuthorized?: boolean
}

export type PlanRun = {
  id: number
  planId: number
  scheduledAt?: string | null
  triggerType: RunTrigger
  status: RunStatus
  agentTaskId?: number | null
  localPostId?: number | null
  reviewPass?: boolean | null
  reviewReason?: string | null
  errorMessage?: string | null
  csdnStatus: string
  csdnUrl?: string | null
  juejinStatus: string
  juejinUrl?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt: string
}

export type PlanPage = {
  records: Plan[]
  total: number
  page: number
  size: number
}

export type PlanRunPage = {
  records: PlanRun[]
  total: number
  page: number
  size: number
}

export type PlanCreatePayload = {
  topic: string
  timezone?: string
  triggerTime?: string
  triggerTimes?: string[]
  topics?: string[]
  syncCsdn?: boolean
  syncJuejin?: boolean
  audience?: string
  tone?: string
}

export type PlanAiGeneratePayload = {
  topic: string
  days?: number
  time?: string
  timezone?: string
  syncCsdn?: boolean
  syncJuejin?: boolean
  audience?: string
  tone?: string
}

const toQuery = (params: Record<string, unknown>) => {
  const entries = Object.entries(params).filter(([, value]) => value !== '' && value != null)
  return entries.length
    ? `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')}`
    : ''
}

export const planApi = {
  list: (params: { page?: number; size?: number } = {}) =>
    request<PlanPage>(`/api/blog-plans${toQuery({ page: 1, size: 10, ...params })}`),
  get: (id: number) => request<Plan>(`/api/blog-plans/${id}`),
  create: (payload: PlanCreatePayload) =>
    request<Plan>('/api/blog-plans', { method: 'POST', data: payload }),
  update: (id: number, payload: PlanCreatePayload) =>
    request<Plan>(`/api/blog-plans/${id}`, { method: 'PATCH', data: payload }),
  updateStatus: (id: number, action: 'PAUSED' | 'RESUME' | 'CANCELLED') =>
    request<Plan>(`/api/blog-plans/${id}/status`, { method: 'PATCH', data: { action } }),
  delete: (id: number) => request<void>(`/api/blog-plans/${id}`, { method: 'DELETE' }),
  trigger: (id: number) => request<PlanRun>(`/api/blog-plans/${id}/trigger`, { method: 'POST' }),
  listRuns: (planId: number, params: { page?: number; size?: number } = {}) =>
    request<PlanRunPage>(
      `/api/blog-plans/${planId}/runs${toQuery({ page: 1, size: 10, ...params })}`,
    ),
  aiGenerate: (payload: PlanAiGeneratePayload) =>
    request<Plan[]>('/api/blog-plans/ai-generate', { method: 'POST', data: payload }),
}
