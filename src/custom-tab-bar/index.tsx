import { useRef } from 'react'
import Taro from '@tarojs/taro'
import { TabBar } from '@/components/TabBar'
import { useTabBarStore } from '@/store/tabBar'
import type { TabItem } from '@/utils/tabBarRoute'

export default function CustomTabBar() {
  const active = useTabBarStore(state => state.active)
  const navigatingRef = useRef(false)

  const handleNavigate = async (item: TabItem) => {
    if (navigatingRef.current || item.key === useTabBarStore.getState().active) return

    const previous = useTabBarStore.getState().active
    navigatingRef.current = true
    // Keep the feedback order deterministic: visual state, haptic feedback, native page switch.
    useTabBarStore.getState().setActive(item.key)
    void Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
    try {
      await Taro.switchTab({ url: item.url })
    } catch {
      useTabBarStore.getState().setActive(previous)
    } finally {
      navigatingRef.current = false
    }
  }

  return <TabBar active={active} onNavigate={handleNavigate} />
}
