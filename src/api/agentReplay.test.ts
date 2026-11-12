import { afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('./http', () => ({ requestEventStream: mocks.request }))
import { connectAgentReplay } from './agentReplay'
afterEach(() => { vi.useRealTimers(); mocks.request.mockReset() })

it('replays image progress, resumes at the last event, and stops after completion', async () => {
  vi.useFakeTimers()
  const requests: any[] = []
  mocks.request.mockImplementation((url, _options, event) => {
    let resolve!: () => void
    const done = new Promise<void>(r => { resolve = r })
    requests.push({ url, event, resolve })
    return { done, close: vi.fn(resolve) }
  })
  const onEvent = vi.fn()
  const close = connectAgentReplay(234, 3, { onEvent })
  requests[0].event({ id: 20195, event: 'tool_progress', data: { tool: 'image_generate', progress: 69 } })
  requests[0].resolve()
  await vi.advanceTimersByTimeAsync(500)
  expect(requests[1].url).toContain('afterEventId=20195')
  requests[1].event({ id: 20195, event: 'tool_progress' })
  requests[1].event({ id: 20196, event: 'complete' })
  await vi.advanceTimersByTimeAsync(10000)
  expect(onEvent).toHaveBeenCalledTimes(2)
  expect(requests).toHaveLength(2)
  close()
})
