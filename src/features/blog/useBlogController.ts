import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { blogApi, type Article, type Category, type Tag } from '@/api/blog'
import { usePanelActive } from '@/hooks/usePanelActive'

const PAGE_SIZE = 10
type RefreshSource = 'panel-active' | 'page-show' | 'tab-refresh'
type ArticleFilters = { search: string; category: string; tag: string }

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

function decodeInitialTag(value?: string) {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function useBlogController(
  active: boolean,
  initialTag = '',
  pageShowCount = 0,
  refreshVersion = 0,
) {
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [popularTags, setPopularTags] = useState<Tag[]>([])
  const [category, setCategory] = useState('')
  const [tag, setTag] = useState(() => decodeInitialTag(initialTag))
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const requestSequence = useRef(0)
  const handledPageShowRef = useRef(pageShowCount)
  const handledRefreshVersionRef = useRef(refreshVersion)

  const currentFilters = useCallback(
    (): ArticleFilters => ({ search, category, tag }),
    [category, search, tag],
  )

  const load = useCallback(async (targetPage: number, append: boolean, filters: ArticleFilters) => {
    const requestId = ++requestSequence.current
    console.log('[BlogController] LOAD_START', {
      requestId,
      targetPage,
      append,
      filters,
    })
    setLoading(true)
    try {
      const result = await blogApi.getArticles({
        search: filters.search || undefined,
        category: filters.category || undefined,
        tag: filters.tag || undefined,
        page: targetPage,
        size: PAGE_SIZE,
      })
      if (requestId !== requestSequence.current) {
        console.log('[BlogController] LOAD_STALE', {
          requestId,
          latestRequestId: requestSequence.current,
        })
        return
      }
      console.log('[BlogController] LOAD_APPLY', {
        requestId,
        targetPage,
        records: result.records.length,
        total: result.total,
      })
      setArticles(previous => (append ? [...previous, ...result.records] : result.records))
      setTotal(result.total)
      setPage(targetPage)
    } catch (error) {
      if (requestId === requestSequence.current) {
        showToast(error instanceof Error ? error.message : '文章列表加载失败')
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false)
        setLoadedOnce(true)
      }
    }
  }, [])

  const refresh = useCallback(
    async (source: RefreshSource = 'panel-active') => {
      const filters = currentFilters()
      console.log('[BlogController] REFRESH', { source, filters })
      const requestId = ++requestSequence.current
      const pageCount = Math.max(page, 1)
      console.log('[BlogController] RELOAD_START', {
        requestId,
        pageCount,
        filters,
      })
      setLoading(true)
      try {
        const results = await Promise.all(
          Array.from({ length: pageCount }, (_, index) =>
            blogApi.getArticles({
              search: filters.search || undefined,
              category: filters.category || undefined,
              tag: filters.tag || undefined,
              page: index + 1,
              size: PAGE_SIZE,
            }),
          ),
        )
        if (requestId !== requestSequence.current) {
          console.log('[BlogController] RELOAD_STALE', {
            requestId,
            latestRequestId: requestSequence.current,
          })
          return
        }
        const records = results.flatMap(result => result.records)
        const nextTotal = results[results.length - 1]?.total ?? 0
        console.log('[BlogController] RELOAD_APPLY', {
          requestId,
          pageCount,
          records: records.length,
          total: nextTotal,
        })
        setArticles(records)
        setTotal(nextTotal)
        setPage(pageCount)
      } catch (error) {
        if (requestId === requestSequence.current) {
          showToast(error instanceof Error ? error.message : '文章列表加载失败')
        }
      } finally {
        if (requestId === requestSequence.current) {
          setLoading(false)
          setLoadedOnce(true)
        }
      }
    },
    [currentFilters, page],
  )

  useEffect(() => {
    blogApi
      .getCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
    blogApi
      .getPopularTags(10)
      .then(setPopularTags)
      .catch(() => setPopularTags([]))
  }, [])

  usePanelActive(active, { onShow: refresh })

  useEffect(() => {
    if (refreshVersion === handledRefreshVersionRef.current) return
    if (!active) return

    handledRefreshVersionRef.current = refreshVersion
    void refresh('tab-refresh')
  }, [active, refresh, refreshVersion])

  useEffect(() => {
    if (pageShowCount === 0 || pageShowCount === handledPageShowRef.current) return

    handledPageShowRef.current = pageShowCount
    if (pageShowCount > 1 && active) void refresh('page-show')
  }, [active, pageShowCount, refresh])

  const updateFilters = useCallback(
    (next: ArticleFilters) => {
      setSearch(next.search)
      setCategory(next.category)
      setTag(next.tag)
      if (active) void load(1, false, next)
    },
    [active, load],
  )

  const submitSearch = useCallback(
    (value: string) => {
      const next = { search: value.trim(), category, tag }
      setSearch(next.search)
      if (active) void load(1, false, next)
    },
    [active, category, load, tag],
  )

  const selectAll = useCallback(() => {
    updateFilters({ search: '', category: '', tag: '' })
    setSearchInput('')
  }, [updateFilters])

  const selectCategory = useCallback(
    (value: string) => {
      updateFilters({ search, category: value, tag: '' })
    },
    [search, updateFilters],
  )

  const selectTag = useCallback(
    (value: string) => {
      updateFilters({ search, category: '', tag: value })
    },
    [search, updateFilters],
  )

  const clearFilters = useCallback(() => {
    selectAll()
  }, [selectAll])

  const loadMore = useCallback(() => {
    if (!active || loading || articles.length >= total) return
    void load(page + 1, true, currentFilters())
  }, [active, articles.length, currentFilters, load, loading, page, total])

  return {
    articles,
    categories,
    popularTags,
    category,
    tag,
    searchInput,
    search,
    total,
    loading,
    loadedOnce,
    setSearchInput,
    submitSearch,
    selectAll,
    selectCategory,
    selectTag,
    clearFilters,
    loadMore,
  }
}

export type BlogController = ReturnType<typeof useBlogController>
