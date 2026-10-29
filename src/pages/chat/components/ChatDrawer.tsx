import { t, useLocale } from '@/i18n'
import {
  ScrollView,
  Text,
  View,
  Input,
  type CommonEventFunction,
  type ITouchEvent,
} from '@tarojs/components'
import { Icon } from '@/components/Icon'
import { formatDateTime } from '@/utils/format'
import type { AgentConversation } from '@/api/agent'
import type { UserInfo } from '@/store/user'
import { useCallback, useRef, useState } from 'react'
import { useNavbarLayout } from '@/hooks/useNavbarLayout'
import { navigateToTab } from '@/store/tabBar'

interface ChatDrawerProps {
  visible: boolean
  closing?: boolean
  onClose: () => void
  conversations: AgentConversation[]
  activeId: number | null
  onSelect: (id: number) => void
  onNewChat: () => void
  user: UserInfo | null
}

const PRODUCT_MENUS = [
  {
    get name() {
      return t('ui.publishingPlans')
    },
    icon: 'calendar',
    tab: 'calendar',
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
  conversations,
  activeId,
  onSelect,
  onNewChat,
  user,
}: ChatDrawerProps) {
  useLocale()
  const [keyword, setKeyword] = useState('')
  const [focused, setFocused] = useState(false)
  const { navBarHeight } = useNavbarLayout()

  // 抽屉内部左滑收起：与主面板一致的阈值与方向判定。
  const drawerTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const SWIPE_THRESHOLD = 60

  const onDrawerTouchStart: CommonEventFunction = useCallback(e => {
    const touch = (e as ITouchEvent).touches[0]
    if (!touch) return
    drawerTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const onDrawerTouchEnd: CommonEventFunction = useCallback(
    e => {
      const start = drawerTouchStartRef.current
      drawerTouchStartRef.current = null
      if (!start) return
      const end = (e as ITouchEvent).changedTouches[0]
      if (!end) return
      const dx = end.clientX - start.x
      const dy = end.clientY - start.y
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy) * 1.2) return
      if (dx < 0) onClose()
    },
    [onClose],
  )

  const filteredConversations = keyword
    ? conversations.filter(c => c.title.toLowerCase().includes(keyword.toLowerCase()))
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
        onTouchStart={onDrawerTouchStart}
        onTouchEnd={onDrawerTouchEnd}
      >
        <View className="drawer-header" style={{ paddingTop: navBarHeight + 12 }}>
          <View className="drawer-brand">
            <View className="drawer-logo">
              <Icon name="play" />
            </View>
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

        <ScrollView scrollY className="drawer-scroll">
          <View className="drawer-menu-list">
            {PRODUCT_MENUS.map(menu => (
              <View
                key={menu.tab}
                className="drawer-menu-item"
                role="button"
                ariaRole="button"
                ariaLabel={menu.name}
                onClick={() => {
                  navigateToTab(menu.tab)
                  onClose()
                }}
              >
                <Icon name={menu.icon as any} />
                <Text>{menu.name}</Text>
              </View>
            ))}
          </View>

          <View className="drawer-recent-section">
            <Text className="drawer-recent-title">{t('ui.recentConversations')}</Text>
            <View className="drawer-recent-list">
              {filteredConversations.map(conversation => (
                <View
                  key={conversation.id}
                  className={`drawer-chat-item ${activeId === conversation.id ? 'active' : ''}`}
                  role="button"
                  ariaRole="button"
                  ariaLabel={conversation.title || t('ui.newChat')}
                  onClick={() => {
                    onSelect(conversation.id)
                    onClose()
                  }}
                >
                  <Icon name="chat" className="chat-item-icon" />
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
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {user ? (
          <View
            className="drawer-footer"
            role="button"
            ariaRole="button"
            ariaLabel={PRODUCT_MENUS[2].name}
            onClick={() => {
              navigateToTab('user')
              onClose()
            }}
          >
            <View className="drawer-user-avatar">
              <Icon name="user" />
            </View>
            <Text className="drawer-user-name">{user.nickname || t('ui.user')}</Text>
            <Icon name="right" className="drawer-user-arrow" />
          </View>
        ) : null}
      </View>
    </View>
  )
}
