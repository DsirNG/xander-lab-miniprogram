import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { authApi, type UserInfo } from '@/api/auth'

export type { UserInfo } from '@/api/auth'

type UserState = {
  user: UserInfo | null
  loaded: boolean
  setUser: (user: UserInfo | null) => void
  /** 按需拉取当前用户；未登录或失效时置空并清理凭证 */
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

export const useUserStore = create<UserState>(set => ({
  user: null,
  loaded: false,
  setUser: user => set({ user, loaded: true }),
  refresh: async () => {
    if (!authApi.isLoggedIn()) {
      set({ user: null, loaded: true })
      return
    }
    try {
      const user = await authApi.me()
      set({ user, loaded: true })
    } catch {
      set({ user: null, loaded: true })
    }
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
  if (useUserStore.getState().user || authApi.isLoggedIn()) return true
  Taro.navigateTo({ url: '/pages/login/index' })
  return false
}
