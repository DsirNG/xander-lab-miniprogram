import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Plan } from '@/api/plans'
import { Icon } from './Icon'
import { PlanStatusBadge } from './StatusBadge'
import { formatInstant } from '@/utils/format'

export type PlanActionKey = 'pause' | 'resume' | 'trigger' | 'cancel' | 'delete'

const ACTION_DEFS: Array<{
  key: PlanActionKey
  title: string
  show: (plan: Plan) => boolean
}> = [
  {
    key: 'trigger',
    title: '立即执行',
    show: plan => !plan.runOnce && (plan.status === 'ACTIVE' || plan.status === 'PAUSED'),
  },
  { key: 'pause', title: '暂停', show: plan => plan.status === 'ACTIVE' },
  { key: 'resume', title: '恢复', show: plan => plan.status === 'PAUSED' },
  {
    key: 'cancel',
    title: '取消',
    show: plan => plan.status === 'ACTIVE' || plan.status === 'PAUSED',
  },
  { key: 'delete', title: '删除', show: plan => plan.status !== 'RUNNING' },
]

export function PlanCard({
  plan,
  onAction,
}: {
  plan: Plan
  onAction: (action: PlanActionKey) => void
}) {
  const visibleActions = ACTION_DEFS.filter(def => def.show(plan))

  const showActions = async (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    if (visibleActions.length === 0) return
    try {
      const result = await Taro.showActionSheet({
        itemList: visibleActions.map(action => action.title),
      })
      const selected = visibleActions[result.tapIndex]
      if (!selected) return
      Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
      onAction(selected.key)
    } catch {
      // 用户关闭操作菜单时不需要反馈。
    }
  }

  return (
    <View className="plan-card">
      <View className="plan-card-head">
        <View className="plan-card-title-wrap">
          <Text className="plan-card-title">{plan.topic}</Text>
          {plan.runOnce ? <Text className="badge badge-purple">一次性</Text> : null}
          {plan.topics?.length > 0 && !plan.runOnce ? (
            <Text className="plan-queue">队列 {plan.topics.length}</Text>
          ) : null}
        </View>
        <View className="plan-card-status">
          <PlanStatusBadge status={plan.status} />
          {visibleActions.length > 0 ? (
            <View className="plan-more" aria-label="计划操作" onClick={showActions}>
              <Icon name="more" />
            </View>
          ) : null}
        </View>
      </View>
      <View className="plan-card-meta">
        <Text className="plan-meta-item">
          触发 {(plan.triggerTimes?.length ? plan.triggerTimes : [plan.triggerTime]).join(' / ')}
        </Text>
        <Text className="plan-meta-item">
          下次运行 {formatInstant(plan.nextRunAt)}（{plan.timezone}）
        </Text>
        <View className="plan-syncs">
          {plan.syncCsdn ? <Text className="badge badge-blue">CSDN</Text> : null}
          {plan.syncJuejin ? <Text className="badge badge-blue">掘金</Text> : null}
        </View>
      </View>
      {plan.errorMessage ? <Text className="plan-error">{plan.errorMessage}</Text> : null}
    </View>
  )
}
