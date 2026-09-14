import { View, Text } from '@tarojs/components'
import { TAB_ITEMS, type TabItem, type TabKey } from '@/utils/tabBarRoute'
import { Icon } from './Icon'
import './TabBar.scss'

export function TabBar({
  active,
  onNavigate,
}: {
  active: TabKey
  onNavigate: (item: TabItem) => void
}) {
  const handleNavigate = (item: TabItem) => {
    if (active === item.key) return
    onNavigate(item)
  }

  const activeIndex = TAB_ITEMS.findIndex(item => item.key === active)
  const safeActiveIndex = Math.max(activeIndex, 0)

  return (
    <View className="tab-bar">
      <View className="tab-list">
        <View className={`active-pill active-pill--${safeActiveIndex}`} />
        {TAB_ITEMS.map(item => (
          <View
            className={`tab-item ${active === item.key ? 'active' : ''}`}
            key={item.url}
            hoverClass="tab-item--pressed"
            onClick={() => handleNavigate(item)}
          >
            <Icon name={item.icon} />
            <Text>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
