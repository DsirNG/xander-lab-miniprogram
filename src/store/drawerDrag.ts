import { create } from 'zustand'

let frame: ReturnType<typeof setTimeout> | undefined
let latest = 0

export const useDrawerDrag = create<{
  offset: number | null
  setOffset: (offset: number | null) => void
  moveOffset: (offset: number) => void
}>(set => ({
  offset: null,
  setOffset: offset => {
    if (frame !== undefined) clearTimeout(frame)
    frame = undefined
    set({ offset })
  },
  moveOffset: offset => {
    latest = offset
    if (frame !== undefined) return
    frame = setTimeout(() => {
      frame = undefined
      set({ offset: latest })
    }, 16)
  },
}))

export function drawerReleaseTarget(offset: number, width: number, velocity: number) {
  if (Math.abs(velocity) >= 0.45) return velocity > 0
  return offset >= width * 0.45
}

export function drawerOffset(start: number, delta: number, width: number) {
  return Math.max(0, Math.min(width, start + delta))
}
