import type { AgentStreamEvent } from './agentSocket'

const TEXT_EVENTS = new Set(['delta', 'answer_delta', 'thought', 'answer', 'stage', 'error'])

/** Incremental UTF-8 decoding, including runtimes without TextDecoder. */
export function createUtf8Decoder() {
  let pending: number[] = []
  return (chunk: ArrayBuffer, final = false): string => {
    const bytes = pending.concat(Array.from(new Uint8Array(chunk)))
    let index = 0
    let text = ''
    while (index < bytes.length) {
      const first = bytes[index]
      const count =
        first < 0x80
          ? 1
          : first >= 0xc2 && first <= 0xdf
            ? 2
            : first >= 0xe0 && first <= 0xef
              ? 3
              : first >= 0xf0 && first <= 0xf4
                ? 4
                : 0
      if (!count) {
        text += '\ufffd'
        index += 1
        continue
      }
      if (index + count > bytes.length && !final) break
      const tail = bytes.slice(index + 1, index + count)
      let code = first & (count === 1 ? 0x7f : count === 2 ? 0x1f : count === 3 ? 0x0f : 7)
      for (const byte of tail) code = (code << 6) | (byte & 0x3f)
      if (
        tail.length !== count - 1 ||
        tail.some(byte => byte < 0x80 || byte > 0xbf) ||
        (count === 2 && code < 0x80) ||
        (count === 3 && code < 0x800) ||
        (count === 4 && code < 0x10000) ||
        code > 0x10ffff ||
        (code >= 0xd800 && code <= 0xdfff)
      ) {
        text += '\ufffd'
        index += 1
        continue
      }
      text += String.fromCodePoint(code)
      index += count
    }
    pending = bytes.slice(index)
    return text
  }
}

/** Parse frames as bytes arrive; never wait for the HTTP request to finish. */
export function createEventStreamReader(onEvent: (event: AgentStreamEvent) => void) {
  const decode = createUtf8Decoder()
  let buffer = ''
  let discardingPreview = false
  const normalLimit = 1024 * 1024
  const previewLimit = 8 * normalLimit
  const isPreview = (frame: string) => /(?:^|\n)event: *image_preview\r?\n/.test(frame.slice(0, 256))
  const accept = (text: string) => {
    buffer += text
    let separator: RegExpExecArray | null
    while ((separator = /\r?\n\r?\n/.exec(buffer))) {
      const frame = buffer.slice(0, separator.index)
      buffer = buffer.slice(separator.index + separator[0].length)
      if (discardingPreview || (frame.length > previewLimit && isPreview(frame))) {
        discardingPreview = false
        continue
      }
      if (frame.length > normalLimit && !isPreview(frame)) {
        throw new Error('Event stream frame exceeds size limit')
      }
      let event = 'message'
      let id: number | undefined
      const data: string[] = []
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith(':')) continue
        const colon = line.indexOf(':')
        const field = colon < 0 ? line : line.slice(0, colon)
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
        if (field === 'event') event = value || 'message'
        if (field === 'id' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)))
          id = Number(value)
        if (field === 'data') data.push(value)
      }
      if (!data.length) continue
      const raw = data.join('\n')
      let value: unknown = raw
      if (!TEXT_EVENTS.has(event)) {
        try {
          value = JSON.parse(raw)
        } catch {
          /* Keep text. */
        }
      }
      onEvent({ ...(id === undefined ? {} : { id }), event, data: value })
    }
    if (discardingPreview || (buffer.length > previewLimit && isPreview(buffer))) {
      if (!discardingPreview) console.warn('[Image] Preview exceeds stream size limit')
      discardingPreview = true
      // Keep only enough bytes to recognize a frame boundary split across chunks.
      buffer = buffer.slice(-3)
    } else if (buffer.length > normalLimit && !isPreview(buffer)) {
      throw new Error('Event stream frame exceeds size limit')
    }
  }
  return {
    push(chunk: ArrayBuffer | string) {
      accept(typeof chunk === 'string' ? chunk : decode(chunk))
    },
    finish() {
      accept(decode(new ArrayBuffer(0), true))
    },
  }
}
