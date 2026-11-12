import { useEffect, useRef, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { virtualPayApi, type VirtualPayOrder } from '@/api/virtualPay'
import { NavBar } from '@/components/NavBar'
import { ThemeView } from '@/components/ThemeView'
import { SkeletonBlock } from '@/components/Skeleton'
import { Button } from '@/components/ui/Button'
import { PageState } from '@/components/ui/PageState'
import { ensureLogin } from '@/store/user'
import { t, useLocale } from '@/i18n'
import { formatDateTime } from '@/utils/format'
import { getSessionVersion, useSessionVersion } from '@/utils/privateCache'
import { ensureRuntime, requestVirtualPayment, confirmDelivered } from '@/utils/virtualPayment'
import { useUserStore } from '@/store/user'
import { orderState, paymentCountdown } from './status'
import './index.scss'

export default function Orders() {
  const session = useSessionVersion()
  return <OrderContent key={session} session={session} />
}
function OrderContent({ session }: { session: number }) {
  useLocale()
  const [records, setRecords] = useState<VirtualPayOrder[]>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState('')
  const [now, setNow] = useState(Date.now())
  const clockOffset = useRef(0)
  const visible = useRef(false)
  const recordsRef = useRef(records)
  recordsRef.current = records
  const syncBusy = useRef(false)
  const loadingRef = useRef(false)
  const actionRef = useRef(false)
  const current = () => session === getSessionVersion()
  const notify = (e: unknown) => {
    if (current())
      void Taro.showToast({
        title: e instanceof Error ? e.message : t('orders.loadError'),
        icon: 'none',
      })
  }
  async function load(before?: number) {
    if (loadingRef.current || !current()) return
    if (!ensureLogin()) {
      setLoading(false)
      return
    }
    loadingRef.current = true
    setLoading(true)
    setError(false)
    try {
      const result = await virtualPayApi.orders(before)
      if (!current()) return
      if (result.serverNow) clockOffset.current = Date.parse(result.serverNow) - Date.now()
      setNow(Date.now() + clockOffset.current)
      setRecords(previous =>
        before
          ? [
              ...previous,
              ...result.records.filter(
                row => !previous.some(old => old.outTradeNo === row.outTradeNo),
              ),
            ]
          : result.records,
      )
      setCursor(result.nextCursor)
    } catch (e) {
      if (current()) {
        setError(true)
        notify(e)
      }
    } finally {
      loadingRef.current = false
      if (current()) setLoading(false)
    }
  }
  async function syncStatuses() {
    if (syncBusy.current || actionRef.current || !visible.current || !current()) return
    syncBusy.current = true
    try {
      const snapshot = recordsRef.current
      const updates = await Promise.allSettled(snapshot.map(async order => {
        if (order.refund && !['SUCCEEDED', 'FAILED'].includes(order.refund.status)) {
          const refund = await virtualPayApi.refundStatus(order.outTradeNo)
          return { ...order, refund }
        }
        if (order.status === 'PENDING') {
          const status = await virtualPayApi.reconcile(order.outTradeNo)
          return { ...order, ...status }
        }
        return order
      }))
      if (!current() || !visible.current) return
      // Merge by ID; pagination and a foreground action may have completed in the meantime.
      setRecords(previous => previous.map(order => {
        const update = updates.find(result => result.status === 'fulfilled' && result.value.outTradeNo === order.outTradeNo)
        return update?.status === 'fulfilled' && snapshot.includes(order) ? update.value : order
      }))
    } finally { syncBusy.current = false }
  }
  useDidShow(() => {
    visible.current = true
    void load().then(syncStatuses)
  })
  useDidHide(() => { visible.current = false })
  useEffect(() => {
    const tick = setInterval(() => { if (visible.current) setNow(Date.now() + clockOffset.current) }, 1000)
    const sync = setInterval(() => { void syncStatuses() }, 15000)
    return () => { visible.current = false; clearInterval(tick); clearInterval(sync) }
  }, [])
  async function pay(order: VirtualPayOrder) {
    if (actionRef.current || !current() || !ensureLogin() || !ensureRuntime()) return
    actionRef.current = true
    setBusy(order.outTradeNo)
    try {
      const login = await Taro.login()
      if (!login.code) throw new Error(t('subscription.loginFailed'))
      const data = await virtualPayApi.createOrder(order.productId, login.code, order.quantity, order.outTradeNo)
      if (!current()) return
      await requestVirtualPayment(data)
      if (!current()) return
      const delivered = await confirmDelivered(data.outTradeNo)
      if (!current()) return
      if (delivered) await useUserStore.getState().refresh()
      void Taro.showToast({ title: t(delivered ? 'subscription.success' : 'subscription.pending'), icon: 'none' })
    } catch (error) {
      const detail = error as { errCode?: number; errMsg?: string }
      if (detail.errCode !== -2 && !detail.errMsg?.includes('cancel')) notify(error)
    } finally {
      if (current()) await load()
      actionRef.current = false
      if (current()) setBusy('')
    }
  }
  async function action(order: VirtualPayOrder) {
    if (actionRef.current || !current() || !ensureLogin()) return
    actionRef.current = true
    setBusy(order.outTradeNo)
    try {
      {
        const quote = await virtualPayApi.refundQuote(order.outTradeNo)
        if (!current()) return
        if (!quote.eligible) {
          const reason =
            (
              {
                EXPIRED: 'expired',
                APPLE: 'apple',
                LEGACY: 'legacy',
                NO_REMAINING: 'none',
                NOT_DELIVERED: 'notDelivered',
                REFUND_EXISTS: 'exists',
              } as Record<string, string>
            )[quote.reason] ?? 'review'
          const response = await Taro.showModal({
            title: t('orders.help'),
            content: t(`orders.${reason}`),
            showCancel: quote.reason === 'APPLE',
            confirmText: quote.reason === 'APPLE' ? t('orders.copyShort') : t('orders.ok'),
            cancelText: t('orders.cancel'),
          })
          if (current() && quote.reason === 'APPLE' && response.confirm)
            await Taro.setClipboardData({ data: 'https://reportaproblem.apple.com/' })
          return
        }
        const result = await Taro.showModal({
          title: t('orders.confirmTitle'),
          content:
            t('orders.confirmBody', {
              remaining: quote.remainingPoints ?? 0,
              original: quote.originalPoints ?? 0,
              amount: (quote.amount / 100).toFixed(2),
            }) + (quote.terminatesSubscription ? '\n' + t('orders.endPlan') : ''),
          confirmText: t('orders.confirmShort'),
          cancelText: t('orders.cancel'),
        })
        if (!result.confirm || !current()) return
        await virtualPayApi.refund(order.outTradeNo, quote.amount)
        if (current()) void Taro.showToast({ title: t('orders.submitted'), icon: 'none' })
      }
      if (current()) await load()
    } catch (e) {
      notify(e)
    } finally {
      actionRef.current = false
      if (current()) setBusy('')
    }
  }
  return (
    <ThemeView className="orders-page">
      <NavBar title={t('orders.title')} showBack />
      <ScrollView scrollY className="orders-scroll" onScrollToLower={() => { if (cursor) void load(cursor) }}>
      <View className="orders-content">
        {loading && records.length === 0 ? (
          <View className="orders-skeleton">
            <SkeletonBlock height="120px" />
            <SkeletonBlock height="120px" />
          </View>
        ) : null}
        {!loading && !records.length ? (
          <PageState
            kind={error ? 'error' : 'empty'}
            title={t(error ? 'orders.loadError' : 'orders.empty')}
            action={<Button onClick={() => void load()}>{t('orders.retry')}</Button>}
          />
        ) : null}
        {records.map(order => (
          <View className="order-card" key={order.outTradeNo}>
            <View className="order-heading">
              <Text>
                {order.kind === 'points'
                  ? t('orders.pointsCard', { points: order.points })
                  : t('orders.plan', { tier: order.tier })}
              </Text>
              <Text className={`order-status order-status--${orderState(order, now).toLowerCase()}`}>
                {t(`orders.${orderState(order, now)}`)}
              </Text>
            </View>
            <View className="order-field">
              <Text>{t('orders.amount')}</Text>
              <Text className="order-field-value order-amount">¥{(order.amount / 100).toFixed(2)}</Text>
            </View>
            <View className="order-field">
              <Text>{t('orders.orderNo')}</Text>
              <Text className="order-field-value" selectable>{order.outTradeNo}</Text>
            </View>
            <View className="order-field">
              <Text>{t('orders.createdAt')}</Text>
              <Text className="order-field-value">{order.createdAt ? formatDateTime(order.createdAt) : '—'}</Text>
            </View>
            {order.paidAt ? (
              <View className="order-field">
                <Text>{t('orders.paidAt')}</Text>
                <Text className="order-field-value">{formatDateTime(order.paidAt)}</Text>
              </View>
            ) : null}
            {order.refund ? (
              <View className="order-field">
                <Text>{t('orders.refundAmount')}</Text>
                <Text className="order-field-value">¥{(order.refund.refundFee / 100).toFixed(2)}</Text>
              </View>
            ) : null}
            <View className="order-actions">
              {orderState(order, now) === 'PENDING' ? (
                <>
                  <Text className="order-countdown">{t('orders.timeLeft', { time: paymentCountdown(order, now) })}</Text>
                  <Button size="sm" loading={busy === order.outTradeNo} disabled={Boolean(busy)} onClick={() => void pay(order)}>
                    {t('orders.payNow')}
                  </Button>
                </>
              ) : null}
              {order.status === 'DELIVERED' && !order.refund ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(busy)}
                  loading={busy === order.outTradeNo}
                  onClick={() => void action(order)}
                >
                  {t('orders.refund')}
                </Button>
              ) : null}
            </View>
          </View>
        ))}
        {error && records.length > 0 ? (
          <Button variant="ghost" onClick={() => void load(cursor ?? undefined)}>
            {t('orders.retry')}
          </Button>
        ) : null}
        {cursor ? (
          <Button
            block
            variant="ghost"
            loading={loading}
            disabled={loading}
            onClick={() => void load(cursor)}
          >
            {t('orders.more')}
          </Button>
        ) : null}
      </View>
      </ScrollView>
      <View className="orders-footer">
        <Text className="orders-policy">{t('orders.paymentRule')}</Text>
        <Text className="orders-policy">{t('orders.rule')}</Text>
      </View>
    </ThemeView>
  )
}
