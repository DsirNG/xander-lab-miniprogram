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
      showToast(e instanceof Error ? e.message : '计划加载失败')
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
          showToast('已暂停')
          break
        case 'resume':
          await planApi.updateStatus(plan.id, 'RESUME')
          showToast('已恢复')
          break
        case 'cancel': {
          const confirmed = await Taro.showModal({
            title: '取消计划',
            content: '取消后将不再执行该计划，确定取消吗？',
            confirmColor: '#d14343',
          })
          if (!confirmed.confirm) return
          await planApi.updateStatus(plan.id, 'CANCELLED')
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
          await planApi.delete(plan.id)
          showToast('已删除')
          Taro.navigateBack()
          return
        }
        case 'trigger':
          await planApi.trigger(plan.id)
          showToast('已触发执行')
          break
      }
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const showRunDetail = (run: PlanRun) => {
    const lines = [
      `状态：${run.status}`,
      `触发方式：${run.triggerType === 'MANUAL' ? '手动' : '定时'}`,
      run.scheduledAt ? `计划时间：${formatInstant(run.scheduledAt)}` : '',
      run.startedAt ? `开始：${formatInstant(run.startedAt)}` : '',
      run.finishedAt ? `完成：${formatInstant(run.finishedAt)}` : '',
      `CSDN：${run.csdnStatus}${run.csdnUrl ? `（${run.csdnUrl}）` : ''}`,
      `掘金：${run.juejinStatus}${run.juejinUrl ? `（${run.juejinUrl}）` : ''}`,
      run.reviewReason ? `审核说明：${run.reviewReason}` : '',
      run.errorMessage ? `错误：${run.errorMessage}` : '',
    ].filter(Boolean)
    Taro.showModal({
      title: `执行记录 #${run.id}`,
      content: lines.join('\n'),
      showCancel: false,
      confirmText: '知道了',
    })
  }

  const gotoArticle = (run: PlanRun) => {
    if (run.localPostId) {
      Taro.navigateTo({ url: `/pages/blog-detail/index?id=${run.localPostId}` })
    }
  }

  const copyExternalLink = (url: string) => {
    Taro.setClipboardData({ data: url }).then(() => showToast('链接已复制'))
  }

  const showPlanActions = async () => {
    if (!plan || busy) return
    const actions: Array<{ label: string; run: () => unknown | Promise<unknown> }> = []
    if (plan.status !== 'RUNNING' && plan.status !== 'FINISHED') {
      actions.push({
        label: '编辑计划',
        run: () => Taro.navigateTo({ url: `/pages/plan-create/index?id=${plan.id}` }),
      })
    }
    if (plan.status === 'ACTIVE') {
      actions.push(
        { label: '暂停', run: () => runAction('pause') },
        { label: '立即执行', run: () => runAction('trigger') },
        { label: '取消', run: () => runAction('cancel') },
      )
    } else if (plan.status === 'PAUSED') {
      actions.push(
        { label: '恢复', run: () => runAction('resume') },
        { label: '立即执行', run: () => runAction('trigger') },
        { label: '取消', run: () => runAction('cancel') },
      )
    }
    if (plan.status !== 'RUNNING') {
      actions.push({ label: '删除', run: () => runAction('delete') })
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
        <NavBar title="计划详情" showBack />
        <Text className="data-state">正在加载计划...</Text>
      </View>
    )
  }

  if (!plan) {
    return (
      <View className="detail-page">
        <NavBar title="计划详情" showBack />
        <View className="empty-state">
          <Text className="empty-title">计划不存在</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="detail-page">
      <NavBar title="计划详情" showBack />

      <View className="plan-info-card">
        <View className="plan-info-heading">
          <Text className="plan-info-topic">{plan.topic}</Text>
          <View className="plan-info-actions">
            <PlanStatusBadge status={plan.status} />
            <Text className="plan-manage" onClick={showPlanActions}>
              管理
            </Text>
          </View>
        </View>
        <View className="plan-info-tags">
          {plan.runOnce ? <Text className="badge badge-purple">一次性</Text> : null}
          {plan.syncCsdn ? <Text className="badge badge-blue">同步 CSDN</Text> : null}
          {plan.syncJuejin ? <Text className="badge badge-blue">同步掘金</Text> : null}
        </View>
        <View className="plan-info-rows">
          <View className="plan-info-row">
            <Text className="plan-info-label">触发时间</Text>
            <Text className="plan-info-value">
              {(plan.triggerTimes?.length ? plan.triggerTimes : [plan.triggerTime]).join(' / ')}（
              {plan.timezone}）
            </Text>
          </View>
          <View className="plan-info-row">
            <Text className="plan-info-label">下次运行</Text>
            <Text className="plan-info-value">{formatInstant(plan.nextRunAt)}</Text>
          </View>
          <View className="plan-info-row">
            <Text className="plan-info-label">主题队列</Text>
            <Text className="plan-info-value">
              {plan.topics?.length ? `${plan.topics.length} 个主题` : '由主题自动生成'}
            </Text>
          </View>
          {plan.audience ? (
            <View className="plan-info-row">
              <Text className="plan-info-label">目标读者</Text>
              <Text className="plan-info-value">{plan.audience}</Text>
            </View>
          ) : null}
          {plan.tone ? (
            <View className="plan-info-row">
              <Text className="plan-info-label">写作语气</Text>
              <Text className="plan-info-value">{plan.tone}</Text>
            </View>
          ) : null}
          <View className="plan-info-row">
            <Text className="plan-info-label">创建时间</Text>
            <Text className="plan-info-value">{formatDateTime(plan.createdAt)}</Text>
          </View>
        </View>
      </View>

      <View className="section-title">
        <Text>执行记录（{runsTotal}）</Text>
      </View>
      {runsLoading && runs.length === 0 ? <Text className="data-state">加载中...</Text> : null}
      {!runsLoading && runs.length === 0 ? (
        <Text className="data-state">暂无执行记录，触发后可见</Text>
      ) : null}
      {runs.map(run => (
        <View className="run-card" key={run.id}>
          <View className="run-head">
            <Text className="run-title">
              #{run.id} {run.triggerType === 'MANUAL' ? '手动触发' : '定时触发'}
            </Text>
            <RunStatusBadge status={run.status} />
          </View>
          <View className="run-info">
            <Text>计划时间：{formatInstant(run.scheduledAt)}</Text>
            <Text>完成：{formatInstant(run.finishedAt)}</Text>
            <Text>
              CSDN：{run.csdnStatus} ｜ 掘金：{run.juejinStatus}
            </Text>
          </View>
          <View className="run-links">
            {run.localPostId ? (
              <Text className="link-chip" onClick={() => gotoArticle(run)}>
                查看文章
              </Text>
            ) : null}
            {run.reviewReason ? (
              <Text className="link-chip" onClick={() => showRunDetail(run)}>
                审核说明
              </Text>
            ) : null}
            {run.csdnUrl ? (
              <Text className="link-chip" onClick={() => copyExternalLink(run.csdnUrl!)}>
                复制 CSDN 链接
              </Text>
            ) : null}
            {run.juejinUrl ? (
              <Text className="link-chip" onClick={() => copyExternalLink(run.juejinUrl!)}>
                复制掘金链接
              </Text>
            ) : null}
            <Text className="link-chip" onClick={() => showRunDetail(run)}>
              详情
            </Text>
          </View>
        </View>
      ))}
      {runsLoading && runs.length > 0 ? <Text className="data-state">加载中...</Text> : null}
    </View>
  )
}
