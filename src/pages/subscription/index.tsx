import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { virtualPayApi, type VirtualPayData, type VirtualPayProduct } from '@/api/virtualPay'
import { NavBar } from '@/components/NavBar'
import { Button } from '@/components/ui/Button'
import { t } from '@/i18n'
import { useUserStore } from '@/store/user'
import './index.scss'

type VirtualPaymentRuntime = {
  requestVirtualPayment: (
    options: VirtualPayData & {
      success: () => void
      fail: (error: { errMsg?: string; errCode?: number }) => void
    },
  ) => void
}

function compareVersion(left: string, right: string) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0)
    if (difference !== 0) return difference
  }
  return 0
}

function requestVirtualPayment(payData: VirtualPayData) {
  return new Promise<void>((resolve, reject) => {
    const runtime = Taro as unknown as VirtualPaymentRuntime
    runtime.requestVirtualPayment({
      ...payData,
      success: resolve,
      fail: reject,
    })
  })
}

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export default function SubscriptionPage() {
  const user = useUserStore(state => state.user)
  const [products, setProducts] = useState<VirtualPayProduct[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState('')

  useDidShow(() => {
    const load = async () => {
      await useUserStore.getState().refresh()
      if (!useUserStore.getState().user) {
        Taro.redirectTo({ url: '/pages/login/index' })
        return
      }
      try {
        const catalog = await virtualPayApi.catalog()
        setEnabled(catalog.enabled)
        setProducts(catalog.products)
      } catch (error) {
        Taro.showToast({
          title: error instanceof Error ? error.message : t('subscription.loadFailed'),
          icon: 'none',
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  })

  const ensureRuntime = () => {
    if (process.env.TARO_ENV !== 'weapp' || !Taro.canIUse('requestVirtualPayment')) {
      Taro.showToast({ title: t('subscription.wechatOnly'), icon: 'none' })
      return false
    }
    const system = Taro.getSystemInfoSync()
    if (system.platform === 'ios' && compareVersion(system.version || '0', '8.0.68') < 0) {
      Taro.showToast({ title: t('subscription.updateWechat'), icon: 'none' })
      return false
    }
    return true
  }

  const confirmDelivered = async (outTradeNo: string) => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const order = await virtualPayApi.reconcile(outTradeNo)
      if (order.status === 'DELIVERED') return true
      await wait(1500)
    }
    return false
  }

  const buy = async (product: VirtualPayProduct) => {
    if (buying || !ensureRuntime()) return
    setBuying(product.productId)
    let loadingShown = false
    try {
      // 每次支付都使用新 code，避免旧 session_key 被 wx.login 轮换后签名失效。
      const login = await Taro.login()
      if (!login.code) throw new Error(t('subscription.loginFailed'))
      const payData = await virtualPayApi.createOrder(product.productId, login.code)
      await requestVirtualPayment(payData)
      Taro.showLoading({ title: t('subscription.confirming'), mask: true })
      loadingShown = true
      const delivered = await confirmDelivered(payData.outTradeNo)
      Taro.hideLoading()
      loadingShown = false
      if (delivered) {
        await useUserStore.getState().refresh()
        Taro.showToast({ title: t('subscription.success'), icon: 'success' })
      } else {
        Taro.showToast({ title: t('subscription.pending'), icon: 'none', duration: 3500 })
      }
    } catch (error) {
      if (loadingShown) {
        Taro.hideLoading()
        loadingShown = false
      }
      const paymentError = error as { errMsg?: string; errCode?: number }
      const canceled = paymentError.errCode === -2 || paymentError.errMsg?.includes('cancel')
      if (!canceled) {
        Taro.showToast({
          title:
            error instanceof Error
              ? error.message
              : paymentError.errMsg || t('subscription.failed'),
          icon: 'none',
        })
      }
    } finally {
      setBuying('')
    }
  }

  return (
    <View className="subscription-page">
      <NavBar title={t('subscription.title')} showBack />
      <View className="subscription-summary">
        <Text className="subscription-eyebrow">{t('subscription.currentPlan')}</Text>
        <Text className="subscription-tier">{user?.tier || 'FREE'}</Text>
        <Text className="subscription-expiry">
          {user?.tierExpiresAt
            ? t('subscription.expiresAt', { date: user.tierExpiresAt.slice(0, 10) })
            : t('subscription.freePlan')}
        </Text>
      </View>

      <Text className="subscription-section-title">{t('subscription.choosePlan')}</Text>
      {loading ? <Text className="subscription-state">{t('common.loading')}</Text> : null}
      {!loading && (!enabled || products.length === 0) ? (
        <Text className="subscription-state">{t('subscription.notConfigured')}</Text>
      ) : null}
      {products.map(product => (
        <View className="subscription-product" key={product.productId}>
          <View className="subscription-product-copy">
            <Text className="subscription-product-name">{product.name}</Text>
            <Text className="subscription-product-meta">
              {t('subscription.duration', { days: product.durationDays })}
            </Text>
          </View>
          <Text className="subscription-price">¥{(product.goodsPrice / 100).toFixed(2)}</Text>
          <Button
            size="sm"
            loading={buying === product.productId}
            disabled={Boolean(buying) || !enabled}
            onClick={() => buy(product)}
          >
            {t('subscription.buy')}
          </Button>
        </View>
      ))}
      <Text className="subscription-notice">{t('subscription.notice')}</Text>
    </View>
  )
}
