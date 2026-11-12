import Taro from '@tarojs/taro'

type TimedResponse = { statusCode: number; header?: unknown; profile?: unknown }
export type RequestTrace = {
  attempt: <T extends TimedResponse>(send: () => PromiseLike<T>) => Promise<T>
}
export function isRequestTimingEnabled(): boolean {
  if (process.env.NODE_ENV === 'development') return true
  if (process.env.TARO_ENV !== 'weapp') return false
  try {
    // Build mode and WeChat runtime edition are independent during device debugging.
    return Taro.getAccountInfoSync?.().miniProgram?.envVersion === 'develop'
  } catch {
    return false
  }
}

let sequence = 0

function serverMetrics(header: unknown): Record<string, number> {
  if (!header || typeof header !== 'object') return {}
  const entries = Object.entries(header)
  const timing = entries.find(([key]) => key.toLowerCase() === 'server-timing')?.[1]
  if (typeof timing !== 'string') return {}
  const metrics: Record<string, number> = {}
  // Only known numeric durations are safe to copy from server diagnostics.
  for (const item of timing.split(',')) {
    const match = item.trim().match(/^(auth|upstream|gateway);\s*dur=(\d+(?:\.\d+)?)$/)
    if (match) metrics[match[1] + 'Ms'] = Number(match[2])
  }
  return metrics
}

function networkMetrics(profile: unknown): Record<string, number> {
  if (!profile || typeof profile !== 'object') return {}
  const values = profile as Record<string, unknown>
  const metrics: Record<string, number> = {}
  const stages = {
    dnsMs: ['domainLookupStart', 'domainLookupEnd'],
    connectMs: ['connectStart', 'connectEnd'],
    tlsMs: ['SSLconnectionStart', 'SSLconnectionEnd'],
    requestToFirstByteMs: ['requestStart', 'responseStart'],
    downloadMs: ['responseStart', 'responseEnd'],
  }
  for (const [name, [start, end]] of Object.entries(stages)) {
    const from = values[start]
    const to = values[end]
    if (
      typeof from === 'number' &&
      typeof to === 'number' &&
      from > 0 &&
      Number.isFinite(from) &&
      Number.isFinite(to) &&
      to >= from
    ) {
      metrics[name] = Math.round(to - from)
    }
  }
  return metrics
}

function logTiming(event: Record<string, unknown>) {
  // DevTools log export truncates object previews; serialize before crossing the debug bridge.
  console.log('[HTTP timing]', JSON.stringify(event))
}

/** Development diagnostics only; never log credentials, query strings or payloads. */
export async function traceRequest<T>(
  method: string,
  path: string,
  send: (trace: RequestTrace) => Promise<T>,
): Promise<T> {
  if (!isRequestTimingEnabled()) {
    return send({ attempt: async call => await call() })
  }
  const id = ++sequence
  const started = Date.now()
  const route = path.split(/[?#]/)[0]
  let attempts = 0
  let failed = false
  logTiming({
    phase: 'start',
    id,
    method,
    path: route,
    startedAt: new Date(started).toISOString(),
  })
  const trace: RequestTrace = {
    attempt: async call => {
      const attempt = ++attempts
      const attemptStarted = Date.now()
      logTiming({
        phase: 'attempt-start',
        id,
        attempt,
        offsetMs: attemptStarted - started,
      })
      try {
        const response = await call()
        logTiming({
          phase: 'attempt-end',
          id,
          attempt,
          durationMs: Date.now() - attemptStarted,
          status: response.statusCode,
          serverTimingAvailable: Object.keys(serverMetrics(response.header)).length > 0,
          networkProfileAvailable: Object.keys(networkMetrics(response.profile)).length > 0,
          ...serverMetrics(response.header),
          ...networkMetrics(response.profile),
        })
        return response
      } catch (error) {
        logTiming({
          phase: 'attempt-error',
          id,
          attempt,
          durationMs: Date.now() - attemptStarted,
        })
        throw error
      }
    },
  }
  try {
    return await send(trace)
  } catch (error) {
    failed = true
    throw error
  } finally {
    const durationMs = Date.now() - started
    logTiming({
      phase: 'complete',
      id,
      method,
      path: route,
      durationMs,
      attempts,
      failed,
      over100ms: durationMs > 100,
    })
  }
}
