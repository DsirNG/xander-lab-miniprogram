import { ScrollView, Text, View } from '@tarojs/components'
import { NavBar } from '@/components/NavBar'
import { t } from '@/i18n'
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
      <NavBar left={<Text className="profile-nav-title">{t('profile.title')}</Text>} />
      <ScrollView scrollY enableBackToTop className="main-panel__scroll">
        <ProfileContent active={active} refreshVersion={refreshVersion} />
      </ScrollView>
    </View>
  )
}
