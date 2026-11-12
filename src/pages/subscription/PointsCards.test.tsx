import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { renderComponent } from '../../test/render'
import type { VirtualPayProduct } from '@/api/virtualPay'
vi.mock('@tarojs/components', () => ({ Text: 'span', View: 'div' }))
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, disabled }: { children: import('react').ReactNode; disabled?: boolean }) =>
    createElement('button', { disabled }, children),
}))
vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => `${key}:${JSON.stringify(params ?? {})}`,
}))
import { PointsCards } from './PointsCards'
const products: VirtualPayProduct[] = [
  {
    productId: 'server-a',
    kind: 'points',
    name: 'A',
    points: 30,
    goodsPrice: 300,
    tier: 'PLUS',
    durationDays: 30,
  },
  {
    productId: 'server-b',
    kind: 'points',
    name: 'B',
    points: 80,
    goodsPrice: 800,
    tier: 'PLUS',
    durationDays: 30,
  },
  {
    productId: 'server-c',
    kind: 'points',
    name: 'C',
    points: 200,
    goodsPrice: 2000,
    tier: 'PLUS',
    durationDays: 30,
  },
]
const props = {
  products,
  selectedId: 'server-b',
  onSelect: vi.fn(),
  onBuy: vi.fn(),
  enabled: true,
  subscriber: true,
  buying: '',
}
it('renders exactly the cards and prices supplied by the backend', () => {
  const html = renderComponent(createElement(PointsCards, props))
  for (const price of ['¥3.00', '¥8.00', '¥20.00']) expect(html).toContain(price)
  expect(html.match(/points-card-amount/g)).toHaveLength(3)
  expect(html).not.toContain('points-selector')
})
it('buys the selected server SKU rather than multiplying the first SKU', () => {
  const tree = PointsCards(props)
  const button = tree.props.children.at(-1)
  button.props.onClick()
  expect(props.onBuy).toHaveBeenCalledWith(products[1])
})
it('reselects a current card if an old SKU disappears and disables an empty catalog', () => {
  const tree = PointsCards({ ...props, selectedId: 'removed' })
  tree.props.children.at(-1).props.onClick()
  expect(props.onBuy).toHaveBeenLastCalledWith(products[0])
  expect(PointsCards({ ...props, products: [] }).props.children.at(-1).props.disabled).toBe(true)
  expect(PointsCards({ ...props, subscriber: false }).props.children.at(-1).props.disabled).toBe(
    true,
  )
})
