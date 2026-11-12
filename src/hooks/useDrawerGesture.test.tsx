import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderComponent } from '@/test/render'
import { useDrawerGesture } from './useDrawerGesture'
import { useDrawerDrag } from '@/store/drawerDrag'

vi.mock('@tarojs/taro', () => ({
  default: { getWindowInfo: () => ({ windowWidth: 400 }) },
}))

const touch = (x: number, y = 0) => ({
  touches: [{ clientX: x, clientY: y }],
  stopPropagation: vi.fn(),
}) as any

beforeEach(() => {
  useDrawerDrag.getState().setOffset(null)
  vi.restoreAllMocks()
  vi.useFakeTimers()
})

afterEach(() => vi.useRealTimers())

function setup(initial: 'open' | 'closed' = 'closed') {
  let phase: string = initial
  let gesture!: ReturnType<typeof useDrawerGesture>
  const settle = vi.fn((open: boolean) => { phase = open ? 'open' : 'closed' })
  const reveal = vi.fn(() => { phase = 'open' })
  function Probe() {
    gesture = useDrawerGesture({ phase: () => phase, reveal, settle, enabled: true })
    return null
  }
  renderComponent(createElement(Probe))
  return { gesture, settle, reveal }
}

it('tracks horizontal position before release and settles by distance after a pause', () => {
  let time = 0
  vi.spyOn(Date, 'now').mockImplementation(() => time)
  const { gesture, settle } = setup()
  gesture.onTouchStart(touch(10))
  time = 300
  gesture.onTouchMove(touch(190))
  vi.advanceTimersByTime(16)
  expect(useDrawerDrag.getState().offset).toBe(180)
  time = 500
  gesture.onTouchEnd()
  expect(settle).toHaveBeenCalledWith(true)
  expect(useDrawerDrag.getState().offset).toBeNull()
  expect(gesture.suppressClick()).toBe(true)
})

it('leaves vertical scrolling alone and restores the starting state after touch cancellation', () => {
  const vertical = setup()
  vertical.gesture.onTouchStart(touch(10, 10))
  vertical.gesture.onTouchMove(touch(15, 60))
  vertical.gesture.onTouchEnd()
  expect(vertical.reveal).not.toHaveBeenCalled()
  expect(vertical.settle).not.toHaveBeenCalled()

  const open = setup('open')
  open.gesture.onTouchStart(touch(250))
  open.gesture.onTouchMove(touch(100))
  vi.advanceTimersByTime(16)
  expect(useDrawerDrag.getState().offset).toBe(130)
  open.gesture.onTouchCancel()
  expect(open.settle).toHaveBeenCalledWith(true)
})

it('clamps overdrag and permits a quick flick to close', () => {
  let time = 0
  vi.spyOn(Date, 'now').mockImplementation(() => time)
  const { gesture, settle } = setup('open')
  gesture.onTouchStart(touch(250))
  time = 20
  gesture.onTouchMove(touch(230))
  vi.advanceTimersByTime(16)
  expect(useDrawerDrag.getState().offset).toBe(260)
  gesture.onTouchEnd()
  expect(settle).toHaveBeenCalledWith(false)
  const next = setup()
  next.gesture.onTouchStart(touch(0))
  next.gesture.onTouchMove(touch(700))
  vi.advanceTimersByTime(16)
  expect(useDrawerDrag.getState().offset).toBe(280)
})
