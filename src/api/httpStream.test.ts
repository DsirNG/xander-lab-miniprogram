import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ request: vi.fn(), storage: new Map<string, string>() }))
vi.mock('@tarojs/taro', () => ({
  default: {
    request: mocks.request,
    getStorageSync: (key: string) => mocks.storage.get(key),
    setStorageSync: (key: string, value: string) => mocks.storage.set(key, value),
    removeStorageSync: (key: string) => mocks.storage.delete(key),
    eventCenter: { trigger: vi.fn() },
  },
}))
import { requestEventStream, tokenStorage } from './http'
import type { AgentStreamEvent } from './agentSocket'

const encode = (text: string) => new TextEncoder().encode(text).buffer
function streamTask() {
  let resolve!: (value: { statusCode: number; data: ArrayBuffer }) => void
  let reject!: (error: unknown) => void
  let headers!: (value: { header: Record<string, string> }) => void
  let chunk!: (value: { data: ArrayBuffer }) => void
  const promise = new Promise<{ statusCode: number; data: ArrayBuffer }>((yes, no) => {
    resolve = yes
    reject = no
  })
  const task = Object.assign(promise, {
    abort: vi.fn(() => reject({ errMsg: 'request:fail abort' })),
    onHeadersReceived: vi.fn(callback => {
      headers = callback
    }),
    onChunkReceived: vi.fn(callback => {
      chunk = callback
    }),
  })
  return {
    task,
    resolve,
    reject,
    headers: (type = 'text/event-stream') => headers({ header: { 'Content-Type': type } }),
    chunk: (text: string) => chunk({ data: encode(text) }),
  }
}
beforeEach(() => {
  mocks.request.mockReset()
  mocks.storage.clear()
  tokenStorage.setTokens('access', 'refresh')
})

it('emits events before completion and does not replay chunks from the final body', async () => {
  const native = streamTask()
  mocks.request.mockReturnValue(native.task)
  const events: AgentStreamEvent[] = []
  const stream = requestEventStream(
    '/api/agent/conversations/7/messages/stream',
    { method: 'POST', data: { content: 'hello' } },
    event => events.push(event),
  )
  native.headers()
  const frame = 'event: answer_delta\ndata: hello\n\n'
  native.chunk(frame)
  expect(events).toEqual([{ event: 'answer_delta', data: 'hello' }])
  expect(mocks.request.mock.calls[0][0]).toMatchObject({
    enableChunked: true,
    timeout: 600000,
    header: { Accept: 'text/event-stream', Authorization: 'Bearer access' },
  })
  native.resolve({ statusCode: 200, data: encode(frame) })
  await stream.done
  expect(events).toHaveLength(1)
  expect(mocks.request).toHaveBeenCalledOnce()
})

it('refreshes a rejected token once before retrying and never emits the 401 body', async () => {
  const first = streamTask()
  const second = streamTask()
  mocks.request
    .mockReturnValueOnce(first.task)
    .mockResolvedValueOnce({
      statusCode: 200,
      data: { code: 200, data: { accessToken: 'new-access', refreshToken: 'new-refresh' } },
    })
    .mockReturnValueOnce(second.task)
  const onEvent = vi.fn()
  const stream = requestEventStream(
    '/api/agent/conversations/7/messages/stream',
    { method: 'POST' },
    onEvent,
  )
  first.headers('application/json')
  first.chunk('{"code":401}')
  first.resolve({ statusCode: 401, data: encode('{"code":401}') })
  await vi.waitFor(() => expect(second.task.onHeadersReceived).toHaveBeenCalled())
  second.headers()
  second.chunk('event: accepted\ndata: {"runVersion":2}\n\n')
  second.resolve({ statusCode: 200, data: encode('') })
  await stream.done
  expect(onEvent).toHaveBeenCalledExactlyOnceWith({ event: 'accepted', data: { runVersion: 2 } })
  expect(mocks.request.mock.calls[2][0].header.Authorization).toBe('Bearer new-access')
})

it('aborts locally without retrying a committed mutation or delivering late events', async () => {
  const native = streamTask()
  mocks.request.mockReturnValue(native.task)
  const onEvent = vi.fn()
  const stream = requestEventStream(
    '/api/agent/conversations/7/messages/stream',
    { method: 'POST' },
    onEvent,
  )
  native.headers()
  stream.close()
  native.chunk('event: answer_delta\ndata: late\n\n')
  await stream.done
  expect(native.task.abort).toHaveBeenCalledOnce()
  expect(onEvent).not.toHaveBeenCalled()
  expect(mocks.request).toHaveBeenCalledOnce()
})

it('rejects JSON business errors instead of silently treating them as an empty stream', async () => {
  const native = streamTask()
  mocks.request.mockReturnValue(native.task)
  const stream = requestEventStream(
    '/api/agent/conversations/7/messages/stream',
    { method: 'POST' },
    vi.fn(),
  )
  native.headers('application/json')
  native.resolve({ statusCode: 403, data: encode('{"message":"forbidden"}') })
  await expect(stream.done).rejects.toMatchObject({ code: 403, message: 'forbidden' })
})

it('streams H5 Fetch bytes before the response body closes', async () => {
  vi.stubEnv('TARO_ENV', 'h5')
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value
    },
  })
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/event-stream' } }))
  vi.stubGlobal('fetch', fetchMock)
  try {
    const onEvent = vi.fn()
    const stream = requestEventStream(
      '/api/agent/conversations/7/messages/stream',
      { method: 'POST', data: { content: 'hello' } },
      onEvent,
    )
    controller.enqueue(new TextEncoder().encode('event: accepted\ndata: {"runVersion":3}\n\n'))
    await vi.waitFor(() =>
      expect(onEvent).toHaveBeenCalledExactlyOnceWith({
        event: 'accepted',
        data: { runVersion: 3 },
      }),
    )
    expect(mocks.request).not.toHaveBeenCalled()
    controller.close()
    await stream.done
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ content: 'hello' })
  } finally {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  }
})
