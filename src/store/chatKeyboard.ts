import { create } from 'zustand'

export const useChatKeyboard = create<{ height: number; setHeight: (height: number) => void }>(
  (set, get) => ({
    height: 0,
    setHeight: height => {
      const next = Number.isFinite(height) ? Math.max(0, Math.round(height)) : 0
      if (next !== get().height) set({ height: next })
    },
  }),
)
