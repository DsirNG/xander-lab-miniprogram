import { request } from './http'

export type Article = {
  id: number
  title: string
  summary: string
  content: string | null
  category: string
  categoryName: string
  tags: string[]
  userId: number
  author: string
  date: string
  readTime: string
  tips: string | null
  views: number
  status?: number
  coverImage?: string | null
  csdnSynced?: boolean
  juejinSynced?: boolean
}

export type ArticlePage = {
  records: Article[]
  total: number
  current: number
  pages: number
  size: number
  hasMore: boolean
}

export type Category = {
  id?: number
  name: string
  code?: string
  count?: number
}

export type Tag = { name: string; count: number }

export type ArticleQuery = {
  search?: string
  category?: string
  tag?: string
  page?: number
  size?: number
}

export type BlogPostPayload = {
  title: string
  summary?: string
  content: string
  categoryId?: number
  coverImage?: string
  tags?: string[]
  publish: boolean
}

export type PublishStatus = {
  status: 'pending' | 'published' | 'failed' | string
  articleId?: number
}

const toQuery = (params: Record<string, unknown>) => {
  const entries = Object.entries(params).filter(([, value]) => value !== '' && value != null)
  return entries.length
    ? `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')}`
    : ''
}

export const blogApi = {
  getArticles: (params: ArticleQuery = {}) =>
    request<ArticlePage>(`/api/blog/posts${toQuery({ page: 1, size: 10, ...params })}`),
  getRecentArticles: (limit = 5) => request<Article[]>(`/api/blog/posts/recent?limit=${limit}`),
  getArticle: (id: string | number) => request<Article>(`/api/blog/posts/${id}`),
  getCategories: () => request<Category[]>('/api/blog/categories'),
  getTags: () => request<Tag[]>('/api/blog/tags'),
  getPopularTags: (limit = 10) => request<Tag[]>(`/api/blog/tags/popular?limit=${limit}`),
  recordView: (id: string | number) =>
    request<{ counted: boolean }>(`/api/blog/posts/${id}/view`, { method: 'POST' }),

  /** 我的文章（status: 0 草稿 / 1 发布 / -1 回收站，不传为草稿+发布） */
  getMyArticles: (
    params: { status?: number; search?: string; page?: number; size?: number } = {},
  ) => request<ArticlePage>(`/api/blog/posts/mine${toQuery({ page: 1, size: 10, ...params })}`),
  getMyArticle: (id: string | number) => request<Article>(`/api/blog/posts/mine/${id}`),
  createArticle: (payload: BlogPostPayload, requestId?: string) =>
    request<Article>('/api/blog/posts', {
      method: 'POST',
      data: payload,
      timeout: payload.publish ? 60000 : 15000,
      header: requestId ? { 'Idempotency-Key': requestId } : undefined,
    }),
  getPublishStatus: (requestId: string) =>
    request<PublishStatus>(
      `/api/blog/posts/publish-status?requestId=${encodeURIComponent(requestId)}`,
      {
        timeout: 5000,
      },
    ),
  updateArticle: (id: string | number, payload: BlogPostPayload) =>
    request<Article>(`/api/blog/posts/${id}`, { method: 'PUT', data: payload }),
  updateArticleStatus: (id: string | number, status: number) =>
    request<Article>(`/api/blog/posts/${id}/status`, { method: 'PATCH', data: { status } }),
  deleteArticle: (id: string | number) =>
    request<void>(`/api/blog/posts/${id}`, { method: 'DELETE' }),
  permanentlyDeleteArticle: (id: string | number) =>
    request<void>(`/api/blog/posts/${id}/permanent`, { method: 'DELETE' }),
}
