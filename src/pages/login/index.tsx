import { ThemeView } from '@/components/ThemeView'
import { takeLoginContinuation } from '@/utils/loginPrompt'
import { Button, Input, Text, View } from '@tarojs/components'
import Taro, { useLoad, useUnload } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { authApi, type UserInfo } from '@/api/auth'
import { NavBar } from '@/components/NavBar'
import { t, useLocale } from '@/i18n'
import { useUserStore } from '@/store/user'
import './index.scss'

type Mode = 'wechat' | 'bind' | 'password'

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function isInvalidEmail(value: string): boolean {
  const trimmed = value.trim()
  return !trimmed || !EMAIL_PATTERN.test(trimmed)
}

export default function Login() {
  useLocale()
  const supportsWechatLogin = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
  const setUser = useUserStore(state => state.setUser)
  const [mode, setMode] = useState<Mode>(supportsWechatLogin ? 'wechat' : 'password')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // 首次微信登录（先绑定后建号）流程状态
  const [pendingBindToken, setPendingBindToken] = useState('')
  const [bindEmail, setBindEmail] = useState('')
  const [bindCode, setBindCode] = useState('')
  const [bindCountdown, setBindCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)

  const [agreed, setAgreed] = useState(false)
  const [existingOnly, setExistingOnly] = useState(false)
  const active = useRef(true)
  const loginBusy = useRef(false)
  const showToast = (title: string) => {
    if (active.current) Taro.showToast({ title, icon: 'none' })
  }
  useLoad(params => {
    if (params?.existing === '1') {
      setExistingOnly(true)
      setMode(supportsWechatLogin ? 'wechat' : 'password')
    }
  })
  useUnload(() => {
    active.current = false
    takeLoginContinuation()
  })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (bindCountdown > 0) {
      timer = setTimeout(() => setBindCountdown(bindCountdown - 1), 1000)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [bindCountdown])

  const finishLogin = (userInfo: UserInfo | undefined) => {
    if (userInfo) setUser(userInfo)
    if (!active.current) return
    const next = takeLoginContinuation()
    if (next) {
      void Taro.navigateBack()
        .then(() => next())
        .catch(() => {
          if (active.current) void Taro.reLaunch({ url: '/pages/main/index' })
        })
      return
    }
    void Taro.reLaunch({ url: '/pages/main/index' })
  }

  const handleWechatLogin = async () => {
    if (!agreed) {
      showToast(t('login.consentRequired'))
      return
    }
    if (!active.current || loginBusy.current) return
    loginBusy.current = true
    setLoading(true)
    try {
      const loginResult = await Taro.login()
      if (!active.current) return
      if (!loginResult.code) {
        showToast(t('login.wxCredentialFailed'))
        return
      }
      const response = await authApi.wechatLogin(loginResult.code)
      if (response.pendingBind) {
        if (!active.current) return
        // 未建号：引导绑定邮箱（与 PC 同号）或跳过
        setPendingBindToken(response.pendingBindToken ?? '')
        setMode('bind')
        return
      }
      finishLogin(response.userInfo)
      showToast(t('login.loginSuccess'))
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.loginFailed'))
    } finally {
      loginBusy.current = false
      if (active.current) setLoading(false)
    }
  }

  const handleSendBindCode = async () => {
    if (!agreed) {
      showToast(t('login.consentRequired'))
      return
    }
    if (sendingCode || bindCountdown > 0) return
    if (isInvalidEmail(bindEmail)) {
      showToast(t('login.invalidEmail'))
      return
    }
    setSendingCode(true)
    try {
      await authApi.sendCode(bindEmail.trim())
      if (!active.current) return
      setBindCountdown(60)
      showToast(t('login.codeSent'))
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.codeSendFailed'))
    } finally {
      if (active.current) setSendingCode(false)
    }
  }

  const handleBindEmail = async () => {
    if (!agreed) {
      showToast(t('login.consentRequired'))
      return
    }
    if (!pendingBindToken) {
      showToast(t('login.bindCredentialExpired'))
      return
    }
    if (isInvalidEmail(bindEmail)) {
      showToast(t('login.invalidEmail'))
      return
    }
    if (!bindCode.trim()) {
      showToast(t('login.codeRequired'))
      return
    }
    if (!active.current || loginBusy.current) return
    loginBusy.current = true
    setLoading(true)
    try {
      const response = await authApi.bindWechat(pendingBindToken, bindEmail.trim(), bindCode.trim())
      finishLogin(response.userInfo)
      showToast(t('login.bindSuccess'))
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.bindFailed'))
    } finally {
      loginBusy.current = false
      if (active.current) setLoading(false)
    }
  }

  const handleSkipBind = async () => {
    if (!agreed) {
      showToast(t('login.consentRequired'))
      return
    }
    if (!pendingBindToken) {
      showToast(t('login.bindCredentialExpired'))
      return
    }
    if (!active.current || loginBusy.current) return
    loginBusy.current = true
    setLoading(true)
    try {
      const response = await authApi.skipBind(pendingBindToken)
      finishLogin(response.userInfo)
      showToast(t('login.loginSuccess'))
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.skipFailed'))
    } finally {
      loginBusy.current = false
      if (active.current) setLoading(false)
    }
  }

  const handlePasswordLogin = async () => {
    if (!agreed) {
      showToast(t('login.consentRequired'))
      return
    }
    if (!account.trim()) {
      showToast(t('login.accountPlaceholder'))
      return
    }
    if (!password) {
      showToast(t('login.passwordPlaceholder'))
      return
    }
    if (!active.current || loginBusy.current) return
    loginBusy.current = true
    setLoading(true)
    try {
      const response = await authApi.login(account.trim(), password)
      finishLogin(response.userInfo)
      showToast(t('login.loginSuccess'))
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.loginFailed'))
    } finally {
      loginBusy.current = false
      if (active.current) setLoading(false)
    }
  }

  const openLegal = (type: string) => Taro.navigateTo({ url: `/pages/legal/index?type=${type}` })

  return (
    <ThemeView className="login-page">
      <NavBar title={t('nav.login')} showBack />
      <View className="login-stage">
        <View className="login-stack">
          <Text className="login-brand">DinQorAI</Text>
          {mode === 'wechat' ? (
            <>
              <Button
                className="btn btn-primary login-submit"
                loading={loading}
                disabled={!agreed || loading}
                onClick={handleWechatLogin}
              >
                {t(existingOnly ? 'login.qrLinkWechat' : 'login.wechatOneTap')}
              </Button>
              <View className="login-divider">{t('login.or')}</View>
              <Button className="btn btn-ghost" onClick={() => setMode('password')}>
                {t('login.emailLogin')}
              </Button>
            </>
          ) : null}

          {mode === 'bind' ? (
            <View className="login-form">
              <Text className="login-bind-title">{t('login.bindTitle')}</Text>
              <Text className="login-bind-subtitle">{t('login.bindSubtitle')}</Text>
              <View className="form-item">
                <Text className="form-label">{t('login.emailLabel')}</Text>
                <Input
                  className="form-input"
                  type="text"
                  placeholder={t('login.emailPlaceholder')}
                  value={bindEmail}
                  onInput={e => setBindEmail(e.detail.value)}
                />
              </View>
              <View className="form-item">
                <Text className="form-label">{t('login.codeLabel')}</Text>
                <View className="form-code-row">
                  <Input
                    className="form-input form-code-input"
                    type="number"
                    placeholder={t('login.codePlaceholder')}
                    value={bindCode}
                    maxlength={6}
                    onInput={e => setBindCode(e.detail.value)}
                  />
                  <Button
                    className="btn btn-ghost form-code-btn"
                    disabled={!agreed || sendingCode || bindCountdown > 0}
                    loading={sendingCode}
                    onClick={handleSendBindCode}
                  >
                    {bindCountdown > 0 ? `${bindCountdown}s` : t('login.sendCode')}
                  </Button>
                </View>
              </View>
              <Button
                className="btn btn-primary login-submit"
                loading={loading}
                disabled={!agreed || loading}
                onClick={handleBindEmail}
              >
                {t('login.bindAndLogin')}
              </Button>
              {!existingOnly ? (
                <Button
                  className="btn btn-ghost login-skip"
                  disabled={!agreed || loading}
                  onClick={handleSkipBind}
                >
                  {t('login.skipBind')}
                </Button>
              ) : null}
            </View>
          ) : null}

          {mode === 'password' && (
            <>
              <View className="login-form">
                <View className="form-item">
                  <Text className="form-label">{t('login.accountLabel')}</Text>
                  <Input
                    className="form-input"
                    placeholder={t('login.accountPlaceholder')}
                    value={account}
                    onInput={e => setAccount(e.detail.value)}
                  />
                </View>
                <View className="form-item">
                  <Text className="form-label">{t('login.passwordLabel')}</Text>
                  <Input
                    className="form-input"
                    placeholder={t('login.passwordPlaceholder')}
                    password
                    value={password}
                    maxlength={50}
                    onInput={e => setPassword(e.detail.value)}
                    onConfirm={handlePasswordLogin}
                  />
                </View>
              </View>
              <Button
                className="btn btn-primary login-submit"
                loading={loading}
                disabled={!agreed || loading}
                onClick={handlePasswordLogin}
              >
                {t('login.emailLogin')}
              </Button>
              {supportsWechatLogin && (
                <Button className="btn btn-ghost login-skip" onClick={() => setMode('wechat')}>
                  {t('login.wechatOneTap')}
                </Button>
              )}
            </>
          )}
          <View className="login-legal">
            <View
              className={`login-legal-toggle ${agreed ? 'is-checked' : ''}`}
              ariaRole="checkbox"
              ariaLabel={t('login.consentRequired')}
              aria-checked={agreed}
              onClick={() => setAgreed(value => !value)}
            >
              <View className="login-legal-circle" />
            </View>
            <View className="login-legal-copy">
              <Text onClick={() => setAgreed(value => !value)}>{t('login.legal')}</Text>
              <Text className="login-legal-link" onClick={() => openLegal('terms')}>
                {t('login.agreement')}
              </Text>
              <Text>{t('login.and')}</Text>
              <Text className="login-legal-link" onClick={() => openLegal('privacy')}>
                {t('login.privacy')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ThemeView>
  )
}
