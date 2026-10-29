import { t, useLocale } from '@/i18n'
import { Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { blogApi, type Article } from '@/api/blog'
import { Icon } from '@/components/Icon'
import { NavBar } from '@/components/NavBar'
import { BLOG_STATUS_TEXT } from '@/utils/format'
import './index.scss'

const STATUS_OPTIONS: Array<{ label: string; value: number | undefined }> = [
  {
    get label() {
      return t('ui.all')
    },
    value: undefined,
  },
  {
    get label() {
      return t('ui.draft')
    },
    value: 0,
  },
  {
    get label() {
      return t('ui.published')
    },
    value: 1,
  },
  {
    get label() {
      return t('ui.trash')
    },
    value: -1,
  },
]

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

export default function BlogManage() {
  useLocale()
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
        showToast(e instanceof Error ? e.message : t('ui.unableToLoadArticles'))
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
      showToast(
        target === 1
          ? t('ui.published')
          : target === 0
            ? t('ui.movedToDrafts')
            : t('ui.movedToTrash'),
      )
      load(1, false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('ui.operationFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const removeArticle = async (article: Article, permanent: boolean) => {
    if (busyId !== null) return
    const confirmed = await Taro.showModal({
      title: permanent ? t('ui.deletePermanently') : t('ui.deleteArticle'),
      content: permanent
        ? t('ui.permanentlyDeleteThisArticleThisCannotBe')
        : t('ui.moveThisArticleToTrashYouCan'),
      confirmColor: '#d14343',
    })
    if (!confirmed.confirm) return
    setBusyId(article.id)
    try {
      if (permanent) {
        await blogApi.permanentlyDeleteArticle(article.id)
        showToast(t('ui.permanentlyDeleted'))
      } else {
        await blogApi.deleteArticle(article.id)
        showToast(t('ui.movedToTrash'))
      }
      load(1, false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('ui.operationFailed'))
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
        label: t('ui.edit'),
        run: () => Taro.navigateTo({ url: `/pages/publish/index?id=${article.id}` }),
      },
    ]
    if (article.status === 1) {
      actions.push(
        {
          label: t('ui.viewArticle'),
          run: () => Taro.navigateTo({ url: `/pages/blog-detail/index?id=${article.id}` }),
        },
        { label: t('ui.moveToDrafts'), run: () => changeStatus(article, 0) },
      )
    } else if (article.status === 0) {
      actions.push({ label: t('ui.publish'), run: () => changeStatus(article, 1) })
    } else {
      actions.push(
        { label: t('ui.restoreAsDraft'), run: () => changeStatus(article, 0) },
        { label: t('ui.deletePermanently'), run: () => removeArticle(article, true) },
      )
    }
    if (article.status !== -1) {
      actions.push({ label: t('ui.moveToTrash'), run: () => removeArticle(article, false) })
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
      <NavBar title={t('ui.myArticles')} showBack />

      <View className="manage-toolbar">
        <Text
          className="manage-write"
          onClick={() => Taro.navigateTo({ url: '/pages/publish/index' })}
        >
          {t('ui.writeArticle')}
        </Text>
      </View>

      <View className="inline-search manage-search">
        <Icon name="search" />
        <Input
          className="inline-search-input"
          placeholder={t('ui.searchMyArticles')}
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
            {t('ui.clear')}
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

      {loading && articles.length === 0 ? (
        <Text className="data-state">{t('ui.loadingData')}</Text>
      ) : null}
      {loadedOnce && !loading && articles.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-title">{t('ui.noArticlesYet')}</Text>
          <Text className="empty-desc">{t('ui.writeYourFirstArticle')}</Text>
          <View
            className="empty-btn"
            onClick={() => Taro.navigateTo({ url: '/pages/publish/index' })}
          >
            {t('ui.startWriting')}
          </View>
        </View>
      ) : null}

      {articles.map(article => (
        <View className="manage-card" key={article.id} onClick={() => gotoDetail(article)}>
          <View className="manage-head">
            <Text className="manage-title">{article.title || t('ui.untitled')}</Text>
            <Text className="badge badge-gray">
              {BLOG_STATUS_TEXT[article.status ?? 1] || t('ui.unknown')}
            </Text>
            <View
              className={`manage-more ${busyId === article.id ? 'is-busy' : ''}`}
              aria-label={t('ui.articleActions')}
              onClick={event => showArticleActions(event, article)}
            >
              <Icon name="more" />
            </View>
          </View>
          <View className="manage-meta">
            {article.categoryName ? <Text>{article.categoryName}</Text> : null}
            <Text>{article.date}</Text>
            {article.views != null ? (
              <Text>
                {article.views} {t('ui.viewsLabel')}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
      {loading && articles.length > 0 ? (
        <Text className="data-state">{t('ui.loading')}</Text>
      ) : null}
      {loadedOnce && !loading && articles.length > 0 && articles.length >= total ? (
        <Text className="data-state">{t('ui.allArticlesShown')}</Text>
      ) : null}
    </View>
  )
}
