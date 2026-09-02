import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import {
  notificationsApi,
  type NotificationItem,
  type NotificationListResult,
} from '@/api/notifications'
import { NavBar } from '@/components/NavBar'
import { getLocale, t, type Locale } from '@/i18n'
import './index.scss'

const PAGE_SIZE = 20
const dateLocales: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  fr: 'fr-FR',
  ja: 'ja-JP',
  ru: 'ru-RU',
  vi: 'vi-VN',
}

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

function formatNotificationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return t('common.notAvailable')

  try {
    return date.toLocaleString(dateLocales[getLocale()], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return date.toLocaleString()
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const hasLoaded = useRef(false)
  const requestSequence = useRef(0)

  const applyFirstPage = useCallback((result: NotificationListResult) => {
    setItems(result.records)
    setPage(1)
    setTotal(result.total)
    setUnreadCount(result.unreadCount)
  }, [])

  const loadFirstPage = useCallback(
    async (showInitialLoading: boolean) => {
      const requestId = ++requestSequence.current
      if (showInitialLoading) setLoading(true)
      setError(null)

      try {
        const result = await notificationsApi.list({ page: 1, size: PAGE_SIZE })
        if (requestId !== requestSequence.current) return
        applyFirstPage(result)
        hasLoaded.current = true
      } catch {
        if (requestId !== requestSequence.current) return
        setError(t('notifications.loadError'))
      } finally {
        if (requestId === requestSequence.current) setLoading(false)
      }
    },
    [applyFirstPage],
  )

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || items.length >= total) return

    const nextPage = page + 1
    const requestId = ++requestSequence.current
    setLoadingMore(true)
    try {
      const result = await notificationsApi.list({ page: nextPage, size: PAGE_SIZE })
      if (requestId !== requestSequence.current) return
      setItems(current => {
        const knownIds = new Set(current.map(item => item.id))
        return [...current, ...result.records.filter(item => !knownIds.has(item.id))]
      })
      setPage(nextPage)
      setTotal(result.total)
      setUnreadCount(result.unreadCount)
    } catch {
      if (requestId === requestSequence.current) {
        showToast(t('notifications.loadMoreError'))
      }
    } finally {
      setLoadingMore(false)
    }
  }, [items, loading, loadingMore, page, total])

  useDidShow(() => {
    void loadFirstPage(!hasLoaded.current)
  })

  usePullDownRefresh(() => {
    void loadFirstPage(false).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    void loadMore()
  })

  const navigateToPlan = (planId: number) => {
    Taro.navigateTo({
      url: `/pages/plan-detail/index?id=${encodeURIComponent(String(planId))}`,
    }).catch(() => showToast(t('notifications.navigationError')))
  }

  const handleItemPress = async (item: NotificationItem) => {
    if (busyId !== null) return

    if (!item.isRead) {
      setBusyId(item.id)
      try {
        await notificationsApi.markRead(item.id)
        setItems(current =>
          current.map(notification =>
            notification.id === item.id ? { ...notification, isRead: true } : notification,
          ),
        )
        setUnreadCount(current => Math.max(0, current - 1))
      } catch {
        showToast(t('notifications.markReadError'))
      } finally {
        setBusyId(null)
      }
    }

    if (item.planId) navigateToPlan(item.planId)
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return
    setMarkingAll(true)
    try {
      await notificationsApi.markAllRead()
      setItems(current => current.map(item => ({ ...item, isRead: true })))
      setUnreadCount(0)
      showToast(t('notifications.markedAll'))
    } catch {
      showToast(t('notifications.markAllError'))
    } finally {
      setMarkingAll(false)
    }
  }

  const markAllLabel = markingAll
    ? t('notifications.markingAllRead')
    : t('notifications.markAllRead')

  return (
    <View className="notifications-page">
      <NavBar
        title={t('nav.notifications')}
        showBack
        background="var(--color-canvas)"
        color="var(--color-ink)"
      />

      <View className="notifications-summary">
        <View className="notifications-summary-heading">
          <Text className="notifications-summary-count">
            {t('notifications.unreadSummary', { count: unreadCount })}
          </Text>
          <View
            className={`notifications-mark-all ${unreadCount === 0 ? 'is-disabled' : ''}`}
            onClick={handleMarkAllRead}
          >
            <Text>{markAllLabel}</Text>
          </View>
        </View>
        <Text className="notifications-summary-hint">{t('notifications.summaryHint')}</Text>
      </View>

      {error && items.length > 0 ? (
        <View className="notifications-inline-error">
          <Text>{error}</Text>
          <Text className="notifications-inline-retry" onClick={() => loadFirstPage(false)}>
            {t('common.retry')}
          </Text>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View className="notifications-state">
          <Text className="notifications-state-title">{t('common.loading')}</Text>
        </View>
      ) : null}

      {!loading && error && items.length === 0 ? (
        <View className="notifications-state">
          <Text className="notifications-state-title">{error}</Text>
          <Button className="notifications-retry-button" onClick={() => loadFirstPage(true)}>
            {t('common.retry')}
          </Button>
        </View>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <View className="notifications-state">
          <Text className="notifications-state-title">{t('notifications.emptyTitle')}</Text>
          <Text className="notifications-state-description">
            {t('notifications.emptyDescription')}
          </Text>
        </View>
      ) : null}

      {items.length > 0 ? (
        <View className="notifications-list">
          {items.map(item => (
            <View
              className={`notification-row ${item.isRead ? 'is-read' : 'is-unread'} ${
                busyId === item.id ? 'is-busy' : ''
              }`}
              key={item.id}
              onClick={() => handleItemPress(item)}
            >
              <View className="notification-indicator" />
              <View className="notification-content">
                <View className="notification-heading">
                  <Text className="notification-title">
                    {item.title || t('notifications.fallbackTitle')}
                  </Text>
                  <Text className="notification-status">
                    {t(item.isRead ? 'notifications.read' : 'notifications.unread')}
                  </Text>
                </View>
                {item.message ? <Text className="notification-message">{item.message}</Text> : null}
                <View className="notification-meta">
                  <Text>{formatNotificationTime(item.createdAt)}</Text>
                  {item.planId ? (
                    <Text className="notification-plan-link">{t('notifications.openPlan')}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {loadingMore ? <Text className="notifications-list-state">{t('common.loading')}</Text> : null}
      {!loading && items.length > 0 && items.length >= total ? (
        <Text className="notifications-list-state">{t('common.noMore')}</Text>
      ) : null}
    </View>
  )
}
