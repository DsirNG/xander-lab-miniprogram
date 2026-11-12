import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('./http', () => ({ request: vi.fn(), requestEventStream: vi.fn(), uploadFile: vi.fn() }))
vi.mock('@tarojs/taro', () => ({
  default: { getStorageSync: () => '', getSystemInfoSync: () => ({ language: 'zh' }) },
}))

import { request, requestEventStream } from './http'
import { agentApi } from './agent'
import { setLocale, setReplyLanguage } from '@/i18n'

beforeEach(() => vi.mocked(request).mockReset())

it('extracts conversations from the paginated API response', async () => {
  const items = [{ id: 1, title: 'Conversation' }]
  vi.mocked(request).mockResolvedValue({ items, page: 1, size: 20, hasMore: false })
  expect(await agentApi.listConversations()).toEqual(items)
})

it('supports the legacy array response', async () => {
  vi.mocked(request).mockResolvedValue([])
  expect(await agentApi.listConversations()).toEqual([])
})

it.each([null, {}, { items: {} }])('rejects an invalid response: %j', async result => {
  vi.mocked(request).mockResolvedValue(result)
  await expect(agentApi.listConversations()).rejects.toThrow('会话列表响应格式错误')
})

it('sends language preferences separately from the original message', async () => {
  setLocale('en')
  setReplyLanguage('auto')
  const content = 'Explain this 中文 identifier'
  const onEvent = vi.fn()
  agentApi.sendMessageStream(7, content, [], onEvent)
  expect(requestEventStream).toHaveBeenCalledWith(
    '/api/agent/conversations/7/messages/stream',
    {
      method: 'POST',
      data: { content, attachments: [], locale: 'en', replyLanguage: 'auto' },
    },
    onEvent,
  )
  setLocale('zh')
})

it('pins and unpins conversations using the existing server endpoints', async () => {
  vi.mocked(request).mockResolvedValue({ id: 7, isPinned: 1 })
  await agentApi.setPinned(7, true)
  expect(request).toHaveBeenLastCalledWith('/api/agent/conversations/7/pin', { method: 'POST' })
  await agentApi.setPinned(7, false)
  expect(request).toHaveBeenLastCalledWith('/api/agent/conversations/7/pin', { method: 'DELETE' })
})

it('supports paged server-side conversation search and read tracking', async () => {
  const items = [{ id: 3, title: 'Pinned', isPinned: 1 }]
  vi.mocked(request).mockResolvedValue({ items, hasMore: true })
  expect(await agentApi.listConversationPage(2, 'A&B')).toEqual({ items, hasMore: true })
  expect(request).toHaveBeenLastCalledWith('/api/agent/conversations?page=2&size=20&search=A%26B')
  await agentApi.markRead(3)
  expect(request).toHaveBeenLastCalledWith('/api/agent/conversations/3/read', { method: 'POST' })
})
