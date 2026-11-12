import type { VirtualPayOrder } from '@/api/virtualPay'
export function orderDeadline(order: VirtualPayOrder) {
  return order.expiresAt ? Date.parse(order.expiresAt) : Date.parse(order.createdAt ?? '') + 15 * 60 * 1000
}
export function orderState(order: VirtualPayOrder, now: number) {
  if (order.refund) return order.refund.status === 'FAILED' ? 'REFUND_FAILED' : order.refund.status
  if (order.status === 'PENDING' && !(orderDeadline(order) > now)) return 'EXPIRED'
  return order.status
}
export function paymentCountdown(order: VirtualPayOrder, now: number) {
  const seconds = Math.max(0, Math.ceil((orderDeadline(order) - now) / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
