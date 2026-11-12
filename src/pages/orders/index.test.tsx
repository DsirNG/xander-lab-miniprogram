import { createElement } from 'react'
import { renderComponent } from '../../test/render'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  onShow: null as null | (() => void),
  orders: vi.fn(),
  login: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('@tarojs/taro', () => ({
  default: {
    showToast: mocks.toast,
    getStorageSync: () => '',
    getSystemInfoSync: () => ({ language: 'zh' }),
  },
  useDidShow: (cb: () => void) => {
    mocks.onShow = cb
  },
  useDidHide: vi.fn(),
}))
vi.mock('@tarojs/components', () => ({ ScrollView: 'section', Text: 'span', View: 'div', Button: 'button' }))
vi.mock('@/components/NavBar', () => ({ NavBar: () => null }))
vi.mock('@/components/ThemeView', () => ({ ThemeView: 'div' }))
vi.mock('@/store/user', () => ({ ensureLogin: mocks.login }))
vi.mock('@/api/virtualPay', () => ({ virtualPayApi: { orders: mocks.orders } }))
import Orders from './index'
beforeEach(() => {
  mocks.orders.mockReset()
  mocks.login.mockReset().mockReturnValue(true)
  mocks.toast.mockReset()
})
it('shows the seven-day proportional refund rule and deduplicates initial loads', () => {
  mocks.orders.mockReturnValue(new Promise(() => {}))
  const html = renderComponent(createElement(Orders))
  expect(html).toContain('支付后7天内')
  expect(html).toContain('超过7天不支持申请退款')
  mocks.onShow!()
  mocks.onShow!()
  expect(mocks.orders).toHaveBeenCalledTimes(1)
})
it('never requests another account orders without a session', () => {
  mocks.login.mockReturnValue(false)
  renderComponent(createElement(Orders))
  mocks.onShow!()
  expect(mocks.orders).not.toHaveBeenCalled()
})
it('reports load failures and allows a subsequent retry', async () => {
  mocks.orders.mockRejectedValue(new Error('unavailable'))
  renderComponent(createElement(Orders))
  mocks.onShow!()
  await vi.waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1))
  mocks.orders.mockResolvedValue({ records: [], nextCursor: null })
  mocks.onShow!()
  expect(mocks.orders).toHaveBeenCalledTimes(2)
})
