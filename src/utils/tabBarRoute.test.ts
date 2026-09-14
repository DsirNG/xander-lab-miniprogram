import { describe, expect, it } from 'vitest'
import { getTabKeyByPath, normalizeTabPath } from './tabBarRoute'

describe('tab bar route matching', () => {
  it('normalizes leading slashes, query parameters, hashes, and trailing slashes', () => {
    expect(normalizeTabPath('/pages/plans/index?from=profile#top')).toBe('pages/plans/index')
  })

  it('maps every main tab route to its tab key', () => {
    expect(getTabKeyByPath('/pages/chat/index')).toBe('chat')
    expect(getTabKeyByPath('pages/plans/index?from=profile')).toBe('calendar')
    expect(getTabKeyByPath('/pages/blog/index/')).toBe('article')
    expect(getTabKeyByPath('/pages/profile/index')).toBe('user')
  })

  it('does not guess a main tab for unrelated pages', () => {
    expect(getTabKeyByPath('/pages/blog-detail/index?id=1')).toBeUndefined()
  })
})
