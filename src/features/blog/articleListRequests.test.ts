import { expect, it, vi } from 'vitest'
import { ArticleListRequests } from './articleListRequests'
const page = { records: [], total: 30, current: 1, pages: 3, size: 10, hasMore: true }
function deferred() {
  let resolve!: (value: typeof page) => void
  let reject!: (error: Error) => void
  const promise = new Promise<typeof page>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
it('always revalidates page one on return, even immediately after a successful read', async () => {
  const fetch = vi.fn().mockResolvedValue(page)
  const loader = new ArticleListRequests(fetch)
  await loader.run({ page: 1 })
  await loader.run({ page: 3 })
  await loader.run({ page: 1 })
  await loader.run({ page: 1 })
  expect(fetch.mock.calls.map(([query]) => query.page)).toEqual([1, 3, 1, 1])
})
it('coalesces duplicate in-flight lifecycle refreshes and pagination', async () => {
  const pending = deferred()
  const fetch = vi.fn().mockReturnValue(pending.promise)
  const loader = new ArticleListRequests(fetch)
  const first = loader.run({ page: 1 })
  expect(await loader.run({ page: 1 })).toBeNull()
  expect(loader.loading).toBe(true)
  pending.resolve(page)
  expect(await first).toEqual(page)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(loader.loading).toBe(false)
})
it('ignores an old response after a filter change', async () => {
  const old = deferred()
  const fetch = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(page)
  const loader = new ArticleListRequests(fetch)
  const first = loader.run({ search: 'old' })
  expect(await loader.run({ search: 'new' })).toEqual(page)
  old.resolve(page)
  expect(await first).toBeNull()
})
it('failed refreshes are retryable rather than marked fresh', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(page)
  const loader = new ArticleListRequests(fetch)
  await expect(loader.run({ page: 1 })).rejects.toThrow('offline')
  expect(await loader.run({ page: 1 })).toEqual(page)
})
it('does not apply an old request after unmount and effect remount', async () => {
  const old = deferred()
  const loader = new ArticleListRequests(
    vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(page),
  )
  const pending = loader.run({ page: 1 })
  loader.dispose()
  loader.activate()
  expect(await loader.run({ page: 1 })).toEqual(page)
  old.resolve(page)
  expect(await pending).toBeNull()
})
