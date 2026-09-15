import { Text, View, type CommonEventFunction, type ITouchEvent } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { memo, useEffect, useRef, useState } from 'react'
import { navigateToTab, useTabBarStore } from '@/store/tabBar'
import { TAB_ITEMS } from '@/utils/tabBarRoute'
import { AnimatedIcon } from './AnimatedIcon'
import './TabBar.scss'

type TabBarBounds = {
  left: number
  width: number
}

type PressState = {
  index: number
  activeIndex: number
  startX: number
  startY: number
  didMove: boolean
}

const MOVE_CANCEL_DISTANCE = 4
const TAB_BAR_SIDE_INSET = 20
const TAB_BAR_PADDING = 6

function TabBarBase() {
  const active = useTabBarStore(state => state.active)
  const renderCountRef = useRef(0)
  const boundsRef = useRef<TabBarBounds | null>(null)
  const pressRef = useRef<PressState | null>(null)
  const suppressClickRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  renderCountRef.current += 1

  const measureBounds = () => {
    try {
      Taro.createSelectorQuery()
        .select('#tab-list')
        .boundingClientRect()
        .exec(result => {
          const rect = result?.[0] as { left?: number; width?: number } | undefined
          if (rect?.width) {
            boundsRef.current = {
              left: rect.left ?? 0,
              width: rect.width,
            }
          }
        })
    } catch {
      // Use the window estimate below when the selector query is unavailable.
    }

    if (boundsRef.current) return
    try {
      const info = Taro.getWindowInfo()
      const windowWidth = info.windowWidth || 375
      boundsRef.current = {
        left: TAB_BAR_SIDE_INSET + TAB_BAR_PADDING,
        width: Math.max(0, windowWidth - TAB_BAR_SIDE_INSET * 2 - TAB_BAR_PADDING * 2),
      }
    } catch {
      boundsRef.current = {
        left: TAB_BAR_SIDE_INSET + TAB_BAR_PADDING,
        width: 375 - TAB_BAR_SIDE_INSET * 2 - TAB_BAR_PADDING * 2,
      }
    }
  }

  const getOffsetFromX = (clientX: number) => {
    if (!boundsRef.current) measureBounds()
    const bounds = boundsRef.current
    if (!bounds?.width) return 0
    const ratio = (clientX - bounds.left) / bounds.width
    const offset = (ratio * TAB_ITEMS.length - 0.5) * 100
    return Math.max(0, Math.min((TAB_ITEMS.length - 1) * 100, offset))
  }

  const getIndexFromX = (clientX: number) => {
    const offset = getOffsetFromX(clientX)
    return Math.max(0, Math.min(TAB_ITEMS.length - 1, Math.floor((offset + 50) / 100)))
  }

  const getDragDeltaFromX = (clientX: number, press: PressState) => {
    if (!boundsRef.current) measureBounds()
    const bounds = boundsRef.current
    if (!bounds?.width) return 0

    const cellWidth = bounds.width / TAB_ITEMS.length
    const minCenter = cellWidth / 2
    const maxCenter = bounds.width - cellWidth / 2
    const center = Math.max(minCenter, Math.min(maxCenter, clientX - bounds.left))
    const targetOffset = center - cellWidth / 2
    const originOffset = press.activeIndex * cellWidth
    return targetOffset - originOffset
  }

  const getTouch = (event: ITouchEvent) => event.touches?.[0] ?? event.changedTouches?.[0]

  const handleTouchStart =
    (index: number): CommonEventFunction =>
    event => {
      const touch = getTouch(event as ITouchEvent)
      if (!touch) return

      measureBounds()
      pressRef.current = {
        index,
        activeIndex: safeActiveIndex,
        startX: touch.clientX,
        startY: touch.clientY,
        didMove: false,
      }
      // A tap keeps the capsule still. Expand it only after a drag is proven.
      setIsDragging(false)
      setDragOffset(null)
    }

  const handleTouchMove: CommonEventFunction = event => {
    const press = pressRef.current
    const touch = getTouch(event as ITouchEvent)
    if (!press || !touch) return

    const moved = Math.hypot(touch.clientX - press.startX, touch.clientY - press.startY)
    if (moved > MOVE_CANCEL_DISTANCE) {
      press.didMove = true
      setIsDragging(true)
    }

    if (press.didMove) setDragOffset(getDragDeltaFromX(touch.clientX, press))
  }

  const finishTouch = (event: ITouchEvent) => {
    const press = pressRef.current
    pressRef.current = null
    if (!press) return

    setIsDragging(false)
    setDragOffset(null)

    if (!press.didMove) return

    const touch = event.changedTouches?.[0] ?? event.touches?.[0]
    const index = touch ? getIndexFromX(touch.clientX) : press.index
    suppressClickRef.current = true
    setTimeout(() => {
      suppressClickRef.current = false
    }, 120)
    navigateToTab(TAB_ITEMS[index].key, 'medium')
  }

  const handleTouchEnd: CommonEventFunction = event => {
    finishTouch(event as ITouchEvent)
  }

  const handleTouchCancel: CommonEventFunction = event => {
    const didMove = pressRef.current?.didMove ?? false
    pressRef.current = null
    setIsDragging(false)
    setDragOffset(null)
    if (didMove) {
      suppressClickRef.current = true
      setTimeout(() => {
        suppressClickRef.current = false
      }, 120)
    }
    void event
  }

  const handleClick = (index: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    navigateToTab(TAB_ITEMS[index].key)
  }

  const activeIndex = TAB_ITEMS.findIndex(item => item.key === active)
  const safeActiveIndex = Math.max(activeIndex, 0)

  console.log('[TabBar] RENDER', {
    active,
    activeIndex: safeActiveIndex,
    renderCount: renderCountRef.current,
  })

  useEffect(() => {
    measureBounds()
    console.log('[TabBar] MOUNT', { active })

    return () => {
      console.log('[TabBar] UNMOUNT')
    }
  }, [])

  useEffect(() => {
    console.log('[TabBar] ACTIVE_CHANGE', {
      active,
      activeIndex: safeActiveIndex,
    })
  }, [active, safeActiveIndex])

  return (
    <View
      className={`tab-bar ${isDragging ? 'tab-bar--dragging' : ''}`}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <View className="tab-bar__glass" />
      <View id="tab-list" className="tab-list">
        <View
          className={`active-pill active-pill--${safeActiveIndex} ${
            isDragging ? 'active-pill--dragging' : ''
          }`}
          style={
            dragOffset === null
              ? undefined
              : {
                  transform: `translate3d(${dragOffset}px, 0, 0)`,
                }
          }
        />
        {TAB_ITEMS.map((item, index) => (
          <View
            className={`tab-item ${active === item.key ? 'active' : ''}`}
            key={item.key}
            onTouchStart={handleTouchStart(index)}
            onClick={() => handleClick(index)}
          >
            <AnimatedIcon
              key={item.key}
              name={item.icon}
              active={active === item.key}
              className="tab-icon"
            />
            <Text>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// The MainShell also re-renders when a same-tab refresh increments its data
// version. TabBar has no props, so skip that parent render entirely; its own
// Zustand subscription still re-renders it when the selected tab changes.
export const TabBar = memo(TabBarBase)
