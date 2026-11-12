import { ThemeView } from '@/components/ThemeView'
import { Skeleton } from '@/components/Skeleton'
import { t, useLocale } from '@/i18n'
import { Button, Text, View } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { blogApi, type Article } from '@/api/blog'
import { Icon } from '@/components/Icon'
import { Markdown } from '@/components/Markdown'
import { NavBar } from '@/components/NavBar'
import { useTabBarStore } from '@/store/tabBar'
import './index.scss'

export default function BlogDetail() {
  useLocale()
  const { params } = useRouter()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const id = params.id

  const handleTagClick = (tag: string) => {
    const pages = Taro.getCurrentPages()
    const opener = pages[pages.length - 2]
    if (opener?.route === 'pages/main/index') {
      useTabBarStore.getState().setPendingBlogTag(tag)
      Taro.navigateBack({
        fail: () => useTabBarStore.getState().setPendingBlogTag(null),
      })
      return
    }

    void Taro.reLaunch({
      url: `/pages/main/index?tab=article&tag=${encodeURIComponent(tag)}`,
    })
  }

  useEffect(() => {
    if (!id) {
      setError(t('ui.missingArticleId'))
      setLoading(false)
      return
    }
    let active = true
    blogApi
      .getArticle(id)
      .then(data => {
        if (active) setArticle(data)
        blogApi.recordView(id).catch(() => undefined)
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : t('ui.unableToLoadArticle'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  useShareAppMessage(() => ({
    title: article?.title || t('ui.dinqoraiBlog'),
    path: `/pages/blog-detail/index?id=${id}`,
  }))

  return (
    <ThemeView className="detail-page">
      <NavBar title={t('ui.articleDetails')} showBack />
      {loading ? <Skeleton layout="articleDetail" /> : null}
      {error ? <Text className="data-state error">{error}</Text> : null}
      {article ? (
        <>
          <Text className="detail-title">{article.title}</Text>
          <View className="detail-meta">
            <View className="avatar-mini">X</View>
            <Text>{article.author}</Text>
            <Text>· {article.date}</Text>
            <Text>
              {t('ui.views')}
              {article.readTime}
            </Text>
            <View className="views">
              <Icon name="eye" />
              <Text>{article.views.toLocaleString()}</Text>
            </View>
          </View>
          {article.categoryName ? (
            <Text className="detail-category">{article.categoryName}</Text>
          ) : null}
          {article.tips ? <View className="tips-box">{article.tips}</View> : null}
          {article.summary ? <Text className="lead">{article.summary}</Text> : null}
          {article.tags.length > 0 ? (
            <View className="tags detail-tags">
              {article.tags.map(tag => (
                <Text className="tag" key={tag} onClick={() => handleTagClick(tag)}>
                  {tag}
                </Text>
              ))}
            </View>
          ) : null}
          <View className="markdown-body">
            <Markdown content={article.content || ''} />
          </View>
          <View className="detail-share-row">
            <Button className="share-trigger" openType="share">
              {t('ui.share')}
            </Button>
          </View>
        </>
      ) : null}
    </ThemeView>
  )
}
