import { describe, expect, it } from 'vitest'
import { createEventStreamReader } from './sseStream'
import type { AgentStreamEvent } from './agentSocket'

const bytes = (text: string) => new TextEncoder().encode(text)

describe('SSE byte stream', () => {
  it('delivers partial output immediately and preserves split UTF-8, CRLF and emoji', () => {
    const events: AgentStreamEvent[] = []
    const reader = createEventStreamReader(event => events.push(event))
    const first = bytes('event: accepted\r\ndata: {"runVersion":3}\r\n\r\n')
    reader.push(first.buffer)
    expect(events).toEqual([{ event: 'accepted', data: { runVersion: 3 } }])
    for (const byte of bytes('id: 7\nevent: answer_delta\ndata: 中文🙂\n\n')) {
      reader.push(new Uint8Array([byte]).buffer)
    }
    expect(events[1]).toEqual({ id: 7, event: 'answer_delta', data: '中文🙂' })
  })

  it('ignores heartbeat comments and retains JSON-looking answer text and multiline data', () => {
    const events: AgentStreamEvent[] = []
    const reader = createEventStreamReader(event => events.push(event))
    reader.push(': heartbeat\n\nevent: answer_delta\ndata: 123\ndata: true\n\n')
    reader.finish()
    expect(events).toEqual([{ event: 'answer_delta', data: '123\ntrue' }])
  })

  it('does not dispatch an incomplete event on disconnection', () => {
    const events: AgentStreamEvent[] = []
    const reader = createEventStreamReader(event => events.push(event))
    reader.push('event: answer_delta\ndata: incomplete')
    reader.finish()
    expect(events).toEqual([])
  })
})

it('delivers a fragmented image preview before the durable image result', () => {
  const events: AgentStreamEvent[] = []
  const reader = createEventStreamReader(event => events.push(event))
  const url = 'data:image/png;base64,' + 'A'.repeat(2 * 1024 * 1024)
  reader.push('id: 0\nevent: image_preview\ndata: {"result":{"url":"' + url.slice(0, 1500000))
  expect(events).toHaveLength(0)
  reader.push(url.slice(1500000) + '"}}\n\n')
  expect(events[0]).toEqual({ id: 0, event: 'image_preview', data: { result: { url } } })
  reader.push('id: 9\nevent: tool_result\ndata: {"result":{"url":"https://example.com/image.png"}}\n\n')
  expect(events[1]?.event).toBe('tool_result')
})

it('skips an oversized preview without losing the next durable event', () => {
  const events: AgentStreamEvent[] = []
  const reader = createEventStreamReader(event => events.push(event))
  reader.push('event: image_preview\r\ndata: ' + 'A'.repeat(8 * 1024 * 1024) + '\r\n\r')
  reader.push('\nid: 10\nevent: complete\ndata: {"status":"ready"}\n\n')
  expect(events).toEqual([{ id: 10, event: 'complete', data: { status: 'ready' } }])
})
