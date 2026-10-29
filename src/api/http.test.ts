import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  request: vi.fn(),
  uploadFile: vi.fn(),
  trigger: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => mocks.storage.get(key),
    setStorageSync: (key: string, value: string) => mocks.storage.set(key, value),
    removeStorageSync: (key: string) => mocks.storage.delete(key),
    request: mocks.request,
    uploadFile: mocks.uploadFile,
    eventCenter: { trigger: mocks.trigger },
  },
}))

import { request, tokenStorage, uploadFile } from './http'
import { setLocale, setReplyLanguage } from '@/i18n'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}

const ok = (data: unknown) => ({ statusCode: 200, data: { code: 200, data } })
const unauthorized = { statusCode: 401, data: { code: 401, message: 'expired' } }

describe('parallel authenticated requests', () => {
  beforeEach(() => {
    setLocale('zh')
    mocks.storage.clear()
    mocks.request.mockReset()
    mocks.uploadFile.mockReset()
    mocks.trigger.mockReset()
    tokenStorage.setTokens('old-access', 'old-refresh')
  })

  it('sends the current interface language on requests, refresh and uploads', async () => {
    setLocale('en')
    setReplyLanguage('zh')
    mocks.request.mockImplementation(options => {
      expect(options.header['Accept-Language']).toBe('en')
      if (options.url.endsWith('/auth/refresh')) {
        return Promise.resolve(ok({ accessToken: 'new-access', refreshToken: 'new-refresh' }))
      }
      return Promise.resolve(
        options.header.Authorization === 'Bearer old-access' ? unauthorized : ok(null),
      )
    })
    await request('/api/points')
    mocks.uploadFile.mockResolvedValue({
      statusCode: 200,
      data: JSON.stringify({ code: 200, data: null }),
    })
    await uploadFile('/api/upload', '/tmp/photo.jpg')
    expect(mocks.uploadFile.mock.calls[0][0].header['Accept-Language']).toBe('en')
    setLocale('zh')
    mocks.request.mockResolvedValue(ok(null))
    await request('/api/points')
    expect(mocks.request.mock.calls[mocks.request.mock.calls.length - 1][0].header['Accept-Language']).toBe('zh-CN')
    expect(mocks.request.mock.calls[0][0].header['Accept-Language']).toBe('en')
  })

  it('shares one token refresh across concurrent 401 responses', async () => {
    const refresh = deferred<ReturnType<typeof ok>>()
    mocks.request.mockImplementation(options => {
      if (options.url.endsWith('/auth/refresh')) return refresh.promise
      return Promise.resolve(
        options.header.Authorization === 'Bearer old-access' ? unauthorized : ok(options.url),
      )
    })
    const results = Promise.all([request('/api/points'), request('/api/points/ledger')])
    await vi.waitFor(() =>
      expect(
        mocks.request.mock.calls.filter(([options]) => options.url.endsWith('/auth/refresh')),
      ).toHaveLength(1),
    )
    refresh.resolve(ok({ accessToken: 'new-access', refreshToken: 'new-refresh' }))
    expect(await results).toHaveLength(2)
    expect(mocks.request).toHaveBeenCalledTimes(5)
    expect(mocks.trigger).not.toHaveBeenCalled()
  })

  it('reuses the new token when an old 401 arrives after refresh has finished', async () => {
    const late = deferred<typeof unauthorized>()
    mocks.request.mockImplementation(options => {
      if (options.url.endsWith('/auth/refresh'))
        return Promise.resolve(ok({ accessToken: 'new-access', refreshToken: 'new-refresh' }))
      if (options.header.Authorization === 'Bearer new-access') return Promise.resolve(ok('done'))
      return options.url.endsWith('/ledger') ? late.promise : Promise.resolve(unauthorized)
    })
    const ledger = request('/api/points/ledger')
    await expect(request('/api/points')).resolves.toBe('done')
    late.resolve(unauthorized)
    await expect(ledger).resolves.toBe('done')
    expect(
      mocks.request.mock.calls.filter(([options]) => options.url.endsWith('/auth/refresh')),
    ).toHaveLength(1)
  })

  it.each(['network', 'server'])(
    'keeps the session when refresh fails due to %s',
    async failure => {
      mocks.request.mockResolvedValueOnce(unauthorized)
      if (failure === 'network') mocks.request.mockRejectedValueOnce(new Error('offline'))
      else
        mocks.request.mockResolvedValueOnce({ statusCode: 503, data: { message: 'unavailable' } })
      await expect(request('/api/points')).rejects.toThrow()
      expect(tokenStorage.getAccessToken()).toBe('old-access')
      expect(mocks.trigger).not.toHaveBeenCalled()
    },
  )

  it('expires the session once when concurrent refresh attempts are rejected', async () => {
    mocks.request.mockResolvedValue(unauthorized)
    const results = await Promise.allSettled([
      request('/api/points'),
      request('/api/points/ledger'),
    ])
    expect(results.every(result => result.status === 'rejected')).toBe(true)
    expect(tokenStorage.getAccessToken()).toBe('')
    expect(mocks.trigger).toHaveBeenCalledExactlyOnceWith('auth:logout')
  })

  it('expires the session if the retried request still returns 401', async () => {
    mocks.request.mockImplementation(options =>
      Promise.resolve(
        options.url.endsWith('/auth/refresh')
          ? ok({ accessToken: 'new-access', refreshToken: 'new-refresh' })
          : unauthorized,
      ),
    )
    await expect(request('/api/points')).rejects.toMatchObject({ code: 401 })
    expect(tokenStorage.getAccessToken()).toBe('')
    expect(mocks.request).toHaveBeenCalledTimes(3)
  })

  it('does not restore a session that was cleared while refresh was in flight', async () => {
    const refresh = deferred<ReturnType<typeof ok>>()
    mocks.request.mockResolvedValueOnce(unauthorized).mockImplementationOnce(() => refresh.promise)
    const result = request('/api/points').catch(error => error)
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2))
    tokenStorage.clear()
    refresh.resolve(ok({ accessToken: 'new-access', refreshToken: 'new-refresh' }))
    expect(await result).toMatchObject({ code: 401 })
    expect(tokenStorage.getAccessToken()).toBe('')
  })

  it('respects endpoint-specific timeouts', async () => {
    mocks.request.mockResolvedValue(ok(null))
    await request('/api/blog/posts', { timeout: 60000 })
    expect(mocks.request.mock.calls[0][0].timeout).toBe(60000)
  })

  it('does not retry a previous account request using a newly signed-in account', async () => {
    const late = deferred<typeof unauthorized>()
    mocks.request.mockReturnValue(late.promise)
    const pending = request('/api/points').catch(error => error)
    tokenStorage.setTokens('another-user-access', 'another-user-refresh')
    late.resolve(unauthorized)
    expect(await pending).toMatchObject({ code: 401 })
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(tokenStorage.getAccessToken()).toBe('another-user-access')
    expect(mocks.trigger).not.toHaveBeenCalled()
  })

  it('also refreshes and retries authenticated uploads', async () => {
    mocks.uploadFile.mockResolvedValueOnce({ statusCode: 401, data: '' }).mockResolvedValueOnce({
      statusCode: 200,
      data: JSON.stringify({ code: 200, data: { url: '/image.png' } }),
    })
    mocks.request.mockResolvedValue(ok({ accessToken: 'new-access', refreshToken: 'new-refresh' }))
    await expect(uploadFile('/api/upload/oss', '/local/image.png')).resolves.toEqual({
      url: '/image.png',
    })
    expect(mocks.uploadFile.mock.calls[1][0].header.Authorization).toBe('Bearer new-access')
    expect(mocks.trigger).not.toHaveBeenCalled()
  })
})
