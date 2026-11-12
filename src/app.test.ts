import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(() => Promise.resolve()),
  setUser: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  navigateTo: vi.fn(() => Promise.resolve()),
  getCurrentPages: vi.fn(),
  showModal: vi.fn(),
}))
vi.mock('react', () => ({ useEffect: (effect: () => unknown) => effect() }))
vi.mock('@tarojs/taro', () => ({
  default: {
    eventCenter: { on: mocks.on, off: mocks.off },
    navigateTo: mocks.navigateTo,
    showModal: mocks.showModal,
    getCurrentPages: mocks.getCurrentPages,
  },
}))
vi.mock('@/store/user', () => ({
  useUserStore: (
    selector: (state: { refresh: typeof mocks.refresh; setUser: typeof mocks.setUser }) => unknown,
  ) => selector(mocks),
}))

import App from './app'

beforeEach(() => {
  mocks.on.mockClear()
  mocks.setUser.mockClear()
  mocks.navigateTo.mockClear()
  mocks.showModal.mockReset()
  mocks.showModal.mockResolvedValue({ confirm: true })
  mocks.getCurrentPages.mockReturnValue([{ route: 'pages/points/index' }])
})

it('confirms before opening login after session expiration', async () => {
  App({ children: null })
  const [, handleLogout] = mocks.on.mock.calls[0]
  handleLogout()
  expect(mocks.setUser).toHaveBeenCalledWith(null)
  expect(mocks.navigateTo).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(mocks.navigateTo).toHaveBeenCalledWith({ url: '/pages/login/index' }))
})

it('does not stack another login page when already signing in', () => {
  mocks.getCurrentPages.mockReturnValue([{ route: 'pages/login/index' }])
  App({ children: null })
  const [, handleLogout] = mocks.on.mock.calls[0]
  handleLogout()
  expect(mocks.navigateTo).not.toHaveBeenCalled()
  expect(mocks.showModal).not.toHaveBeenCalled()
})

it('stays on the current page when the login prompt is declined', async () => {
  mocks.showModal.mockResolvedValue({ confirm: false })
  App({ children: null })
  const [, handleLogout] = mocks.on.mock.calls[0]
  handleLogout()
  expect(mocks.showModal).toHaveBeenCalledOnce()
  await Promise.resolve()
  expect(mocks.navigateTo).not.toHaveBeenCalled()
})
