import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { TabKey } from '@/utils/tabBarRoute'

type TabBarState = {
  active: TabKey
  setActive: (active: TabKey) => void
  refreshVersions: Record<TabKey, number>
  refreshTab: (tab: TabKey) => void
  pendingBlogTag: string | null
  setPendingBlogTag: (tag: string | null) => void
}

export const useTabBarStore = create<TabBarState>(set => ({
  active: 'chat',
  setActive: active => set({ active }),
  refreshVersions: {
    chat: 0,
    calendar: 0,
    article: 0,
    user: 0,
  },
  refreshTab: tab =>
    set(state => {
      return {
        refreshVersions: {
          ...state.refreshVersions,
          [tab]: state.refreshVersions[tab] + 1,
        },
      }
    }),
  pendingBlogTag: null,
  setPendingBlogTag: pendingBlogTag => set({ pendingBlogTag }),
}))

/** Centralized top-level navigation action used by the TabBar and in-panel shortcuts. */
export function navigateToTab(tab: TabKey, vibration: 'light' | 'medium' | 'heavy' = 'light') {
  const state = useTabBarStore.getState()
  if (state.active === tab) {
    // Refresh the active panel without changing the selected indicator.
    console.log('[TabBar] SAME_TAB_REFRESH', {
      tab,
      version: state.refreshVersions[tab] + 1,
    })
    state.refreshTab(tab)
    void Taro.vibrateShort({ type: vibration }).catch(() => undefined)
    return false
  }

  state.setActive(tab)
  void Taro.vibrateShort({ type: vibration }).catch(() => undefined)
  return true
}
