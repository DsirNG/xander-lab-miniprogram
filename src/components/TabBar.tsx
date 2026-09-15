import { Text, View, type CommonEventFunction, type ITouchEvent } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
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
  startX: number
  startY: number
  didMove: boolean
}

const MOVE_CANCEL_DISTANCE = 8

export function TabBar() {
  const active = useTabBarStore(state => state.active)
  const renderCountRef = useRef(0)
  const boundsRef = useRef<TabBarBounds | null>(null)
  const pressRef = useRef<PressState | null>(null)
  const suppressClickRef = useRef(false)
  const [isPressed, setIsPressed] = useState(false)
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
      // Fall through to the window-based estimate below.
    }

    if (boundsRef.current) return
    try {
      const info = Taro.getWindowInfo()
      const windowWidth = info.windowWidth || 375
      boundsRef.current = {
        left: 22,
        width: Math.max(0, windowWidth - 44),
      }
    } catch {
      boundsRef.current = { left: 22, width: 331 }
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

  const getTouch = (event: ITouchEvent) => event.touches?.[0] ?? event.changedTouches?.[0]

  const handleTouchStart =
    (index: number): CommonEventFunction =>
    event => {
      const touch = getTouch(event as ITouchEvent)
      if (!touch) return

      measureBounds()
      pressRef.current = {
        index,
        startX: touch.clientX,
        startY: touch.clientY,
        didMove: false,
      }
      setIsPressed(true)
      setIsDragging(false)
      // 普通点击只触发按压放大；未确认拖动前不要预先移动胶囊。
      // 这样松手后的 click 才能保留完整的旧位置 → 新位置过渡。
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
    setDragOffset(getOffsetFromX(touch.clientX))
  }

  const finishTouch = (event: ITouchEvent) => {
    const press = pressRef.current
    pressRef.current = null
    if (!press) return

    setIsPressed(false)
    setIsDragging(false)
    setDragOffset(null)

    if (press.didMove) {
      const touch = event.changedTouches?.[0] ?? event.touches?.[0]
      const index = touch ? getIndexFromX(touch.clientX) : press.index
      suppressClickRef.current = true
      setTimeout(() => {
        suppressClickRef.current = false
      }, 120)
      navigateToTab(TAB_ITEMS[index].key, 'medium')
      return
    }
  }

  const handleTouchEnd: CommonEventFunction = event => {
    finishTouch(event as ITouchEvent)
  }

  const handleTouchCancel: CommonEventFunction = event => {
    const didMove = pressRef.current?.didMove ?? false
    pressRef.current = null
    setDragOffset(null)
    setIsPressed(false)
    setIsDragging(false)
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
      className={`tab-bar ${isPressed ? 'tab-bar--pressed' : ''} ${
        isDragging ? 'tab-bar--dragging' : ''
      }`}
    >
      <View className="tab-bar__glass" />
      <View id="tab-list" className="tab-list">
        <View
          className={`active-pill active-pill--${safeActiveIndex} ${
            isPressed ? 'active-pill--dragging' : ''
          }`}
          style={
            dragOffset === null
              ? undefined
              : {
                  transform: `translate3d(${dragOffset}%, 0, 0) scale(1.28)`,
                }
          }
        />
        {TAB_ITEMS.map((item, index) => (
          <View
            className={`tab-item ${active === item.key ? 'active' : ''}`}
            key={item.key}
            hoverClass="tab-item--pressed"
            onTouchStart={handleTouchStart(index)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onClick={() => handleClick(index)}
          >
            <AnimatedIcon name={item.icon} active={active === item.key} className="tab-icon" />
            <Text>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
