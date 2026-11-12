import type { ArticlePage, ArticleQuery } from '@/api/blog'

/** Owns in-flight deduplication and stale-result rejection for one mounted list. */
export class ArticleListRequests {
  private sequence = 0
  private pending: { key: string; id: number } | null = null
  private disposed = false
  constructor(private fetchPage: (query: ArticleQuery) => Promise<ArticlePage>) {}
  get loading() {
    return this.pending !== null
  }
  activate() {
    this.disposed = false
  }
  dispose() {
    this.disposed = true
    this.sequence++
    this.pending = null
  }

  async run(query: ArticleQuery): Promise<ArticlePage | null> {
    if (this.disposed) return null
    const filters = JSON.stringify([query.search || '', query.category || '', query.tag || ''])
    const key = JSON.stringify([filters, query.page || 1])
    if (this.pending?.key === key) return null
    const id = ++this.sequence
    this.pending = { key, id }
    try {
      const result = await this.fetchPage(query)
      if (id !== this.sequence || this.disposed) return null
      return result
    } catch (error) {
      if (id === this.sequence && !this.disposed) throw error
      return null
    } finally {
      if (this.pending?.id === id) this.pending = null
    }
  }
}
