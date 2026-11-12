import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@tarojs/taro', () => ({ default: {} }))

import { useDrawerDrag } from './drawerDrag'
import { drawerTravel } from '@/utils/drawerGeometry'

afterEach(() => {
  useDrawerDrag.getState().setOffset(null)
  vi.useRealTimers()
})

it('coalesces high-frequency moves and discards pending work on release', () => {
  vi.useFakeTimers()
  useDrawerDrag.getState().setOffset(0)
  const changed = vi.fn()
  const unsubscribe = useDrawerDrag.subscribe(changed)
  for (let offset = 1; offset <= 20; offset++) useDrawerDrag.getState().moveOffset(offset)
  expect(changed).not.toHaveBeenCalled()
  vi.advanceTimersByTime(16)
  expect(changed).toHaveBeenCalledOnce()
  expect(useDrawerDrag.getState().offset).toBe(20)
  useDrawerDrag.getState().moveOffset(50)
  useDrawerDrag.getState().setOffset(null)
  vi.advanceTimersByTime(16)
  expect(useDrawerDrag.getState().offset).toBeNull()
  unsubscribe()
})

it('leaves a wider right strip with the panel edge before the WeChat capsule', () => {
  expect(drawerTravel(400)).toBe(280)
  expect(drawerTravel(400, 280)).toBe(264)
  expect(400 - drawerTravel(400, 280)).toBeGreaterThan(400 * 0.22)
})
