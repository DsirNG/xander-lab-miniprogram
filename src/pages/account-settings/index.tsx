import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Icon } from '@/components/Icon'
import { NavBar } from '@/components/NavBar'
import { Button } from '@/components/ui/Button'
import { ListRow } from '@/components/ui/ListRow'
import {
  setLocale,
  setReplyLanguage,
  supportedLocales,
  t,
  useLocale,
  useReplyLanguage,
  type ReplyLanguage,
} from '@/i18n'
import { authApi } from '@/api/auth'
import { ensureLogin, useUserStore } from '@/store/user'
import './index.scss'

function SettingsRow({
  icon,
  title,
  description,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  title: string
  description?: string
  onClick: () => void
}) {
  return (
    <ListRow
      className="settings-row"
      leading={<Icon name={icon} />}
      title={<Text>{title}</Text>}
      description={description ? <Text>{description}</Text> : undefined}
      trailing={<Icon name="right" />}
      onClick={onClick}
    />
  )
}

const languageNames = { zh: '简体中文', en: 'English' } as const
const replyLanguages: ReplyLanguage[] = ['auto', 'zh', 'en']

export default function AccountSettingsPage() {
  const locale = useLocale()
  const replyLanguage = useReplyLanguage()
  const logout = useUserStore(state => state.logout)
  const user = useUserStore(state => state.user)
  const signedIn = Boolean(user) && authApi.isLoggedIn()
  const navigateProtected = (url: string) => {
    if (ensureLogin()) void Taro.navigateTo({ url })
  }
  const showInfo = (title: string, content: string) =>
    Taro.showModal({ title, content, showCancel: false, confirmText: t('login.agree') })
  const comingSoon = () => void Taro.showToast({ title: t('profile.comingSoon'), icon: 'none' })
  const signOut = async () => {
    const result = await Taro.showModal({
      title: t('preferences.signOut'),
      content: t('preferences.signOutHint'),
    })
    if (result.confirm) await logout()
  }

  return (
    <View className="settings-page">
      <NavBar
        title={t('settings.title')}
        showBack
        background="var(--color-surface)"
        color="var(--color-ink)"
      />
      <View className="settings-content">
        <Text className="settings-intro">{t('preferences.settingsIntro')}</Text>
        <Text className="settings-section-title">{t('settings.accountGroup')}</Text>
        <View className="settings-list">
          <SettingsRow
            icon="user"
            title={t('settings.accountProfile')}
            description={t('settings.accountProfileDesc')}
            onClick={() => navigateProtected('/pages/account-profile/index')}
          />
          <SettingsRow
            icon="points"
            title={t('settings.security')}
            description={t('settings.securityDesc')}
            onClick={() => navigateProtected('/pages/security-center/index')}
          />
        </View>

        <Text className="settings-section-title">{t('preferences.languageGroup')}</Text>
        <View className="settings-list settings-language-card">
          <Text className="settings-option-title">{t('preferences.interfaceLanguage')}</Text>
          <View className="settings-language-options">
            {supportedLocales.map(value => (
              <Button
                key={value}
                variant="ghost"
                size="sm"
                className={`settings-choice ${locale === value ? 'is-selected' : ''}`}
                onClick={() => setLocale(value)}
              >
                {languageNames[value]}
              </Button>
            ))}
          </View>
          <Text className="settings-option-title">{t('preferences.replyLanguage')}</Text>
          <View className="settings-language-options">
            {replyLanguages.map(value => (
              <Button
                key={value}
                variant="ghost"
                size="sm"
                className={`settings-choice ${replyLanguage === value ? 'is-selected' : ''}`}
                onClick={() => setReplyLanguage(value)}
              >
                {value === 'auto' ? t('preferences.replyAuto') : languageNames[value]}
              </Button>
            ))}
          </View>
          <Text className="settings-option-hint">{t('preferences.replyHint')}</Text>
        </View>

        <Text className="settings-section-title">{t('preferences.supportGroup')}</Text>
        <View className="settings-list">
          <SettingsRow icon="star" title={t('profile.favorites')} onClick={comingSoon} />
          <SettingsRow icon="discover" title={t('profile.help')} onClick={comingSoon} />
          <SettingsRow icon="chat" title={t('profile.feedback')} onClick={comingSoon} />
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
        {signedIn ? (
          <Button variant="ghost" block className="settings-signout" onClick={signOut}>
            {t('preferences.signOut')}
          </Button>
        ) : null}
      </View>
    </View>
  )
}
