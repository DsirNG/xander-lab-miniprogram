import { getSessionVersion, resetPrivateCache } from '@/utils/privateCache'
import { traceRequest, isRequestTimingEnabled, type RequestTrace } from './requestTiming'
import { getLocale, t } from '@/i18n'
import Taro from '@tarojs/taro'
import { createEventStreamReader, createUtf8Decoder } from './sseStream'
import type { AgentStreamEvent } from './agentSocket'

type ApiResult<T> = {
  code: number
  message: string
  data: T
}

export const API_SERVER_ORIGIN = 'https://api.xiaodongding.dpdns.org'
export const API_ORIGIN = process.env.TARO_ENV === 'h5' ? '' : API_SERVER_ORIGIN

const ACCESS_TOKEN_KEY = 'xander_access_token'
const REFRESH_TOKEN_KEY = 'xander_refresh_token'

function persistTokens(accessToken: string, refreshToken: string) {
  Taro.setStorageSync(ACCESS_TOKEN_KEY, accessToken)
  Taro.setStorageSync(REFRESH_TOKEN_KEY, refreshToken)
}

export const tokenStorage = {
  getAccessToken: () => Taro.getStorageSync<string>(ACCESS_TOKEN_KEY) || '',
  getRefreshToken: () => Taro.getStorageSync<string>(REFRESH_TOKEN_KEY) || '',
  setTokens: (accessToken: string, refreshToken: string) =>
    resetPrivateCache(() => persistTokens(accessToken, refreshToken)),
  clear: () =>
    resetPrivateCache(() => {
      Taro.removeStorageSync(ACCESS_TOKEN_KEY)
      Taro.removeStorageSync(REFRESH_TOKEN_KEY)
    }),
}

export type TokenPair = {
  accessToken: string
  refreshToken: string
}

export function saveTokenPair(pair: TokenPair) {
  tokenStorage.setTokens(pair.accessToken, pair.refreshToken)
}

export class ApiError extends Error {
  code: number

