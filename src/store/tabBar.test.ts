import { beforeEach, describe, expect, it, vi } from 'vitest'

const { vibrateShort } = vi.hoisted(() => ({
  vibrateShort: vi.fn(() => Promise.resolve()),
}))

vi.mock('@tarojs/taro', () => ({
  default: { vibrateShort },
}))

import { navigateToTab, useTabBarStore } from './tabBar'

describe('tab bar navigation', () => {
  beforeEach(() => {
    vibrateShort.mockClear()
    useTabBarStore.setState({
      active: 'chat',
      refreshVersions: { chat: 0, calendar: 0, article: 0, user: 0 },
    })
  })

  it('refreshes a second tap on the active tab without changing selection', () => {
    expect(navigateToTab('chat')).toBe(false)
    expect(useTabBarStore.getState().active).toBe('chat')
    expect(useTabBarStore.getState().refreshVersions.chat).toBe(1)
    expect(vibrateShort).toHaveBeenCalledOnce()
  })

  it('changes tabs and gives feedback for a new selection', () => {
    expect(navigateToTab('article')).toBe(true)
    expect(useTabBarStore.getState().active).toBe('article')
    expect(vibrateShort).toHaveBeenCalledOnce()
  })
})
