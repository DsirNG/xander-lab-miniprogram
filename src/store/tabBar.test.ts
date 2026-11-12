import { beforeEach, describe, expect, it, vi } from 'vitest'

const { vibrateShort, ensureLogin } = vi.hoisted(() => ({
  ensureLogin: vi.fn(() => true),
  vibrateShort: vi.fn(() => Promise.resolve()),
}))

vi.mock('@tarojs/taro', () => ({
  default: { vibrateShort, hideKeyboard: vi.fn(() => Promise.resolve()) },
}))

vi.mock('@/store/user', () => ({ ensureLogin }))

import { navigateToTab, useTabBarStore } from './tabBar'

describe('tab bar navigation', () => {
  beforeEach(() => {
    vibrateShort.mockClear()
    ensureLogin.mockReset()
    ensureLogin.mockReturnValue(true)
    useTabBarStore.setState({
      active: 'chat',
      refreshVersions: { chat: 0, files: 0, article: 0, user: 0 },
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

  it('keeps the current tab until the user has logged in', () => {
    let continueNavigation: (() => void) | undefined
    ensureLogin.mockImplementationOnce((...args: unknown[]) => {
      continueNavigation = args[0] as () => void
      return false
    })
    expect(navigateToTab('user')).toBe(false)
    expect(useTabBarStore.getState().active).toBe('chat')
    continueNavigation?.()
    expect(useTabBarStore.getState().active).toBe('user')
  })

  for (const source of ['chat', 'files', 'article', 'user'] as const) {
    for (const target of ['chat', 'files', 'article', 'user'] as const) {
      it(`uses the same selection and refresh rules from ${source} to ${target}`, () => {
        useTabBarStore.setState({ active: source })
        expect(navigateToTab(target)).toBe(source !== target)
        expect(useTabBarStore.getState().active).toBe(target)
        expect(useTabBarStore.getState().refreshVersions).toEqual({
          chat: source === target && target === 'chat' ? 1 : 0,
          files: source === target && target === 'files' ? 1 : 0,
          article: source === target && target === 'article' ? 1 : 0,
          user: source === target && target === 'user' ? 1 : 0,
        })
        expect(vibrateShort).toHaveBeenCalledOnce()
      })
    }
  }
})
