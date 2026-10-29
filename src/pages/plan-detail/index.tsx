import { t, useLocale } from '@/i18n'
import { Text, View } from '@tarojs/components'
import Taro, { useReachBottom, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { planApi, type Plan, type PlanRun } from '@/api/plans'
import { NavBar } from '@/components/NavBar'
import { PlanStatusBadge, RunStatusBadge } from '@/components/StatusBadge'
import { formatDateTime, formatInstant } from '@/utils/format'
import './index.scss'

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

type ActionKey = 'pause' | 'resume' | 'trigger' | 'cancel' | 'delete'

export default function PlanDetail() {
  useLocale()
  const { params } = useRouter()
  const planId = Number(params.id)

  const [plan, setPlan] = useState<Plan | null>(null)
  const [runs, setRuns] = useState<PlanRun[]>([])
  const [page, setPage] = useState(1)
  const [runsTotal, setRunsTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [runsLoading, setRunsLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!planId) return
    try {
      const [planData, runsData] = await Promise.all([
        planApi.get(planId),
        planApi.listRuns(planId, { page: 1, size: 10 }),
      ])
      setPlan(planData)
      setRuns(runsData.records)
      setRunsTotal(runsData.total)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('ui.unableToLoadPlan'))
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    load()
  }, [load])

  useReachBottom(() => {
    if (!runsLoading && runs.length < runsTotal) {
      setRunsLoading(true)
      planApi
        .listRuns(planId, { page: page + 1, size: 10 })
        .then(result => {
          setRuns(prev => [...prev, ...result.records])
          setPage(page + 1)
          setRunsTotal(result.total)
        })
        .catch(() => undefined)
        .finally(() => setRunsLoading(false))
    }
  })

  const runAction = async (action: ActionKey) => {
    if (!plan || busy) return
    setBusy(true)
    try {
      switch (action) {
        case 'pause':
          await planApi.updateStatus(plan.id, 'PAUSED')
          showToast(t('ui.paused'))
          break
        case 'resume':
          await planApi.updateStatus(plan.id, 'RESUME')
          showToast(t('ui.resumed'))
          break
        case 'cancel': {
          const confirmed = await Taro.showModal({
            title: t('ui.cancelPlan'),
            content: t('ui.thisPlanWillStopRunningCancelIt'),
            confirmColor: '#d14343',
          })
          if (!confirmed.confirm) return
          await planApi.updateStatus(plan.id, 'CANCELLED')
          showToast(t('ui.cancelled'))
          break
        }
        case 'delete': {
          const confirmed = await Taro.showModal({
            title: t('ui.deletePlan'),
            content: t('ui.thisCannotBeUndoneDeleteIt'),
            confirmColor: '#d14343',
          })
          if (!confirmed.confirm) return
          await planApi.delete(plan.id)
          showToast(t('ui.deleted'))
          Taro.navigateBack()
          return
        }
        case 'trigger':
          await planApi.trigger(plan.id)
          showToast(t('ui.runRequested'))
          break
      }
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('ui.operationFailed'))
    } finally {
      setBusy(false)
    }
  }

  const showRunDetail = (run: PlanRun) => {
    const lines = [
      t('preferences.runStatus', { value: run.status }),
      t('preferences.runTrigger', {
        value: run.triggerType === 'MANUAL' ? t('ui.manual') : t('ui.scheduled'),
      }),
      run.scheduledAt
        ? t('preferences.runScheduled', { value: formatInstant(run.scheduledAt) })
        : '',
      run.startedAt ? t('preferences.runStarted', { value: formatInstant(run.startedAt) }) : '',
      run.finishedAt ? t('preferences.runFinished', { value: formatInstant(run.finishedAt) }) : '',
      `CSDN：${run.csdnStatus}${run.csdnUrl ? `（${run.csdnUrl}）` : ''}`,
      `${t('ui.juejin')}: ${run.juejinStatus}${run.juejinUrl ? `（${run.juejinUrl}）` : ''}`,
      run.reviewReason ? t('preferences.runReview', { value: run.reviewReason }) : '',
      run.errorMessage ? t('preferences.runError', { value: run.errorMessage }) : '',
    ].filter(Boolean)
    Taro.showModal({
      title: t('preferences.runTitle', { id: run.id }),
      content: lines.join('\n'),
      showCancel: false,
      confirmText: t('ui.gotIt'),
    })
  }

  const gotoArticle = (run: PlanRun) => {
    if (run.localPostId) {
      Taro.navigateTo({ url: `/pages/blog-detail/index?id=${run.localPostId}` })
    }
  }

  const copyExternalLink = (url: string) => {
    Taro.setClipboardData({ data: url }).then(() => showToast(t('ui.linkCopied')))
  }

  const showPlanActions = async () => {
    if (!plan || busy) return
    const actions: Array<{ label: string; run: () => unknown | Promise<unknown> }> = []
    if (plan.status !== 'RUNNING' && plan.status !== 'FINISHED') {
      actions.push({
        label: t('ui.editPlan'),
        run: () => Taro.navigateTo({ url: `/pages/plan-create/index?id=${plan.id}` }),
      })
    }
    if (plan.status === 'ACTIVE') {
      actions.push(
        { label: t('ui.pause'), run: () => runAction('pause') },
        { label: t('ui.runNow'), run: () => runAction('trigger') },
        { label: t('ui.cancel'), run: () => runAction('cancel') },
      )
    } else if (plan.status === 'PAUSED') {
      actions.push(
        { label: t('ui.resume'), run: () => runAction('resume') },
        { label: t('ui.runNow'), run: () => runAction('trigger') },
        { label: t('ui.cancel'), run: () => runAction('cancel') },
      )
    }
    if (plan.status !== 'RUNNING') {
      actions.push({ label: t('ui.delete'), run: () => runAction('delete') })
    }
    if (actions.length === 0) return
    try {
      const result = await Taro.showActionSheet({ itemList: actions.map(item => item.label) })
      await actions[result.tapIndex]?.run()
    } catch {
      // 用户关闭操作菜单时不需要反馈。
    }
  }

  if (loading) {
    return (
      <View className="detail-page">
        <NavBar title={t('ui.planDetails')} showBack />
        <Text className="data-state">{t('ui.loadingPlans')}</Text>
      </View>
    )
  }

  if (!plan) {
    return (
      <View className="detail-page">
        <NavBar title={t('ui.planDetails')} showBack />
        <View className="empty-state">
          <Text className="empty-title">{t('ui.planNotFound')}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="detail-page">
      <NavBar title={t('ui.planDetails')} showBack />

      <View className="plan-info-card">
        <View className="plan-info-heading">
          <Text className="plan-info-topic">{plan.topic}</Text>
          <View className="plan-info-actions">
            <PlanStatusBadge status={plan.status} />
            <Text className="plan-manage" onClick={showPlanActions}>
              {t('ui.manage')}
            </Text>
          </View>
        </View>
        <View className="plan-info-tags">
          {plan.runOnce ? <Text className="badge badge-purple">{t('ui.oneTime')}</Text> : null}
          {plan.syncCsdn ? (
            <Text className="badge badge-blue">{t('ui.crossPostToCsdnLabel')}</Text>
          ) : null}
          {plan.syncJuejin ? (
            <Text className="badge badge-blue">{t('ui.crossPostToJuejinLabel')}</Text>
          ) : null}
        </View>
        <View className="plan-info-rows">
          <View className="plan-info-row">
            <Text className="plan-info-label">{t('ui.scheduledTime')}</Text>
            <Text className="plan-info-value">
              {(plan.triggerTimes?.length ? plan.triggerTimes : [plan.triggerTime]).join(' / ')}（
              {plan.timezone}）
            </Text>
          </View>
          <View className="plan-info-row">
            <Text className="plan-info-label">{t('ui.nextRun')}</Text>
            <Text className="plan-info-value">{formatInstant(plan.nextRunAt)}</Text>
          </View>
          <View className="plan-info-row">
            <Text className="plan-info-label">{t('ui.topicQueue')}</Text>
            <Text className="plan-info-value">
              {plan.topics?.length
                ? t('preferences.topicCount', { count: plan.topics.length })
                : t('ui.generatedFromTheTopic')}
            </Text>
          </View>
          {plan.audience ? (
            <View className="plan-info-row">
              <Text className="plan-info-label">{t('ui.audience')}</Text>
              <Text className="plan-info-value">{plan.audience}</Text>
            </View>
          ) : null}
          {plan.tone ? (
            <View className="plan-info-row">
              <Text className="plan-info-label">{t('ui.tone')}</Text>
              <Text className="plan-info-value">{plan.tone}</Text>
            </View>
          ) : null}
          <View className="plan-info-row">
            <Text className="plan-info-label">{t('ui.created')}</Text>
            <Text className="plan-info-value">{formatDateTime(plan.createdAt)}</Text>
          </View>
        </View>
      </View>

      <View className="section-title">
        <Text>{t('preferences.scheduledCount', { count: runsTotal })}</Text>
      </View>
      {runsLoading && runs.length === 0 ? (
        <Text className="data-state">{t('ui.loading')}</Text>
      ) : null}
      {!runsLoading && runs.length === 0 ? (
        <Text className="data-state">{t('ui.noRunsYetStartAPlanTo')}</Text>
      ) : null}
      {runs.map(run => (
        <View className="run-card" key={run.id}>
          <View className="run-head">
            <Text className="run-title">
              #{run.id} {run.triggerType === 'MANUAL' ? t('ui.manualRun') : t('ui.scheduledRun')}
            </Text>
            <RunStatusBadge status={run.status} />
          </View>
          <View className="run-info">
            <Text>
              {t('ui.scheduledLabel')}
              {formatInstant(run.scheduledAt)}
            </Text>
            <Text>
              {t('ui.completed')}
              {formatInstant(run.finishedAt)}
            </Text>
            <Text>
              CSDN：{run.csdnStatus} {t('ui.juejinLabel')}
              {run.juejinStatus}
            </Text>
          </View>
          <View className="run-links">
            {run.localPostId ? (
              <Text className="link-chip" onClick={() => gotoArticle(run)}>
                {t('ui.viewArticle')}
              </Text>
            ) : null}
            {run.reviewReason ? (
              <Text className="link-chip" onClick={() => showRunDetail(run)}>
                {t('ui.reviewNotes')}
              </Text>
            ) : null}
            {run.csdnUrl ? (
              <Text className="link-chip" onClick={() => copyExternalLink(run.csdnUrl!)}>
                {t('ui.copyCsdnLink')}
              </Text>
            ) : null}
            {run.juejinUrl ? (
              <Text className="link-chip" onClick={() => copyExternalLink(run.juejinUrl!)}>
                {t('ui.copyJuejinLink')}
              </Text>
            ) : null}
            <Text className="link-chip" onClick={() => showRunDetail(run)}>
              {t('ui.details')}
            </Text>
          </View>
        </View>
      ))}
      {runsLoading && runs.length > 0 ? (
        <Text className="data-state">{t('ui.loading')}</Text>
      ) : null}
    </View>
  )
}
