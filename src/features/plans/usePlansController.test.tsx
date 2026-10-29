import { createElement } from 'react'
import { renderComponent as renderToStaticMarkup } from '../../test/render'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  onShow: null as null | (() => Promise<void>),
  list: vi.fn(),
  isLoggedIn: vi.fn(),
}))
vi.mock('@tarojs/taro', () => ({ default: { showToast: vi.fn() } }))
vi.mock('@/api/auth', () => ({ authApi: { isLoggedIn: mocks.isLoggedIn } }))
vi.mock('@/api/plans', () => ({ planApi: { list: mocks.list } }))
vi.mock('@/hooks/usePanelActive', () => ({
  usePanelActive: (_active: boolean, options: { onShow: () => Promise<void> }) => {
    mocks.onShow = options.onShow
  },
}))
vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: { user: null; loaded: boolean }) => unknown) =>
    selector({ user: null, loaded: false }),
}))

import { usePlansController } from './usePlansController'

function Probe() {
  const controller = usePlansController(true)
  return createElement('span', null, String(controller.hasSession))
}

beforeEach(() => {
  mocks.isLoggedIn.mockReset().mockReturnValue(true)
  mocks.list.mockReset().mockResolvedValue({ records: [], total: 0 })
})

it('fetches plans while user information is still unavailable', async () => {
  expect(renderToStaticMarkup(createElement(Probe))).toContain('true')
  await mocks.onShow!()
  expect(mocks.list).toHaveBeenCalledExactlyOnceWith({ page: 1, size: 10 })
})

it('does not fetch plans without a token', async () => {
  mocks.isLoggedIn.mockReturnValue(false)
  renderToStaticMarkup(createElement(Probe))
  await mocks.onShow!()
  expect(mocks.list).not.toHaveBeenCalled()
})
