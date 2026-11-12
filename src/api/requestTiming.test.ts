import { afterEach, expect, it, vi } from 'vitest'
const { account } = vi.hoisted(() => ({ account: vi.fn() }))
vi.mock('@tarojs/taro', () => ({ default: { getAccountInfoSync: account } }))
import { traceRequest, isRequestTimingEnabled } from './requestTiming'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('logs safe route timing and case-insensitive server diagnostics in development', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  let now = 1000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const response = {
    statusCode: 200,
    data: { secret: 'private-body' },
    header: {
      'Server-Timing': 'auth;dur=3.5, upstream;dur=45, gateway;dur=49, secret;dur=99',
      Authorization: 'private-token',
    },
    profile: {
      domainLookupStart: 10,
      domainLookupEnd: 15,
      requestStart: 20,
      responseStart: 80,
      responseEnd: 90,
      peerIP: 'private-ip',
    },
  }
  const result = await traceRequest('GET', '/api/points/ledger?token=private-query', trace =>
    trace.attempt(async () => {
      now += 120
      return response
    }),
  )
  expect(result).toBe(response)
  const entries = log.mock.calls.map(call => JSON.parse(call[1]))
  expect(entries.find(item => item.phase === 'attempt-end')).toMatchObject({
    status: 200,
    durationMs: 120,
    authMs: 3.5,
    upstreamMs: 45,
    gatewayMs: 49,
    dnsMs: 5,
    requestToFirstByteMs: 60,
    downloadMs: 10,
  })
  expect(entries[entries.length - 1]).toMatchObject({
    phase: 'complete',
    path: '/api/points/ledger',
    durationMs: 120,
    attempts: 1,
    failed: false,
    over100ms: true,
  })
  expect(JSON.stringify(entries)).not.toMatch(/private-|peerIP|Authorization/)
})

it('includes retry waits in the logical total while separating network attempts', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  let now = 1000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  await traceRequest('GET', '/api/points', async trace => {
    await trace.attempt(async () => {
      now += 20
      return { statusCode: 401 }
    })
    now += 200 // Shared refresh wait.
    return trace.attempt(async () => {
      now += 30
      return { statusCode: 200 }
    })
  })
  const entries = log.mock.calls.map(call => JSON.parse(call[1]))
  expect(entries.filter(item => item.phase === 'attempt-end').map(item => item.durationMs)).toEqual(
    [20, 30],
  )
  expect(entries[entries.length - 1]).toMatchObject({ durationMs: 250, attempts: 2, failed: false })
})

it('logs network failure without copying the error message or changing the error', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const error = new Error('private-network-details')
  await expect(
    traceRequest('GET', '/api/points', trace =>
      trace.attempt(async () => {
        throw error
      }),
    ),
  ).rejects.toBe(error)
  expect(JSON.parse(log.mock.calls[log.mock.calls.length - 1][1])).toMatchObject({
    phase: 'complete',
    failed: true,
  })
  expect(JSON.stringify(log.mock.calls)).not.toContain('private-network-details')
})

it('emits no diagnostics in production and preserves requests', async () => {
  vi.stubEnv('NODE_ENV', 'production')
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  await expect(
    traceRequest('GET', '/api/points', trace => trace.attempt(async () => ({ statusCode: 200 }))),
  ).resolves.toEqual({ statusCode: 200 })
  expect(log).not.toHaveBeenCalled()
})

it('enables device diagnostics for the WeChat develop edition even in a production build', async () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('TARO_ENV', 'weapp')
  account.mockReturnValue({ miniProgram: { envVersion: 'develop' } })
  expect(isRequestTimingEnabled()).toBe(true)
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  await traceRequest('GET', '/api/points', trace =>
    trace.attempt(async () => ({ statusCode: 200 })),
  )
  expect(log.mock.calls.some(call => JSON.parse(call[1]).phase === 'complete')).toBe(true)
})

it.each(['trial', 'release'])(
  'keeps diagnostics off in the %s edition of production builds',
  edition => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TARO_ENV', 'weapp')
    account.mockReturnValue({ miniProgram: { envVersion: edition } })
    expect(isRequestTimingEnabled()).toBe(false)
  },
)

it('exports complete JSON text instead of a collapsible truncated object', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  await traceRequest('GET', '/api/blog/tags/popular', trace =>
    trace.attempt(async () => ({ statusCode: 200 })),
  )
  for (const [prefix, text] of log.mock.calls) {
    expect(prefix).toBe('[HTTP timing]')
    expect(typeof text).toBe('string')
    expect(() => JSON.parse(text)).not.toThrow()
  }
  const end = log.mock.calls
    .map(call => JSON.parse(call[1]))
    .find(event => event.phase === 'attempt-end')
  expect(end).toMatchObject({ serverTimingAvailable: false, networkProfileAvailable: false })
})
