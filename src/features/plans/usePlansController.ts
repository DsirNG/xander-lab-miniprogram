import { t } from '@/i18n'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { planApi, type Plan } from '@/api/plans'
import { authApi } from '@/api/auth'
import { usePanelActive } from '@/hooks/usePanelActive'
import { useUserStore } from '@/store/user'
import type { PlanActionKey } from '@/components/PlanCard'

const PAGE_SIZE = 10
type RefreshSource = 'panel-active' | 'page-show' | 'tab-refresh'

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

export function usePlansController(active: boolean, pageShowCount = 0, refreshVersion = 0) {
  const user = useUserStore(state => state.user)
  const userLoaded = useUserStore(state => state.loaded)
  const hasSession = authApi.isLoggedIn()

  const [plans, setPlans] = useState<Plan[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const requestSequence = useRef(0)
  const handledPageShowRef = useRef(pageShowCount)
  const handledRefreshVersionRef = useRef(refreshVersion)

  const load = useCallback(async (targetPage: number, append: boolean) => {
    if (!authApi.isLoggedIn()) {
      setLoadedOnce(true)
      return
    }

    const requestId = ++requestSequence.current
    console.log('[PlansController] LOAD_START', {
      requestId,
      targetPage,
      append,
    })
    setLoading(true)
    try {
      const result = await planApi.list({ page: targetPage, size: PAGE_SIZE })
      if (requestId !== requestSequence.current) {
        console.log('[PlansController] LOAD_STALE', {
          requestId,
          latestRequestId: requestSequence.current,
        })
        return
      }
      console.log('[PlansController] LOAD_APPLY', {
        requestId,
        targetPage,
        records: result.records.length,
        total: result.total,
      })
      setPlans(previous => (append ? [...previous, ...result.records] : result.records))
      setTotal(result.total)
      setPage(targetPage)
    } catch (error) {
      if (requestId === requestSequence.current) {
        showToast(error instanceof Error ? error.message : t('ui.unableToLoadPlans'))
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false)
        setLoadedOnce(true)
      }
    }
  }, [])

  const refresh = useCallback(
    async (source: RefreshSource = 'panel-active') => {
      console.log('[PlansController] REFRESH', { source })
      try {
        if (!authApi.isLoggedIn()) {
          requestSequence.current += 1
          setPlans([])
          setTotal(0)
          setPage(1)
          setLoading(false)
          setLoadedOnce(true)
          return
        }

        // Re-fetch every page that the user has already opened so activation
        // refreshes data without resetting the cached page count or list shape.
        const requestId = ++requestSequence.current
        const pageCount = Math.max(page, 1)
        console.log('[PlansController] RELOAD_START', {
          requestId,
          pageCount,
        })
        setLoading(true)
        try {
          const results = await Promise.all(
            Array.from({ length: pageCount }, (_, index) =>
              planApi.list({ page: index + 1, size: PAGE_SIZE }),
            ),
          )
          if (requestId !== requestSequence.current) {
            console.log('[PlansController] RELOAD_STALE', {
              requestId,
              latestRequestId: requestSequence.current,
            })
            return
          }
          console.log('[PlansController] RELOAD_APPLY', {
            requestId,
            pageCount,
            records: results.reduce((count, result) => count + result.records.length, 0),
            total: results[results.length - 1]?.total ?? 0,
          })
          setPlans(results.flatMap(result => result.records))
          setTotal(results[results.length - 1]?.total ?? 0)
          setPage(pageCount)
        } finally {
          if (requestId === requestSequence.current) {
            setLoading(false)
            setLoadedOnce(true)
          }
        }
      } catch (error) {
        // Keep the page usable even when restoring the session fails.
        showToast(error instanceof Error ? error.message : t('ui.unableToLoadPlans'))
        setLoadedOnce(true)
        setLoading(false)
      }
    },
    [page],
  )

  usePanelActive(active, { onShow: refresh })

  useEffect(() => {
    if (refreshVersion === handledRefreshVersionRef.current) return
    if (!active) return

    handledRefreshVersionRef.current = refreshVersion
    void refresh('tab-refresh')
  }, [active, refresh, refreshVersion])

  useEffect(() => {
    if (pageShowCount === 0 || pageShowCount === handledPageShowRef.current) return

    handledPageShowRef.current = pageShowCount
    if (pageShowCount > 1 && active) void refresh('page-show')
  }, [active, pageShowCount, refresh])

  const loadMore = useCallback(() => {
    if (!active || loading || plans.length >= total) return
    void load(page + 1, true)
  }, [active, load, loading, page, plans.length, total])

  const runAction = useCallback(
    async (id: number, action: PlanActionKey) => {
      if (busyId !== null) return
      setBusyId(id)
      try {
        switch (action) {
          case 'pause':
            await planApi.updateStatus(id, 'PAUSED')
            showToast(t('ui.paused'))
            break
          case 'resume':
            await planApi.updateStatus(id, 'RESUME')
            showToast(t('ui.resumed'))
            break
          case 'cancel': {
            const confirmed = await Taro.showModal({
              title: t('ui.cancelPlan'),
              content: t('ui.thisPlanWillStopRunningCancelIt'),
              confirmColor: '#d14343',
            })
            if (!confirmed.confirm) return
            await planApi.updateStatus(id, 'CANCELLED')
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
            await planApi.delete(id)
            showToast(t('ui.deleted'))
            break
          }
          case 'trigger':
            await planApi.trigger(id)
            showToast(t('ui.runRequested'))
            break
        }
        await load(1, false)
      } catch (error) {
        showToast(error instanceof Error ? error.message : t('ui.operationFailed'))
      } finally {
        setBusyId(null)
      }
    },
    [busyId, load],
  )

  const openDetail = useCallback((id: number) => {
    void Taro.navigateTo({ url: `/pages/plan-detail/index?id=${id}` })
  }, [])

  return {
    user,
    userLoaded,
    hasSession,
    plans,
    total,
    loading,
    loadedOnce,
    busyId,
    loadMore,
    runAction,
    openDetail,
  }
}

export type PlansController = ReturnType<typeof usePlansController>
