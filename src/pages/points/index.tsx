import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState } from 'react'
import { formatPoints, pointsApi, type PointsLedgerItem, type PointsOverview } from '@/api/points'
import { NavBar } from '@/components/NavBar'
import { useUserStore } from '@/store/user'
import { formatDateTime } from '@/utils/format'
import './index.scss'

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

export default function Points() {
  const [overview, setOverview] = useState<PointsOverview | null>(null)
  const [ledger, setLedger] = useState<PointsLedgerItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)

  const load = async (targetPage: number, append: boolean) => {
    setLoading(true)
    try {
      const result = await pointsApi.ledger(targetPage, 20)
      setLedger(prev => (append ? [...prev, ...result.records] : result.records))
      setTotal(result.total)
      setPage(targetPage)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '积分明细加载失败')
    } finally {
      setLoading(false)
      setLoadedOnce(true)
    }
  }

  useDidShow(() => {
    const restoreAndLoad = async () => {
      await useUserStore.getState().refresh()
      if (!useUserStore.getState().user) {
        Taro.redirectTo({ url: '/pages/login/index' })
        return
      }
      const overviewData = await pointsApi.overview()
      setOverview(overviewData)
      await load(1, false)
    }
    restoreAndLoad().catch(error => {
      setOverview(null)
      showToast(error instanceof Error ? error.message : '积分信息加载失败')
    })
  })

  useReachBottom(() => {
    if (!loading && ledger.length < total) load(page + 1, true)
  })

  return (
    <View className="detail-page">
      <NavBar title="积分明细" showBack />

      <View className="points-card points-page-card">
        <View>
          <Text className="points-balance">{overview ? formatPoints(overview.balance) : '--'}</Text>
          <Text className="points-label">可用积分</Text>
        </View>
        <View className="points-today">
          {overview?.consumedToday != null
            ? `今日已用 ${formatPoints(overview.consumedToday)}`
            : ''}
        </View>
      </View>

      <View className="section-title">
        <Text>消费流水</Text>
      </View>
      {loading && ledger.length === 0 ? <Text className="data-state">正在加载...</Text> : null}
      {loadedOnce && !loading && ledger.length === 0 ? (
        <Text className="data-state">暂无积分流水</Text>
      ) : null}
      {ledger.map(item => (
        <View className="ledger-item" key={item.id}>
          <View className="ledger-info">
            <Text className="ledger-reason">{item.remark || item.reason || '积分变动'}</Text>
            <Text className="ledger-time">{formatDateTime(item.createdAt)}</Text>
          </View>
          <Text className={`ledger-amount ${item.delta >= 0 ? 'positive' : 'negative'}`}>
            {item.delta >= 0 ? `+${formatPoints(item.delta)}` : formatPoints(item.delta)}
          </Text>
        </View>
      ))}
      {loading && ledger.length > 0 ? <Text className="data-state">加载中...</Text> : null}
    </View>
  )
}
