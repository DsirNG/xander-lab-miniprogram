import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Article } from '@/api/blog'
import { Icon } from './Icon'

type ArticleCardProps = {
  article: Article
  featured?: boolean
}

export function ArticleCard({ article, featured = false }: ArticleCardProps) {
  return (
    <View
      className={`article-card ${featured ? 'featured' : ''}`}
      onClick={() => Taro.navigateTo({ url: `/pages/blog-detail/index?id=${article.id}` })}
    >
      <View className="article-info">
        {featured ? <Text className="featured-label">精选</Text> : null}
        <Text className="article-title">{article.title}</Text>
        <Text className="article-excerpt">{article.summary}</Text>
        {article.tags.length > 0 ? (
          <View className="tags">
            {article.tags.slice(0, 3).map(tag => (
              <Text className="tag" key={tag}>
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
        <View className="meta">
          <View className="author">
            <View className="avatar-mini">X</View>
            <Text>{article.author}</Text>
          </View>
          <View className="views">
            <Icon name="eye" />
            <Text>{article.views.toLocaleString()}</Text>
          </View>
          <Text>{article.date.slice(5)}</Text>
        </View>
      </View>
    </View>
  )
}
