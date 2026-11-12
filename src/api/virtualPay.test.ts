import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('./http', () => ({ request: vi.fn() }))
import { request } from './http'
import { virtualPayApi } from './virtualPay'
beforeEach(() => vi.mocked(request).mockReset())
it('uses the shared authenticated transport for pagination and refund confirmation', async () => {
  await virtualPayApi.orders(42)
  expect(request).toHaveBeenLastCalledWith('/api/virtual-pay/orders?before=42', { method: 'GET' })
  await virtualPayApi.refund('order1234', 150)
  expect(request).toHaveBeenLastCalledWith('/api/virtual-pay/orders/order1234/refund', {
    method: 'POST',
    data: { expectedAmount: 150 },
  })
})
it('encodes order identifiers and separates quote from refund status', async () => {
  await virtualPayApi.refundQuote('a/b')
  expect(request).toHaveBeenLastCalledWith('/api/virtual-pay/orders/a%2Fb/refund-quote', {
    method: 'GET',
  })
  await virtualPayApi.refundStatus('order1234')
  expect(request).toHaveBeenLastCalledWith('/api/virtual-pay/orders/order1234/refund-status', {
    method: 'GET',
  })
})
