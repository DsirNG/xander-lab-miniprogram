import { View } from '@tarojs/components'
import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { useDrawerDrag } from '@/store/drawerDrag'

type MotionNode = {
  style: { setProperty: (name: string, value: string) => void; removeProperty: (name: string) => unknown }
  classList: { add: (name: string) => void; remove: (name: string) => void }
}

/** Drag updates write only two transform styles, without a React render per touch event. */
export function DrawerMotionView({ className = '', style, ...props }: ComponentProps<typeof View>) {
  const node = useRef<MotionNode | null>(null)
  useLayoutEffect(() => {
    let dragging = false
    const update = (offset: number | null) => {
      const element = node.current
      if (!element) return
      if (offset !== null) {
        if (!dragging) {
          element.classList.add('is-drawer-dragging')
          element.style.setProperty('transition', 'none')
        }
        element.style.setProperty('transform', `translate3d(${offset}px, 0, 0)`)
      } else if (dragging) {
        element.classList.remove('is-drawer-dragging')
        element.style.removeProperty('transition')
        element.style.removeProperty('transform')
      }
      dragging = offset !== null
    }
    update(useDrawerDrag.getState().offset)
    return useDrawerDrag.subscribe((state, previous) => {
      if (state.offset !== previous.offset) update(state.offset)
    })
  }, [className, style])
  return <View {...props} ref={element => { node.current = element as unknown as MotionNode }} className={className} style={style} />
}
