import { expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ connectSocket: vi.fn(() => new Promise(() => {})) }))
vi.mock('@tarojs/taro', () => ({ default: { connectSocket: mocks.connectSocket } }))
vi.mock('./http', () => ({
  API_SERVER_ORIGIN: 'https://api.xiaodongding.dpdns.org',
  tokenStorage: { getAccessToken: () => 'access' },
}))

import { connectAgentStream } from './agentSocket'

it('uses the same API host for the chat WebSocket', () => {
  const close = connectAgentStream(12, 3, { onEvent: vi.fn() })
  expect(mocks.connectSocket).toHaveBeenCalledWith({
    url: 'wss://api.xiaodongding.dpdns.org/ws/agent?conversationId=12&runVersion=3',
    header: { Authorization: 'Bearer access' },
  })
  close()
})
