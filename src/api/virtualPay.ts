import { request } from './http'

export type VirtualPayProduct = {
  productId: string
  name: string
  kind?: 'subscription' | 'points'
  points?: number
  tier: 'PLUS' | 'PRO' | 'ULTRA'
  goodsPrice: number
  durationDays: number
}

export type VirtualPayCatalog = {
  enabled: boolean
  products: VirtualPayProduct[]
}

export type VirtualPayData = {
  outTradeNo: string
  mode: 'short_series_goods'
  signData: string
  paySig: string
  signature: string
}

export type VirtualPayOrderStatus = {
  outTradeNo: string
  status: 'PENDING' | 'EXPIRED' | 'DELIVERED' | 'REFUNDED' | 'FAILED'
  tier: string
  expiresAt?: string | null
  serverNow?: string
  deliveredAt: string | null
}

export type VirtualPayRefund = {
  refundId: string
  status: 'PREPARING' | 'SUBMITTING' | 'PROCESSING' | 'REVIEW' | 'SUCCEEDED' | 'FAILED'
  refundFee: number
}
export type VirtualPayOrder = VirtualPayOrderStatus & {
  productId: string
  kind: 'subscription' | 'points'
  amount: number
  quantity: number
  points: number
  createdAt: string | null
  paidAt: string | null
  refund: VirtualPayRefund | null
}
export type RefundQuote = {
  eligible: boolean
  reason: string
  amount: number
  remainingPoints?: number
  originalPoints?: number
  terminatesSubscription?: boolean
  refund?: VirtualPayRefund
}
export const virtualPayApi = {
  orders: (before?: number) => request<{ records: VirtualPayOrder[]; nextCursor: number | null; serverNow?: string }>(
    `/api/virtual-pay/orders${before ? `?before=${before}` : ''}`, { method: 'GET' }),
  refundQuote: (order: string) => request<RefundQuote>(`/api/virtual-pay/orders/${encodeURIComponent(order)}/refund-quote`, { method: 'GET' }),
  refund: (order: string, expectedAmount: number) => request<VirtualPayRefund>(`/api/virtual-pay/orders/${encodeURIComponent(order)}/refund`, { method: 'POST', data: { expectedAmount } }),
  refundStatus: (order: string) => request<VirtualPayRefund | null>(`/api/virtual-pay/orders/${encodeURIComponent(order)}/refund-status`, { method: 'GET' }),
  catalog: () => request<VirtualPayCatalog>('/api/virtual-pay/products', { method: 'GET' }),
  createOrder: (productId: string, loginCode: string, quantity = 1, outTradeNo?: string) =>
    request<VirtualPayData>('/api/virtual-pay/orders', {
      method: 'POST',
      data: { productId, loginCode, quantity, ...(outTradeNo ? { outTradeNo } : {}) },
    }),
  status: (outTradeNo: string) =>
    request<VirtualPayOrderStatus>(`/api/virtual-pay/orders/${outTradeNo}`, { method: 'GET' }),
  reconcile: (outTradeNo: string) =>
    request<VirtualPayOrderStatus>(`/api/virtual-pay/orders/${outTradeNo}/reconcile`, {
      method: 'POST',
    }),
}
