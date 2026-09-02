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

interface ChatDrawerProps {
  visible: boolean
  closing?: boolean
  onClose: () => void
  conversations: AgentConversation[]
  activeId: number | null
  onSelect: (id: number) => void
  onNewChat: () => void
  onNavigate: (url: string) => void
  user: UserInfo | null
}

const PRODUCT_MENUS = [
  { name: '内容计划', icon: 'calendar', url: '/pages/plans/index' },
  { name: '浏览博客', icon: 'article', url: '/pages/blog/index' },
  { name: '个人中心', icon: 'user', url: '/pages/profile/index' },
]

export function ChatDrawer({
  visible,
  closing = false,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onNavigate,
  user,
}: ChatDrawerProps) {
  const [keyword, setKeyword] = useState('')
  const [focused, setFocused] = useState(false)
  const { statusBarHeight } = useNavbarLayout()

  // 抽屉内部左滑收起：与主面板一致的阈值与方向判定。
  const drawerTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const SWIPE_THRESHOLD = 60

  const onDrawerTouchStart: CommonEventFunction = useCallback(e => {
    const touch = (e as ITouchEvent).touches[0]
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
      ariaLabel="最近对话"
    >
      <View
        className={`chat-drawer-content ${closing ? 'is-closing' : ''}`}
        role="dialog"
        ariaRole="dialog"
        ariaLabel="最近对话"
        onTouchStart={onDrawerTouchStart}
        onTouchEnd={onDrawerTouchEnd}
      >
        <View className="drawer-header" style={{ paddingTop: statusBarHeight + 16 }}>
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
            ariaLabel="新建对话"
            onClick={() => {
              onNewChat()
              onClose()
            }}
          >
            <Icon name="plus" />
            <Text>新建对话</Text>
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
              ariaLabel="搜索对话"
            />
            {!keyword && !focused ? (
              <View className="drawer-search-placeholder" onClick={() => setFocused(true)}>
                搜索对话
              </View>
            ) : null}
          </View>
        </View>

        <ScrollView scrollY className="drawer-scroll">
          <View className="drawer-menu-list">
            {PRODUCT_MENUS.map(menu => (
              <View
                key={menu.url}
                className="drawer-menu-item"
                role="button"
                ariaRole="button"
                ariaLabel={menu.name}
                onClick={() => {
                  onNavigate(menu.url)
                  onClose()
                }}
              >
                <Icon name={menu.icon as any} />
                <Text>{menu.name}</Text>
              </View>
            ))}
          </View>

          <View className="drawer-recent-section">
            <Text className="drawer-recent-title">最近对话</Text>
            <View className="drawer-recent-list">
              {filteredConversations.map(conversation => (
                <View
                  key={conversation.id}
                  className={`drawer-chat-item ${activeId === conversation.id ? 'active' : ''}`}
                  role="button"
                  ariaRole="button"
                  ariaLabel={conversation.title || '新对话'}
                  onClick={() => {
                    onSelect(conversation.id)
                    onClose()
                  }}
                >
                  <Icon name="chat" className="chat-item-icon" />
                  <View className="chat-item-info">
                    <Text className="chat-item-title">{conversation.title}</Text>
                    <Text className="chat-item-desc">
                      {conversation.status === 'running' ? '执行中...' : '新对话'}
                    </Text>
                  </View>
                  <View className="chat-item-meta">
                    <Text className="chat-item-time">
                      {formatDateTime(conversation.updatedAt).split(' ')[1] || '昨天'}
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
              onNavigate('/pages/profile/index')
              onClose()
            }}
          >
            <View className="drawer-user-avatar">
              <Icon name="user" />
            </View>
            <Text className="drawer-user-name">{user.nickname || '用户'}</Text>
            <Icon name="right" className="drawer-user-arrow" />
          </View>
        ) : null}
      </View>
    </View>
  )
}
