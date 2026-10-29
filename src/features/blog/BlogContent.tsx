import { t, useLocale } from '@/i18n'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import { ArticleCard } from '@/components/ArticleCard'
import { Icon } from '@/components/Icon'
import { NavBar } from '@/components/NavBar'
import type { BlogController } from './useBlogController'

export function BlogContent({ controller }: { controller: BlogController }) {
  useLocale()
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
      <NavBar title={t('ui.blogs')} />
      <View className="inline-search">
        <Icon name="search" />
        <Input
          className="inline-search-input"
          placeholder={t('ui.searchArticlesTagsOrKeywords')}
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
            {t('ui.clear')}
          </Text>
        ) : null}
      </View>
      <ScrollView scrollX showScrollbar={false} className="chips">
        <Text
          className={`chip ${category === '' && tag === '' ? 'active' : ''}`}
          onClick={selectAll}
        >
          {t('ui.all')}
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
            {search ? t('preferences.keywordFilter', { value: search }) : ''}
            {category ? t('preferences.categoryFilter', { value: category }) : ''}
            {tag ? t('preferences.tagFilter', { value: tag }) : ''}
          </Text>
          <Text className="filter-clear" onClick={clearFilters}>
            {t('ui.clearFilters')}
          </Text>
        </View>
      ) : null}
      {loading && articles.length === 0 ? (
        <Text className="data-state">{t('ui.loadingArticles')}</Text>
      ) : null}
      {loadedOnce && !loading && articles.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-title">{t('ui.noMatchingArticles')}</Text>
          <Text className="empty-desc">{t('ui.tryAnotherKeywordOrClearYourFilters')}</Text>
          {hasFilter ? (
            <View className="empty-btn" onClick={clearFilters}>
              {t('ui.viewAllArticles')}
            </View>
          ) : null}
        </View>
      ) : null}
      {articles.map(article => (
        <ArticleCard key={article.id} article={article} />
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
