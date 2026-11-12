import { expect, it } from 'vitest'
import type { VirtualPayOrder } from '@/api/virtualPay'
import { orderState, paymentCountdown } from './status'
const order = { status: 'PENDING', createdAt: '2026-11-12T00:00:00Z', refund: null } as VirtualPayOrder
it('marks the exact fifteen-minute boundary expired and never enables a negative countdown', () => {
  const start = Date.parse(order.createdAt!)
  expect(orderState(order, start + 899999)).toBe('PENDING')
  expect(paymentCountdown(order, start)).toBe('15:00')
  expect(orderState(order, start + 900000)).toBe('EXPIRED')
  expect(paymentCountdown(order, start + 900001)).toBe('00:00')
  expect(orderState({ ...order, status: 'DELIVERED' }, start + 900001)).toBe('DELIVERED')
})
it('uses the server deadline and distinguishes refund failure from payment failure', () => {
  expect(orderState({ ...order, expiresAt: '2026-11-12T00:01:00Z' }, Date.parse('2026-11-12T00:01:00Z'))).toBe('EXPIRED')
  expect(orderState({ ...order, refund: { status: 'FAILED', refundId: 'r', refundFee: 100 } }, 0)).toBe('REFUND_FAILED')
})
