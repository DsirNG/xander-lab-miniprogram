import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useReachBottom, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { blogApi, type Article, type Category, type Tag } from '@/api/blog'
import { ArticleCard } from '@/components/ArticleCard'
import { TabBar } from '@/components/TabBar'
import { NavBar } from '@/components/NavBar'
import { Icon } from '@/components/Icon'
import './index.scss'

const PAGE_SIZE = 10

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

export default function Blog() {
  const { params } = useRouter()
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [popularTags, setPopularTags] = useState<Tag[]>([])
  const [category, setCategory] = useState('')
  const [tag, setTag] = useState(params.tag ? decodeURIComponent(params.tag) : '')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)

  const load = useCallback(
    async (
      targetPage: number,
      append: boolean,
      params: { category?: string; tag?: string; search?: string } = {},
    ) => {
      setLoading(true)
      try {
        const result = await blogApi.getArticles({
          search: params.search || undefined,
          category: params.category || undefined,
          tag: params.tag || undefined,
          page: targetPage,
          size: PAGE_SIZE,
        })
        setArticles(prev => (append ? [...prev, ...result.records] : result.records))
        setTotal(result.total)
        setPage(targetPage)
      } catch (e) {
        showToast(e instanceof Error ? e.message : '文章列表加载失败')
      } finally {
        setLoading(false)
        setLoadedOnce(true)
      }
    },
    [],
  )

  useEffect(() => {
    load(1, false, { search, category, tag })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, tag])

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

  useReachBottom(() => {
    if (!loading && articles.length < total) load(page + 1, true, { search, category, tag })
  })

  const hasFilter = Boolean(search || category || tag)

  const clearFilters = () => {
    setSearch('')
    setSearchInput('')
    setCategory('')
    setTag('')
  }

  return (
    <View className="page blog-page">
      <NavBar title="博客" />
      <View className="inline-search">
        <Icon name="search" />
        <Input
          className="inline-search-input"
          placeholder="搜索文章、标签或关键词"
          placeholderClass="search-placeholder"
          value={searchInput}
          onInput={e => setSearchInput(e.detail.value)}
          onConfirm={e => setSearch(e.detail.value.trim())}
          confirmType="search"
        />
        {searchInput ? (
          <Text
            className="search-clear"
            onClick={() => {
              setSearchInput('')
              setSearch('')
            }}
          >
            清除
          </Text>
        ) : null}
      </View>
      <ScrollView scrollX showScrollbar={false} className="chips">
        <Text
          className={`chip ${category === '' && tag === '' ? 'active' : ''}`}
          onClick={() => {
            setCategory('')
            setTag('')
            setSearch('')
            setSearchInput('')
          }}
        >
          全部
        </Text>
        {categories.map(item => (
          <Text
            className={`chip ${category === (item.code || item.name) && !tag ? 'active' : ''}`}
            key={item.id ?? item.name}
            onClick={() => {
              setCategory(item.code || item.name)
              setTag('')
            }}
          >
            {item.name}
          </Text>
        ))}
        {popularTags.map(item => (
          <Text
            className={`chip ${tag === item.name ? 'active' : ''}`}
            key={item.name}
            onClick={() => {
              setTag(item.name)
              setCategory('')
            }}
          >
            #{item.name}
          </Text>
        ))}
      </ScrollView>
      {hasFilter ? (
        <View className="filter-bar">
          <Text className="filter-summary">
            {search ? `关键词「${search}」` : ''}
            {category ? `分类「${category}」` : ''}
            {tag ? `标签「${tag}」` : ''}
          </Text>
          <Text className="filter-clear" onClick={clearFilters}>
            清除筛选
          </Text>
        </View>
      ) : null}
      {loading && articles.length === 0 ? (
        <Text className="data-state">正在加载文章...</Text>
      ) : null}
      {loadedOnce && !loading && articles.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-title">没有找到相关文章</Text>
          <Text className="empty-desc">换个关键词或清除筛选条件试试</Text>
          {hasFilter ? (
            <View className="empty-btn" onClick={clearFilters}>
              查看全部文章
            </View>
          ) : null}
        </View>
      ) : null}
      {articles.map(article => (
        <ArticleCard key={article.id} article={article} />
      ))}
      {loading && articles.length > 0 ? <Text className="data-state">加载中...</Text> : null}
      {loadedOnce && !loading && articles.length > 0 && articles.length >= total ? (
        <Text className="data-state">已展示全部文章</Text>
      ) : null}
      <TabBar active="article" />
    </View>
  )
}
