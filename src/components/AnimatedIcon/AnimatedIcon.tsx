import { Canvas, Image, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
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
  inactiveColor?: string
}

export function AnimatedIcon({
  name,
  active,
  className = '',
  size = 21,
  activeColor = '#1677ff',
  inactiveColor = '#86909c',
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

    drawIcon(runtime, definition, progress, inactiveColor, activeColor)
  }

  useEffect(() => {
    let cancelled = false

    getCanvasRuntime(canvasIdRef.current, size).then(runtime => {
      if (cancelled || !runtime) return
      try {
        runtimeRef.current = runtime
        render(progressRef.current)
        setCanvasReady(true)
      } catch {
        runtimeRef.current = null
      }
    })

    return () => {
      cancelled = true
      runtimeRef.current = null
    }
  }, [name, size])

  useEffect(() => {
    if (!runtimeRef.current) return

    if (timerRef.current) clearInterval(timerRef.current)

    const target = active ? 1 : 0
    const start = progressRef.current
    const startedAt = Date.now()
    const duration = 180

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
  }, [active, activeColor, inactiveColor, definition])

  return (
    <View
      className={`animated-icon-wrap ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <Image
        className={`animated-icon ${canvasReady ? 'animated-icon--canvas-ready' : ''}`}
        src={fallbackIcons[name]}
        mode="aspectFit"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
      <Canvas
        id={canvasIdRef.current}
        type="2d"
        className={`animated-icon__canvas ${canvasReady ? '' : 'animated-icon__canvas--hidden'}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    </View>
  )
}
