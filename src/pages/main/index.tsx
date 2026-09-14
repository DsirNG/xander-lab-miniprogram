import { View } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { TabBar } from '@/components/TabBar'
import { useTabBarStore } from '@/store/tabBar'
import { TAB_ITEMS, type TabItem, type TabKey } from '@/utils/tabBarRoute'
import { ChatPanel } from './panels/ChatPanel'
import { ProfilePanel } from './panels/ProfilePanel'
import { PlansPanel } from './panels/PlansPanel'
import { BlogPanel } from './panels/BlogPanel'
import './index.scss'

function isTabKey(value?: string): value is TabKey {
  return TAB_ITEMS.some(item => item.key === value)
}

export default function MainPage() {
  const active = useTabBarStore(state => state.active)
  const setActive = useTabBarStore(state => state.setActive)
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set(['chat']))
  const [initialBlogTag, setInitialBlogTag] = useState('')
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
      markVisited(tab)
      setActive(tab)
      if (tab === 'article' && options?.tag) setInitialBlogTag(options.tag)
    }
  })

  useEffect(() => {
    markVisited(active)
  }, [active])

  const handleNavigate = (item: TabItem) => {
    if (item.key === active) return

    markVisited(item.key)
    setActive(item.key)
    void Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
  }

  const handleMainTabNavigate = (tab: TabKey) => {
    const item = TAB_ITEMS.find(candidate => candidate.key === tab)
    if (item) handleNavigate(item)
  }

  return (
    <View className="main-shell">
      <View className="main-shell__content">
        <ChatPanel active={active === 'chat'} onMainTabNavigate={handleMainTabNavigate} />

        {visited.has('calendar') ? (
          <PlansPanel active={active === 'calendar'} pageShowCount={pageShowCount} />
        ) : null}

        {visited.has('article') ? (
          <BlogPanel
            active={active === 'article'}
            pageShowCount={pageShowCount}
            initialTag={initialBlogTag}
          />
        ) : null}

        {visited.has('user') ? (
          <ProfilePanel active={active === 'user'} onMainTabNavigate={handleMainTabNavigate} />
        ) : null}
      </View>

      <TabBar active={active} onNavigate={handleNavigate} />
    </View>
  )
}
