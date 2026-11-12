import { ThemeView } from '@/components/ThemeView'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Icon } from '@/components/Icon'
import { NavBar } from '@/components/NavBar'
import { Skeleton } from '@/components/Skeleton'
import { ListRow } from '@/components/ui/ListRow'
import { t, useLocale } from '@/i18n'
import { ensureLogin, useUserStore } from '@/store/user'
import './index.scss'

export default function SecurityCenterPage() {
  useLocale()
  const { user, loaded, refresh } = useUserStore()
  useDidShow(() => {
    if (ensureLogin()) void refresh()
  })
  const open = (mode: 'email' | 'change' | 'reset') =>
    void Taro.navigateTo({ url: `/pages/security-edit/index?mode=${mode}` })
  const arrow = <Icon name="right" />

  return (
    <ThemeView className="security-page">
      <NavBar title={t('settings.security')} showBack />
      <View className="security-content">
        {!user ? (
          !loaded ? (
            <Skeleton layout="security" />
          ) : (
            <Text>{t('accountSettings.loadError')}</Text>
          )
        ) : (
          <>
            <ListRow
              leading={<Icon name="mail" />}
              title={t('security.emailLabel')}
              description={<Text>{user.email || t('security.notBound')}</Text>}
              trailing={arrow}
              onClick={() => open('email')}
            />
            <ListRow
              leading={<Icon name="lock" />}
              title={t('security.changePassword')}
              trailing={arrow}
              onClick={() => open('change')}
            />
            {user.email && (
              <ListRow
                leading={<Icon name="key" />}
                title={t('security.resetPassword')}
                trailing={arrow}
                onClick={() => open('reset')}
              />
            )}
          </>
        )}
      </View>
    </ThemeView>
  )
}
