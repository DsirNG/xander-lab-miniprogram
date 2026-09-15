import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { TabKey } from '@/utils/tabBarRoute'

type TabBarState = {
  active: TabKey
  setActive: (active: TabKey) => void
  pendingBlogTag: string | null
  setPendingBlogTag: (tag: string | null) => void
}

export const useTabBarStore = create<TabBarState>(set => ({
  active: 'chat',
  setActive: active => set({ active }),
  pendingBlogTag: null,
  setPendingBlogTag: pendingBlogTag => set({ pendingBlogTag }),
}))

/** Centralized top-level navigation action used by the TabBar and in-panel shortcuts. */
export function navigateToTab(tab: TabKey, vibration: 'light' | 'medium' | 'heavy' = 'light') {
  const state = useTabBarStore.getState()
  if (state.active === tab) return false

  state.setActive(tab)
  void Taro.vibrateShort({ type: vibration }).catch(() => undefined)
  return true
}
