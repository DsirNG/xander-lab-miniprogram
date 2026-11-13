import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'

export function createScrollFollow() {
  let following = true
  let previousTop = 0
  return {
    get following() {
      return following
    },
    reset() {
      following = true
      previousTop = 0
    },
    observe(top: number, height: number, viewport: number, userGesture: boolean) {
      if (userGesture && top < previousTop - 2) following = false
      if (viewport > 0 && height - top - viewport <= 48) following = true
      previousTop = top
    },
  }
}

/** Wait for the native view commit before scrolling; respect deliberate history reading. */
export function useChatScroll(
  conversationId: number | undefined,
  ready: boolean,
  revision: string,
  keyboard: number,
) {
  const follow = useRef(createScrollFollow())
  const viewport = useRef(0)
  const gestureUntil = useRef(0)
  const alive = useRef(true)
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollTarget, setScrollTarget] = useState('')
  const scrollToBottom = useCallback(() => {
    if (!follow.current.following) return
    Taro.nextTick(() => {
      if (!alive.current || !follow.current.following) return
      const query = Taro.createSelectorQuery()
      query.select('#chat-message-viewport').boundingClientRect()
      query.select('#chat-message-content').boundingClientRect()
      query.exec(rects => {
        if (!alive.current || !follow.current.following) return
        const view = rects?.[0]
        const content = rects?.[1]
        if (!view?.height || !content) return
        viewport.current = view.height
        setScrollTop(
          previous => Math.max(0, content.height - view.height) + (previous % 1 === 0 ? 0.5 : 0),
        )
        setScrollTarget(previous =>
          previous === 'chat-scroll-bottom-a' ? 'chat-scroll-bottom-b' : 'chat-scroll-bottom-a',
        )
      })
    })
  }, [])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    follow.current.reset()
  }, [conversationId])
  useEffect(() => {
    if (!ready) return
    const first = setTimeout(scrollToBottom, 60)
    const settled = setTimeout(scrollToBottom, 280)
    return () => {
      clearTimeout(first)
      clearTimeout(settled)
    }
  }, [conversationId, ready, revision, keyboard, scrollToBottom])
  return {
    scrollTop,
    scrollTarget,
    scrollToBottom,
    followLatest() {
      follow.current.reset()
      scrollToBottom()
    },
    onTouchStart() {
      gestureUntil.current = Date.now() + 60_000
    },
    onTouchEnd() {
      gestureUntil.current = Date.now() + 600
    },
    onScroll(event: { detail: { scrollTop: number; scrollHeight: number } }) {
      follow.current.observe(
        event.detail.scrollTop,
        event.detail.scrollHeight,
        viewport.current,
        Date.now() < gestureUntil.current,
      )
    },
    onScrollToLower() {
      follow.current.reset()
    },
  }
}
