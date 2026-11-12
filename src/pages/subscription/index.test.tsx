import { createElement } from 'react'
import { renderComponent as renderToStaticMarkup } from '../../test/render'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  onShow: null as null | (() => void),
  catalog: vi.fn(),
  refresh: vi.fn(),
  ensureLogin: vi.fn(),
  overview: vi.fn(),
}))
vi.mock('@tarojs/taro', () => ({
  useDidHide: vi.fn(),
  default: { showToast: vi.fn() },
  useDidShow: (callback: () => void) => {
    const previous = mocks.onShow
    mocks.onShow = () => { previous?.(); callback() }
  },
}))
vi.mock('@tarojs/components', () => ({
  ScrollView: 'section', Text: 'span',
  View: 'div',
  Swiper: 'section',
  SwiperItem: 'article',
}))
vi.mock('@/components/Icon', () => ({ Icon: () => null }))
vi.mock('@/components/NavBar', () => ({ NavBar: () => null }))
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, disabled }: { children?: import('react').ReactNode; disabled?: boolean }) =>
    createElement('button', { disabled }, children),
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key, useLocale: () => 'zh' }))
vi.mock('@/api/virtualPay', () => ({ virtualPayApi: { catalog: mocks.catalog } }))
vi.mock('@/api/points', () => ({
  pointsApi: { overview: mocks.overview },
  formatPoints: (value: number) => String(value / 1000),
}))
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
  mocks.onShow = null
  mocks.refresh.mockReset().mockReturnValue(new Promise(() => {}))
  mocks.catalog.mockReset().mockReturnValue(new Promise(() => {}))
  mocks.ensureLogin.mockReset().mockReturnValue(true)
  mocks.overview.mockReset().mockReturnValue(new Promise(() => {}))
})

it('loads the product catalog without waiting for user information', () => {
  renderToStaticMarkup(createElement(Subscription))
  mocks.onShow!()
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
  expect(mocks.catalog).toHaveBeenCalledTimes(1)
  expect(mocks.overview).not.toHaveBeenCalled()
  mocks.onShow!()
  expect(mocks.catalog).toHaveBeenCalledTimes(1)
})

it('does not load a protected page without a local session', () => {
  mocks.ensureLogin.mockReturnValue(false)
  renderToStaticMarkup(createElement(Subscription))
  mocks.onShow!()
  expect(mocks.catalog).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(mocks.overview).not.toHaveBeenCalled()
})

it('hides wallet details and shows a points-card section without inventing unloaded products', () => {
  const html = renderToStaticMarkup(createElement(Subscription))
  for (const price of ['¥2.00', '¥4.00', '¥10.00']) expect(html).not.toContain(price)
  expect(html).not.toContain('wallet.subscription')
  expect(html).not.toContain('wallet.permanent')
  expect(html).toContain('subscription.pointsCardRule')
  expect(html).toContain('wallet.subscriberOnly')
})
