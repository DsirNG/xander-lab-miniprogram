import { Canvas, Image, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { memo, useEffect, useRef, useState } from 'react'
import { iconRegistry } from './registry'
import { drawIcon, getCanvasRuntime } from './renderers/WeappCanvasRenderer'
import type { AnimatedIconName } from './types'
import './AnimatedIcon.scss'

const fallbackIcons: Record<AnimatedIconName, string> = {
  chat: require('@/assets/icons/chat.svg'),
  calendar: require('@/assets/icons/calendar.svg'),
  article: require('@/assets/icons/article.svg'),
  user: require('@/assets/icons/user.svg'),
}

let idSeed = 0

type AnimatedIconProps = {
  name: AnimatedIconName
  active: boolean
  className?: string
  size?: number
  activeColor?: string
}

function AnimatedIconBase({
  name,
  active,
  className = '',
  size = 21,
  activeColor = '#1d2129',
}: AnimatedIconProps) {
  const canvasIdRef = useRef(`animated-icon-${idSeed++}`)
  const runtimeRef = useRef<Awaited<ReturnType<typeof getCanvasRuntime>>>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef(active ? 1 : 0)
  const [canvasReady, setCanvasReady] = useState(false)
  const definition = iconRegistry[name]

  const render = (progress: number) => {
    const runtime = runtimeRef.current
    if (!runtime) return

    drawIcon(runtime, definition, progress, activeColor)
  }

  useEffect(() => {
    let cancelled = false

    getCanvasRuntime(canvasIdRef.current, size).then(runtime => {
      if (cancelled || !runtime) {
        console.warn('[AnimatedIcon] CANVAS_FALLBACK', {
          name,
          canvasId: canvasIdRef.current,
        })
        return
      }
      try {
        runtimeRef.current = runtime
        render(progressRef.current)
        setCanvasReady(true)
        console.log('[AnimatedIcon] CANVAS_READY', {
          name,
          canvasId: canvasIdRef.current,
          size: runtime.size,
          ratio: runtime.ratio,
        })
      } catch {
        runtimeRef.current = null
        console.warn('[AnimatedIcon] CANVAS_DRAW_FAILED', {
          name,
          canvasId: canvasIdRef.current,
        })
      }
    })

    return () => {
      cancelled = true
      runtimeRef.current = null
    }
  }, [name, size])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null

    if (!active) {
      progressRef.current = 0
      render(0)
      return
    }

    if (!runtimeRef.current) return

    const target = 1
    const start = progressRef.current
    const startedAt = Date.now()
    const duration = 2000

    console.log('[AnimatedIcon] ANIMATION_START', {
      name,
      active,
      from: start,
      to: target,
    })

    timerRef.current = setInterval(() => {
      const elapsed = Math.min(1, (Date.now() - startedAt) / duration)
      const eased = 1 - Math.pow(1 - elapsed, 3)
      const progress = start + (target - start) * eased
      progressRef.current = progress
      render(progress)

      if (elapsed >= 1) {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
      }
    }, 16)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
    // Canvas initialization is asynchronous in WeChat. Include its ready
    // state so a newly selected icon draws even if its canvas resolves later.
  }, [active, activeColor, canvasReady, definition])

  return (
    <View
      className={`animated-icon-wrap ${className} ${active ? 'animated-icon-wrap--active' : ''}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <Image
        className={`animated-icon ${canvasReady && active ? 'animated-icon--canvas-active' : ''}`}
        src={fallbackIcons[name]}
        mode="aspectFit"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
      <Canvas
        id={canvasIdRef.current}
        type="2d"
        className={`animated-icon__canvas ${canvasReady && active ? '' : 'animated-icon__canvas--hidden'}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    </View>
  )
}

// Same-tab refreshes update panel data but keep every icon's props unchanged.
// Memoizing the leaf prevents those parent renders from restarting or
// re-creating the icon subtree; changing active still runs the draw effect.
export const AnimatedIcon = memo(AnimatedIconBase)
