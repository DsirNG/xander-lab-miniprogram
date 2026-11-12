import { ThemeView } from '@/components/ThemeView'
import { Text, View } from '@tarojs/components'
import { Button } from '@/components/ui/Button'
import Taro, { useLoad, useUnload } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { authApi, type QrLoginStatus } from '@/api/auth'
import { NavBar } from '@/components/NavBar'
import { SkeletonBlock } from '@/components/Skeleton'
import { authorizeQrLogin, isWaitingQr, readWaitingQr } from '@/features/auth/qrAuthorization'
import { t, useLocale } from '@/i18n'
import { useUserStore } from '@/store/user'
import { useTabBarStore } from '@/store/tabBar'
import { openLogin } from '@/utils/loginPrompt'
import './index.scss'

export default function ScanLogin() {
  const locale = useLocale()
  const user = useUserStore(state => state.user)
  const [ticket, setTicket] = useState('')
  const [session, setSession] = useState<QrLoginStatus | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)
  const active = useRef(true)
  const busy = useRef(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout>>()
  const loggedIn = authApi.isLoggedIn()

  useUnload(() => {
    active.current = false
    if (exitTimer.current) clearTimeout(exitTimer.current)
  })

  const loadSession = async (value: string) => {
    setChecking(true)
    setError('')
    try {
      const result = await readWaitingQr(value)
      if (active.current) setSession(result)
    } catch (cause) {
      if (active.current) {
        setSession(null)
        setError(cause instanceof Error ? cause.message : t('login.qrFailed'))
      }
    } finally {
      if (active.current) setChecking(false)
    }
  }

  useLoad(params => {
    const value = params?.ticket || params?.scene || ''
    setTicket(value)
    void loadSession(value)
    if (authApi.isLoggedIn()) void useUserStore.getState().refresh()
  })

  useEffect(() => {
    if (!session?.expiresAt || completed) return
    const timer = setTimeout(
      () => {
        setSession(null)
        setError(t('login.qrInvalid'))
      },
      Math.max(0, session.expiresAt - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [session, completed])

  const exit = () => {
    active.current = false
    if (exitTimer.current) clearTimeout(exitTimer.current)
    useTabBarStore.getState().setActive('chat')
    const pages = Taro.getCurrentPages()
    const mainIndex = pages.findIndex(page => page.route === 'pages/main/index')
    if (mainIndex >= 0 && mainIndex < pages.length - 1) {
      void Taro.navigateBack({ delta: pages.length - 1 - mainIndex }).catch(() =>
        Taro.reLaunch({ url: '/pages/main/index' }),
      )
    } else {
      void Taro.reLaunch({ url: '/pages/main/index' })
    }
  }

  const confirm = async (fromExistingLogin = false) => {
    if (!active.current || busy.current || completed) return
    if (!authApi.isLoggedIn() && !agreed) {
      Taro.showToast({ title: t('login.consentRequired'), icon: 'none' })
      return
    }
    // 登录页返回后使用最新会话重新验证，避免闭包中的旧页面状态阻止继续授权。
    if (!fromExistingLogin && (!session || !isWaitingQr(session))) return
    busy.current = true
    setLoading(true)
    try {
      await authorizeQrLogin(ticket, {
        active: () => active.current,
        onUser: info => useUserStore.getState().setUser(info),
        allowWechatLogin: !fromExistingLogin && agreed,
      })
      if (!active.current) return
      setCompleted(true)
      Taro.showToast({ title: t('login.qrConfirmed'), icon: 'success' })
      exitTimer.current = setTimeout(exit, 700)
    } catch (cause) {
      if (active.current) {
        Taro.showToast({
          title: cause instanceof Error ? cause.message : t('login.qrFailed'),
          icon: 'none',
        })
        // 过期、已确认及失败均重新读取，避免继续展示旧的有效二维码。
        void loadSession(ticket)
      }
    } finally {
      busy.current = false
      if (active.current) setLoading(false)
    }
  }

  const existingLogin = async () => {
    if (busy.current || !session || !isWaitingQr(session)) return
    busy.current = true
    setLoading(true)
    try {
      await readWaitingQr(ticket)
      if (!active.current) return
      await openLogin(() => void confirm(true), '?existing=1')
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : t('login.qrFailed'))
    } finally {
      busy.current = false
      if (active.current) setLoading(false)
    }
  }

  const deviceKeys: Record<string, string> = {
    windows: 'qrDeviceWindows',
    macos: 'qrDeviceMacos',
    linux: 'qrDeviceLinux',
    chromeos: 'qrDeviceChromeos',
    android: 'qrDeviceAndroid',
    ios: 'qrDeviceIos',
    chrome: 'qrBrowserChrome',
    edge: 'qrBrowserEdge',
    firefox: 'qrBrowserFirefox',
    safari: 'qrBrowserSafari',
    opera: 'qrBrowserOpera',
  }
  const device = [session?.device?.os, session?.device?.browser]
    .map(value => t(`login.${deviceKeys[value || ''] || 'qrUnknownDevice'}`))
    .join(' · ')
  const time = session?.createdAt
    ? new Date(session.createdAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
        hour12: false,
      })
    : t('login.qrUnknownTime')
  const disabled = checking || loading || completed || !session
  const openLegal = (type: string) =>
    void Taro.navigateTo({ url: `/pages/legal/index?type=${type}` })

  return (
    <ThemeView className="scan-login-page">
      <NavBar title={t('login.qrTitle')} showBack onBack={exit} />
      <View className="scan-login-card">
        <Text className="scan-login-brand">DinQorAI</Text>
        <Text className="scan-login-title">{t('login.qrTitle')}</Text>
        <Text className="scan-login-desc">{t('login.qrDescription')}</Text>
        {checking ? (
          <View className="scan-login-details">
            <SkeletonBlock height="72px" />
          </View>
        ) : session ? (
          <View className="scan-login-details">
            <View className="scan-login-row">
              <Text>{t('login.qrDevice')}</Text>
              <Text>{device}</Text>
            </View>
            <View className="scan-login-row">
              <Text>{t('login.qrTime')}</Text>
              <Text>{time}</Text>
            </View>
            {loggedIn ? (
              <View className="scan-login-row">
                <Text>{t('login.qrAccount')}</Text>
                <Text>{user?.nickname || user?.username || t('login.qrCurrentAccount')}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {!loggedIn ? (
          <>
            <Text className="scan-login-note">{t('login.qrAutoRegister')}</Text>
            <View className="scan-login-legal">
              <View
                className={`scan-login-checkbox ${agreed ? 'is-checked' : ''}`}
                ariaRole="checkbox"
                ariaLabel={t('login.consentRequired')}
                aria-checked={agreed}
                onClick={() => {
                  if (!loading) setAgreed(value => !value)
                }}
              >
                <Text>{agreed ? '✓' : ''}</Text>
              </View>
              <View className="scan-login-legal-copy">
                <Text
                  onClick={() => {
                    if (!loading) setAgreed(value => !value)
                  }}
                >
                  {t('login.legal')}
                </Text>
                <Text className="scan-login-link" onClick={() => openLegal('terms')}>
                  {t('login.agreement')}
                </Text>
                <Text>{t('login.and')}</Text>
                <Text className="scan-login-link" onClick={() => openLegal('privacy')}>
                  {t('login.privacy')}
                </Text>
              </View>
            </View>
          </>
        ) : null}
        <Button
          block
          className="scan-login-button"
          loading={loading}
          disabled={disabled || (!loggedIn && !agreed)}
          onClick={() => void confirm()}
        >
          {completed
            ? t('login.qrConfirmed')
            : loggedIn
              ? t('login.qrConfirm')
              : t('login.qrAgreeAndLogin')}
        </Button>
        {!loggedIn ? (
          <Button
            variant="ghost"
            block
            className="scan-login-button"
            disabled={disabled}
            onClick={existingLogin}
          >
            {t('login.qrExistingAccount')}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          block
          className="scan-login-button"
          disabled={completed}
          onClick={exit}
        >
          {t('login.qrCancel')}
        </Button>
        {!loggedIn || (loggedIn && !user?.email) ? (
          <Text className="scan-login-note">{t('login.qrBindLater')}</Text>
        ) : null}
        {error ? (
          <View>
            <Text className="scan-login-error">{error}</Text>
            <Button
              variant="ghost"
              disabled={checking || loading}
              onClick={() => void loadSession(ticket)}
            >
              {t('login.qrRetry')}
            </Button>
          </View>
        ) : null}
      </View>
    </ThemeView>
  )
}
