import { getDrawerTravel } from '@/utils/drawerGeometry'
import type { CSSProperties } from 'react'
import { DrawerMotionView } from '@/components/DrawerMotionView'
import { ThemeView } from '@/components/ThemeView'
import { hasSession, useSessionVersion } from '@/utils/privateCache'
import { ensureLogin } from '@/store/user'
import { View } from '@tarojs/components'
import { useDidShow, useLoad } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { TabBar } from '@/components/TabBar'
import { useTabBarStore } from '@/store/tabBar'
import { TAB_ITEMS, type TabKey } from '@/utils/tabBarRoute'
import { ChatPanel } from './panels/ChatPanel'
import type { ChatDrawerPhase } from '@/features/chat/ChatContent'
import { ProfilePanel } from './panels/ProfilePanel'
import { FilesPanel } from './panels/FilesPanel'
import { BlogPanel } from './panels/BlogPanel'
import './index.scss'

function isTabKey(value?: string): value is TabKey {
  return TAB_ITEMS.some(item => item.key === value)
}

export default function MainPage() {
  const session = useSessionVersion()
  const signedIn = hasSession()
  const active = useTabBarStore(state => state.active)
  const setActive = useTabBarStore(state => state.setActive)
  const refreshVersions = useTabBarStore(state => state.refreshVersions)
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set(['chat']))
  const [initialBlogTag, setInitialBlogTag] = useState('')
  const [drawerTravel, setDrawerTravel] = useState(getDrawerTravel)
  const [drawerPhase, setDrawerPhase] = useState<ChatDrawerPhase>('closed')
  const [pageShowCount, setPageShowCount] = useState(0)
  const pageShowCountRef = useRef(0)
  const renderCountRef = useRef(0)
  renderCountRef.current += 1

  console.log('[MainShell] RENDER', {
    active,
    visited: Array.from(visited),
    renderCount: renderCountRef.current,
  })

  useEffect(() => {
    console.log('[MainShell] MOUNT')

    return () => {
      console.log('[MainShell] UNMOUNT')
    }
  }, [])

  useEffect(() => {
    console.log('[MainShell] ACTIVE_CHANGE', { active })
  }, [active])

  useDidShow(() => {
    setDrawerTravel(getDrawerTravel())
    pageShowCountRef.current += 1
    const next = pageShowCountRef.current
    console.log('[MainShell] PAGE_SHOW', { count: next })
    setPageShowCount(next)
  })

  const markVisited = (tab: TabKey) => {
    setVisited(previous => {
      if (previous.has(tab)) return previous
      const next = new Set(previous)
      next.add(tab)
      return next
    })
  }

  useLoad(options => {
    const tab = options?.tab
    if (isTabKey(tab)) {
      if (tab === 'user' && !ensureLogin(() => setActive(tab))) return
      markVisited(tab)
      setActive(tab)
      if (tab === 'article' && options?.tag) setInitialBlogTag(options.tag)
    }
  })

  useEffect(() => {
    markVisited(active)
  }, [active])

  useEffect(() => {
    setDrawerPhase('closed')
    if (!signedIn && useTabBarStore.getState().active === 'user') setActive('chat')
  }, [session, signedIn, setActive])

  const drawerClass =
    active === 'chat' && drawerPhase !== 'closed' ? `is-drawer-${drawerPhase}` : ''

  return (
    <ThemeView
      className="main-shell"
      style={{ '--chat-drawer-offset': `${drawerTravel}px` } as CSSProperties}
    >
      <View className="main-shell__content">
        <ChatPanel
          key={`chat:${session}`}
          active={active === 'chat'}
          refreshVersion={refreshVersions.chat}
          onDrawerPhaseChange={setDrawerPhase}
        />
        {visited.has('files') || active === 'files' ? (
          <FilesPanel
            key={`files:${session}`}
            active={active === 'files'}
            refreshVersion={refreshVersions.files}
          />
        ) : null}
        {visited.has('article') || active === 'article' ? (
          <BlogPanel
            active={active === 'article'}
            pageShowCount={pageShowCount}
            initialTag={initialBlogTag}
            refreshVersion={refreshVersions.article}
          />
        ) : null}
        {visited.has('user') || active === 'user' ? (
          <ProfilePanel
            key={`profile:${session}`}
            active={active === 'user'}
            refreshVersion={refreshVersions.user}
          />
        ) : null}
      </View>
      {(active !== 'chat' || process.env.TARO_ENV !== 'weapp') && (
        <DrawerMotionView className={`main-shell__navigation ${drawerClass}`}>
          <TabBar />
        </DrawerMotionView>
      )}
    </ThemeView>
  )
}
