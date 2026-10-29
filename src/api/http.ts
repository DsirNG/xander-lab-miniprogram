import { getLocale, t } from '@/i18n'
import Taro from '@tarojs/taro'

type ApiResult<T> = {
  code: number
  message: string
  data: T
}

export const API_SERVER_ORIGIN = 'https://api.xiaodongding.dpdns.org'
export const API_ORIGIN = process.env.TARO_ENV === 'h5' ? '' : API_SERVER_ORIGIN

const ACCESS_TOKEN_KEY = 'xander_access_token'
const REFRESH_TOKEN_KEY = 'xander_refresh_token'
let sessionVersion = 0

function persistTokens(accessToken: string, refreshToken: string) {
  Taro.setStorageSync(ACCESS_TOKEN_KEY, accessToken)
  Taro.setStorageSync(REFRESH_TOKEN_KEY, refreshToken)
}

export const tokenStorage = {
  getAccessToken: () => Taro.getStorageSync<string>(ACCESS_TOKEN_KEY) || '',
  getRefreshToken: () => Taro.getStorageSync<string>(REFRESH_TOKEN_KEY) || '',
  setTokens: (accessToken: string, refreshToken: string) => {
    sessionVersion += 1
    persistTokens(accessToken, refreshToken)
  },
  clear: () => {
    sessionVersion += 1
    Taro.removeStorageSync(ACCESS_TOKEN_KEY)
    Taro.removeStorageSync(REFRESH_TOKEN_KEY)
  },
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
}

/** 无感刷新：并发 401 只触发一次刷新，成功后返回是否可重试原请求 */
let refreshing: { session: number; promise: Promise<boolean> } | null = null

function logOutgoingRequest(method: keyof Taro.request.Method | 'UPLOAD', path: string) {
  // 查询参数、请求头和请求体可能包含凭据或用户数据，发送日志只记录安全的路由信息。
  const pathname = path.split('?')[0]
  console.info(`[HTTP] Sending request: method=${method} path=${pathname}`)
}

function refreshAccessToken(): Promise<boolean> {
  const session = sessionVersion
  if (refreshing?.session === session) return refreshing.promise
  const refreshToken = tokenStorage.getRefreshToken()
  const promise = Promise.resolve()
    .then(async () => {
      if (!refreshToken || session !== sessionVersion) return false
      logOutgoingRequest('POST', '/api/auth/refresh')
      const response = await Taro.request<ApiResult<TokenPair>>({
        url: `${API_ORIGIN}/api/auth/refresh`,
        method: 'POST',
        timeout: 15000,
        header: {
          'Content-Type': 'application/json',
          'Accept-Language': getLocale() === 'en' ? 'en' : 'zh-CN',
        },
        data: { refreshToken },
      })
      if (
        response.statusCode === 200 &&
        response.data?.code === 200 &&
        response.data.data?.accessToken &&
        response.data.data?.refreshToken
      ) {
        if (session !== sessionVersion || tokenStorage.getRefreshToken() !== refreshToken)
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
): Promise<T> {
  const accessToken = tokenStorage.getAccessToken()
  const session = sessionVersion
  const response = await send(accessToken)
  if (response.statusCode === 401) {
    if (!retried && accessToken && session === sessionVersion) {
      // 另一个并发请求可能已完成刷新，迟到的 401 直接使用新令牌重试。
      const currentToken = tokenStorage.getAccessToken()
      if (
        currentToken &&
        (currentToken !== accessToken || (await refreshAccessToken())) &&
        session === sessionVersion
      ) {
        return authenticatedRequest(send, true)
      }
    }
    if (
      session === sessionVersion &&
      tokenStorage.getAccessToken() === accessToken &&
      accessToken
    ) {
      tokenStorage.clear()
      Taro.eventCenter.trigger('auth:logout')
    }
    throw new ApiError(t('ui.pleaseSignInAgain'), 401)
  }
  return response
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { _retried, ...requestOptions } = options
  const response = await authenticatedRequest(accessToken => {
    logOutgoingRequest(options.method || 'GET', path)
    return Taro.request<ApiResult<T>>({
      ...requestOptions,
      url: `${API_ORIGIN}${path}`,
      timeout: options.timeout ?? 15000,
      header: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.header,
        'Accept-Language': getLocale() === 'en' ? 'en' : 'zh-CN',
      },
    })
  }, _retried)

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

export async function uploadFile<T>(path: string, filePath: string): Promise<T> {
  const response = await authenticatedRequest(accessToken => {
    logOutgoingRequest('UPLOAD', path)
    return Taro.uploadFile({
      url: `${API_ORIGIN}${path}`,
      filePath,
      name: 'file',
      header: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'Accept-Language': getLocale() === 'en' ? 'en' : 'zh-CN',
      },
    })
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
