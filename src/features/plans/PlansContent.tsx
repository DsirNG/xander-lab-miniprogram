import { t, useLocale } from '@/i18n'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PlanCard } from '@/components/PlanCard'
import { Icon } from '@/components/Icon'
import { NavBar } from '@/components/NavBar'
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
    openCreate,
  } = controller

  if (hasSession && !userLoaded && !loadedOnce) {
    return (
      <View className="page plans-page">
        <NavBar title={t('ui.plans')} />
        <Text className="data-state">{t('ui.syncingPlans')}</Text>
      </View>
    )
  }

  if (!hasSession) {
    return (
      <View className="page plans-page">
        <NavBar title={t('ui.plans')} />
        <View className="empty-state">
          <Text className="empty-title">{t('ui.signInToViewPublishingPlans')}</Text>
          <Text className="empty-desc">{t('ui.signInToSchedulePostsWithThe')}</Text>
          <View
            className="empty-btn"
            onClick={() => void Taro.navigateTo({ url: '/pages/login/index' })}
          >
            {t('ui.signIn')}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="page plans-page">
      <NavBar title={t('ui.plans')} />
      <View className="plans-toolbar">
        <View className="new-plan-btn" onClick={openCreate}>
          <Icon name="plus" />
          <Text>{t('ui.new')}</Text>
        </View>
      </View>
      {loading && plans.length === 0 ? (
        <Text className="data-state">{t('ui.loadingPlans')}</Text>
      ) : null}
      {loadedOnce && plans.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-title">{t('ui.noPublishingPlansYet')}</Text>
          <Text className="empty-desc">{t('ui.createAPlanToGenerateAndPublish')}</Text>
          <View className="empty-btn" onClick={openCreate}>
            {t('ui.newPlan')}
          </View>
        </View>
      ) : null}
      {plans.map(plan => (
        <View key={plan.id} className="plan-item" onClick={() => openDetail(plan.id)}>
          <PlanCard plan={plan} onAction={action => void runAction(plan.id, action)} />
        </View>
      ))}
      {loading && plans.length > 0 ? <Text className="data-state">{t('ui.loading')}</Text> : null}
      {loadedOnce && !loading && plans.length > 0 && plans.length >= total ? (
        <Text className="data-state">{t('ui.allPlansShown')}</Text>
      ) : null}
    </View>
  )
}