  constructor(message: string, code: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

type RequestOptions = Omit<Taro.request.Option, 'url' | 'success' | 'fail'> & {
  _retried?: boolean
  anonymous?: boolean
}

/** 无感刷新：并发 401 只触发一次刷新，成功后返回是否可重试原请求 */
let refreshing: { session: number; promise: Promise<boolean> } | null = null

function logOutgoingRequest(method: keyof Taro.request.Method | 'UPLOAD', path: string) {
  // 查询参数、请求头和请求体可能包含凭据或用户数据，发送日志只记录安全的路由信息。
  const pathname = path.split('?')[0]
  if (isRequestTimingEnabled()) {
    console.info(`[HTTP] Sending request: method=${method} path=${pathname}`)
  }
}

function refreshAccessToken(): Promise<boolean> {
  const session = getSessionVersion()
  if (refreshing?.session === session) return refreshing.promise
  const refreshToken = tokenStorage.getRefreshToken()
  const promise = Promise.resolve()
    .then(async () => {
      if (!refreshToken || session !== getSessionVersion()) return false
      logOutgoingRequest('POST', '/api/auth/refresh')
      const response = await traceRequest('POST', '/api/auth/refresh', trace => trace.attempt(() => Taro.request<ApiResult<TokenPair>>({
        url: `${API_ORIGIN}/api/auth/refresh`,
        method: 'POST',
        timeout: 15000,
        header: {
          'Content-Type': 'application/json',
          'Accept-Language': getLocale() === 'en' ? 'en' : 'zh-CN',
        },
        data: { refreshToken },
      })))
      if (
        response.statusCode === 200 &&
        response.data?.code === 200 &&
        response.data.data?.accessToken &&
        response.data.data?.refreshToken
      ) {
        if (session !== getSessionVersion() || tokenStorage.getRefreshToken() !== refreshToken)
          return false
        persistTokens(response.data.data.accessToken, response.data.data.refreshToken)
        return true
      }
      if (response.statusCode === 401 || response.statusCode === 403) return false
      throw new ApiError(
        response.data?.message || t('ui.serviceTemporarilyUnavailable'),
        response.statusCode >= 400 ? response.statusCode : 502,
      )
    })
    .finally(() => {
      if (refreshing?.promise === promise) refreshing = null
    })
  refreshing = { session, promise }
  return promise
}

async function authenticatedRequest<T extends { statusCode: number }>(
  send: (accessToken: string) => Promise<T>,
  retried = false,
  allowResponseAfterLogout = false,
): Promise<T> {
  const accessToken = tokenStorage.getAccessToken()
  const session = getSessionVersion()
  const response = await send(accessToken)
  if (response.statusCode === 401) {
    if (!retried && accessToken && session === getSessionVersion()) {
      // 另一个并发请求可能已完成刷新，迟到的 401 直接使用新令牌重试。
      const currentToken = tokenStorage.getAccessToken()
      if (
        currentToken &&
        (currentToken !== accessToken || (await refreshAccessToken())) &&
        session === getSessionVersion()
      ) {
        return authenticatedRequest(send, true)
      }
    }
    if (
      session === getSessionVersion() &&
      tokenStorage.getAccessToken() === accessToken &&
      accessToken
    ) {
      tokenStorage.clear()
      Taro.eventCenter.trigger('auth:logout')
    }
    throw new ApiError(t('ui.pleaseSignInAgain'), 401)
  }
  if (!allowResponseAfterLogout && accessToken && session !== getSessionVersion()) {
    throw new ApiError(t('ui.pleaseSignInAgain'), 401)
  }
  return response
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return traceRequest(options.method || 'GET', path, trace => executeRequest<T>(path, options, trace))
}

async function executeRequest<T>(path: string, options: RequestOptions, trace: RequestTrace): Promise<T> {
  const { _retried, anonymous = false, ...requestOptions } = options
  const send = (accessToken: string) => {
    logOutgoingRequest(options.method || 'GET', path)
    const headers = { ...options.header }
    if (anonymous) {
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'authorization') delete headers[key]
      }
    }
    return trace.attempt(() => Taro.request<ApiResult<T>>({
      ...requestOptions,
      url: `${API_ORIGIN}${path}`,
      timeout: options.timeout ?? 15000,
      header: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
        'Accept-Language': getLocale() === 'en' ? 'en' : 'zh-CN',
      },
    }))
  }
  const response = anonymous ? await send('') : await authenticatedRequest(send, _retried, path === '/api/auth/logout')

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new ApiError(
      (response.data as ApiResult<unknown> | undefined)?.message ||
        t('preferences.requestFailed', { status: response.statusCode }),
      response.statusCode,
    )
  }

  if (!response.data || ![0, 200].includes(response.data.code)) {
    throw new ApiError(
      response.data?.message || t('ui.serviceTemporarilyUnavailable'),
      response.data?.code || -1,
    )
  }

  return response.data.data
}

export function uploadFile<T>(path: string, filePath: string): Promise<T> {
  return traceRequest('UPLOAD', path, trace => executeUpload<T>(path, filePath, trace))
}

async function executeUpload<T>(path: string, filePath: string, trace: RequestTrace): Promise<T> {
  const response = await authenticatedRequest(accessToken => {
    logOutgoingRequest('UPLOAD', path)
    return trace.attempt(() => Taro.uploadFile({
      url: `${API_ORIGIN}${path}`,
      filePath,
      name: 'file',
      timeout: 90000,
      header: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'Accept-Language': getLocale() === 'en' ? 'en' : 'zh-CN',
      },
    }))
  })
  let body: ApiResult<T>
  try {
    body = JSON.parse(response.data) as ApiResult<T>
  } catch {
    throw new ApiError(t('ui.invalidUploadResponse'), response.statusCode)
  }
  if (response.statusCode < 200 || response.statusCode >= 300 || ![0, 200].includes(body.code)) {
    throw new ApiError(body.message || t('ui.uploadFailed'), body.code || response.statusCode)
  }
  return body.data
}

