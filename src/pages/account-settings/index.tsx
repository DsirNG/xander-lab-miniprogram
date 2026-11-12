import { FilingNotice } from '@/components/FilingNotice'
import { showThemedActionSheet } from '@/utils/actionSheet'
import { setThemeMode, themeModes, useThemeMode } from '@/hooks/useDarkMode'
import { ThemeView } from '@/components/ThemeView'
import { version } from '../../../package.json'
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
  onClick?: () => void
}) {
  return (
    <ListRow
      className="settings-row"
      leading={<Icon name={icon} />}
      title={<Text>{title}</Text>}
      description={description ? <Text>{description}</Text> : undefined}
      trailing={onClick ? <Icon name="right" /> : null}
      onClick={onClick}
    />
  )
}

const languageNames = { zh: '简体中文', en: 'English' } as const
const replyLanguages: ReplyLanguage[] = ['auto', 'zh', 'en']

export default function AccountSettingsPage() {
  const locale = useLocale()
  const themeMode = useThemeMode()
  const replyLanguage = useReplyLanguage()
  const logout = useUserStore(state => state.logout)
  const user = useUserStore(state => state.user)
  const signedIn = Boolean(user) && authApi.isLoggedIn()
  const navigateProtected = (url: string) => {
    const open = () => {
      void Taro.navigateTo({ url })
    }
    if (ensureLogin(open)) open()
  }
  const chooseTheme = async () => {
    try {
      const { tapIndex } = await showThemedActionSheet({
        itemList: themeModes.map(mode => t(`preferences.theme.${mode}`)),
      })
      const next = themeModes[tapIndex]
      if (next) setThemeMode(next)
    } catch {
      // Leave the current appearance when the chooser is dismissed.
    }
  }
  const chooseLanguage = async (reply = false) => {
    const choices = reply ? replyLanguages : [...supportedLocales]
    try {
      const result = await showThemedActionSheet({
        itemList: choices.map(value =>
          value === 'auto' ? t('preferences.replyAuto') : languageNames[value],
        ),
      })
      const selected = choices[result.tapIndex]
      if (!selected) return
      if (reply) setReplyLanguage(selected)
      else if (selected !== 'auto') setLocale(selected)
    } catch {
      // Dismissing the chooser keeps the current preference.
    }
  }
  const comingSoon = () => void Taro.showToast({ title: t('profile.comingSoon'), icon: 'none' })
  const signOut = async () => {
    const result = await Taro.showModal({
      title: t('preferences.signOut'),
      content: t('preferences.signOutHint'),
    })
    if (result.confirm) {
      void logout()
      void Taro.reLaunch({ url: '/pages/main/index?tab=chat' })
    }
  }

  return (
    <ThemeView className="settings-page">
      <NavBar
        title={t('settings.title')}
        showBack
        color="var(--color-ink)"
      />
      <View className="settings-content">
        <Text className="settings-section-title">{t('settings.accountGroup')}</Text>
        <View className="settings-list">
          <SettingsRow
            icon="user"
            title={t('settings.accountProfile')}
            description={t('settings.accountProfileDesc')}
            onClick={() => navigateProtected('/pages/account-profile/index')}
          />
          <SettingsRow
            icon="shield"
            title={t('settings.security')}
            description={t('settings.securityDesc')}
            onClick={() => navigateProtected('/pages/security-center/index')}
          />
        </View>

        <Text className="settings-section-title">{t('preferences.appearanceGroup')}</Text>
        <View className="settings-list">
          <SettingsRow
            icon="theme"
            title={t('preferences.themeTitle')}
            description={t(`preferences.theme.${themeMode}`)}
            onClick={() => void chooseTheme()}
          />
        </View>

        <Text className="settings-section-title">{t('preferences.languageGroup')}</Text>
        <View className="settings-list">
          <SettingsRow
            icon="globe"
            title={t('preferences.interfaceLanguage')}
            description={languageNames[locale as keyof typeof languageNames] || languageNames.zh}
            onClick={() => void chooseLanguage()}
          />
          <SettingsRow
            icon="languages"
            title={t('preferences.replyLanguage')}
            description={
              replyLanguage === 'auto' ? t('preferences.replyAuto') : languageNames[replyLanguage]
            }
            onClick={() => void chooseLanguage(true)}
          />
        </View>

        <Text className="settings-section-title">{t('preferences.supportGroup')}</Text>
        <View className="settings-list">
          <SettingsRow icon="star" title={t('profile.favorites')} onClick={comingSoon} />
          <SettingsRow icon="help" title={t('profile.help')} onClick={comingSoon} />
          <SettingsRow icon="feedback" title={t('profile.feedback')} onClick={comingSoon} />
          <SettingsRow
            icon="article"
            title={t('login.agreementTitle')}
            onClick={() => void Taro.navigateTo({ url: '/pages/legal/index?type=terms' })}
          />
          <SettingsRow icon="info" title={t('settings.about')} description={`v${version}`} />
        </View>
        {signedIn ? (
          <Button variant="ghost" block className="settings-signout" onClick={signOut}>
            {t('preferences.signOut')}
          </Button>
        ) : null}
        <FilingNotice />
      </View>
    </ThemeView>
  )
}
