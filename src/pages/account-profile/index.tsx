import { ThemeView } from '@/components/ThemeView'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { NavBar } from '@/components/NavBar'
import { Skeleton } from '@/components/Skeleton'
import { ListRow } from '@/components/ui/ListRow'
import { t, useLocale } from '@/i18n'
import { ensureLogin, useUserStore } from '@/store/user'
import './index.scss'

export default function AccountProfilePage() {
  useLocale()
  const { user, loaded, refresh } = useUserStore()
  useDidShow(() => {
    if (ensureLogin()) void refresh()
  })

  const open = (field: 'avatar' | 'username' | 'nickname') => {
    const navigate = () =>
      void Taro.navigateTo({ url: `/pages/account-profile-edit/index?field=${field}` })
    if (ensureLogin(navigate)) navigate()
  }

  return (
    <ThemeView className="form-page">
      <NavBar title={t('settings.accountProfile')} showBack />
      <View className="form-content">
        {!user ? (
          !loaded ? (
            <Skeleton layout="account" />
          ) : (
            <Text>{t('accountSettings.loadError')}</Text>
          )
        ) : (
          <>
            <ListRow
              title={t('accountSettings.avatarLabel')}
              onClick={() => open('avatar')}
              trailing={
                user.avatar ? (
                  <View className="avatar-preview">
                    <Image className="avatar-image" src={user.avatar} mode="aspectFill" />
                  </View>
                ) : (
                  <Text>{t('accountSettings.noAvatar')}</Text>
                )
              }
            />
            <ListRow
              title={t('accountSettings.username')}
              onClick={() => open('username')}
              trailing={<Text>{user.username}</Text>}
            />
            <ListRow
              title={t('accountSettings.nickname')}
              onClick={() => open('nickname')}
              trailing={<Text>{user.nickname || '—'}</Text>}
            />
          </>
        )}
      </View>
    </ThemeView>
  )
}
