import { request } from './http'

export type VirtualPayProduct = {
  productId: string
  name: string
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
  status: 'PENDING' | 'DELIVERED' | 'REFUNDED' | 'FAILED'
  tier: string
  deliveredAt: string | null
}

export const virtualPayApi = {
  catalog: () => request<VirtualPayCatalog>('/api/virtual-pay/products', { method: 'GET' }),
  createOrder: (productId: string, loginCode: string) =>
    request<VirtualPayData>('/api/virtual-pay/orders', {
      method: 'POST',
      data: { productId, loginCode },
    }),
  status: (outTradeNo: string) =>
    request<VirtualPayOrderStatus>(`/api/virtual-pay/orders/${outTradeNo}`, { method: 'GET' }),
  reconcile: (outTradeNo: string) =>
    request<VirtualPayOrderStatus>(`/api/virtual-pay/orders/${outTradeNo}/reconcile`, {
      method: 'POST',
    }),
}
