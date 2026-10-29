import { createElement } from 'react'
import { renderComponent as renderToStaticMarkup } from '../../test/render'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  onShow: null as null | (() => void),
  catalog: vi.fn(),
  refresh: vi.fn(),
  ensureLogin: vi.fn(),
}))
vi.mock('@tarojs/taro', () => ({
  default: { showToast: vi.fn() },
  useDidShow: (callback: () => void) => {
    mocks.onShow = callback
  },
}))
vi.mock('@tarojs/components', () => ({ Text: 'span', View: 'div' }))
vi.mock('@/components/NavBar', () => ({ NavBar: () => null }))
vi.mock('@/components/ui/Button', () => ({ Button: () => null }))
vi.mock('@/i18n', () => ({ t: (key: string) => key, useLocale: () => 'zh' }))
vi.mock('@/api/virtualPay', () => ({ virtualPayApi: { catalog: mocks.catalog } }))
vi.mock('@/store/user', () => ({
  ensureLogin: mocks.ensureLogin,
  useUserStore: Object.assign(
    (selector: (state: { user: null }) => unknown) => selector({ user: null }),
    {
      getState: () => ({ refresh: mocks.refresh }),
    },
  ),
}))

import Subscription from './index'

beforeEach(() => {
  mocks.refresh.mockReset().mockReturnValue(new Promise(() => {}))
  mocks.catalog.mockReset().mockReturnValue(new Promise(() => {}))
  mocks.ensureLogin.mockReset().mockReturnValue(true)
})

it('loads the product catalog without waiting for user information', () => {
  renderToStaticMarkup(createElement(Subscription))
  mocks.onShow!()
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
  expect(mocks.catalog).toHaveBeenCalledTimes(1)
  mocks.onShow!()
  expect(mocks.catalog).toHaveBeenCalledTimes(1)
})

it('does not load a protected page without a local session', () => {
  mocks.ensureLogin.mockReturnValue(false)
  renderToStaticMarkup(createElement(Subscription))
  mocks.onShow!()
  expect(mocks.catalog).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
})
