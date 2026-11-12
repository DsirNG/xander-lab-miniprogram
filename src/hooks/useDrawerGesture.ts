import { getDrawerTravel } from '@/utils/drawerGeometry'
import type { CommonEventFunction, ITouchEvent } from '@tarojs/components'
import { useRef } from 'react'
import { drawerOffset, drawerReleaseTarget, useDrawerDrag } from '@/store/drawerDrag'

type Gesture = {
  x: number; y: number; width: number; start: number
  offset: number; lastX: number; lastAt: number; velocity: number
  locked: boolean; rejected: boolean; wasOpen: boolean
}

export function useDrawerGesture({
  phase,
  reveal,
  settle,
  enabled,
}: {
  phase: () => string
  reveal: () => void
  settle: (open: boolean) => void
  enabled: boolean | (() => boolean)
}) {
  const gesture = useRef<Gesture | null>(null)
  const suppressUntil = useRef(0)
  const start: CommonEventFunction = event => {
    gesture.current = null
    if (!(typeof enabled === 'function' ? enabled() : enabled) || phase() === 'closing') return
    const touches = (event as ITouchEvent).touches
    if (touches.length !== 1) return
    const touch = touches[0]
    const width = getDrawerTravel()
    const wasOpen = phase() === 'open'
    gesture.current = {
      x: touch.clientX, y: touch.clientY, width, start: wasOpen ? width : 0,
      offset: wasOpen ? width : 0, lastX: touch.clientX, lastAt: Date.now(),
      velocity: 0, locked: false, rejected: false, wasOpen,
    }
  }
  const move: CommonEventFunction = event => {
    const current = gesture.current
    const touches = (event as ITouchEvent).touches
    if (!current || current.rejected || touches.length !== 1) return
    const touch = touches[0]
    const dx = touch.clientX - current.x
    const dy = touch.clientY - current.y
    if (!current.locked) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return
      if (Math.abs(dx) <= Math.abs(dy) * 1.3 || (!current.wasOpen && dx <= 0)) {
        current.rejected = true
        return
      }
      current.locked = true
      useDrawerDrag.getState().setOffset(current.start)
      reveal()
    }
    const now = Date.now()
    const dt = now - current.lastAt
    if (dt > 0) current.velocity = (touch.clientX - current.lastX) / dt
    current.lastX = touch.clientX
    current.lastAt = now
    current.offset = drawerOffset(current.start, dx, current.width)
    useDrawerDrag.getState().moveOffset(current.offset)
    event.stopPropagation()
  }
  const finish = (cancelled: boolean) => {
    const current = gesture.current
    gesture.current = null
    if (!current?.locked) return
    suppressUntil.current = Date.now() + 350
    const velocity = Date.now() - current.lastAt > 100 ? 0 : current.velocity
    settle(cancelled ? current.wasOpen : drawerReleaseTarget(current.offset, current.width, velocity))
    useDrawerDrag.getState().setOffset(null)
  }
  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: () => finish(false),
    onTouchCancel: () => finish(true),
    suppressClick: () => Date.now() < suppressUntil.current,
  }
}