/** Authenticated SSE over WeChat chunked HTTP. Never replay a started mutation. */
export function requestEventStream(
  path: string,
  options: RequestOptions,
  onEvent: (event: AgentStreamEvent) => void,
): { done: Promise<void>; close: () => void } {
  let closed = false
  let task: { abort: () => void } | null = null
  const done = (async () => {
    const response = await authenticatedRequest(async accessToken => {
      if (closed) throw new Error('Stream closed')
      let status = 0
      let streaming = false
      let receivedChunks = false
      let parseError: unknown
      const pending: ArrayBuffer[] = []
      const reader = createEventStreamReader(event => {
        if (!closed) onEvent(event)
      })
      const consume = (data: ArrayBuffer) => {
        if (closed || parseError || status < 200 || status >= 300 || !streaming) return
        try {
          reader.push(data)
        } catch (error) {
          parseError = error
          task?.abort()
        }
      }
      logOutgoingRequest(options.method || 'POST', path)
      if (process.env.TARO_ENV === 'h5') {
        const controller = new AbortController()
        task = { abort: () => controller.abort() }
        const deadline = setTimeout(() => controller.abort(), 600000)
        try {
          const result = await fetch(`${API_ORIGIN}${path}`, {
            method: options.method || 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              ...options.header,
              'Accept-Language': getLocale() === 'en' ? 'en' : 'zh-CN',
            },
            body: options.data === undefined ? undefined : JSON.stringify(options.data),
            signal: controller.signal,
          })
          const streaming =
            result.ok &&
            !!result.body &&
            (result.headers.get('content-type') || '').includes('text/event-stream')
          if (!streaming)
            return { statusCode: result.status, data: await result.text(), streaming: false }
          const source = result.body!.getReader()
          try {
            while (!closed) {
              const chunk = await source.read()
              if (chunk.done) break
              reader.push(
                chunk.value.buffer.slice(
                  chunk.value.byteOffset,
                  chunk.value.byteOffset + chunk.value.byteLength,
                ) as ArrayBuffer,
              )
            }
            reader.finish()
          } finally {
            source.releaseLock()
          }
          return { statusCode: result.status, data: '', streaming: true }
        } finally {
          clearTimeout(deadline)
        }
      }
      const current = Taro.request<ArrayBuffer>({
        ...options,
        url: `${API_ORIGIN}${path}`,
        method: options.method || 'POST',
        enableChunked: true,
        responseType: 'arraybuffer',
        // Stream duration is independent of the short JSON request timeout.
        timeout: 600000,
        header: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...options.header,
          'Accept-Language': getLocale() === 'en' ? 'en' : 'zh-CN',
        },
      })
      task = current
      current.onHeadersReceived(headers => {
        status = (headers as { statusCode?: number }).statusCode ?? 200
        const type = Object.entries(headers.header || {}).find(
          ([key]) => key.toLowerCase() === 'content-type',
        )?.[1]
        streaming = String(type || '')
          .toLowerCase()
          .includes('text/event-stream')
        for (const chunk of pending.splice(0)) consume(chunk)
      })
      current.onChunkReceived(chunk => {
        receivedChunks = true
        if (status) consume(chunk.data)
        else pending.push(chunk.data)
      })
      let result
      try {
        result = await current
      } catch (error) {
        throw parseError || error
      }
      if (closed) return result
      if (result.statusCode >= 200 && result.statusCode < 300 && streaming) {
        if (!receivedChunks) reader.push(result.data)
        reader.finish()
      }
      return { ...result, streaming }
    })
    if (closed) return
    if (
      response.statusCode < 200 ||
      response.statusCode >= 300 ||
      !('streaming' in response) ||
      !response.streaming
    ) {
      let body: { message?: string } = {}
      try {
        body = JSON.parse(
          typeof response.data === 'string'
            ? response.data
            : createUtf8Decoder()(response.data as ArrayBuffer, true),
        )
      } catch {
        /* Use a localized fallback for non-JSON errors. */
      }
      throw new ApiError(body.message || t('ui.serviceTemporarilyUnavailable'), response.statusCode)
    }
  })().catch(error => {
    if (!closed) throw error
  })
  return {
    done,
    close() {
      closed = true
      task?.abort()
    },
  }
}
