import Taro from '@tarojs/taro'
import { API_SERVER_ORIGIN, tokenStorage } from './http'
import { createStreamWatchdog } from './streamWatchdog'

export type AgentStreamEvent = {
  id?: number
  event: string
  data?: unknown
}

const HEARTBEAT_INTERVAL = 20000
const INITIAL_RECONNECT_DELAY = 500
const MAX_RECONNECT_DELAY = 5000

export type AgentStreamHandlers = {
  onEvent: (event: AgentStreamEvent) => void
  onOpen?: () => void
  onReconnect?: (attempt: number) => void
  onError?: (message: string) => void
}

type SocketError = {
  errMsg?: string
}

function safeErrorMessage(error: unknown, token: string) {
  const message = String(
    (error as SocketError | undefined)?.errMsg || 'WebSocket connection failed',
  )
  return token ? message.split(token).join('[REDACTED]') : message
}

/**
 * 订阅一轮智能体执行的事件流（WebSocket）。
 * 用于恢复已有轮次；新消息通过 HTTP 分块 SSE 直接消费，后端 /ws/agent 重放持久化事件。
 * 客户端心跳保活，服务端推 pong 回执。非终态断线后按指数退避自动重连，
 * 并利用持久化事件 id 去重服务端重放帧。返回关闭函数。
 */
export function connectAgentStream(
  conversationId: number,
  runVersion: number,
  handlers: AgentStreamHandlers,
): () => void {
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let closed = false
  let terminal = false
  let reconnectAttempt = 0
  let lastEventId = 0
  let socketTask: Taro.SocketTask | null = null
  let receivedFirstEvent = false
  let watchdog: ReturnType<typeof createStreamWatchdog> | null = null
  const socketOrigin = API_SERVER_ORIGIN.replace(/^http/, 'ws')
  const url = `${socketOrigin}/ws/agent?conversationId=${conversationId}&runVersion=${runVersion}`

  const trace = (message: string, extra = '') => {
    console.info(
      `[AgentWS] ${message} conversationId=${conversationId} runVersion=${runVersion}${extra}`,
    )
  }

  const clearHeartbeat = () => {
    watchdog?.stop()
    watchdog = null
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  const scheduleReconnect = () => {
    if (closed || terminal || reconnectTimer) return
    reconnectAttempt += 1
    trace('reconnect scheduled', ` attempt=${reconnectAttempt}`)
    handlers.onReconnect?.(reconnectAttempt)
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * 2 ** Math.max(0, reconnectAttempt - 1),
      MAX_RECONNECT_DELAY,
    )
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  const connect = () => {
    if (closed || terminal) return
    let settled = false
    clearHeartbeat()
    watchdog = createStreamWatchdog(() => {
      settled = true
      clearHeartbeat()
      const staleTask = socketTask
      socketTask = null
      scheduleReconnect()
      staleTask?.close({ code: 1000 })
    })
    const token = tokenStorage.getAccessToken()
    trace('connecting', ` attempt=${reconnectAttempt + 1} tokenPresent=${Boolean(token)}`)
    Taro.connectSocket({
      url,
      header: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(task => {
        if (closed || terminal || settled) {
          trace('socket task resolved after local close')
          task.close({ code: 1000 })
          return
        }
        socketTask = task
        const handleDisconnect = () => {
          if (settled) return
          settled = true
          clearHeartbeat()
          if (socketTask === task) socketTask = null
          scheduleReconnect()
        }

        task.onOpen(() => {
          if (closed || terminal || settled) return
          clearHeartbeat()
          watchdog = createStreamWatchdog(() => {
            handleDisconnect()
            task.close({ code: 1000 })
          })
          trace('connected')
          handlers.onOpen?.()
          heartbeatTimer = setInterval(() => {
            task.send({ data: JSON.stringify({ event: 'ping' }) })
          }, HEARTBEAT_INTERVAL)
        })
        task.onMessage(res => {
          if (closed || terminal || settled) return
          try {
            const payload = JSON.parse(res.data as string) as AgentStreamEvent
            watchdog?.touch()
            if (payload.event === 'ping') {
              reconnectAttempt = 0
              task.send({ data: JSON.stringify({ event: 'pong' }) })
              return
            }
            if (payload.event === 'pong') {
              reconnectAttempt = 0
              return
            }
            reconnectAttempt = 0
            if (!receivedFirstEvent) {
              receivedFirstEvent = true
              trace('first event received', ` event=${payload.event} id=${payload.id ?? '-'}`)
            }
            if (payload.id != null) {
              const eventId = Number(payload.id)
              if (Number.isSafeInteger(eventId) && eventId > 0) {
                if (eventId <= lastEventId) return
                lastEventId = eventId
              }
            }
            if (
              payload.event === 'complete' ||
              payload.event === 'error' ||
              payload.event === 'approval_required'
            ) {
              terminal = true
              clearHeartbeat()
              trace('terminal event received', ` event=${payload.event} id=${payload.id ?? '-'}`)
            }
            handlers.onEvent(payload)
          } catch (error) {
            console.warn(
              `[AgentWS] malformed frame conversationId=${conversationId} runVersion=${runVersion}`,
              error,
            )
            // 忽略畸形帧，后续合法帧和断线重放仍可继续处理。
          }
        })
        task.onClose(result => {
          trace(
            'closed',
            ` code=${result.code ?? '-'} reason=${result.reason || '-'} terminal=${terminal} local=${closed}`,
          )
          handleDisconnect()
        })
        task.onError(error => {
          if (closed || terminal || settled) return
          const message = safeErrorMessage(error, token)
          console.warn(
            `[AgentWS] connection error conversationId=${conversationId} runVersion=${runVersion}: ${message}`,
          )
          handlers.onError?.(message)
          handleDisconnect()
        })
      })
      .catch(error => {
        if (closed || terminal || settled) return
        settled = true
        clearHeartbeat()
        const message = safeErrorMessage(error, token)
        console.warn(
          `[AgentWS] connectSocket failed conversationId=${conversationId} runVersion=${runVersion}: ${message}`,
        )
        handlers.onError?.(message)
        scheduleReconnect()
      })
  }

  connect()

  return () => {
    closed = true
    trace('closing locally', ` receivedFirstEvent=${receivedFirstEvent}`)
    clearHeartbeat()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    socketTask?.close({ code: 1000 })
    socketTask = null
  }
}
