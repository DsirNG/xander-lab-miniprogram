import { Input, ScrollView, Text, View } from '@tarojs/components'
import { ArticleCard } from '@/components/ArticleCard'
import { Icon } from '@/components/Icon'
import { NavBar } from '@/components/NavBar'
import type { BlogController } from './useBlogController'

export function BlogContent({ controller }: { controller: BlogController }) {
  const {
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
  } = controller
  const hasFilter = Boolean(search || category || tag)

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
          onConfirm={e => submitSearch(e.detail.value)}
          confirmType="search"
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
      <ScrollView scrollX showScrollbar={false} className="chips">
        <Text
          className={`chip ${category === '' && tag === '' ? 'active' : ''}`}
          onClick={selectAll}
        >
          全部
        </Text>
        {categories.map(item => {
          const value = item.code || item.name
          return (
            <Text
              className={`chip ${category === value && !tag ? 'active' : ''}`}
              key={item.id ?? item.name}
              onClick={() => selectCategory(value)}
            >
              {item.name}
            </Text>
          )
        })}
        {popularTags.map(item => (
          <Text
            className={`chip ${tag === item.name ? 'active' : ''}`}
            key={item.name}
            onClick={() => selectTag(item.name)}
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
    </View>
  )
}
