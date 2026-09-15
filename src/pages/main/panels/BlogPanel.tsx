import { ScrollView, View } from '@tarojs/components'
import { useEffect, useRef } from 'react'
import { BlogContent } from '@/features/blog/BlogContent'
import { useBlogController } from '@/features/blog/useBlogController'
import { useTabBarStore } from '@/store/tabBar'
import '@/features/blog/BlogContent.scss'

type BlogPanelProps = {
  active: boolean
  pageShowCount: number
  initialTag?: string
  refreshVersion?: number
}

/** Blog business content hosted inside the persistent MainShell. */
export function BlogPanel({
  active,
  pageShowCount,
  initialTag = '',
  refreshVersion = 0,
}: BlogPanelProps) {
  const controller = useBlogController(active, initialTag, pageShowCount, refreshVersion)
  const { selectTag } = controller
  const pendingBlogTag = useTabBarStore(state => state.pendingBlogTag)
  const clearPendingBlogTag = useTabBarStore(state => state.setPendingBlogTag)
  const renderCountRef = useRef(0)
  renderCountRef.current += 1

  console.log('[BlogPanel] RENDER', {
    active,
    renderCount: renderCountRef.current,
  })

  useEffect(() => {
    console.log('[BlogPanel] MOUNT')

    return () => {
      console.log('[BlogPanel] UNMOUNT')
    }
  }, [])

  useEffect(() => {
    console.log('[BlogPanel] ACTIVE_CHANGE', { active })
  }, [active])

  useEffect(() => {
    if (!active || !pendingBlogTag) return
    selectTag(pendingBlogTag)
    clearPendingBlogTag(null)
  }, [active, clearPendingBlogTag, pendingBlogTag, selectTag])

  return (
    <View
      className={`main-panel main-panel--article ${active ? 'is-active' : ''}`}
      hidden={!active}
    >
      <ScrollView
        scrollY
        className="main-panel__scroll"
        onScrollToLower={() => controller.loadMore()}
      >
        <BlogContent controller={controller} />
      </ScrollView>
    </View>
  )
}
