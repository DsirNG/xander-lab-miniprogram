import { createElement } from 'react'
import { renderComponent as renderToStaticMarkup } from '../../test/render'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  onShow: null as null | (() => void),
  overview: vi.fn(),
  ledger: vi.fn(),
  ensureLogin: vi.fn(),
  showToast: vi.fn(),
  storage: new Map<string, unknown>(),
}))
vi.mock('@tarojs/taro', () => ({
  useDidHide: vi.fn(),
  default: { showToast: mocks.showToast, getStorageSync: (key: string) => mocks.storage.get(key) },
  useDidShow: (callback: () => void) => {
    const previous = mocks.onShow
    mocks.onShow = () => { previous?.(); callback() }
  },
  useReachBottom: vi.fn(),
}))
vi.mock('@tarojs/components', () => ({ Text: 'span', View: 'div' }))
vi.mock('@/components/NavBar', () => ({ NavBar: () => null }))
vi.mock('@/store/user', () => ({ ensureLogin: mocks.ensureLogin }))
vi.mock('@/api/points', () => ({
  pointsApi: { overview: mocks.overview, ledger: mocks.ledger },
  formatPoints: String,
}))
vi.mock('@/utils/format', () => ({ formatDateTime: String }))

import Points from './index'

beforeEach(() => {
  mocks.onShow = null
  mocks.storage.clear()
  mocks.overview.mockReset()
  mocks.ledger.mockReset()
  mocks.ensureLogin.mockReset().mockReturnValue(true)
  mocks.showToast.mockReset()
})

it('starts both business requests immediately without a profile preflight', () => {
  mocks.overview.mockReturnValue(new Promise(() => {}))
  mocks.ledger.mockReturnValue(new Promise(() => {}))
  renderToStaticMarkup(createElement(Points))
  mocks.onShow!()
  expect(mocks.overview).toHaveBeenCalledTimes(1)
  expect(mocks.ledger).toHaveBeenCalledExactlyOnceWith(1, 20)
  mocks.onShow!()
  expect(mocks.overview).toHaveBeenCalledTimes(1)
  expect(mocks.ledger).toHaveBeenCalledTimes(1)
})

it('still fetches the ledger if the overview fails', async () => {
  mocks.overview.mockRejectedValue(new Error('overview unavailable'))
  mocks.ledger.mockResolvedValue({ records: [], total: 0 })
  renderToStaticMarkup(createElement(Points))
  mocks.onShow!()
  await vi.waitFor(() => expect(mocks.showToast).toHaveBeenCalled())
  expect(mocks.ledger).toHaveBeenCalledTimes(1)
})

it('does not send protected requests without a local session', () => {
  mocks.ensureLogin.mockReturnValue(false)
  renderToStaticMarkup(createElement(Points))
  mocks.onShow!()
  expect(mocks.overview).not.toHaveBeenCalled()
  expect(mocks.ledger).not.toHaveBeenCalled()
})

it('renders the cached balance and recent transactions before refreshing', () => {
  mocks.storage.set('xander_access_token', 'signed-in')
  mocks.storage.set('xander_points_overview_v1', { balance: 325, consumedToday: 0 })
  mocks.storage.set('xander_points_ledger_v1', {
    records: [{ id: 1, delta: 25, remark: 'Cached transaction' }],
    total: 1,
  })
  const html = renderToStaticMarkup(createElement(Points))
  expect(html).toContain('325')
  expect(html).toContain('Cached transaction')
})

it('shows only the total balance without wallet category details', () => {
  mocks.storage.set('xander_access_token', 'signed-in')
  mocks.storage.set('xander_points_overview_v1', {
    balance: 75000,
    subscriptionBalance: 50000,
    permanentBalance: 25000,
    nextExpiry: '2026-12-12T00:00:00Z',
    consumedToday: 0,
  })
  const html = renderToStaticMarkup(createElement(Points))
  expect(html).toContain('75000')
  expect(html).not.toContain('wallet-breakdown')
  expect(html).not.toContain('50000')
  expect(html).not.toContain('25000')
  expect(html).not.toContain('2026-12-12')
})
