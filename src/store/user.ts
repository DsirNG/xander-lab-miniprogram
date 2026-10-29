import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { authApi, type UserInfo } from '@/api/auth'
import { ApiError, tokenStorage } from '@/api/http'

export type { UserInfo } from '@/api/auth'

type UserState = {
  user: UserInfo | null
  loaded: boolean
  setUser: (user: UserInfo | null) => void
  /** 合并并发的用户资料请求；网络失败保留缓存，鉴权由请求层处理。 */
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

let userRevision = 0
let pendingRefresh: { token: string; promise: Promise<void> } | null = null

export const useUserStore = create<UserState>(set => ({
  user: null,
  loaded: false,
  setUser: user => {
    userRevision += 1
    pendingRefresh = null
    set({ user, loaded: true })
  },
  refresh: () => {
    const token = tokenStorage.getAccessToken()
    if (!token) {
      userRevision += 1
      pendingRefresh = null
      set({ user: null, loaded: true })
      return Promise.resolve()
    }
    if (pendingRefresh?.token === token) return pendingRefresh.promise
    const revision = ++userRevision
    const promise = authApi
      .me()
      .then(user => {
        // 已退出或切换账号时，旧请求不能恢复先前的用户资料。
        if (revision === userRevision && authApi.isLoggedIn()) set({ user, loaded: true })
      })
      .catch(error => {
        if (revision !== userRevision) return
        if (error instanceof ApiError && error.code === 401) {
          set({ user: null, loaded: true })
        } else {
          // 网络失败不代表登录失效，保留已有资料供页面使用。
          set({ loaded: true })
        }
      })
      .finally(() => {
        if (pendingRefresh?.promise === promise) pendingRefresh = null
      })
    pendingRefresh = { token, promise }
    return promise
  },
  logout: async () => {
    try {
      await authApi.logout()
    } catch {
      // 登出接口失败也清除本地凭证
    }
    set({ user: null })
    Taro.removeStorageSync('chat_active_id')
  },
}))

export function ensureLogin(): boolean {
  if (authApi.isLoggedIn()) return true
  Taro.navigateTo({ url: '/pages/login/index' })
  return false
}
