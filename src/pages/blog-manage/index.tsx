import { Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { blogApi, type Article } from '@/api/blog'
import { Icon } from '@/components/Icon'
import { NavBar } from '@/components/NavBar'
import { BLOG_STATUS_TEXT } from '@/utils/format'
import './index.scss'

const STATUS_OPTIONS: Array<{ label: string; value: number | undefined }> = [
  { label: '全部', value: undefined },
  { label: '草稿', value: 0 },
  { label: '已发布', value: 1 },
  { label: '回收站', value: -1 },
]

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

export default function BlogManage() {
  const [status, setStatus] = useState<number | undefined>(undefined)
  const [articles, setArticles] = useState<Article[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(
    async (
      targetPage: number,
      append: boolean,
      nextStatus: number | undefined = status,
      nextSearch: string = search,
    ) => {
      setLoading(true)
      try {
        const result = await blogApi.getMyArticles({
          status: nextStatus,
          search: nextSearch || undefined,
          page: targetPage,
          size: 10,
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
    [search, status],
  )

  useDidShow(() => {
    load(1, false)
  })

  useReachBottom(() => {
    if (!loading && articles.length < total) load(page + 1, true)
  })

  const switchStatus = (value: number | undefined) => {
    setStatus(value)
    setArticles([])
    setPage(1)
    setLoadedOnce(false)
    load(1, false, value, search)
  }

  const changeStatus = async (article: Article, target: number) => {
    if (busyId !== null) return
    setBusyId(article.id)
    try {
      await blogApi.updateArticleStatus(article.id, target)
      showToast(target === 1 ? '已发布' : target === 0 ? '已转为草稿' : '已移入回收站')
      load(1, false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  const removeArticle = async (article: Article, permanent: boolean) => {
    if (busyId !== null) return
    const confirmed = await Taro.showModal({
      title: permanent ? '永久删除' : '删除文章',
      content: permanent ? '永久删除后不可恢复，确定继续吗？' : '文章将移入回收站，可随时恢复',
      confirmColor: '#d14343',
    })
    if (!confirmed.confirm) return
    setBusyId(article.id)
    try {
      if (permanent) {
        await blogApi.permanentlyDeleteArticle(article.id)
        showToast('已永久删除')
      } else {
        await blogApi.deleteArticle(article.id)
        showToast('已移入回收站')
      }
      load(1, false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  const gotoDetail = (article: Article) => {
    if (article.status === 1) {
      Taro.navigateTo({ url: `/pages/blog-detail/index?id=${article.id}` })
    } else {
      Taro.navigateTo({ url: `/pages/publish/index?id=${article.id}` })
    }
  }

  const showArticleActions = async (event: { stopPropagation: () => void }, article: Article) => {
    event.stopPropagation()
    const actions: Array<{ label: string; run: () => unknown | Promise<unknown> }> = [
      {
        label: '编辑',
        run: () => Taro.navigateTo({ url: `/pages/publish/index?id=${article.id}` }),
      },
    ]
    if (article.status === 1) {
      actions.push(
        {
          label: '查看文章',
          run: () => Taro.navigateTo({ url: `/pages/blog-detail/index?id=${article.id}` }),
        },
        { label: '转为草稿', run: () => changeStatus(article, 0) },
      )
    } else if (article.status === 0) {
      actions.push({ label: '发布', run: () => changeStatus(article, 1) })
    } else {
      actions.push(
        { label: '恢复到草稿', run: () => changeStatus(article, 0) },
        { label: '永久删除', run: () => removeArticle(article, true) },
      )
    }
    if (article.status !== -1) {
      actions.push({ label: '移入回收站', run: () => removeArticle(article, false) })
    }
    try {
      const result = await Taro.showActionSheet({ itemList: actions.map(item => item.label) })
      await actions[result.tapIndex]?.run()
    } catch {
      // 用户关闭操作菜单时不需要反馈。
    }
  }

  const submitSearch = (value: string) => {
    const nextSearch = value.trim()
    setSearch(nextSearch)
    setArticles([])
    setLoadedOnce(false)
    load(1, false, status, nextSearch)
  }

  return (
    <View className="detail-page">
      <NavBar title="我的博客" showBack />

      <View className="manage-toolbar">
        <Text
          className="manage-write"
          onClick={() => Taro.navigateTo({ url: '/pages/publish/index' })}
        >
          写文章
        </Text>
      </View>

      <View className="inline-search manage-search">
        <Icon name="search" />
        <Input
          className="inline-search-input"
          placeholder="搜索我的文章"
          value={searchInput}
          confirmType="search"
          onInput={event => setSearchInput(event.detail.value)}
          onConfirm={event => submitSearch(event.detail.value)}
        />
        {searchInput ? (
          <Text
            className="search-clear"
            onClick={() => {
              setSearchInput('')
              submitSearch('')
            }}
          >
            清除
          </Text>
        ) : null}
      </View>

      <View className="segmented manage-segmented">
        {STATUS_OPTIONS.map(option => (
          <Text
            key={option.label}
            className={`segment ${status === option.value ? 'active' : ''}`}
            onClick={() => switchStatus(option.value)}
          >
            {option.label}
          </Text>
        ))}
      </View>

      {loading && articles.length === 0 ? <Text className="data-state">正在加载...</Text> : null}
      {loadedOnce && !loading && articles.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-title">暂无文章</Text>
          <Text className="empty-desc">去写一篇新文章吧</Text>
          <View
            className="empty-btn"
            onClick={() => Taro.navigateTo({ url: '/pages/publish/index' })}
          >
            去发文
          </View>
        </View>
      ) : null}

      {articles.map(article => (
        <View className="manage-card" key={article.id} onClick={() => gotoDetail(article)}>
          <View className="manage-head">
            <Text className="manage-title">{article.title || '(无标题)'}</Text>
            <Text className="badge badge-gray">
              {BLOG_STATUS_TEXT[article.status ?? 1] || '未知'}
            </Text>
            <View
              className={`manage-more ${busyId === article.id ? 'is-busy' : ''}`}
              aria-label="文章操作"
              onClick={event => showArticleActions(event, article)}
            >
              <Icon name="more" />
            </View>
          </View>
          <View className="manage-meta">
            {article.categoryName ? <Text>{article.categoryName}</Text> : null}
            <Text>{article.date}</Text>
            {article.views != null ? <Text>{article.views} 阅读</Text> : null}
          </View>
        </View>
      ))}
      {loading && articles.length > 0 ? <Text className="data-state">加载中...</Text> : null}
      {loadedOnce && !loading && articles.length > 0 && articles.length >= total ? (
        <Text className="data-state">已展示全部文章</Text>
      ) : null}
    </View>
  )
}
