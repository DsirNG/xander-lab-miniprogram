import { create } from 'zustand'
import type { TabKey } from '@/utils/tabBarRoute'

type TabBarState = {
  active: TabKey
  setActive: (active: TabKey) => void
}

export const useTabBarStore = create<TabBarState>(set => ({
  active: 'chat',
  setActive: active => set({ active }),
}))
