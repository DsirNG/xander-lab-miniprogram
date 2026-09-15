import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { planApi, type Plan } from '@/api/plans'
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
  const refreshUser = useUserStore(state => state.refresh)

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
    if (!useUserStore.getState().user) {
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
        showToast(error instanceof Error ? error.message : '计划列表加载失败')
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
        if (!useUserStore.getState().loaded) await refreshUser()
        if (!useUserStore.getState().user) {
          requestSequence.current += 1
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
        showToast(error instanceof Error ? error.message : '计划列表加载失败')
        setLoadedOnce(true)
        setLoading(false)
      }
    },
    [page, refreshUser],
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
          case 'trigger':
            await planApi.trigger(id)
            showToast('已触发执行')
            break
        }
        await load(1, false)
      } catch (error) {
        showToast(error instanceof Error ? error.message : '操作失败')
      } finally {
        setBusyId(null)
      }
    },
    [busyId, load],
  )

  const openDetail = useCallback((id: number) => {
    void Taro.navigateTo({ url: `/pages/plan-detail/index?id=${id}` })
  }, [])

  const openCreate = useCallback(() => {
    void Taro.navigateTo({ url: '/pages/plan-create/index' })
  }, [])

  return {
    user,
    userLoaded,
    plans,
    total,
    loading,
    loadedOnce,
    busyId,
    loadMore,
    runAction,
    openDetail,
    openCreate,
  }
}

export type PlansController = ReturnType<typeof usePlansController>
