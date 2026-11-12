import { t } from '@/i18n'
import { request, requestEventStream, uploadFile } from './http'
import type { AgentStreamEvent } from './agentSocket'
import { getLocale, getReplyLanguage } from '@/i18n'

export type AgentAttachment = {
  url: string
  name: string
  contentType: string
  size: number
}

export type ConversationStatus = 'ready' | 'running' | 'failed' | 'awaiting_approval'

export type AgentConversation = {
  id: number
  userId: number
  title: string
  status: ConversationStatus
  errorMessage?: string | null
  runVersion?: number | null
  cancelRequested?: number
  isPinned?: number
  lastReadAt?: string | null
  lastCompletedAt?: string | null
  shareToken?: string | null
  createdAt: string
  updatedAt: string
}

export type AgentMessage = {
  id: number
  conversationId: number
  role: 'user' | 'assistant' | 'tool'
  kind: 'message' | 'thought' | 'answer' | 'tool_call' | 'tool_result'
  toolName?: string | null
  content: string
  attachments?: AgentAttachment[]
  createdAt: string
}

export type ConversationSnapshot = {
  conversation: AgentConversation
  messages: AgentMessage[]
}

/** 新消息直接读取 SSE；恢复已有轮次时用 WebSocket 重放持久化事件。 */

export const agentApi = {
  uploadAttachment: (filePath: string) =>
    uploadFile<AgentAttachment>('/api/agent/conversations/attachments', filePath),
  listConversations: async (): Promise<AgentConversation[]> => {
    const result = await request<AgentConversation[] | { items: AgentConversation[] }>(
      '/api/agent/conversations',
      { method: 'GET' },
    )
    if (Array.isArray(result)) return result
    if (Array.isArray(result?.items)) return result.items
    throw new Error(t('ui.invalidConversationListResponse'))
  },
  listConversationPage: async (page = 1, search = '') => {
    const result = await request<
      AgentConversation[] | { items: AgentConversation[]; hasMore: boolean }
    >(`/api/agent/conversations?page=${page}&size=20&search=${encodeURIComponent(search)}`)
    if (Array.isArray(result)) return { items: result, hasMore: false }
    if (!Array.isArray(result?.items)) throw new Error(t('ui.invalidConversationListResponse'))
    return { items: result.items, hasMore: Boolean(result.hasMore) }
  },
  setPinned: (id: number, pinned: boolean) =>
    request<AgentConversation>(`/api/agent/conversations/${id}/pin`, {
      method: pinned ? 'POST' : 'DELETE',
    }),
  markRead: (id: number) =>
    request<AgentConversation>(`/api/agent/conversations/${id}/read`, { method: 'POST' }),
  createConversation: (content: string) =>
    request<ConversationSnapshot>('/api/agent/conversations', {
      method: 'POST',
      data: { content },
    }),
  getConversation: (id: number) => request<ConversationSnapshot>(`/api/agent/conversations/${id}`),
  getMessages: (id: number) => request<AgentMessage[]>(`/api/agent/conversations/${id}/messages`),
  /** Start and consume the same SSE request; the first event is delivered before completion. */
  sendMessageStream: (
    id: number,
    content: string,
    attachments: AgentAttachment[] = [],
    onEvent: (event: AgentStreamEvent) => void,
  ) =>
    requestEventStream(
      `/api/agent/conversations/${id}/messages/stream`,
      {
        method: 'POST',
        data: { content, attachments, locale: getLocale(), replyLanguage: getReplyLanguage() },
      },
      onEvent,
    ),
  cancel: (id: number) =>
    request<AgentConversation>(`/api/agent/conversations/${id}/cancel`, { method: 'POST' }),
  share: (id: number) =>
    request<string>(`/api/agent/conversations/${id}/share`, { method: 'POST' }),
}
