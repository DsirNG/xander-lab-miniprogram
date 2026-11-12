import { expect, it, vi } from 'vitest'
const { request } = vi.hoisted(() => ({ request: vi.fn().mockResolvedValue(null) }))
vi.mock('./http', () => ({ request }))
import { blogApi } from './blog'
it('uses anonymous reads for public list metadata and pagination', async () => {
  request.mockClear()
  await blogApi.getArticles({ page: 2, category: 'backend' })
  await blogApi.getCategories()
  await blogApi.getPopularTags(10)
  expect(request.mock.calls).toEqual([
    ['/api/blog/posts?page=2&size=10&category=backend', { anonymous: true }],
    ['/api/blog/categories', { anonymous: true }],
    ['/api/blog/tags/popular?limit=10', { anonymous: true }],
  ])
})
it('keeps private article management authenticated', async () => {
  request.mockClear()
  await blogApi.getMyArticles()
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/blog/posts/mine?page=1&size=10')
})
