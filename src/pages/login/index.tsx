import { Button, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { authApi, type UserInfo } from '@/api/auth'
import { NavBar } from '@/components/NavBar'
import { t } from '@/i18n'
import { useUserStore } from '@/store/user'
import './index.scss'

type Mode = 'wechat' | 'bind' | 'password' | 'register'

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

function isInvalidEmail(value: string): boolean {
  const trimmed = value.trim()
  return !trimmed || !EMAIL_PATTERN.test(trimmed)
}

export default function Login() {
  const supportsWechatLogin = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
  const setUser = useUserStore(state => state.setUser)
  const [mode, setMode] = useState<Mode>(supportsWechatLogin ? 'wechat' : 'password')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  // 首次微信登录（先绑定后建号）流程状态
  const [pendingBindToken, setPendingBindToken] = useState('')
  const [bindEmail, setBindEmail] = useState('')
  const [bindCode, setBindCode] = useState('')
  const [bindCountdown, setBindCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)

  // 从「我的」页首次登录跳转而来（?autologin=1）：自动发起微信登录并进入绑定/跳过流程
  const autoLoginRef = useRef(false)
  useLoad(params => {
    if (params?.autologin === '1' && !autoLoginRef.current && supportsWechatLogin) {
      autoLoginRef.current = true
      setTimeout(() => {
        void handleWechatLogin()
      }, 0)
    }
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

  useDidShow(() => {
    if (useUserStore.getState().user) {
      Taro.navigateBack().catch(() => undefined)
    }
  })

  const finishLogin = (userInfo: UserInfo | undefined) => {
    if (userInfo) setUser(userInfo)
  }

  const handleWechatLogin = async () => {
    if (loading) return
    setLoading(true)
    try {
      const loginResult = await Taro.login()
      if (!loginResult.code) {
        showToast(t('login.wxCredentialFailed'))
        return
      }
      const response = await authApi.wechatLogin(loginResult.code)
      if (response.pendingBind) {
        // 未建号：引导绑定邮箱（与 PC 同号）或跳过
        setPendingBindToken(response.pendingBindToken ?? '')
        setMode('bind')
        return
      }
      finishLogin(response.userInfo)
      showToast(t('login.loginSuccess'))
      setTimeout(() => Taro.navigateBack().catch(() => undefined), 600)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSendBindCode = async () => {
    if (sendingCode || bindCountdown > 0) return
    if (isInvalidEmail(bindEmail)) {
      showToast(t('login.invalidEmail'))
      return
    }
    setSendingCode(true)
    try {
      await authApi.sendCode(bindEmail.trim())
      setBindCountdown(60)
      showToast(t('login.codeSent'))
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.codeSendFailed'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleBindEmail = async () => {
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
    if (loading) return
    setLoading(true)
    try {
      const response = await authApi.bindWechat(pendingBindToken, bindEmail.trim(), bindCode.trim())
      finishLogin(response.userInfo)
      showToast(t('login.bindSuccess'))
      setTimeout(() => Taro.navigateBack().catch(() => undefined), 600)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.bindFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSkipBind = async () => {
    if (!pendingBindToken) {
      showToast(t('login.bindCredentialExpired'))
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const response = await authApi.skipBind(pendingBindToken)
      finishLogin(response.userInfo)
      showToast(t('login.loginSuccess'))
      setTimeout(() => Taro.navigateBack().catch(() => undefined), 600)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.skipFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async () => {
    if (!account.trim() || !password) {
      showToast(t('login.fillAccountAndPassword'))
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const response = await authApi.login(account.trim(), password)
      finishLogin(response.userInfo)
      showToast(t('login.loginSuccess'))
      setTimeout(() => Taro.navigateBack().catch(() => undefined), 600)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!name.trim() || !account.trim() || !password) {
      showToast(t('login.fillRegisterRequired'))
      return
    }
    if (password.length < 6) {
      showToast(t('login.passwordTooShort'))
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const response = await authApi.register(account.trim(), password, name.trim())
      finishLogin(response.userInfo)
      showToast(t('login.registerSuccess'))
      setTimeout(() => Taro.navigateBack().catch(() => undefined), 600)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('login.registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  const showUserAgreement = () => {
    Taro.showModal({
      title: t('login.agreementTitle'),
      content: t('login.agreementContent'),
      showCancel: false,
      confirmText: t('login.agree'),
    })
  }

  const openPrivacyPolicy = () => {
    const openPrivacyContract = (
      Taro as typeof Taro & {
        openPrivacyContract?: () => Promise<unknown>
      }
    ).openPrivacyContract
    if (openPrivacyContract) {
      Promise.resolve(openPrivacyContract()).catch(() => showToast(t('login.privacyUnavailable')))
    } else {
      showToast(t('login.privacyUnavailable'))
    }
  }

  return (
    <View className="login-page">
      <NavBar title={t('nav.login')} showBack />
      <Text className="login-brand">DinQorAI</Text>
      <Text className="login-subtitle">{t('login.subtitle')}</Text>

      {mode === 'wechat' ? (
        <>
          <Button
            className="btn btn-primary login-submit"
            loading={loading}
            onClick={handleWechatLogin}
          >
            {t('login.wechatOneTap')}
          </Button>
          <View className="login-divider">{t('login.or')}</View>
          <Button className="btn btn-ghost" onClick={() => setMode('password')}>
            {t('login.accountPassword')}
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
                disabled={sendingCode || bindCountdown > 0}
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
            onClick={handleBindEmail}
          >
            {t('login.bindAndLogin')}
          </Button>
          <Button className="btn btn-ghost login-skip" onClick={handleSkipBind}>
            {t('login.skipBind')}
          </Button>
        </View>
      ) : null}

      {mode === 'password' || mode === 'register' ? (
        <>
          <View className="segmented login-segmented">
            <Text
              className={`segment ${mode === 'password' ? 'active' : ''}`}
              onClick={() => setMode('password')}
            >
              {t('login.login')}
            </Text>
            <Text
              className={`segment ${mode === 'register' ? 'active' : ''}`}
              onClick={() => setMode('register')}
            >
              {t('login.register')}
            </Text>
          </View>
          <View className="login-form">
            {mode === 'register' ? (
              <View className="form-item">
                <Text className="form-label">{t('login.nickname')}</Text>
                <Input
                  className="form-input"
                  placeholder={t('login.nicknamePlaceholder')}
                  value={name}
                  maxlength={30}
                  onInput={e => setName(e.detail.value)}
                />
              </View>
            ) : null}
            <View className="form-item">
              <Text className="form-label">
                {mode === 'register' ? t('login.emailLabel') : t('login.accountLabel')}
              </Text>
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
                onConfirm={mode === 'password' ? handlePasswordLogin : handleRegister}
              />
            </View>
          </View>
          <Button
            className="btn btn-primary login-submit"
            loading={loading}
            onClick={mode === 'password' ? handlePasswordLogin : handleRegister}
          >
            {mode === 'password' ? t('login.login') : t('login.registerAndLogin')}
          </Button>
          {mode === 'register' ? (
            <Text className="login-back">{t('login.switchToLogin')}</Text>
          ) : (
            <Text className="login-back">{t('login.switchToRegister')}</Text>
          )}
        </>
      ) : null}
      <View className="login-legal">
        <Text>{t('login.legal')}</Text>
        <Text className="login-legal-link" onClick={showUserAgreement}>
          {t('login.agreement')}
        </Text>
        <Text>{t('login.and')}</Text>
        <Text className="login-legal-link" onClick={openPrivacyPolicy}>
          {t('login.privacy')}
        </Text>
      </View>
    </View>
  )
}
