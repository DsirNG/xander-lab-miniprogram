import { ScrollView, View } from '@tarojs/components'
import { ProfileContent } from '@/features/profile/ProfileContent'
import type { TabKey } from '@/utils/tabBarRoute'
import '@/features/profile/ProfileContent.scss'

type ProfilePanelProps = {
  active: boolean
  onMainTabNavigate: (tab: TabKey) => void
}

/** Profile business content hosted inside the persistent MainShell. */
export function ProfilePanel({ active, onMainTabNavigate }: ProfilePanelProps) {
  return (
    <View className={`main-panel main-panel--user ${active ? 'is-active' : ''}`} hidden={!active}>
      <ScrollView scrollY className="main-panel__scroll">
        <ProfileContent active={active} onMainTabNavigate={onMainTabNavigate} />
      </ScrollView>
    </View>
  )
}
