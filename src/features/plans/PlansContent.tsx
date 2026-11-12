import { Skeleton } from '@/components/Skeleton'
import { ensureLogin } from '@/store/user'
import { t, useLocale } from '@/i18n'
import { Text, View } from '@tarojs/components'
import { PlanCard } from '@/components/PlanCard'
import type { PlansController } from './usePlansController'

export function PlansContent({ controller }: { controller: PlansController }) {
  useLocale()
  const {
    hasSession,
    userLoaded,
    plans,
    total,
    loading,
    loadedOnce,
    runAction,
    openDetail,
  } = controller

  if (hasSession && !userLoaded && !loadedOnce) {
    return (
      <View className="page plans-page">
        <Skeleton layout="plans" />
      </View>
    )
  }

  if (!hasSession) {
    return (
      <View className="page plans-page">
        <View className="empty-state">
          <Text className="empty-title">{t('ui.signInToViewPublishingPlans')}</Text>
          <Text className="empty-desc">{t('ui.signInToSchedulePostsWithThe')}</Text>
          <View
            className="empty-btn"
            onClick={() => ensureLogin()}
          >
            {t('ui.signIn')}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="page plans-page">
      {loading && plans.length === 0 ? (
        <Skeleton layout="plans" />
      ) : null}
      {loadedOnce && plans.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-title">{t('ui.noPublishingPlansYet')}</Text>
        </View>
      ) : null}
      {plans.map(plan => (
        <View key={plan.id} className="plan-item" onClick={() => openDetail(plan.id)}>
          <PlanCard plan={plan} onAction={action => void runAction(plan.id, action)} />
        </View>
      ))}
      {loading && plans.length > 0 ? <Skeleton layout="plans" count={1} /> : null}
      {loadedOnce && !loading && plans.length > 0 && plans.length >= total ? (
        <Text className="data-state">{t('ui.allPlansShown')}</Text>
      ) : null}
    </View>
  )
}
