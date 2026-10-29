import { t, useLocale } from '@/i18n'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { formatPoints, pointsApi, type PointsLedgerItem, type PointsOverview } from '@/api/points'
import { NavBar } from '@/components/NavBar'
import { ensureLogin } from '@/store/user'
import { formatDateTime } from '@/utils/format'
import './index.scss'

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

export default function Points() {
  useLocale()
  const [overview, setOverview] = useState<PointsOverview | null>(null)
  const [ledger, setLedger] = useState<PointsLedgerItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const loadingRef = useRef(false)
  const refreshingRef = useRef(false)

  const load = async (targetPage: number, append: boolean) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const result = await pointsApi.ledger(targetPage, 20)
      setLedger(prev => (append ? [...prev, ...result.records] : result.records))
      setTotal(result.total)
      setPage(targetPage)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('ui.unableToLoadPointsHistory'))
    } finally {
      loadingRef.current = false
      setLoading(false)
      setLoadedOnce(true)
    }
  }

  useDidShow(() => {
    if (!ensureLogin() || refreshingRef.current) return
    refreshingRef.current = true
    // 两个业务接口独立鉴权、独立展示结果，不等待用户资料或彼此完成。
    void Promise.allSettled([
      pointsApi
        .overview()
        .then(setOverview)
        .catch(error => {
          setOverview(null)
          showToast(error instanceof Error ? error.message : t('ui.unableToLoadPointsOverview'))
        }),
      load(1, false),
    ]).finally(() => {
      refreshingRef.current = false
    })
  })

  useReachBottom(() => {
    if (!loading && ledger.length < total) load(page + 1, true)
  })

  return (
    <View className="detail-page">
      <NavBar title={t('ui.pointsHistory')} showBack />

      <View className="points-card points-page-card">
        <View>
          <Text className="points-balance">{overview ? formatPoints(overview.balance) : '--'}</Text>
          <Text className="points-label">{t('ui.availablePoints')}</Text>
        </View>
        <View className="points-today">
          {overview?.consumedToday != null
            ? t('preferences.consumedToday', { points: formatPoints(overview.consumedToday) })
            : ''}
        </View>
      </View>

      <View className="section-title">
        <Text>{t('ui.transactions')}</Text>
      </View>
      {loading && ledger.length === 0 ? (
        <Text className="data-state">{t('ui.loadingData')}</Text>
      ) : null}
      {loadedOnce && !loading && ledger.length === 0 ? (
        <Text className="data-state">{t('ui.noTransactionsYet')}</Text>
      ) : null}
      {ledger.map(item => (
        <View className="ledger-item" key={item.id}>
          <View className="ledger-info">
            <Text className="ledger-reason">
              {item.remark || item.reason || t('ui.pointsChange')}
            </Text>
            <Text className="ledger-time">{formatDateTime(item.createdAt)}</Text>
          </View>
          <Text className={`ledger-amount ${item.delta >= 0 ? 'positive' : 'negative'}`}>
            {item.delta >= 0 ? `+${formatPoints(item.delta)}` : formatPoints(item.delta)}
          </Text>
        </View>
      ))}
      {loading && ledger.length > 0 ? <Text className="data-state">{t('ui.loading')}</Text> : null}
    </View>
  )
}
