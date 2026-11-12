import { showThemedActionSheet } from '@/utils/actionSheet'
import Taro from '@tarojs/taro'
import { agentApi } from '@/api/agent'
import { formatPoints, pointsApi, type PointsOverview } from '@/api/points'
import {
  getSessionVersion,
  privateCacheKeys,
  readPrivateCache,
  writePrivateCache,
} from '@/utils/privateCache'
import { ensureLogin } from '@/store/user'
import { t, useLocale } from '@/i18n'
import { Image, ScrollView, Text, View, Input, type CommonEventFunction } from '@tarojs/components'
import { Skeleton } from '@/components/Skeleton'
import { Icon } from '@/components/Icon'
import { formatDateTime } from '@/utils/format'
import type { AgentConversation } from '@/api/agent'
import type { UserInfo } from '@/store/user'
import { useEffect, useRef, useState } from 'react'
import { useNavbarLayout } from '@/hooks/useNavbarLayout'
import { navigateToTab } from '@/store/tabBar'

interface ChatDrawerProps {
  visible: boolean
  closing?: boolean
  onClose: () => void
  gesture: {
    onTouchStart: CommonEventFunction
    onTouchMove: CommonEventFunction
    onTouchEnd: () => void
    onTouchCancel: () => void
    suppressClick: () => boolean
  }
  conversations: AgentConversation[]
  loadingConversations: boolean
  hasMore: boolean
  onSearch: (search: string) => void
  onLoadMore: () => void
  onPinned: (conversation: AgentConversation) => void
  loadingUser: boolean
  activeId: number | null
  onSelect: (id: number) => void
  onNewChat: () => void
  user: UserInfo | null
}

const PRODUCT_MENUS = [
  {
    get name() {
      return t('ui.files')
    },
    icon: 'files',
    tab: 'files',
  },
  {
    get name() {
      return t('ui.browseArticles')
    },
    icon: 'article',
    tab: 'article',
  },
  {
    get name() {
      return t('ui.myProfile')
    },
    icon: 'user',
    tab: 'user',
  },
] as const

