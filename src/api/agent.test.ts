import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('./http', () => ({ request: vi.fn(), uploadFile: vi.fn() }))
vi.mock('@tarojs/taro', () => ({
  default: { getStorageSync: () => '', getSystemInfoSync: () => ({ language: 'zh' }) },
}))

import { request } from './http'
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
  await agentApi.sendMessage(7, content, [])
  expect(request).toHaveBeenCalledWith('/api/agent/conversations/7/messages', {
    method: 'POST',
    data: { content, attachments: [], locale: 'en', replyLanguage: 'auto' },
  })
  setLocale('zh')
})
