import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { NavBar } from '@/components/NavBar'
import { ListRow } from '@/components/ui/ListRow'
import { setLocale, t, type Locale } from '@/i18n'
import './index.scss'

function SettingsRow({
  icon,
  title,
  description,
  url,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  title: string
  description: string
  url?: string
  onClick?: () => void
}) {
  return (
    <ListRow
      className="settings-row"
      leading={<Icon name={icon} />}
      title={<Text>{title}</Text>}
      description={<Text>{description}</Text>}
      trailing={<Icon name="right" />}
      onClick={() => (url ? Taro.navigateTo({ url }) : onClick?.())}
    />
  )
}

export default function AccountSettingsPage() {
  const [, refresh] = useState(0)
  const chooseLanguage = async () => {
    const locales: Locale[] = ['zh', 'en', 'fr', 'ja', 'ru', 'vi']
    try {
      const result = await Taro.showActionSheet({
        itemList: ['简体中文', 'English', 'Français', '日本語', 'Русский', 'Tiếng Việt'],
      })
      setLocale(locales[result.tapIndex])
      refresh(value => value + 1)
    } catch {
      // User cancelled the native action sheet.
    }
  }
  const showInfo = (title: string, content: string) =>
    Taro.showModal({ title, content, showCancel: false, confirmText: t('login.agree') })
  return (
    <View className="settings-page">
      <NavBar
        title={t('settings.title')}
        showBack
        background="var(--color-surface)"
        color="var(--color-ink)"
      />
      <View className="settings-content">
        <Text className="settings-section-title">{t('settings.accountGroup')}</Text>
        <View className="settings-list">
          <SettingsRow
            icon="user"
            title={t('settings.accountProfile')}
            description={t('settings.accountProfileDesc')}
            url="/pages/account-profile/index"
          />
          <SettingsRow
            icon="points"
            title={t('settings.security')}
            description={t('settings.securityDesc')}
            url="/pages/security-center/index"
          />
        </View>
        <Text className="settings-section-title">{t('settings.generalGroup')}</Text>
        <View className="settings-list">
          <SettingsRow
            icon="chat"
            title={t('settings.notifications')}
            description={t('settings.notificationsDesc')}
            url="/pages/notifications/index"
          />
          <SettingsRow
            icon="discover"
            title={t('settings.language')}
            description={t('settings.languageDesc')}
            onClick={chooseLanguage}
          />
          <SettingsRow
            icon="star"
            title={t('settings.privacy')}
            description={t('settings.privacyDesc')}
            onClick={() => showInfo(t('settings.privacy'), t('settings.privacyDesc'))}
          />
          <SettingsRow
            icon="discover"
            title={t('settings.about')}
            description={t('settings.aboutDesc')}
            onClick={() => showInfo(t('settings.about'), t('settings.aboutDesc'))}
          />
        </View>
      </View>
    </View>
  )
}