export function ChatDrawer({
  visible,
  closing = false,
  onClose,
  gesture,
  conversations,
  loadingConversations,
  hasMore,
  onSearch,
  onLoadMore,
  onPinned,
  loadingUser,
  activeId,
  onSelect,
  onNewChat,
  user,
}: ChatDrawerProps) {
  useLocale()
  const [keyword, setKeyword] = useState('')
  const [focused, setFocused] = useState(false)
  const [failedAvatar, setFailedAvatar] = useState('')
  const { navBarHeight } = useNavbarLayout()

  const [points, setPoints] = useState(
    () =>
      readPrivateCache<PointsOverview>(privateCacheKeys.pointsOverview)?.balance ??
      readPrivateCache<{ points: number }>(privateCacheKeys.profileSummary)?.points ??
      null,
  )
  const pointsFresh = useRef(0)
  const searchRef = useRef(onSearch)
  searchRef.current = onSearch
  const keywordFirst = useRef(true)
  const [pendingPin, setPendingPin] = useState<number | null>(null)
  const holdUntil = useRef(0)
  useEffect(() => {
    if (keywordFirst.current) {
      keywordFirst.current = false
      return
    }
    const timer = setTimeout(() => searchRef.current(keyword.trim()), 250)
    return () => clearTimeout(timer)
  }, [keyword])
  useEffect(() => {
    if (!visible || !user || Date.now() - pointsFresh.current < 60_000) return
    let live = true
    const session = getSessionVersion()
    void pointsApi
      .overview()
      .then(result => {
        if (!live || session !== getSessionVersion()) return
        writePrivateCache(privateCacheKeys.pointsOverview, result, session)
        setPoints(result.balance)
        pointsFresh.current = Date.now()
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [visible, user?.username])

  const showConversationMenu = async (conversation: AgentConversation) => {
    if (gesture.suppressClick() || pendingPin != null) return
    holdUntil.current = Date.now() + 500
    try {
      const pinned = Number(conversation.isPinned) === 1
      const choice = await showThemedActionSheet({
        itemList: [t(pinned ? 'chat.unpinConversation' : 'chat.pinConversation')],
      })
      if (choice.tapIndex !== 0) return
      setPendingPin(conversation.id)
      const updated = await agentApi.setPinned(conversation.id, !pinned)
      onPinned(updated)
    } catch (error) {
      if (error instanceof Error) Taro.showToast({ title: error.message, icon: 'none' })
    } finally {
      setPendingPin(null)
      holdUntil.current = Date.now() + 350
    }
  }

  const openSettings = () => {
    const open = () => {
      void Taro.navigateTo({ url: '/pages/account-settings/index' })
    }
    if (ensureLogin(open)) open()
  }
  const filteredConversations = keyword
    ? conversations.filter(c => c.title.toLowerCase().includes(keyword.trim().toLowerCase()))
    : conversations

  return (
    <View
      className={`chat-drawer-layer ${visible ? 'is-visible' : 'is-hidden'}`}
      ariaLabel={t('ui.recentConversations')}
    >
      <View
        className={`chat-drawer-content ${closing ? 'is-closing' : ''}`}
        role="dialog"
        ariaRole="dialog"
        ariaLabel={t('ui.recentConversations')}
        onTouchStart={gesture.onTouchStart}
        onTouchMove={gesture.onTouchMove}
        onTouchEnd={gesture.onTouchEnd}
        onTouchCancel={gesture.onTouchCancel}
      >
        <View className="drawer-header" style={{ paddingTop: navBarHeight + 12 }}>
          <View className="drawer-brand">
            <Image
              className="drawer-logo"
              src={require('@/assets/dinqor-logo-80445584.png')}
              mode="aspectFit"
            />
            <Text className="drawer-title">DinQor</Text>
          </View>
        </View>

        <View className="drawer-new-chat-wrap">
          <View
            className="drawer-new-chat-btn"
            role="button"
            ariaRole="button"
            ariaLabel={t('ui.newConversation')}
            onClick={() => {
              if (gesture.suppressClick()) return
              onNewChat()
              onClose()
            }}
          >
            <Icon name="plus" />
            <Text>{t('ui.newConversation')}</Text>
          </View>
        </View>

        <View className="drawer-search-wrap">
          <View className="drawer-search-box">
            <Icon name="search" />
            <Input
              className="drawer-search-input"
              value={keyword}
              focus={focused}
              onInput={e => setKeyword(e.detail.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              ariaLabel={t('ui.searchConversations')}
            />
            {!keyword && !focused ? (
              <View className="drawer-search-placeholder" onClick={() => setFocused(true)}>
                {t('ui.searchConversations')}
              </View>
            ) : null}
          </View>
        </View>

        <ScrollView
          scrollY
          className="drawer-scroll"
          onScrollToLower={() => {
            if (hasMore && !loadingConversations) onLoadMore()
          }}
        >
          <View className="drawer-menu-list">
            {PRODUCT_MENUS.map(menu => (
              <View
                key={menu.tab}
                className="drawer-menu-item"
                role="button"
                ariaRole="button"
                ariaLabel={menu.name}
                onClick={() => {
                  if (gesture.suppressClick()) return
                  if (navigateToTab(menu.tab)) onClose()
                }}
              >
                <Icon name={menu.icon} />
                <Text>{menu.name}</Text>
              </View>
            ))}
          </View>

          <View className="drawer-recent-section">
            <Text className="drawer-recent-title">{t('ui.recentConversations')}</Text>
            <View className="drawer-recent-list">
              {loadingConversations && conversations.length === 0 && (
                <Skeleton layout="conversations" />
              )}
              {filteredConversations.map(conversation => (
                <View
                  key={conversation.id}
                  className={`drawer-chat-item ${activeId === conversation.id ? 'active' : ''}`}
                  role="button"
                  ariaRole="button"
                  ariaLabel={conversation.title || t('ui.newChat')}
                  onLongPress={() => void showConversationMenu(conversation)}
                  onClick={() => {
                    if (gesture.suppressClick() || Date.now() < holdUntil.current) return
                    onSelect(conversation.id)
                    onClose()
                  }}
                >
                  <Icon
                    name={Number(conversation.isPinned) === 1 ? 'pin' : 'chat'}
                    className="chat-item-icon"
                  />
                  <View className="chat-item-info">
                    <Text className="chat-item-title">{conversation.title}</Text>
                    <Text className="chat-item-desc">
                      {conversation.status === 'running' ? t('ui.running') : t('ui.newChat')}
                    </Text>
                  </View>
                  <View className="chat-item-meta">
                    <Text className="chat-item-time">
                      {formatDateTime(conversation.updatedAt).split(' ')[1] || t('ui.yesterday')}
                    </Text>
                    <View
                      className="drawer-chat-menu"
                      ariaRole="button"
                      ariaLabel={t('chat.conversationActions')}
                      onClick={event => {
                        event.stopPropagation()
                        void showConversationMenu(conversation)
                      }}
                    >
                      {pendingPin === conversation.id ? <Text>…</Text> : <Icon name="more" />}
                    </View>
                  </View>
                </View>
              ))}
              {loadingConversations && conversations.length > 0 && (
                <Skeleton layout="conversations" count={1} />
              )}
              {!loadingConversations && hasMore && (
                <View className="drawer-load-more" onClick={onLoadMore}>
                  {t('ui.libraryLoadMore')}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {loadingUser && !user ? (
          <View className="drawer-footer">
            <Skeleton layout="profile" />
          </View>
        ) : user ? (
          <View className="drawer-footer">
            <View
              className="drawer-account"
              ariaRole="button"
              ariaLabel={t('ui.myProfile')}
              hoverClass="drawer-account--pressed"
              hoverStopPropagation
              onClick={() => {
                if (!gesture.suppressClick() && navigateToTab('user')) onClose()
              }}
            >
              <View className="drawer-user-avatar">
                {user.avatar && user.avatar !== failedAvatar ? (
                  <Image
                    className="drawer-avatar-image"
                    src={user.avatar}
                    mode="aspectFill"
                    onError={() => setFailedAvatar(user.avatar)}
                  />
                ) : (
                  <Text>
                    {(user.nickname || user.username || t('ui.user')).charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View className="drawer-account-copy">
                <Text className="drawer-user-name">
                  {user.nickname || user.username || t('ui.user')}
                </Text>
                <Text className="drawer-user-points">
                  {t('chat.drawerPoints', { points: points == null ? '—' : formatPoints(points) })}
                </Text>
              </View>
            </View>
            <View
              className="drawer-settings"
              hoverClass="drawer-settings--pressed"
              hoverStopPropagation
              ariaRole="button"
              ariaLabel={t('profile.settings')}
              onClick={event => {
                event.stopPropagation()
                if (!gesture.suppressClick()) openSettings()
              }}
            >
              <Icon name="settings" />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}
