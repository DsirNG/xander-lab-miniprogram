import Taro from '@tarojs/taro'

type ApiResult<T> = {
  code: number
  message: string
  data: T
}

export const API_ORIGIN = process.env.TARO_ENV === 'h5' ? '' : 'https://api.dinqor.cn'

const ACCESS_TOKEN_KEY = 'xander_access_token'
const REFRESH_TOKEN_KEY = 'xander_refresh_token'

export const tokenStorage = {
  getAccessToken: () => Taro.getStorageSync<string>(ACCESS_TOKEN_KEY) || '',
  getRefreshToken: () => Taro.getStorageSync<string>(REFRESH_TOKEN_KEY) || '',
  setTokens: (accessToken: string, refreshToken: string) => {
    Taro.setStorageSync(ACCESS_TOKEN_KEY, accessToken)
    Taro.setStorageSync(REFRESH_TOKEN_KEY, refreshToken)
  },
  clear: () => {
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
let refreshing: Promise<boolean> | null = null

function logOutgoingRequest(method: Taro.request.Method | 'UPLOAD', path: string) {
  // 查询参数、请求头和请求体可能包含凭据或用户数据，发送日志只记录安全的路由信息。
  const pathname = path.split('?')[0]
  console.info(`[HTTP] Sending request: method=${method} path=${pathname}`)
}

function refreshAccessToken(): Promise<boolean> {
  if (refreshing) return refreshing
  refreshing = Promise.resolve()
    .then(async () => {
      const refreshToken = tokenStorage.getRefreshToken()
      if (!refreshToken) return false
      logOutgoingRequest('POST', '/api/auth/refresh')
      const response = await Taro.request<ApiResult<TokenPair>>({
        url: `${API_ORIGIN}/api/auth/refresh`,
        method: 'POST',
        timeout: 15000,
        header: { 'Content-Type': 'application/json' },
        data: { refreshToken },
      })
      if (
        response.statusCode === 200 &&
        response.data?.code === 200 &&
        response.data.data?.accessToken
      ) {
        tokenStorage.setTokens(response.data.data.accessToken, response.data.data.refreshToken)
        return true
      }
      return false
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = tokenStorage.getAccessToken()
  logOutgoingRequest(options.method || 'GET', path)
  const response = await Taro.request<ApiResult<T>>({
    ...options,
    url: `${API_ORIGIN}${path}`,
    timeout: 15000,
    header: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.header,
    },
  })

  if (response.statusCode === 401 && !options._retried) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return request<T>(path, { ...options, _retried: true })
    }
    tokenStorage.clear()
    Taro.eventCenter.trigger('auth:logout')
    throw new ApiError('未登录或登录已过期', 401)
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new ApiError(
      (response.data as ApiResult<unknown> | undefined)?.message ||
        `请求失败（${response.statusCode}）`,
      response.statusCode,
    )
  }

  if (!response.data || ![0, 200].includes(response.data.code)) {
    throw new ApiError(response.data?.message || '服务暂时不可用', response.data?.code || -1)
  }

  return response.data.data
}

export async function uploadFile<T>(path: string, filePath: string): Promise<T> {
  const accessToken = tokenStorage.getAccessToken()
  logOutgoingRequest('UPLOAD', path)
  const response = await Taro.uploadFile({
    url: `${API_ORIGIN}${path}`,
    filePath,
    name: 'file',
    header: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  })
  let body: ApiResult<T>
  try {
    body = JSON.parse(response.data) as ApiResult<T>
  } catch {
    throw new ApiError('上传响应格式错误', response.statusCode)
  }
  if (response.statusCode < 200 || response.statusCode >= 300 || ![0, 200].includes(body.code)) {
    throw new ApiError(body.message || '上传失败', body.code || response.statusCode)
  }
  return body.data
}
