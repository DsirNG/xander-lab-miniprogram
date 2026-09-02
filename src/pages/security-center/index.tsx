import { Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { authApi } from '@/api/auth'
import { NavBar } from '@/components/NavBar'
import { Button } from '@/components/ui/Button'
import { t } from '@/i18n'
import './index.scss'

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export default function SecurityCenterPage() {
  const [email, setEmail] = useState('')
  const [boundEmail, setBoundEmail] = useState('')
  const [code, setCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  useDidShow(() => {
    authApi
      .me()
      .then(user => {
        setBoundEmail(user.email || '')
        setEmail(user.email || '')
      })
      .catch(() => undefined)
  })

  const sendCode = async () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      Taro.showToast({ title: t('login.invalidEmail'), icon: 'none' })
      return
    }
    try {
      await authApi.sendCode(email.trim())
      Taro.showToast({ title: t('login.codeSent'), icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : t('accountSettings.sendCodeError'),
        icon: 'none',
      })
    }
  }

  const bindEmail = async () => {
    setBusy(true)
    try {
      await authApi.bindExisting(email.trim(), code.trim())
      setBoundEmail(email.trim())
      Taro.showToast({ title: t('accountSettings.bindSuccess'), icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : t('accountSettings.bindError'),
        icon: 'none',
      })
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = async () => {
    if (newPassword.length < 6 || newPassword !== confirmPassword) {
      Taro.showToast({ title: t('security.passwordMismatch'), icon: 'none' })
      return
    }
    setBusy(true)
    try {
      if (currentPassword) await authApi.changePassword(currentPassword, newPassword)
      else await authApi.resetPassword(email.trim(), code.trim(), newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setCode('')
      Taro.showToast({ title: t('security.passwordSuccess'), icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : t('security.passwordError'),
        icon: 'none',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="security-page">
      <NavBar
        title={t('settings.security')}
        showBack
        background="var(--color-surface)"
        color="var(--color-ink)"
      />
      <View className="security-content">
        <Text className="security-title">{t('security.emailTitle')}</Text>
        {boundEmail ? (
          <Text className="security-summary">{boundEmail}</Text>
        ) : (
          <>
            <Input
              className="security-input"
              value={email}
              placeholder={t('accountSettings.emailPlaceholder')}
              onInput={e => setEmail(e.detail.value)}
            />
            <View className="security-code-row">
              <Input
                className="security-input"
                value={code}
                maxlength={6}
                placeholder={t('accountSettings.codePlaceholder')}
                onInput={e => setCode(e.detail.value)}
              />
              <Button variant="secondary" size="sm" onClick={sendCode}>
                {t('accountSettings.sendCode')}
              </Button>
            </View>
            <Button block loading={busy} onClick={bindEmail}>
              {t('accountSettings.bindCta')}
            </Button>
          </>
        )}

        <Text className="security-title">{t('security.passwordTitle')}</Text>
        <Text className="security-help">
          {currentPassword ? t('security.changeHint') : t('security.resetHint')}
        </Text>
        <Input
          className="security-input"
          password
          value={currentPassword}
          placeholder={t('security.currentPassword')}
          onInput={e => setCurrentPassword(e.detail.value)}
        />
        {!currentPassword ? (
          <>
            <Input
              className="security-input"
              value={email}
              placeholder={t('accountSettings.emailPlaceholder')}
              onInput={e => setEmail(e.detail.value)}
            />
            <View className="security-code-row">
              <Input
                className="security-input"
                value={code}
                maxlength={6}
                placeholder={t('accountSettings.codePlaceholder')}
                onInput={e => setCode(e.detail.value)}
              />
              <Button variant="secondary" size="sm" onClick={sendCode}>
                {t('accountSettings.sendCode')}
              </Button>
            </View>
          </>
        ) : null}
        <Input
          className="security-input"
          password
          value={newPassword}
          placeholder={t('security.newPassword')}
          onInput={e => setNewPassword(e.detail.value)}
        />
        <Input
          className="security-input"
          password
          value={confirmPassword}
          placeholder={t('security.confirmPassword')}
          onInput={e => setConfirmPassword(e.detail.value)}
        />
        <Button block loading={busy} onClick={submitPassword}>
          {currentPassword ? t('security.changePassword') : t('security.resetPassword')}
        </Button>
      </View>
    </View>
  )
}
