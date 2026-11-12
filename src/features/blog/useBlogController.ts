import { t } from '@/i18n'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { blogApi, type Article, type Category, type Tag } from '@/api/blog'
import { ArticleListRequests } from './articleListRequests'
import { usePanelActive } from '@/hooks/usePanelActive'

const PAGE_SIZE = 10
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
  const requests = useRef<ArticleListRequests | null>(null)
  if (!requests.current) requests.current = new ArticleListRequests(blogApi.getArticles)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    requests.current!.activate()
    return () => {
      mounted.current = false
      requests.current!.dispose()
    }
  }, [])
  const handledPageShowRef = useRef(pageShowCount)
  const handledRefreshVersionRef = useRef(refreshVersion)

  const currentFilters = useCallback(
    (): ArticleFilters => ({ search, category, tag }),
    [category, search, tag],
  )

  const load = useCallback(async (targetPage: number, append: boolean, filters: ArticleFilters) => {
    const loader = requests.current!
    const pending = loader.run({
      search: filters.search || undefined,
      category: filters.category || undefined,
      tag: filters.tag || undefined,
      page: targetPage,
      size: PAGE_SIZE,
    })
    setLoading(loader.loading)
    try {
      const result = await pending
      if (!result || !mounted.current) return
      setArticles(previous => (append ? [...previous, ...result.records] : result.records))
      setTotal(result.total)
      setPage(targetPage)
      setLoadedOnce(true)
    } catch (error) {
      if (!mounted.current) return
      setLoadedOnce(true)
      showToast(error instanceof Error ? error.message : t('ui.unableToLoadArticles'))
    } finally {
      if (mounted.current) setLoading(loader.loading)
    }
  }, [])

  const [taxonomyLoading, setTaxonomyLoading] = useState(true)
  const taxonomyPending = useRef<Promise<void> | null>(null)
  const refreshTaxonomy = useCallback(() => {
    if (taxonomyPending.current) return taxonomyPending.current
    setTaxonomyLoading(true)
    const pending = Promise.allSettled([
      blogApi.getCategories().then(value => {
        if (mounted.current) setCategories(value)
      }),
      blogApi.getPopularTags(10).then(value => {
        if (mounted.current) setPopularTags(value)
      }),
    ])
      .then(() => undefined)
      .finally(() => {
        if (taxonomyPending.current === pending) taxonomyPending.current = null
        if (mounted.current) setTaxonomyLoading(false)
      })
    taxonomyPending.current = pending
    return pending
  }, [])
  const refresh = useCallback(() => {
    void refreshTaxonomy()
    return load(1, false, currentFilters())
  }, [currentFilters, load, refreshTaxonomy])

  usePanelActive(active, { onShow: refresh })

  useEffect(() => {
    if (refreshVersion === handledRefreshVersionRef.current) return
    if (!active) return

    handledRefreshVersionRef.current = refreshVersion
    void refresh()
  }, [active, refresh, refreshVersion])

  useEffect(() => {
    if (pageShowCount === 0 || pageShowCount === handledPageShowRef.current) return

    handledPageShowRef.current = pageShowCount
    if (pageShowCount > 1 && active) void refresh()
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
    if (!active || loading || requests.current?.loading || articles.length >= total) return
    void load(page + 1, true, currentFilters())
  }, [active, articles.length, currentFilters, load, loading, page, total])

  return {
    articles,
    taxonomyLoading,
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
