import { expect, it, vi } from 'vitest'
vi.mock('@tarojs/taro', () => ({ default: {} }))
import { createScrollFollow } from './useChatScroll'
it('follows restored messages and layout resizing, but respects manual history reading', () => {
  const state = createScrollFollow()
  state.observe(600, 1200, 600, false)
  expect(state.following).toBe(true)
  state.observe(600, 1200, 300, false)
  expect(state.following).toBe(true)
  state.observe(400, 1200, 300, true)
  expect(state.following).toBe(false)
  state.observe(400, 1500, 300, false)
  expect(state.following).toBe(false)
  state.observe(1190, 1500, 300, true)
  expect(state.following).toBe(true)
})
it('sending a message or opening another chat resumes following', () => {
  const state = createScrollFollow()
  state.observe(500, 1000, 400, false)
  state.observe(200, 1000, 400, true)
  expect(state.following).toBe(false)
  state.reset()
  expect(state.following).toBe(true)
})
