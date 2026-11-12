import { ThemeView } from '@/components/ThemeView'
import { Input, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { authApi } from '@/api/auth'
import { NavBar } from '@/components/NavBar'
import { Button } from '@/components/ui/Button'
import { t, useLocale } from '@/i18n'
import { ensureLogin, useUserStore } from '@/store/user'
import '../security-center/index.scss'

type Mode = 'email' | 'change' | 'reset'
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export default function SecurityEditPage() {
  useLocale()
  const boundEmail = useUserStore(state => state.user?.email)
  const [mode, setMode] = useState<Mode>('change')
  const [emailInput, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  useLoad(params => {
    if (params?.mode === 'email' || params?.mode === 'reset') setMode(params.mode)
  })

  const email = mode === 'reset' ? boundEmail || '' : emailInput.trim()
  const isRebind = mode === 'email' && Boolean(boundEmail)
  const usesCode = mode !== 'change'
  const title = t(
    mode === 'email'
      ? isRebind
        ? 'security.rebindEmail'
        : 'security.emailTitle'
      : mode === 'reset'
        ? 'security.resetPassword'
        : 'security.changePassword',
  )
  const notify = (text: string) => Taro.showToast({ title: text, icon: 'none' })

  const sendCode = async () => {
    if (sending || !ensureLogin()) return
    if (!EMAIL_PATTERN.test(email)) {
      notify(t('login.invalidEmail'))
      return
    }
    setSending(true)
    try {
      await authApi.sendCode(email)
      notify(t('login.codeSent'))
    } catch (error) {
      notify(error instanceof Error ? error.message : t('accountSettings.sendCodeError'))
    } finally {
      setSending(false)
    }
  }

  const submit = async () => {
    if (busy || !ensureLogin()) return
    if (usesCode && (!EMAIL_PATTERN.test(email) || !code.trim())) return
    if (mode === 'change' && !current) return
    if (mode !== 'email' && (password.length < 6 || password !== confirm)) {
      notify(t('security.passwordMismatch'))
      return
    }
    setBusy(true)
    try {
      if (mode === 'email') {
        await authApi.bindExisting(email, code.trim())
        await useUserStore.getState().refresh()
        notify(t('accountSettings.bindSuccess'))
      } else {
        if (mode === 'change') await authApi.changePassword(current, password)
        else await authApi.resetPassword(email, code.trim(), password)
        notify(t('security.passwordSuccess'))
      }
      void Taro.navigateBack()
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : t(mode === 'email' ? 'accountSettings.bindError' : 'security.passwordError'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ThemeView className="security-page">
      <NavBar title={title} showBack />
      <View className="security-content">
        {isRebind ? (
          <>
            <Text className="security-summary">{boundEmail}</Text>
            <Text className="security-help">{t('security.rebindUnavailable')}</Text>
          </>
        ) : (
          <>
            {usesCode ? (
              <>
                <Input
                  className="security-input"
                  value={email}
                  disabled={mode === 'reset'}
                  placeholder={t('accountSettings.emailPlaceholder')}
                  onInput={event => setEmail(event.detail.value)}
                />
                <View className="security-code-row">
                  <Input
                    className="security-input"
                    type="number"
                    maxlength={6}
                    value={code}
                    placeholder={t('accountSettings.codePlaceholder')}
                    onInput={event => setCode(event.detail.value)}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={sending}
                    disabled={sending}
                    onClick={sendCode}
                  >
                    {t('accountSettings.sendCode')}
                  </Button>
                </View>
              </>
            ) : (
              <Input
                className="security-input"
                password
                value={current}
                placeholder={t('security.currentPasswordLabel')}
                onInput={event => setCurrent(event.detail.value)}
              />
            )}
            {mode !== 'email' && (
              <>
                <Input
                  className="security-input"
                  password
                  value={password}
                  placeholder={t('security.newPassword')}
                  onInput={event => setPassword(event.detail.value)}
                />
                <Input
                  className="security-input"
                  password
                  value={confirm}
                  placeholder={t('security.confirmPassword')}
                  onInput={event => setConfirm(event.detail.value)}
                />
              </>
            )}
            <Button
              block
              loading={busy}
              disabled={busy || (usesCode ? !email || !code.trim() : !current)}
              onClick={submit}
            >
              {title}
            </Button>
          </>
        )}
      </View>
    </ThemeView>
  )
}
