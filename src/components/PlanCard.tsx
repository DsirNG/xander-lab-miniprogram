import { t, useLocale } from '@/i18n'
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
    get title() {
      return t('ui.runNow')
    },
    show: plan => !plan.runOnce && (plan.status === 'ACTIVE' || plan.status === 'PAUSED'),
  },
  {
    key: 'pause',
    get title() {
      return t('ui.pause')
    },
    show: plan => plan.status === 'ACTIVE',
  },
  {
    key: 'resume',
    get title() {
      return t('ui.resume')
    },
    show: plan => plan.status === 'PAUSED',
  },
  {
    key: 'cancel',
    get title() {
      return t('ui.cancel')
    },
    show: plan => plan.status === 'ACTIVE' || plan.status === 'PAUSED',
  },
  {
    key: 'delete',
    get title() {
      return t('ui.delete')
    },
    show: plan => plan.status !== 'RUNNING',
  },
]

export function PlanCard({
  plan,
  onAction,
}: {
  plan: Plan
  onAction: (action: PlanActionKey) => void
}) {
  useLocale()
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
          {plan.runOnce ? <Text className="badge badge-purple">{t('ui.oneTime')}</Text> : null}
          {plan.topics?.length > 0 && !plan.runOnce ? (
            <Text className="plan-queue">
              {t('ui.queue')}
              {plan.topics.length}
            </Text>
          ) : null}
        </View>
        <View className="plan-card-status">
          <PlanStatusBadge status={plan.status} />
          {visibleActions.length > 0 ? (
            <View className="plan-more" aria-label={t('ui.planActions')} onClick={showActions}>
              <Icon name="more" />
            </View>
          ) : null}
        </View>
      </View>
      <View className="plan-card-meta">
        <Text className="plan-meta-item">
          {t('ui.trigger')}
          {(plan.triggerTimes?.length ? plan.triggerTimes : [plan.triggerTime]).join(' / ')}
        </Text>
        <Text className="plan-meta-item">
          {t('ui.nextRun')}
          {formatInstant(plan.nextRunAt)}（{plan.timezone}）
        </Text>
        <View className="plan-syncs">
          {plan.syncCsdn ? <Text className="badge badge-blue">CSDN</Text> : null}
          {plan.syncJuejin ? <Text className="badge badge-blue">{t('ui.juejin')}</Text> : null}
        </View>
      </View>
      {plan.errorMessage ? <Text className="plan-error">{plan.errorMessage}</Text> : null}
    </View>
  )
}
