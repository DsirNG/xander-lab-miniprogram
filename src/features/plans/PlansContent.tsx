import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PlanCard } from '@/components/PlanCard'
import { Icon } from '@/components/Icon'
import { NavBar } from '@/components/NavBar'
import type { PlansController } from './usePlansController'

export function PlansContent({ controller }: { controller: PlansController }) {
  const { user, userLoaded, plans, total, loading, loadedOnce, runAction, openDetail, openCreate } =
    controller

  if (!userLoaded && !loadedOnce) {
    return (
      <View className="page plans-page">
        <NavBar title="计划" />
        <Text className="data-state">正在同步计划...</Text>
      </View>
    )
  }

  if (!user && !loading) {
    return (
      <View className="page plans-page">
        <NavBar title="计划" />
        <View className="empty-state">
          <Text className="empty-title">登录后查看定时发文计划</Text>
          <Text className="empty-desc">登录后可使用博客智能体的定时发文能力</Text>
          <View
            className="empty-btn"
            onClick={() => void Taro.navigateTo({ url: '/pages/login/index' })}
          >
            去登录
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="page plans-page">
      <NavBar title="计划" />
      <View className="plans-toolbar">
        <View className="new-plan-btn" onClick={openCreate}>
          <Icon name="plus" />
          <Text>新建</Text>
        </View>
      </View>
      {loading && plans.length === 0 ? <Text className="data-state">正在加载计划...</Text> : null}
      {loadedOnce && plans.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-title">还没有定时发文计划</Text>
          <Text className="empty-desc">创建一个计划，让博客智能体按主题自动生成并发布文章</Text>
          <View className="empty-btn" onClick={openCreate}>
            新建计划
          </View>
        </View>
      ) : null}
      {plans.map(plan => (
        <View key={plan.id} className="plan-item" onClick={() => openDetail(plan.id)}>
          <PlanCard plan={plan} onAction={action => void runAction(plan.id, action)} />
        </View>
      ))}
      {loading && plans.length > 0 ? <Text className="data-state">加载中...</Text> : null}
      {loadedOnce && !loading && plans.length > 0 && plans.length >= total ? (
        <Text className="data-state">已展示全部计划</Text>
      ) : null}
    </View>
  )
}
