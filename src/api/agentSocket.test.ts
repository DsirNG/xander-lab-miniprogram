import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ connectSocket: vi.fn(() => new Promise(() => {})) }))
vi.mock('@tarojs/taro', () => ({ default: { connectSocket: mocks.connectSocket } }))
vi.mock('./http', () => ({
  API_SERVER_ORIGIN: 'https://api.xiaodongding.dpdns.org',
  tokenStorage: { getAccessToken: () => 'access' },
}))

import { connectAgentStream } from './agentSocket'

afterEach(() => {
  vi.useRealTimers()
  mocks.connectSocket.mockReset()
  mocks.connectSocket.mockImplementation(() => new Promise(() => {}))
})

function mockSocket() {
  const callbacks: Record<string, (value?: any) => void> = {}
  const task = {
    close: vi.fn(),
    send: vi.fn(),
    onOpen: (callback: () => void) => {
      callbacks.open = callback
    },
    onMessage: (callback: (value: any) => void) => {
      callbacks.message = callback
    },
    onClose: (callback: () => void) => {
      callbacks.close = callback
    },
    onError: (callback: () => void) => {
      callbacks.error = callback
    },
  }
  mocks.connectSocket.mockResolvedValue(task as never)
  return { task, callbacks }
}

it('reconnects when socket creation never settles', async () => {
  vi.useFakeTimers()
  const close = connectAgentStream(234, 3, { onEvent: vi.fn() })
  await vi.advanceTimersByTimeAsync(45500)
  expect(mocks.connectSocket).toHaveBeenCalledTimes(2)
  close()
})

it('reconnects an open socket that stops replying without a close event', async () => {
  vi.useFakeTimers()
  const { task, callbacks } = mockSocket()
  const close = connectAgentStream(234, 3, { onEvent: vi.fn() })
  await Promise.resolve()
  callbacks.open()
  await vi.advanceTimersByTimeAsync(45500)
  expect(task.close).toHaveBeenCalled()
  expect(mocks.connectSocket).toHaveBeenCalledTimes(2)
  close()
})

it('keeps healthy sockets alive and stops retrying after a terminal event', async () => {
  vi.useFakeTimers()
  const { callbacks } = mockSocket()
  const onEvent = vi.fn()
  const close = connectAgentStream(234, 3, { onEvent })
  await Promise.resolve()
  callbacks.open()
  for (let index = 0; index < 4; index++) {
    await vi.advanceTimersByTimeAsync(20000)
    callbacks.message({ data: JSON.stringify({ event: 'pong' }) })
  }
  expect(mocks.connectSocket).toHaveBeenCalledTimes(1)
  callbacks.message({ data: JSON.stringify({ id: 8, event: 'complete' }) })
  callbacks.close({ code: 1000 })
  await vi.advanceTimersByTimeAsync(60000)
  expect(mocks.connectSocket).toHaveBeenCalledTimes(1)
  expect(onEvent).toHaveBeenCalledTimes(1)
  close()
})

it('uses the same API host for the chat WebSocket', () => {
  const close = connectAgentStream(12, 3, { onEvent: vi.fn() })
  expect(mocks.connectSocket).toHaveBeenCalledWith({
    url: 'wss://api.xiaodongding.dpdns.org/ws/agent?conversationId=12&runVersion=3',
    header: { Authorization: 'Bearer access' },
  })
  close()
})
