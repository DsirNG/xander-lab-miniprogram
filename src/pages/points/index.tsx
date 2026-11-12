import { ThemeView } from '@/components/ThemeView'
import {
  getSessionVersion,
  privateCacheKeys,
  readPrivateCache,
  useSessionVersion,
  writePrivateCache,
} from '@/utils/privateCache'
import { Skeleton } from '@/components/Skeleton'
import { t, useLocale } from '@/i18n'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useRef, useState } from 'react'
import {
  formatPoints,
  pointsApi,
  type PointsLedgerItem,
  type PointsOverview,
  type PointsLedgerPage,
} from '@/api/points'
import { NavBar } from '@/components/NavBar'
import { ensureLogin } from '@/store/user'
import { formatDateTime } from '@/utils/format'
import './index.scss'

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

export default function Points() {
  const session = useSessionVersion()
  return <PointsContent key={session} session={session} />
}

function PointsContent({ session }: { session: number }) {
  useLocale()
  const [cachedLedger] = useState(() =>
    readPrivateCache<PointsLedgerPage>(privateCacheKeys.pointsLedger),
  )
  const [overview, setOverview] = useState(() =>
    readPrivateCache<PointsOverview>(privateCacheKeys.pointsOverview),
  )
  const [overviewLoading, setOverviewLoading] = useState(!overview)
  const [ledger, setLedger] = useState<PointsLedgerItem[]>(cachedLedger?.records ?? [])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(cachedLedger?.total ?? 0)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(Boolean(cachedLedger))
  const loadingRef = useRef(false)
  const refreshingRef = useRef(false)

  const load = async (targetPage: number, append: boolean) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const result = await pointsApi.ledger(targetPage, 20)
      if (session !== getSessionVersion()) return
      if (targetPage === 1) writePrivateCache(privateCacheKeys.pointsLedger, result, session)
      setLedger(prev => (append ? [...prev, ...result.records] : result.records))
      setTotal(result.total)
      setPage(targetPage)
    } catch (e) {
      if (session === getSessionVersion())
        showToast(e instanceof Error ? e.message : t('ui.unableToLoadPointsHistory'))
    } finally {
      loadingRef.current = false
      setLoading(false)
      setLoadedOnce(true)
    }
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      setOverviewLoading(false)
      setLoadedOnce(true)
      return
    }
    if (refreshingRef.current) return
    setOverviewLoading(true)
    refreshingRef.current = true
    // 两个业务接口独立鉴权、独立展示结果，不等待用户资料或彼此完成。
    void Promise.allSettled([
      pointsApi
        .overview()
        .then(result => {
          if (session !== getSessionVersion()) return
          writePrivateCache(privateCacheKeys.pointsOverview, result, session)
          setOverview(result)
        })
        .catch(error => {
          if (session !== getSessionVersion()) return
          showToast(error instanceof Error ? error.message : t('ui.unableToLoadPointsOverview'))
        })
        .finally(() => setOverviewLoading(false)),
      load(1, false),
    ]).finally(() => {
      refreshingRef.current = false
    })
  })

  useReachBottom(() => {
    if (!loading && ledger.length < total) load(page + 1, true)
  })

  return (
    <ThemeView className="detail-page points-page">
      <NavBar title={t('ui.pointsHistory')} showBack />

      <View className="points-card points-page-card">
        <View>
          {overviewLoading && !overview ? (
            <Skeleton layout="balance" />
          ) : (
            <Text className="points-balance">
              {overview ? formatPoints(overview.balance) : '--'}
            </Text>
          )}
          <Text className="points-label">{t('ui.availablePoints')}</Text>
        </View>
        <View className="points-today">
          {overview?.consumedToday != null
            ? t('preferences.consumedToday', { points: formatPoints(overview.consumedToday) })
            : ''}
        </View>
      </View>

      <View
        className="wallet-topup-link"
        onClick={() => Taro.navigateTo({ url: '/pages/subscription/index' })}
      >
        <Text>{t('wallet.manage')}</Text>
        <Text>→</Text>
      </View>
      <View className="section-title">
        <Text>{t('ui.transactions')}</Text>
      </View>
      {(loading || !loadedOnce) && ledger.length === 0 ? <Skeleton layout="ledger" /> : null}
      {loadedOnce && !loading && ledger.length === 0 ? (
        <Text className="data-state">{t('ui.noTransactionsYet')}</Text>
      ) : null}
      {ledger.map(item => (
        <View className="ledger-item" key={item.id}>
          <View className="ledger-info">
            <Text className="ledger-reason">
              {item.bizType === 'refund-hold' ? t('orders.holdPoints') : item.bizType === 'refund-release' ? t('orders.releasePoints') : item.remark || item.reason || t('ui.pointsChange')}
            </Text>
            <Text className="ledger-time">{formatDateTime(item.createdAt)}</Text>
          </View>
          <Text className={`ledger-amount ${item.delta >= 0 ? 'positive' : 'negative'}`}>
            {item.delta >= 0 ? `+${formatPoints(item.delta)}` : formatPoints(item.delta)}
          </Text>
        </View>
      ))}
      {loading && ledger.length > 0 ? <Skeleton layout="ledger" count={1} /> : null}
    </ThemeView>
  )
}
