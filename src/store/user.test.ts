import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ token: 'access', me: vi.fn(), navigateTo: vi.fn() }))
vi.mock('@tarojs/taro', () => ({
  default: { navigateTo: mocks.navigateTo, removeStorageSync: vi.fn() },
}))
vi.mock('@/api/auth', () => ({ authApi: { me: mocks.me, isLoggedIn: () => Boolean(mocks.token) } }))
vi.mock('@/api/http', () => ({
  tokenStorage: { getAccessToken: () => mocks.token },
  ApiError: class extends Error {
    constructor(
      public message: string,
      public code: number,
    ) {
      super(message)
    }
  },
}))

import { ApiError } from '@/api/http'
import type { UserInfo } from '@/api/auth'
import { ensureLogin, useUserStore } from './user'

const user = { username: 'alice' } as UserInfo

describe('user profile synchronization', () => {
  beforeEach(() => {
    mocks.token = 'access'
    mocks.me.mockReset()
    mocks.navigateTo.mockReset()
    useUserStore.getState().setUser(null)
  })

  it('deduplicates concurrent profile requests', async () => {
    let resolve!: (value: UserInfo) => void
    mocks.me.mockReturnValue(
      new Promise<UserInfo>(done => {
        resolve = done
      }),
    )
    const first = useUserStore.getState().refresh()
    const second = useUserStore.getState().refresh()
    expect(mocks.me).toHaveBeenCalledTimes(1)
    resolve(user)
    await Promise.all([first, second])
    expect(useUserStore.getState().user).toEqual(user)
  })

  it('preserves cached user information after a network failure', async () => {
    useUserStore.getState().setUser(user)
    mocks.me.mockRejectedValue(new Error('offline'))
    await useUserStore.getState().refresh()
    expect(useUserStore.getState().user).toEqual(user)
  })

  it('clears cached user information for a confirmed authentication failure', async () => {
    useUserStore.getState().setUser(user)
    mocks.me.mockRejectedValue(new ApiError('expired', 401))
    await useUserStore.getState().refresh()
    expect(useUserStore.getState().user).toBeNull()
  })

  it('ignores an old profile response after logout or account replacement', async () => {
    let resolve!: (value: UserInfo) => void
    mocks.me.mockReturnValue(
      new Promise<UserInfo>(done => {
        resolve = done
      }),
    )
    const pending = useUserStore.getState().refresh()
    useUserStore.getState().setUser(null)
    mocks.token = ''
    resolve(user)
    await pending
    expect(useUserStore.getState().user).toBeNull()
  })

  it('uses the local token for navigation without a profile preflight', () => {
    expect(ensureLogin()).toBe(true)
    expect(mocks.me).not.toHaveBeenCalled()
    useUserStore.getState().setUser(user)
    mocks.token = ''
    expect(ensureLogin()).toBe(false)
    expect(mocks.navigateTo).toHaveBeenCalledWith({ url: '/pages/login/index' })
  })
})
