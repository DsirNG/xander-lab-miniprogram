import { describe, expect, it } from 'vitest'
import { TAB_ITEMS } from './tabBarRoute'

describe('main shell tab metadata', () => {
  it('keeps the four tabs in their visual order', () => {
    expect(TAB_ITEMS.map(item => item.key)).toEqual([
      'chat',
      'calendar',
      'article',
      'user',
    ])
  })

  it('contains no page URL navigation contract', () => {
    expect(TAB_ITEMS.every(item => !('url' in item))).toBe(true)
  })
})
