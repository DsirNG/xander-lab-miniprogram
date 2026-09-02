import { Image, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { authApi } from '@/api/auth'
import { NavBar } from '@/components/NavBar'
import { Button } from '@/components/ui/Button'
import { t } from '@/i18n'
import { useUserStore } from '@/store/user'
import './index.scss'

export default function AccountProfilePage() {
  const setStoredUser = useUserStore(state => state.setUser)
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useDidShow(() => {
    authApi
      .me()
      .then(user => {
        setUsername(user.username)
        setNickname(user.nickname || '')
        setAvatar(user.avatar || '')
        setStoredUser(user)
      })
      .catch(() => Taro.showToast({ title: t('accountSettings.loadError'), icon: 'none' }))
  })

  const chooseAvatar = async () => {
    if (uploading) return
    try {
      const selected = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
      })
      const filePath = selected.tempFiles[0]?.tempFilePath
      if (!filePath) return
      setUploading(true)
      const result = await authApi.uploadAvatar(filePath)
      setAvatar(result.url)
      Taro.showToast({ title: t('accountSettings.uploadSuccess'), icon: 'success' })
    } catch (error) {
      if ((error as { errMsg?: string })?.errMsg?.includes('cancel')) return
      Taro.showToast({ title: t('accountSettings.uploadError'), icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (saving) return
    if (username.trim().length < 3 || !nickname.trim()) {
      Taro.showToast({ title: t('accountSettings.profileRequired'), icon: 'none' })
      return
    }
    setSaving(true)
    try {
      const user = await authApi.updateProfile({
        username: username.trim(),
        nickname: nickname.trim(),
        avatar: avatar || undefined,
      })
      setStoredUser(user)
      Taro.showToast({ title: t('accountSettings.saveSuccess'), icon: 'success' })
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
    <View className="form-page">
      <NavBar
        title={t('settings.accountProfile')}
        showBack
        background="var(--color-surface)"
        color="var(--color-ink)"
      />
      <View className="form-content">
        <View className="avatar-upload" onClick={chooseAvatar}>
          <View className="avatar-preview">
            {avatar ? (
              <Image className="avatar-image" src={avatar} mode="aspectFill" />
            ) : (
              <Text>{nickname.charAt(0) || 'X'}</Text>
            )}
          </View>
          <View>
            <Text className="avatar-action">
              {uploading ? t('accountSettings.uploading') : t('accountSettings.changeAvatar')}
            </Text>
            <Text className="form-help">{t('accountSettings.avatarUploadHelp')}</Text>
          </View>
        </View>
        <Text className="form-label">{t('accountSettings.username')}</Text>
        <Input
          className="form-control"
          value={username}
          maxlength={30}
          onInput={e => setUsername(e.detail.value)}
        />
        <Text className="form-help">{t('accountSettings.usernameHelp')}</Text>
        <Text className="form-label">{t('accountSettings.nickname')}</Text>
        <Input
          className="form-control"
          value={nickname}
          maxlength={30}
          onInput={e => setNickname(e.detail.value)}
        />
        <Text className="form-help">{t('accountSettings.nicknameHelp')}</Text>
        <Button block loading={saving} disabled={saving} onClick={save}>
          {t('common.save')}
        </Button>
      </View>
    </View>
  )
}
