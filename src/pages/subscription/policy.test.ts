import { expect, it } from 'vitest'
import { activeTier, canBuyTier } from './policy'

it('allows only a higher active plan and allows expired accounts to subscribe again', () => {
  expect(canBuyTier('PLUS', 'PLUS')).toBe(false)
  expect(canBuyTier('PRO', 'PLUS')).toBe(false)
  expect(canBuyTier('PLUS', 'PRO')).toBe(true)
  expect(activeTier('ULTRA', '2026-10-01T00:00:00Z', Date.UTC(2026, 10, 12))).toBe('FREE')
  expect(canBuyTier('FREE', 'PLUS')).toBe(true)
  expect(activeTier('PRO', 'invalid')).toBe('FREE')
})
