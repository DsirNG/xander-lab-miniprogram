import { ScrollView, View } from '@tarojs/components'
import { ProfileContent } from '@/features/profile/ProfileContent'
import '@/features/profile/ProfileContent.scss'

type ProfilePanelProps = {
  active: boolean
  refreshVersion?: number
}

/** Profile business content hosted inside the persistent MainShell. */
export function ProfilePanel({ active, refreshVersion = 0 }: ProfilePanelProps) {
  return (
    <View className={`main-panel main-panel--user ${active ? 'is-active' : ''}`} hidden={!active}>
      <ScrollView scrollY className="main-panel__scroll">
        <ProfileContent active={active} refreshVersion={refreshVersion} />
      </ScrollView>
    </View>
  )
}
