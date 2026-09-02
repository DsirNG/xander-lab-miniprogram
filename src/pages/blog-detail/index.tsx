import { Button, Text, View } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { blogApi, type Article } from '@/api/blog'
import { Icon } from '@/components/Icon'
import { Markdown } from '@/components/Markdown'
import { NavBar } from '@/components/NavBar'
import './index.scss'

export default function BlogDetail() {
  const { params } = useRouter()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const id = params.id

  useEffect(() => {
    if (!id) {
      setError('缺少文章 ID')
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
        if (active) setError(reason instanceof Error ? reason.message : '文章加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  useShareAppMessage(() => ({
    title: article?.title || 'DinQorAI 博客',
    path: `/pages/blog-detail/index?id=${id}`,
  }))

  return (
    <View className="detail-page">
      <NavBar title="文章详情" showBack />
      {loading ? <Text className="data-state">正在加载文章...</Text> : null}
      {error ? <Text className="data-state error">{error}</Text> : null}
      {article ? (
        <>
          <Text className="detail-title">{article.title}</Text>
          <View className="detail-meta">
            <View className="avatar-mini">X</View>
            <Text>{article.author}</Text>
            <Text>· {article.date}</Text>
            <Text>· 阅读 {article.readTime}</Text>
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
                <Text
                  className="tag"
                  key={tag}
                  onClick={() =>
                    Taro.redirectTo({ url: `/pages/blog/index?tag=${encodeURIComponent(tag)}` })
                  }
                >
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
              分享
            </Button>
          </View>
        </>
      ) : null}
    </View>
  )
}
