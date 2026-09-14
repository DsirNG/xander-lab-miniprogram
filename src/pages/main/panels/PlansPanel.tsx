import { ScrollView, View } from '@tarojs/components'
import { useEffect, useRef } from 'react'
import { PlansContent } from '@/features/plans/PlansContent'
import { usePlansController } from '@/features/plans/usePlansController'
import '@/features/plans/PlansContent.scss'

type PlansPanelProps = {
  active: boolean
  pageShowCount: number
}

/** Plans business content hosted inside the persistent MainShell. */
export function PlansPanel({ active, pageShowCount }: PlansPanelProps) {
  const controller = usePlansController(active, pageShowCount)
  const renderCountRef = useRef(0)
  renderCountRef.current += 1

  console.log('[PlansPanel] RENDER', {
    active,
    renderCount: renderCountRef.current,
  })

  useEffect(() => {
    console.log('[PlansPanel] MOUNT')

    return () => {
      console.log('[PlansPanel] UNMOUNT')
    }
  }, [])

  useEffect(() => {
    console.log('[PlansPanel] ACTIVE_CHANGE', { active })
  }, [active])

  return (
    <View
      className={`main-panel main-panel--calendar ${active ? 'is-active' : ''}`}
      hidden={!active}
    >
      <ScrollView
        scrollY
        className="main-panel__scroll"
        onScrollToLower={() => controller.loadMore()}
      >
        <PlansContent controller={controller} />
      </ScrollView>
    </View>
  )
}
