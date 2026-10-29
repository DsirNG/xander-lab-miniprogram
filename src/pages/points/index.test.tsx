import { createElement } from 'react'
import { renderComponent as renderToStaticMarkup } from '../../test/render'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  onShow: null as null | (() => void),
  overview: vi.fn(),
  ledger: vi.fn(),
  ensureLogin: vi.fn(),
  showToast: vi.fn(),
}))
vi.mock('@tarojs/taro', () => ({
  default: { showToast: mocks.showToast },
  useDidShow: (callback: () => void) => {
    mocks.onShow = callback
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
