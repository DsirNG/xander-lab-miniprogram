import { ThemeView } from '@/components/ThemeView'
import { Image, Input, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { authApi } from '@/api/auth'
import { NavBar } from '@/components/NavBar'
import { Button } from '@/components/ui/Button'
import { t, useLocale } from '@/i18n'
import { ensureLogin, useUserStore } from '@/store/user'
import '../account-profile/index.scss'

export default function AccountProfileEditPage() {
  useLocale()
  const setStoredUser = useUserStore(state => state.setUser)
  const [username, setUsername] = useState(() => useUserStore.getState().user?.username || '')
  const [nickname, setNickname] = useState(() => useUserStore.getState().user?.nickname || '')
  const [avatar, setAvatar] = useState(() => useUserStore.getState().user?.avatar || '')
  const [field, setField] = useState<'avatar' | 'username' | 'nickname'>('nickname')
  useLoad(params => {
    if (params?.field === 'avatar' || params?.field === 'username') setField(params.field)
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const chooseAvatar = async () => {
    if (uploading || !ensureLogin()) return
    try {
      const selected = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
      })
      const filePath = selected.tempFiles[0]?.tempFilePath
      if (!filePath) return
      const previousAvatar = avatar
      setAvatar(filePath)
      setUploading(true)
      try {
        const result = await authApi.uploadAvatar(filePath)
        setAvatar(result.url)
        Taro.showToast({ title: t('accountSettings.uploadSuccess'), icon: 'success' })
      } catch (error) {
        setAvatar(previousAvatar)
        if ((error as { errMsg?: string })?.errMsg?.includes('cancel')) return
        Taro.showToast({ title: t('accountSettings.uploadError'), icon: 'none' })
      } finally {
        setUploading(false)
      }
    } catch {
      // User dismissed media picker
    }
  }

  const save = async () => {
    if (saving || uploading || !ensureLogin()) return
    const current = useUserStore.getState().user
    if (!current) return
    if (
      (field === 'username' && username.trim().length < 3) ||
      (field === 'nickname' && !nickname.trim())
    ) {
      Taro.showToast({ title: t('accountSettings.profileRequired'), icon: 'none' })
      return
    }
    setSaving(true)
    try {
      const user = await authApi.updateProfile({
        username: field === 'username' ? username.trim() : undefined,
        nickname: field === 'nickname' ? nickname.trim() : current.nickname,
        avatar: field === 'avatar' ? avatar : undefined,
      })
      setStoredUser(user)
      Taro.showToast({ title: t('accountSettings.saveSuccess'), icon: 'success' })
      void Taro.navigateBack()
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : t('accountSettings.saveError'),
        icon: 'none',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ThemeView className="form-page">
      <NavBar
        title={t(
          field === 'avatar'
            ? 'accountSettings.changeAvatar'
            : field === 'username'
              ? 'accountSettings.editUsername'
              : 'accountSettings.editNickname',
        )}
        showBack
        color="var(--color-ink)"
      />
      <View className="form-content">
        {field === 'avatar' && (
          <View className="avatar-upload" onClick={chooseAvatar}>
            <View className="avatar-preview">
              {avatar ? (
                <Image className="avatar-image" src={avatar} mode="aspectFill" />
              ) : (
                <Text>{nickname.charAt(0) || 'X'}</Text>
              )}
              {uploading ? (
                <View className="avatar-loading-overlay">
                  <View className="avatar-spinner" />
                </View>
              ) : null}
            </View>
            <View>
              <Text className="avatar-action">
                {uploading ? t('accountSettings.uploading') : t('accountSettings.changeAvatar')}
              </Text>
              <Text className="form-help">{t('accountSettings.avatarUploadHelp')}</Text>
            </View>
          </View>
        )}
        {field === 'username' && (
          <>
            <Text className="form-label">{t('accountSettings.username')}</Text>
            <Input
              className="form-control"
              value={username}
              maxlength={30}
              onInput={e => setUsername(e.detail.value)}
            />
            <Text className="form-help">{t('accountSettings.usernameHelp')}</Text>
          </>
        )}
        {field === 'nickname' && (
          <>
            <Text className="form-label">{t('accountSettings.nickname')}</Text>
            <Input
              className="form-control"
              value={nickname}
              maxlength={30}
              onInput={e => setNickname(e.detail.value)}
            />
            <Text className="form-help">{t('accountSettings.nicknameHelp')}</Text>
          </>
        )}
        <Button
          block
          loading={saving}
          disabled={
            saving ||
            uploading ||
            (field === 'avatar' && (!avatar || avatar === useUserStore.getState().user?.avatar))
          }
          onClick={save}
        >
          {t('common.save')}
        </Button>
      </View>
    </ThemeView>
  )
}
