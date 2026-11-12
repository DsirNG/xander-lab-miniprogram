import { requestEventStream } from './http'
import type { AgentStreamHandlers } from './agentSocket'

/** Replay uses the same authenticated HTTPS transport as new turns, including token refresh. */
export function connectAgentReplay(id: number, runVersion: number, handlers: AgentStreamHandlers) {
  let closed = false
  let terminal = false
  let cursor = 0
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let stream: ReturnType<typeof requestEventStream> | undefined
  const connect = () => {
    if (closed || terminal) return
    stream = requestEventStream(
      `/api/agent/conversations/${id}/events?afterEventId=${cursor}&runVersion=${runVersion}`,
      { method: 'GET' },
      event => {
        if (closed || terminal) return
        if (event.id != null && Number.isSafeInteger(Number(event.id)) && Number(event.id) > 0) {
          if (Number(event.id) <= cursor) return
          cursor = Number(event.id)
        }
        attempt = 0
        terminal = ['complete', 'error', 'approval_required'].includes(event.event)
        handlers.onEvent(event)
        if (terminal) stream?.close()
      },
    )
    void stream.done.catch(error => {
      if (!closed && !terminal) handlers.onError?.(error instanceof Error ? error.message : String(error))
    }).finally(() => {
      if (closed || terminal) return
      attempt += 1
      handlers.onReconnect?.(attempt)
      timer = setTimeout(connect, Math.min(500 * 2 ** Math.min(attempt - 1, 4), 5000))
    })
  }
  connect()
  return () => {
    closed = true
    clearTimeout(timer)
    stream?.close()
  }
}
