import { useEffect, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import { TAB_ITEMS, type TabItem, type TabKey } from '@/utils/tabBarRoute'
import { AnimatedIcon } from './AnimatedIcon'
import './TabBar.scss'

export function TabBar({
  active,
  onNavigate,
}: {
  active: TabKey
  onNavigate: (item: TabItem) => void
}) {
  const renderCountRef = useRef(0)
  renderCountRef.current += 1

  const handleNavigate = (item: TabItem) => {
    if (active === item.key) return
    onNavigate(item)
  }

  const activeIndex = TAB_ITEMS.findIndex(item => item.key === active)
  const safeActiveIndex = Math.max(activeIndex, 0)

  console.log('[TabBar] RENDER', {
    active,
    activeIndex: safeActiveIndex,
    renderCount: renderCountRef.current,
  })

  useEffect(() => {
    console.log('[TabBar] MOUNT', { active })

    return () => {
      console.log('[TabBar] UNMOUNT')
    }
  }, [])

  useEffect(() => {
    console.log('[TabBar] ACTIVE_CHANGE', {
      active,
      activeIndex: safeActiveIndex,
    })
  }, [active, safeActiveIndex])

  return (
    <View className="tab-bar">
      <View className="tab-bar__glass" />
      <View className="tab-list">
        <View className={`active-pill active-pill--${safeActiveIndex}`} />
        {TAB_ITEMS.map(item => (
          <View
            className={`tab-item ${active === item.key ? 'active' : ''}`}
            key={item.key}
            hoverClass="tab-item--pressed"
            onClick={() => handleNavigate(item)}
          >
            <AnimatedIcon name={item.icon} active={active === item.key} className="tab-icon" />
            <Text>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
