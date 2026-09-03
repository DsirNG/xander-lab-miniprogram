import { Button, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { authApi } from '@/api/auth'
import { NavBar } from '@/components/NavBar'
import { t } from '@/i18n'
import { useUserStore } from '@/store/user'
import './index.scss'

export default function ScanLogin() {
  const [ticket, setTicket] = useState('')
  const [loading, setLoading] = useState(false)
  const user = useUserStore(state => state.user)
  useLoad(params => setTicket(params?.ticket || params?.scene || ''))

  const confirm = async () => {
    if (!ticket || loading) return
    if (!user) {
      Taro.redirectTo({ url: '/pages/login/index?autologin=1' })
      return
    }
    setLoading(true)
    try {
      await authApi.confirmQrLogin(ticket)
      Taro.showToast({ title: t('login.qrConfirmed'), icon: 'success' })
      setTimeout(() => Taro.navigateBack().catch(() => undefined), 700)
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : t('login.qrFailed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="scan-login-page">
      <NavBar title={t('login.qrTitle')} showBack />
      <View className="scan-login-card">
        <Text className="scan-login-brand">DinQorAI</Text>
        <Text className="scan-login-title">{t('login.qrTitle')}</Text>
        <Text className="scan-login-desc">{t('login.qrDescription')}</Text>
        <Button className="btn btn-primary scan-login-button" loading={loading} onClick={confirm}>
          {user ? t('login.qrConfirm') : t('login.qrSignInFirst')}
        </Button>
        {!ticket ? <Text className="scan-login-error">{t('login.qrInvalid')}</Text> : null}
      </View>
    </View>
  )
}
