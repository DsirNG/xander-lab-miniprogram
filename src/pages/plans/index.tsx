import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { planApi, type Plan } from '@/api/plans'
import { PlanCard } from '@/components/PlanCard'
import { TabBar } from '@/components/TabBar'
import { NavBar } from '@/components/NavBar'
import { Icon } from '@/components/Icon'
import { useUserStore } from '@/store/user'
import './index.scss'

const PAGE_SIZE = 10

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

export default function Plans() {
  const user = useUserStore(state => state.user)
  const userLoaded = useUserStore(state => state.loaded)
  const refreshUser = useUserStore(state => state.refresh)

  const [plans, setPlans] = useState<Plan[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async (targetPage: number, append: boolean) => {
    if (!useUserStore.getState().user) {
      setLoadedOnce(true)
      return
    }
    setLoading(true)
    try {
      const result = await planApi.list({ page: targetPage, size: PAGE_SIZE })
      setPlans(prev => (append ? [...prev, ...result.records] : result.records))
      setTotal(result.total)
      setPage(targetPage)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '计划列表加载失败')
    } finally {
      setLoading(false)
      setLoadedOnce(true)
    }
  }, [])

  useDidShow(() => {
    const restoreAndLoad = async () => {
      if (!useUserStore.getState().loaded) await refreshUser()
      await load(1, false)
    }
    restoreAndLoad().catch(() => setLoadedOnce(true))
  })

  useReachBottom(() => {
    if (!loading && plans.length < total) load(page + 1, true)
  })

  const runAction = async (id: number, action: string) => {
    if (busyId !== null) return
    setBusyId(id)
    try {
      switch (action) {
        case 'pause':
          await planApi.updateStatus(id, 'PAUSED')
          showToast('已暂停')
          break
        case 'resume':
          await planApi.updateStatus(id, 'RESUME')
          showToast('已恢复')
          break
        case 'cancel': {
          const confirmed = await Taro.showModal({
            title: '取消计划',
            content: '取消后将不再执行该计划，确定取消吗？',
            confirmColor: '#d14343',
          })
          if (!confirmed.confirm) return
          await planApi.updateStatus(id, 'CANCELLED')
          showToast('已取消')
          break
        }
        case 'delete': {
          const confirmed = await Taro.showModal({
            title: '删除计划',
            content: '删除后不可恢复，确定删除吗？',
            confirmColor: '#d14343',
          })
          if (!confirmed.confirm) return
          await planApi.delete(id)
          showToast('已删除')
          break
        }
        case 'trigger': {
          await planApi.trigger(id)
          showToast('已触发执行')
          break
        }
      }
      load(1, false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  const openDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/plan-detail/index?id=${id}` })
  }

  if (!userLoaded && !loadedOnce) {
    return (
      <View className="page plans-page">
        <NavBar title="计划" />
        <Text className="data-state">正在同步计划...</Text>
        <TabBar active="calendar" />
      </View>
    )
  }

  if (!user && !loading) {
    return (
      <View className="page">
        <NavBar title="计划" />
        <View className="empty-state">
          <Text className="empty-title">登录后查看定时发文计划</Text>
          <Text className="empty-desc">登录后可使用博客智能体的定时发文能力</Text>
          <View
            className="empty-btn"
            onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}
          >
            去登录
          </View>
        </View>
        <TabBar active="calendar" />
      </View>
    )
  }

  return (
    <View className="page plans-page">
      <NavBar title="计划" />
      <View className="plans-toolbar">
        <View
          className="new-plan-btn"
          onClick={() => Taro.navigateTo({ url: '/pages/plan-create/index' })}
        >
          <Icon name="plus" />
          <Text>新建</Text>
        </View>
      </View>
      {loading && plans.length === 0 ? <Text className="data-state">正在加载计划...</Text> : null}
      {loadedOnce && plans.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-title">还没有定时发文计划</Text>
          <Text className="empty-desc">创建一个计划，让博客智能体按主题自动生成并发布文章</Text>
          <View
            className="empty-btn"
            onClick={() => Taro.navigateTo({ url: '/pages/plan-create/index' })}
          >
            新建计划
          </View>
        </View>
      ) : null}
      {plans.map(plan => (
        <View key={plan.id} className="plan-item" onClick={() => openDetail(plan.id)}>
          <PlanCard plan={plan} onAction={action => runAction(plan.id, action)} />
        </View>
      ))}
      {loading && plans.length > 0 ? <Text className="data-state">加载中...</Text> : null}
      {loadedOnce && !loading && plans.length > 0 && plans.length >= total ? (
        <Text className="data-state">已展示全部计划</Text>
      ) : null}
      <TabBar active="calendar" />
    </View>
  )
}
