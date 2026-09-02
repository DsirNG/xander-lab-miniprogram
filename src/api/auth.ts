import { request, saveTokenPair, tokenStorage, uploadFile, type TokenPair } from './http'

export type UserInfo = {
  username: string
  nickname: string
  avatar: string
  role: string
  tier: string
  tierExpiresAt: string | null
  email: string | null
  createdAt: string
}

export type TokenResponse = {
  accessToken?: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
  userInfo?: UserInfo
  /** 邮箱为空（临时微信账号）时为 true，前端据此引导绑定邮箱 */
  needsEmailBinding?: boolean
  /** 首次微信登录（openid 未注册）为 true：未建号，需用 pendingBindToken 绑定邮箱或跳过 */
  pendingBind?: boolean
  /** 待绑定凭证（10 分钟有效，仅用于 wechat-bind / wechat-skip 端点） */
  pendingBindToken?: string
}

export const authApi = {
  /** 发送邮箱验证码（绑定流程与账号登录共用同一个 Redis 验证码） */
  sendCode: async (email: string) => {
    await request<void>('/api/auth/code', {
      method: 'GET',
      data: { email },
    })
  },
  /**
   * 微信小程序登录：Taro.login() 的 code 换取平台 token。
   * - openid 已注册 / 已绑定既有账号 → 直接返回 token（自动写入本地凭证）。
   * - openid 首次登录 → 返回 pendingBind=true + pendingBindToken，不写入凭证，
   *   由页面引导用户绑定邮箱（与 PC 同号）或跳过绑定。
   */
  wechatLogin: async (code: string) => {
    const response = await request<TokenResponse>('/api/auth/wechat-login', {
      method: 'POST',
      data: { code },
    })
    if (response.accessToken) {
      saveTokenPair(response as TokenPair)
    }
    return response
  },
  /** 首次微信登录「绑定邮箱」：邮箱已是既有 PC 账号时合并为同一账号 */
  bindWechat: async (pendingBindToken: string, email: string, code: string) => {
    const response = await request<TokenResponse>('/api/auth/wechat-bind', {
      method: 'POST',
      data: { pendingBindToken, email, code },
    })
    if (response.accessToken) {
      saveTokenPair(response as TokenPair)
    }
    return response
  },
  /** 首次微信登录「跳过绑定」：创建临时微信账号（稍后可在账户设置里补绑邮箱） */
  skipBind: async (pendingBindToken: string) => {
    const response = await request<TokenResponse>('/api/auth/wechat-skip', {
      method: 'POST',
      data: { pendingBindToken },
    })
    if (response.accessToken) {
      saveTokenPair(response as TokenPair)
    }
    return response
  },
  /** 已登录的未绑定微信账号补绑邮箱：邮箱已是既有 PC 账号时执行账号合并 */
  bindExisting: async (email: string, code: string) => {
    const response = await request<TokenResponse>('/api/auth/wechat-bind-existing', {
      method: 'POST',
      data: { email, code },
    })
    if (response.accessToken) {
      saveTokenPair(response as TokenPair)
    }
    return response
  },
  /** 账号密码登录（用户名或邮箱） */
  login: async (account: string, password: string) => {
    const response = await request<TokenResponse>('/api/auth/login', {
      method: 'POST',
      data: { type: 'password', account, password },
    })
    if (response.accessToken) {
      saveTokenPair(response as TokenPair)
    }
    return response
  },
  /** 邮箱注册（注册即登录） */
  register: async (email: string, password: string, name: string) => {
    const response = await request<TokenResponse>('/api/auth/register', {
      method: 'POST',
      data: { email, password, name },
    })
    if (response.accessToken) {
      saveTokenPair(response as TokenPair)
    }
    return response
  },
  /** 如已登录，返回当前用户信息 */
  me: () => request<UserInfo>('/api/auth/me', { method: 'GET' }),
  /** 更新昵称 / 头像 */
  updateProfile: (data: { username?: string; nickname?: string; avatar?: string }) =>
    request<UserInfo>('/api/auth/profile', { method: 'PUT', data }),
  uploadAvatar: (filePath: string) =>
    uploadFile<{ url: string }>('/api/upload/oss?type=avatar', filePath),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/api/auth/password', { method: 'PUT', data: { currentPassword, newPassword } }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<void>('/api/auth/reset-password', {
      method: 'POST',
      data: { email, code, newPassword },
    }),
  /** 登出当前设备 */
  logout: async () => {
    try {
      await request<void>('/api/auth/logout', { method: 'POST' })
    } finally {
      tokenStorage.clear()
    }
  },
  isLoggedIn: () => Boolean(tokenStorage.getAccessToken()),
}
