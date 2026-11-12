import { ThemeView } from '@/components/ThemeView'
import { Skeleton } from '@/components/Skeleton'
import { ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { Icon } from '@/components/Icon'
import Taro, { useDidShow } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { virtualPayApi, type VirtualPayProduct } from '@/api/virtualPay'
import { NavBar } from '@/components/NavBar'
import { Button } from '@/components/ui/Button'
import { t, useLocale } from '@/i18n'
import { ensureLogin, useUserStore } from '@/store/user'
import { activeTier, canBuyTier } from './policy'
import { PointsCards } from './PointsCards'
import { ensureRuntime, requestVirtualPayment, confirmDelivered } from '@/utils/virtualPayment'
import './index.scss'

export default function SubscriptionPage() {
  useLocale()
  const user = useUserStore(state => state.user)
  const [selectedPointsId, setSelectedPointsId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(1)
  const [products, setProducts] = useState<VirtualPayProduct[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState('')
  const [confirming, setConfirming] = useState(false)
  const loadingRef = useRef(false)
  const purchaseBusy = useRef(false)

  useDidShow(() => {
    if (!ensureLogin() || loadingRef.current) return
    loadingRef.current = true
    // 用户套餐资料在后台更新，不阻塞商品目录。
    void useUserStore.getState().refresh()
    const load = async () => {
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
        loadingRef.current = false
        setLoading(false)
      }
    }
    load()
  })

  const buy = async (product: VirtualPayProduct, count = 1) => {
    if (purchaseBusy.current || !ensureRuntime()) return
    purchaseBusy.current = true
    setBuying(product.productId)
    try {
      // 每次支付都使用新 code，避免旧 session_key 被 wx.login 轮换后签名失效。
      const login = await Taro.login()
      if (!login.code) throw new Error(t('subscription.loginFailed'))
      const payData = await virtualPayApi.createOrder(product.productId, login.code, count)
      await requestVirtualPayment(payData)
      setConfirming(true)
      const delivered = await confirmDelivered(payData.outTradeNo)
      if (delivered) {
        await useUserStore.getState().refresh()
        Taro.showToast({ title: t('subscription.success'), icon: 'success' })
      } else {
        Taro.showToast({ title: t('subscription.pending'), icon: 'none', duration: 3500 })
      }
    } catch (error) {
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
      setConfirming(false)
      setBuying('')
      purchaseBusy.current = false
    }
  }

  const tier = activeTier(user?.tier, user?.tierExpiresAt)
  const pointsProducts = products.filter(product => product.kind === 'points')
  const plans = products.filter(product => product.kind !== 'points')
  const currentPlan = Math.min(selectedPlan, Math.max(0, plans.length - 1))
  const selectPlan = (index: number) => {
    setSelectedPlan(index)
  }
  return (
    <ThemeView className="subscription-page">
      <NavBar title={t('subscription.title')} showBack />
      <ScrollView scrollY className="subscription-scroll">
      <View className="subscription-inner">
      <View className="subscription-summary">
        <Text className="subscription-eyebrow">{t('subscription.currentPlan')}</Text>
        <Text className="subscription-tier">{tier}</Text>
        <Text className="subscription-expiry">
          {tier !== 'FREE' && user?.tierExpiresAt
            ? t('subscription.expiresAt', { date: user.tierExpiresAt.slice(0, 10) })
            : t('subscription.freePlan')}
        </Text>
      </View>

      <View className="subscription-section-heading">
        <Text className="subscription-section-title">{t('subscription.choosePlan')}</Text>
        <Text
          className="subscription-orders-link"
          onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}
        >
          {t('orders.title')} →
        </Text>
      </View>
      {loading ? <Skeleton layout="subscription" /> : null}
      {confirming ? <Skeleton layout="subscription" count={1} /> : null}
      {!loading && (!enabled || products.length === 0) ? (
        <Text className="subscription-state">{t('subscription.notConfigured')}</Text>
      ) : null}
      <Swiper
        className="subscription-carousel"
        circular={plans.length > 1}
        current={currentPlan}
        previousMargin="32px"
        nextMargin="32px"
        duration={300}
        easingFunction="easeOutCubic"
        onChange={event => selectPlan(event.detail.current)}
      >
        {plans.map((product, index) => (
          <SwiperItem
            key={product.productId}
            className="subscription-slide"
            style={{ zIndex: currentPlan === index ? 2 : 1 }}
          >
            <View
              onClick={() => {
                if (currentPlan !== index && !buying) selectPlan(index)
              }}
              className={`subscription-product${currentPlan === index ? ' plan-selected' : ''}${tier === product.tier ? ' plan-current' : ''}`}
            >
              <View className="plan-heading">
                <View className="plan-identity">
                  <View className="plan-emblem">
                    <Icon name="crown" />
                  </View>
                  <Text className="subscription-product-name">{product.tier}</Text>
                </View>
                {tier === product.tier ? (
                  <Text className="plan-status">{t('wallet.current')}</Text>
                ) : null}
                <View className="plan-price-group">
                  <Text className="subscription-price">
                    ¥{(product.goodsPrice / 100).toFixed(2)}
                  </Text>
                  <Text className="plan-period">
                    {t('subscription.duration', { days: product.durationDays })}
                  </Text>
                </View>
              </View>
              <View className="plan-allowance">
                <Text className="plan-allowance-label">
                  {t('wallet.planPoints', { points: product.points ?? 0 })}
                </Text>
              </View>
              <View className="plan-features">
                <View className="plan-feature">
                  <Icon name="chat" />
                  <Text>{t('subscription.aiTools')}</Text>
                </View>
                <View className="plan-feature">
                  <Icon name="points" />
                  <Text>{t('subscription.usageBased')}</Text>
                </View>
                <View className="plan-feature">
                  <Icon name="calendar" />
                  <Text>{t('subscription.duration', { days: product.durationDays })}</Text>
                </View>
              </View>
              <View className="plan-action">
                <Text className="plan-validity">
                  {t('subscription.duration', { days: product.durationDays })}
                </Text>
                <Button
                  block
                  loading={buying === product.productId}
                  disabled={
                    Boolean(buying) ||
                    !enabled ||
                    currentPlan !== index ||
                    !canBuyTier(tier, product.tier)
                  }
                  onClick={() => buy(product)}
                >
                  {tier === product.tier
                    ? t('wallet.current')
                    : !canBuyTier(tier, product.tier)
                      ? t('wallet.unavailable')
                      : t('subscription.buy')}
                </Button>
              </View>
            </View>
          </SwiperItem>
        ))}
      </Swiper>
      <View className="plan-pagination">
        {plans.map((product, index) => (
          <View
            key={product.productId}
            className={`plan-dot${currentPlan === index ? ' plan-dot-active' : ''}`}
            onClick={() => selectPlan(index)}
          />
        ))}
      </View>
      <Text className="plan-swipe-hint">{t('subscription.swipePlans')}</Text>
      <PointsCards
        products={pointsProducts}
        selectedId={selectedPointsId}
        onSelect={setSelectedPointsId}
        onBuy={product => buy(product)}
        enabled={enabled}
        subscriber={tier !== 'FREE'}
        buying={buying}
      />
      <View className="subscription-footer">
        <Text className="subscription-notice">{t('wallet.planRule')}</Text>
        <Text className="subscription-notice">{t('orders.rule')}</Text>
      </View>
      </View>
      </ScrollView>
    </ThemeView>
  )
}
