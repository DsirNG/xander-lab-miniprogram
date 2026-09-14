import { create } from 'zustand'
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
