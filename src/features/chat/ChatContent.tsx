import { useChatScroll } from '@/hooks/useChatScroll'
import { ReplyActions } from '@/pages/chat/components/ReplyActions'
import { showThemedActionSheet } from '@/utils/actionSheet'
import { NativeChatDrawer } from '@/components/NativeChatDrawer'
import { ChatKeyboardClearance } from '@/components/ChatKeyboardClearance'
import { useChatKeyboard } from '@/store/chatKeyboard'
import { ChatImage as GeneratedImage } from '@/pages/chat/components/ChatImage'
import { loadChatImage } from '@/utils/chatImageCache'
import { DrawerMotionView } from '@/components/DrawerMotionView'
import { useDrawerGesture } from '@/hooks/useDrawerGesture'
import { useDrawerDrag } from '@/store/drawerDrag'
import { Skeleton } from '@/components/Skeleton'
import { getSessionVersion, privateCacheKeys, writePrivateCache } from '@/utils/privateCache'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  agentApi,
  type AgentConversation,
  type AgentMessage,
  type AgentAttachment,
  type ConversationSnapshot,
} from '@/api/agent'
import type { AgentStreamEvent } from '@/api/agentSocket'
import { connectAgentReplay } from '@/api/agentReplay'
import { createStreamWatchdog } from '@/api/streamWatchdog'
import { API_ORIGIN, tokenStorage } from '@/api/http'
import { Markdown } from '@/components/Markdown'
import { NavBar } from '@/components/NavBar'
import { Icon } from '@/components/Icon'
import { usePanelActive } from '@/hooks/usePanelActive'
import { ensureLogin, useUserStore } from '@/store/user'
import { truncate } from '@/utils/markdown'
import { t, useLocale } from '@/i18n'
import { ChatComposer, type ComposerAttachmentItem } from '@/pages/chat/components/ChatComposer'
import { ChatDrawer } from '@/pages/chat/components/ChatDrawer'
import {
  absoluteMediaUrl,
  splitImageAnswer,
  sameImageResource,
  IMAGE_TOOL,
  isImageTool,
  parseImageToolResult as parseImageToolResultPayload,
  type ImageToolResult,
} from '@/pages/chat/imageMessage'
import './ChatContent.scss'

const ACTIVE_KEY = privateCacheKeys.activeChat

/**
 * 流式回答的合并提交间隔（毫秒）。这是"用户看到下一段文字"的节奏上限：
 * 100ms 在移动端阅读上已经足够连贯，同时把一次长回答的重渲染次数
 * 从 token 数量级降到时间窗数量级。
 */
const STREAM_FLUSH_INTERVAL = 100

const QUICK_PROMPTS = () => [
  t('ui.writeATechnicalBlogPost'),
  t('ui.researchAndOrganizeInformation'),
  t('ui.iHaveAQuestion'),
]
const CHAT_COPY = {
  get history() {
    return t('ui.recentConversations')
  },
  get inputPlaceholder() {
    return t('ui.askMeAnything')
  },
  get stop() {
    return t('ui.stop')
  },
} as const

type MessageTurn = {
  key: string
  id: string
  role: 'user' | 'assistant'
  messages: AgentMessage[]
  /**
   * 这一轮里已由图片工具产出的 URL 集合。
   *
   * <p>在分组时算一次并挂到 turn 上，而不是在渲染时每条消息现算：
   * 流式期间渲染会反复发生，逐条解析工具结果的 JSON 会变成可观的开销，
   * 而这份集合只随 messages 变化，天然适合跟着 useMemo 一起缓存。</p>
   */
  imageResultUrls: Set<string>
}

const EMPTY_MESSAGES: AgentMessage[] = []

type StreamToolState = {
  name: string
  message: string
  progress?: number
  estimated?: boolean
  saving?: boolean
}

type GeneratedImageResult = ImageToolResult & { preview?: boolean }

type ToolEventData = {
  tool?: string
  message?: string
  progress?: number
  estimated?: boolean
  stage?: string
  result?: { url?: string; title?: string }
}

function parseImageToolResult(message: AgentMessage): GeneratedImageResult | null {
  return parseImageToolResultPayload(message, API_ORIGIN)
}

function groupMessagesIntoTurns(messages: AgentMessage[]): MessageTurn[] {
  const turns = messages.reduce<MessageTurn[]>((accumulated, message) => {
    // 集合统一在最后填充；这里先占位，避免逐条消息新建临时 Set。
    const imageResultUrls = new Set<string>()
    if (message.role === 'user') {
      accumulated.push({
        key: `user-${message.id}`,
        id: `msg-${message.id}`,
        role: 'user',
        messages: [message],
        imageResultUrls,
      })
      return accumulated
    }

    const previous = accumulated[accumulated.length - 1]
    if (previous?.role === 'assistant') {
      previous.messages.push(message)
      previous.id = `msg-${message.id}`
      return accumulated
    }

    accumulated.push({
      key: `assistant-${message.id}`,
      id: `msg-${message.id}`,
      role: 'assistant',
      messages: [message],
      imageResultUrls,
    })
    return accumulated
  }, [])
  // 集合在这一轮消息全部归位后再算一次，结果挂到 turn 上供渲染直接取用。
  for (const turn of turns) {
    for (const message of turn.messages) {
      const result = parseImageToolResult(message)
      if (result) turn.imageResultUrls.add(result.url)
    }
  }
  return turns
}

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

export type ChatDrawerPhase = 'closed' | 'open' | 'closing'

type ChatContentProps = {
  panelActive: boolean
  onDrawerPhaseChange: (phase: ChatDrawerPhase) => void
  refreshVersion?: number
}

export function ChatContent({
  panelActive,
  refreshVersion = 0,
  onDrawerPhaseChange,
}: ChatContentProps) {
  useLocale()
  const user = useUserStore(state => state.user)
  const userLoaded = useUserStore(state => state.loaded)
  const refreshUser = useUserStore(state => state.refresh)

  const [loadingConversations, setLoadingConversations] = useState(() =>
    Boolean(tokenStorage.getAccessToken()),
  )
  const [loadingConversation, setLoadingConversation] = useState(() =>
    Boolean(tokenStorage.getAccessToken() && Taro.getStorageSync<number>(ACTIVE_KEY)),
  )
  const [conversations, setConversations] = useState<AgentConversation[]>([])
  const [active, setActive] = useState<ConversationSnapshot | null>(null)
  const [composerDraft, setComposerDraft] = useState({ value: '', revision: 0 })
  const replaceComposerDraft = (value: string) => {
    inputRef.current = value
    setComposerDraft(previous => ({ value, revision: previous.revision + 1 }))
  }
  const inputRef = useRef('')
  const [attachments, setAttachments] = useState<ComposerAttachmentItem[]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [running, setRunning] = useState(false)
  const [creating, setCreating] = useState(false)
  const [thoughtOpen, setThoughtOpen] = useState<Record<number, boolean>>({})
  const keyboardHeight = useChatKeyboard(state => state.height)
  const [drawerPhase, setDrawerPhase] = useState<ChatDrawerPhase>('closed')
  const updateDrawerPhase = useCallback(
    (phase: ChatDrawerPhase) => {
      drawerPhaseRef.current = phase
      setDrawerPhase(phase)
      onDrawerPhaseChange(phase)
    },
    [onDrawerPhaseChange],
  )
  const drawerPhaseRef = useRef(drawerPhase)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateKeyboardInset = useCallback(
    (height: number) => {
      if (panelActive && process.env.TARO_ENV === 'weapp') {
        useChatKeyboard.getState().setHeight(Number.isFinite(height) ? Math.max(0, height) : 0)
      }
    },
    [panelActive],
  )
  useEffect(() => {
    if (!panelActive || process.env.TARO_ENV !== 'weapp') {
      useChatKeyboard.getState().setHeight(0)
      return
    }
    const onHeight = ({ height }: { height: number }) => updateKeyboardInset(height)
    Taro.onKeyboardHeightChange?.(onHeight)
    return () => Taro.offKeyboardHeightChange?.(onHeight)
  }, [panelActive, updateKeyboardInset])

  // 主面板左缘圆角对齐屏幕物理圆角：取窗口安全区顶部高度注入 CSS 变量。
  const shellStyle = useMemo(() => {
    const fallback = 0
    let topRadius = fallback
    try {
      const { safeArea } = Taro.getWindowInfo()
      if (safeArea?.top != null) topRadius = safeArea.top
      console.log('topRadius', topRadius)
    } catch {
      /* 无兜底 */
    }
    return {
      '--chat-shell-top-radius': `${topRadius || 24}px`,
    } as any
  }, [])

  useEffect(() => {
    drawerPhaseRef.current = drawerPhase
  }, [drawerPhase])

  const openDrawer = useCallback(() => {
    if (drawerPhaseRef.current !== 'closed') return
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    updateDrawerPhase('open')
  }, [updateDrawerPhase])

  const closeDrawer = useCallback(() => {
    if (drawerPhaseRef.current !== 'open') return
    if (closeTimerRef.current) return
    updateDrawerPhase('closing')
    closeTimerRef.current = setTimeout(() => {
      updateDrawerPhase('closed')
      closeTimerRef.current = null
    }, 320)
  }, [updateDrawerPhase])

  useEffect(() => {
    if (panelActive) return
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    updateDrawerPhase('closed')
  }, [panelActive, updateDrawerPhase])

  const isNativeDrawer = process.env.TARO_ENV === 'weapp'
  const nativeSuppressUntil = useRef(0)
  const fallbackDrawerGesture = useDrawerGesture({
    phase: () => drawerPhaseRef.current,
    enabled: () => !isNativeDrawer && panelActive && useChatKeyboard.getState().height === 0,
    reveal: openDrawer,
    settle: open => (open ? openDrawer() : closeDrawer()),
  })

  const drawerGesture = isNativeDrawer
    ? {
        onTouchStart: () => undefined,
        onTouchMove: () => undefined,
        onTouchEnd: () => undefined,
        onTouchCancel: () => undefined,
        suppressClick: () => Date.now() < nativeSuppressUntil.current,
      }
    : fallbackDrawerGesture

  useEffect(() => {
    if (!panelActive) useDrawerDrag.getState().setOffset(null)
    return () => {
      useDrawerDrag.getState().setOffset(null)
    }
  }, [panelActive])

  const activeIdRef = useRef<number | null>(null)
  const closeStreamRef = useRef<(() => void) | null>(null)
  const streamRunRef = useRef<number | null>(null)
  const cancelStreamRef = useRef<(() => Promise<void>) | null>(null)
  const resumeRequestRef = useRef(0)
  const [streamAnswer, setStreamAnswer] = useState('')
  const [streamThought, setStreamThought] = useState('')
  const [streamTool, setStreamTool] = useState<StreamToolState | null>(null)
  const [streamImageResult, setStreamImageResult] = useState<GeneratedImageResult | null>(null)
  const handledRefreshVersionRef = useRef(refreshVersion)

  // 流式增量的合并缓冲：上游一个 token 一个事件，若每个事件都 setState，
  // 一次回答会触发上百次全量重渲染（历史消息 + Markdown 重解析 + 滚动）。
  // 这里先在 ref 里累积，由下面的定时器按固定间隔统一提交，
  // 把渲染次数从"token 数"压到"时间窗数"，文本本身不丢不乱序。
  const answerBufferRef = useRef('')
  const answerStartedRef = useRef(false)
  const answerFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushAnswerBuffer = useCallback(() => {
    if (answerFlushTimerRef.current) {
      clearTimeout(answerFlushTimerRef.current)
      answerFlushTimerRef.current = null
    }
    const buffered = answerBufferRef.current
    if (!buffered) return
    answerBufferRef.current = ''
    setStreamAnswer(prev => prev + buffered)
  }, [])

  const scheduleAnswerFlush = useCallback(() => {
    if (answerFlushTimerRef.current) return
    answerFlushTimerRef.current = setTimeout(() => {
      answerFlushTimerRef.current = null
      const buffered = answerBufferRef.current
      if (!buffered) return
      answerBufferRef.current = ''
      setStreamAnswer(prev => prev + buffered)
    }, STREAM_FLUSH_INTERVAL)
  }, [])

  const messages = active?.messages ?? EMPTY_MESSAGES
  const messageTurns = useMemo(() => groupMessagesIntoTurns(messages), [messages])
  const lastMessageId = messages[messages.length - 1]?.id

  /**
   * 折叠/展开思考过程。用 id 作为参数而不是为每条消息现造闭包，
   * 这样引用始终稳定，MessagePart 的 memo 才能在流式重渲染时真正生效。
   */
  const toggleThought = useCallback((messageId: number) => {
    setThoughtOpen(previous => ({
      ...previous,
      [messageId]: !previous[messageId],
    }))
  }, [])

  const closeStream = () => {
    cancelStreamRef.current = null
    streamRunRef.current = null
    closeStreamRef.current?.()
    closeStreamRef.current = null
  }

  const clearStreamState = () => {
    // 先清缓冲与计时器：否则上一轮残留的增量会拼到下一轮回答的开头。
    if (answerFlushTimerRef.current) {
      clearTimeout(answerFlushTimerRef.current)
      answerFlushTimerRef.current = null
    }
    answerBufferRef.current = ''
    answerStartedRef.current = false
    setStreamAnswer('')
    setStreamThought('')
    setStreamTool(null)
    setStreamImageResult(null)
  }

  const applyTerminalSnapshot = async (id: number, runVersion: number) => {
    try {
      const snapshot = await agentApi.getConversation(id)
      if (activeIdRef.current !== id || streamRunRef.current !== runVersion) return
      if (snapshot.conversation.status !== 'running') {
        const images = snapshot.messages.slice(-6).flatMap(message => {
          const image = parseImageToolResult(message)
          if (image) return [image.url]
          return splitImageAnswer(message.content || '').flatMap(part =>
            part.type === 'image' ? [part.url] : [],
          )
        })
        await Promise.allSettled([...new Set(images)].map(url => loadChatImage(url)))
        if (activeIdRef.current !== id || streamRunRef.current !== runVersion) return
      }
      setActive(snapshot)
      setRunning(snapshot.conversation.status === 'running')
      if (snapshot.conversation.status === 'running' && snapshot.conversation.runVersion) {
        openStream(id, snapshot.conversation.runVersion)
        return
      }
      closeStream()
      clearStreamState()
      if (snapshot.conversation.status === 'failed') {
        showToast(snapshot.conversation.errorMessage || t('ui.generationFailedTryAgain'))
      }
      void loadConversations()
    } catch (error) {
      if (activeIdRef.current !== id || streamRunRef.current !== runVersion) return
      closeStream()
      setRunning(false)
      showToast(error instanceof Error ? error.message : t('ui.unableToSyncConversation'))
    }
  }

  const handleStreamEvent = (id: number, runVersion: number, ev: AgentStreamEvent) => {
    if (activeIdRef.current !== id || streamRunRef.current !== runVersion) return

    if (ev.event === 'answer_delta') {
      // 累积到缓冲里，由定时器统一提交；不再每个 token 触发一次渲染。
      const delta = String(ev.data ?? '')
      if (!answerStartedRef.current) {
        answerStartedRef.current = true
        setStreamAnswer(delta)
      } else {
        answerBufferRef.current += delta
        scheduleAnswerFlush()
      }
    } else if (ev.event === 'answer') {
      // 全量正文到达：丢弃缓冲（它必然包含在正文里），避免重复拼接。
      if (answerFlushTimerRef.current) {
        clearTimeout(answerFlushTimerRef.current)
        answerFlushTimerRef.current = null
      }
      answerBufferRef.current = ''
      answerStartedRef.current = true
      setStreamAnswer(String(ev.data ?? ''))
    } else if (ev.event === 'thought') {
      setStreamThought(String(ev.data ?? ''))
    } else if (ev.event === 'tool_start') {
      const data = ev.data as ToolEventData | undefined
      const name = String(data?.tool ?? t('ui.internalTool'))
      setStreamTool({ name, message: '', ...(isImageTool(name) ? { progress: 0 } : {}) })
      if (isImageTool(name)) setStreamImageResult(null)
    } else if (ev.event === 'tool_progress') {
      const data = ev.data as ToolEventData | undefined
      setStreamTool(previous => ({
        name: String(data?.tool ?? previous?.name ?? t('ui.internalTool')),
        message: String(data?.message ?? previous?.message ?? ''),
        progress:
          typeof data?.progress === 'number' && Number.isFinite(data.progress)
            ? Math.max(previous?.progress ?? 0, Math.min(100, Math.round(data.progress)))
            : previous?.progress,
        estimated: data?.estimated ?? previous?.estimated,
        saving: previous?.saving || data?.stage === 'generated',
      }))
    } else if (ev.event === 'image_preview') {
      const data = ev.data as ToolEventData | undefined
      const url = data?.result?.url
      if (
        isImageTool(data?.tool) &&
        typeof url === 'string' &&
        /^data:image\/(?:png|jpeg|webp|gif);base64,/.test(url)
      ) {
        console.info('[Image] Preview received', { encodedLength: url.length })
        setStreamImageResult({ url, title: data?.result?.title, preview: true })
        setStreamTool(previous => (previous ? { ...previous, saving: true } : null))
      }
    } else if (ev.event === 'tool_end' || ev.event === 'tool_result') {
      const data = ev.data as ToolEventData | undefined
      const result = data?.result
      if (isImageTool(data?.tool) && result?.url) {
        setStreamImageResult({
          url: absoluteMediaUrl(result.url, API_ORIGIN),
          title: result.title,
        })
      }
      setStreamTool(null)
    } else if (ev.event === 'tool_error') {
      setStreamTool(null)
      setStreamImageResult(previous => (previous?.preview ? null : previous))
    } else if (
      ev.event === 'complete' ||
      ev.event === 'error' ||
      ev.event === 'approval_required'
    ) {
      // 终态到达前把缓冲里的正文补上，避免最后一小段文字只存在于缓冲里。
      flushAnswerBuffer()
      setRunning(false)
      setStreamTool(null)
      void applyTerminalSnapshot(id, runVersion)
    }
  }

  const openStream = (id: number, runVersion: number) => {
    closeStream()
    clearStreamState()
    streamRunRef.current = runVersion
    closeStreamRef.current = connectAgentReplay(id, runVersion, {
      onEvent: ev => handleStreamEvent(id, runVersion, ev),
    })
  }

  const startMessageStream = (
    id: number,
    content: string,
    selectedAttachments: AgentAttachment[],
  ) => {
    closeStream()
    clearStreamState()
    let version = 0
    let terminal = false
    let cancellationRequested = false
    cancelStreamRef.current = async () => {
      // A click before the acknowledgement must not cancel the previous ready turn.
      if (!version) {
        cancellationRequested = true
        return
      }
      await agentApi.cancel(id)
    }
    let attached = true
    // Keep the originating HTTP stream alive until the turn ends. Switching tabs
    // detaches this view; it must not cut off the Worker's active execution request.
    const close = () => {
      attached = false
      watchdog.stop()
    }
    const isCurrent = () =>
      attached && activeIdRef.current === id && closeStreamRef.current === close
    closeStreamRef.current = close
    let recovering = false
    const recover = async (error?: unknown) => {
      if (!isCurrent() || recovering) return
      recovering = true
      watchdog.stop()
      flushAnswerBuffer()
      try {
        // The POST may already be committed. Reconcile once and subscribe; never resend it.
        const snapshot = await agentApi.getConversation(id)
        if (!isCurrent()) return
        setActive(snapshot)
        if (snapshot.conversation.status === 'running' && snapshot.conversation.runVersion) {
          setRunning(true)
          openStream(id, snapshot.conversation.runVersion)
        } else {
          closeStream()
          clearStreamState()
          setRunning(false)
          if (snapshot.conversation.status === 'failed' || !version) {
            showToast(
              snapshot.conversation.errorMessage ||
                (error instanceof Error ? error.message : t('ui.messageCouldNotBeSent')),
            )
          }
        }
      } catch (failure) {
        if (!isCurrent()) return
        closeStream()
        setRunning(false)
        showToast(failure instanceof Error ? failure.message : t('ui.unableToSyncConversation'))
      }
    }
    const watchdog = createStreamWatchdog(() => {
      void recover()
    })
    const request = agentApi.sendMessageStream(id, content, selectedAttachments, ev => {
      if (isCurrent() && !recovering) watchdog.touch()
      if (ev.event === 'accepted' || ev.event === 'started') {
        const next = Number((ev.data as { runVersion?: number } | undefined)?.runVersion)
        if (Number.isSafeInteger(next) && next > 0) {
          version = next
          if (isCurrent()) streamRunRef.current = next
          if (cancellationRequested) {
            cancellationRequested = false
            void agentApi.cancel(id).catch(error => {
              if (isCurrent())
                showToast(error instanceof Error ? error.message : t('ui.unableToCancel'))
            })
          }
        }
      }
      if (!isCurrent()) return
      if (ev.event === 'complete' || ev.event === 'error' || ev.event === 'approval_required') {
        terminal = true
        watchdog.stop()
      }
      if (version) handleStreamEvent(id, version, ev)
    })
    void request.done.then(
      () => {
        watchdog.stop()
        if (!terminal) return recover()
      },
      error => {
        watchdog.stop()
        return recover(error)
      },
    )
  }

  /**
   * 恢复当前会话：进入页面 / 切 tab 回来 / 打开会话时统一走这里，
   * running 状态恢复 WebSocket 事件流。
   */
  const resumeActive = useCallback(() => {
    const savedId = activeIdRef.current ?? Taro.getStorageSync<number>(ACTIVE_KEY)
    if (!savedId || !tokenStorage.getAccessToken()) {
      setLoadingConversation(false)
      return Promise.resolve()
    }
    const requestId = ++resumeRequestRef.current
    if (activeIdRef.current == null) setLoadingConversation(true)
    console.log('[ChatContent] RESUME_START', { requestId, savedId })
    return agentApi
      .getConversation(savedId)
      .then(snapshot => {
        if (requestId !== resumeRequestRef.current) {
          console.log('[ChatContent] RESUME_STALE', {
            requestId,
            latestRequestId: resumeRequestRef.current,
          })
          return
        }
        if (activeIdRef.current != null && activeIdRef.current !== savedId) return
        console.log('[ChatContent] RESUME_APPLY', {
          requestId,
          savedId,
          status: snapshot.conversation.status,
        })
        activeIdRef.current = savedId
        setActive(snapshot)
        setRunning(snapshot.conversation.status === 'running')
        if (snapshot.conversation.status === 'running') {
          if (snapshot.conversation.runVersion)
            openStream(savedId, snapshot.conversation.runVersion)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (requestId === resumeRequestRef.current) setLoadingConversation(false)
      })
  }, [])

  useEffect(() => {
    return () => {
      resumeRequestRef.current += 1
      closeStream()
      // 卸载时清掉未提交的缓冲计时器，避免组件已销毁后仍触发 setState。
      if (answerFlushTimerRef.current) {
        clearTimeout(answerFlushTimerRef.current)
        answerFlushTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [hasMoreConversations, setHasMoreConversations] = useState(false)
  const conversationListRef = useRef({ page: 0, search: '', request: 0, loading: false })
  const loadConversations = useCallback(async (search = '', append = false) => {
    if (!tokenStorage.getAccessToken()) return
    try {
      const state = conversationListRef.current
      if (append && state.loading) return
      const requestId = ++state.request
      state.search = search
      const page = append ? state.page + 1 : 1
      state.loading = true
      setLoadingConversations(true)
      try {
        const result = await agentApi.listConversationPage(page, search)
        if (requestId !== state.request) return
        state.page = page
        setConversations(previous =>
          append
            ? [
                ...previous,
                ...result.items.filter(item => !previous.some(old => old.id === item.id)),
              ]
            : result.items,
        )
        setHasMoreConversations(result.hasMore)
      } finally {
        if (requestId === state.request) {
          state.loading = false
          setLoadingConversations(false)
        }
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('ui.unableToLoadConversations'))
    }
  }, [])

  usePanelActive(panelActive, {
    onShow: () => {
      if (!user) {
        refreshUser().catch(() => undefined)
      }
      if (tokenStorage.getAccessToken()) {
        loadConversations()
      }
      resumeActive()
    },
    onHide: () => {
      // tab 切换只触发 hide 不卸载页面：关闭事件流，回前台后重新读取快照并续接 WS。
      resumeRequestRef.current += 1
      closeStream()
      clearStreamState()
    },
  })

  useEffect(() => {
    if (refreshVersion === handledRefreshVersionRef.current) return
    if (!panelActive) return

    handledRefreshVersionRef.current = refreshVersion

    const refreshTasks: Promise<unknown>[] = [resumeActive()]
    if (tokenStorage.getAccessToken()) refreshTasks.push(loadConversations())

    void Promise.allSettled(refreshTasks)
  }, [loadConversations, panelActive, refreshVersion, resumeActive])

  const chatScroll = useChatScroll(
    active?.conversation.id,
    panelActive && !loadingConversation && Boolean(active),
    `${lastMessageId}:${messages.length}:${running}:${streamAnswer.length}:${streamThought.length}:${Boolean(streamTool)}:${streamImageResult?.url}`,
    keyboardHeight,
  )

  const openConversation = async (id: number) => {
    const session = getSessionVersion()
    const requestId = ++resumeRequestRef.current
    setLoadingConversation(true)
    try {
      const snapshot = await agentApi.getConversation(id)
      if (session !== getSessionVersion() || requestId !== resumeRequestRef.current) return
      closeStream()
      activeIdRef.current = id
      writePrivateCache(ACTIVE_KEY, id, session)
      setActive(snapshot)
      void agentApi
        .markRead(id)
        .then(updated => {
          setConversations(previous =>
            previous.map(item => (item.id === id ? { ...item, ...updated } : item)),
          )
        })
        .catch(() => undefined)
      clearStreamState()
      setRunning(snapshot.conversation.status === 'running')
      if (snapshot.conversation.status === 'running') {
        // 重新进入进行中的会话：恢复 WebSocket 事件流。
        if (snapshot.conversation.runVersion) openStream(id, snapshot.conversation.runVersion)
      }
    } catch (e) {
      if (requestId === resumeRequestRef.current)
        showToast(e instanceof Error ? e.message : t('ui.unableToLoadConversation'))
    } finally {
      if (requestId === resumeRequestRef.current) setLoadingConversation(false)
    }
  }

  const startNewChat = () => {
    resumeRequestRef.current += 1
    setLoadingConversation(false)
    closeStream()
    activeIdRef.current = null
    setActive(null)
    setRunning(false)
    replaceComposerDraft('')
    setAttachments([])
    setStreamAnswer('')
    setStreamThought('')
    setStreamTool(null)
    setStreamImageResult(null)
    Taro.removeStorageSync(ACTIVE_KEY)
    closeDrawer()
  }

  const handleComposerChange = useCallback((value: string) => {
    inputRef.current = value
  }, [])

  const handleAddAttachment = async () => {
    if (running || creating || uploadingAttachments) return
    const remaining = 5 - attachments.length
    if (remaining <= 0) {
      showToast(t('chat.attachmentLimit'))
      return
    }
    try {
      const action = await showThemedActionSheet({
        itemList: [t('chat.chooseImage'), t('chat.chooseFile')],
      })
      let selected: Array<{ path: string; size: number; name?: string; type?: string }> = []
      if (action.tapIndex === 0) {
        const result = await Taro.chooseImage({
          count: remaining,
          sizeType: ['compressed', 'original'],
        })
        selected = result.tempFiles.map((file, idx) => ({
          path: file.path,
          size: file.size,
          name: `image_${Date.now()}_${idx + 1}.jpg`,
          type: 'image/jpeg',
        }))
      } else {
        const result = await Taro.chooseMessageFile({ count: remaining, type: 'file' })
        selected = result.tempFiles.map(file => ({
          path: file.path,
          size: file.size,
          name: file.name,
          type: file.type === 'image' ? 'image/jpeg' : 'application/octet-stream',
        }))
      }
      const valid = selected.filter(file => file.size <= 20 * 1024 * 1024)
      if (valid.length !== selected.length) showToast(t('chat.attachmentTooLarge'))
      if (!valid.length) return

      // 1. 立即占位并显示本地预览和加载动画
      const placeholderItems: ComposerAttachmentItem[] = valid.map((file, idx) => ({
        id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        url: file.path,
        tempPath: file.path,
        name: file.name || 'file',
        contentType: file.type || 'image/jpeg',
        size: file.size,
        status: 'uploading',
      }))

      setAttachments(current => [...current, ...placeholderItems].slice(0, 5))
      setUploadingAttachments(true)

      // 2. 上传文件并替换对应占位项
      await Promise.all(
        placeholderItems.map(async item => {
          try {
            const uploaded = await agentApi.uploadAttachment(item.tempPath || item.url)
            setAttachments(current =>
              current.map(a =>
                a.id === item.id
                  ? {
                      ...a,
                      url: uploaded.url,
                      name: uploaded.name || a.name,
                      contentType: uploaded.contentType || a.contentType,
                      size: uploaded.size || a.size,
                      status: 'done',
                    }
                  : a,
              ),
            )
          } catch {
            setAttachments(current => current.filter(a => a.id !== item.id))
            showToast(t('chat.attachmentUploadFailed'))
          }
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message && !message.includes('cancel')) showToast(t('chat.attachmentUploadFailed'))
    } finally {
      setUploadingAttachments(false)
    }
  }

  const handleSend = async (forcedContent?: string) => {
    chatScroll.followLatest()
    const selectedAttachments: AgentAttachment[] = attachments
      .filter(item => item.status !== 'uploading' && item.status !== 'error')
      .map(({ id, status, tempPath, ...agentAttachment }) => agentAttachment)
    if (loadingConversation) return
    const rawContent = (forcedContent ?? inputRef.current).trim()
    if ((!rawContent && !selectedAttachments.length) || running || creating || uploadingAttachments)
      return
    const content = rawContent || t('chat.analyzeAttachments')
    if (!ensureLogin()) return
    const session = getSessionVersion()
    resumeRequestRef.current += 1

    const tempUser: AgentMessage = {
      id: -Date.now(),
      conversationId: active?.conversation.id ?? 0,
      role: 'user',
      kind: 'message',
      content,
      attachments: selectedAttachments,
      createdAt: new Date().toISOString(),
    }

    replaceComposerDraft('')
    setAttachments([])
    setRunning(true)

    let targetId: number
    try {
      if (!active || active.conversation.id === 0) {
        let createCancelled = false
        cancelStreamRef.current = async () => {
          createCancelled = true
        }
        setCreating(true)
        setActive({
          conversation: {
            id: 0,
            userId: 0,
            title: truncate(content, 24) || t('ui.agentConversation'),
            status: 'running',
            runVersion: 0,
            createdAt: tempUser.createdAt,
            updatedAt: tempUser.createdAt,
          },
          messages: [tempUser],
        })
        const snapshot = await agentApi.createConversation(content)
        if (session !== getSessionVersion()) return
        targetId = snapshot.conversation.id
        activeIdRef.current = targetId
        writePrivateCache(ACTIVE_KEY, targetId, session)
        setActive({
          conversation: snapshot.conversation,
          messages: [...snapshot.messages, { ...tempUser, conversationId: targetId }],
        })
        setCreating(false)
        if (createCancelled) {
          cancelStreamRef.current = null
          setRunning(false)
          return
        }
      } else {
        targetId = active.conversation.id
        activeIdRef.current = targetId
        setActive(prev => (prev ? { ...prev, messages: [...prev.messages, tempUser] } : prev))
        writePrivateCache(ACTIVE_KEY, targetId, session)
      }
      startMessageStream(targetId, content, selectedAttachments)
    } catch (e) {
      cancelStreamRef.current = null
      setCreating(false)
      setRunning(false)
      showToast(e instanceof Error ? e.message : t('ui.messageCouldNotBeSentTryAgain'))
    }
  }

  const handleCancel = async () => {
    if (!active && !creating && !running) return
    const currentCancel = cancelStreamRef.current
    const currentId = activeIdRef.current ?? active?.conversation.id ?? 0
    flushAnswerBuffer()
    setCreating(false)
    setRunning(false)
    setStreamTool(null)
    try {
      if (currentCancel) {
        await currentCancel()
      } else if (currentId > 0) {
        await agentApi.cancel(currentId)
      }
      showToast(t('ui.stopRequested'))
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('ui.unableToCancel'))
    }
  }

  const chatSurface = (
    <DrawerMotionView
      className={`chat-main-shell ${
        drawerPhase === 'open'
          ? 'is-drawer-open'
          : drawerPhase === 'closing'
            ? 'is-drawer-closing'
            : ''
      }`}
      style={shellStyle}
      onTouchStart={drawerGesture.onTouchStart}
      onTouchMove={drawerGesture.onTouchMove}
      onTouchEnd={drawerGesture.onTouchEnd}
      onTouchCancel={drawerGesture.onTouchCancel}
    >
      <NavBar
        title={active ? active.conversation.title || t('ui.agentConversation') : 'DinQor'}
        left={
          <View
            className="chat-history-trigger chat-history-trigger-left"
            role="button"
            ariaRole="button"
            ariaLabel={CHAT_COPY.history}
            onClick={() => openDrawer()}
          >
            <Icon name="more" />
          </View>
        }
      />
      {loadingConversation ? (
        <ScrollView scrollY className="chat-messages">
          <View className="chat-messages-inner">
            <Skeleton layout="messages" />
          </View>
        </ScrollView>
      ) : active ? (
        <ScrollView
          id="chat-message-viewport"
          scrollY
          className="chat-messages"
          scrollTop={chatScroll.scrollTop}
          scrollIntoView={chatScroll.scrollTarget}
          onScroll={chatScroll.onScroll}
          onScrollToLower={chatScroll.onScrollToLower}
          onTouchStart={chatScroll.onTouchStart}
          onTouchEnd={chatScroll.onTouchEnd}
          onTouchCancel={chatScroll.onTouchEnd}
          lowerThreshold={48}
        >
          <View id="chat-message-content" className="chat-messages-inner">
            <View className="chat-turn-list">
              {messageTurns.map(turn => (
                <View id={turn.id} className={`chat-turn ${turn.role}`} key={turn.key}>
                  {turn.messages.map(message => (
                    <MessagePart
                      key={message.id}
                      message={message}
                      imageResultUrls={turn.imageResultUrls}
                      open={Boolean(thoughtOpen[message.id])}
                      onToggleThought={toggleThought}
                      onLayout={chatScroll.scrollToBottom}
                    />
                  ))}
                </View>
              ))}
              {streamTool ||
              streamImageResult ||
              streamThought ||
              streamAnswer ||
              running ||
              creating ? (
                <View className="chat-turn assistant is-streaming" role="status">
                  {streamTool?.name === IMAGE_TOOL ? (
                    <ImageGenerationPanel tool={streamTool} showPlaceholder={!streamImageResult} />
                  ) : streamTool ? (
                    <View className="msg-tool">
                      <View className="msg-tool-dot" />
                      <Text>
                        {t('ui.usingTool')}
                        {streamTool.name}
                      </Text>
                    </View>
                  ) : null}
                  {streamImageResult ? (
                    <GeneratedImage
                      result={streamImageResult}
                      onLayout={chatScroll.scrollToBottom}
                    />
                  ) : null}
                  {streamThought ? (
                    <View className="msg-thought">
                      <Text className="msg-thought-title">{t('ui.thinking')}</Text>
                      <Text>{truncate(streamThought, 120)}</Text>
                    </View>
                  ) : null}
                  {streamAnswer && !streamAnswer.includes(streamImageResult?.url || '\u0000') ? (
                    <View className="msg-answer stream">
                      <Markdown content={streamAnswer} />
                      <Text className="msg-stream-cursor">▍</Text>
                    </View>
                  ) : null}
                  {(running || creating) &&
                  !streamAnswer &&
                  !streamImageResult &&
                  streamTool?.name !== IMAGE_TOOL ? (
                    <View className="chat-typing">
                      <View className="dot" />
                      <View className="dot" />
                      <View className="dot" />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View className="chat-scroll-sentinels">
              <View id="chat-scroll-bottom-a" className="chat-scroll-sentinel" />
              <View id="chat-scroll-bottom-b" className="chat-scroll-sentinel" />
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView scrollY enableBackToTop className="chat-messages chat-messages--home">
          <View className="chat-home-empty">
            <Text className="chat-home-title">{t('ui.whereShallWeStart')}</Text>
            <View className="chat-home-quick-list">
              {QUICK_PROMPTS().map(prompt => (
                <View
                  key={prompt}
                  className="chat-home-quick"
                  role="button"
                  ariaRole="button"
                  ariaLabel={prompt}
                  onClick={() => {
                    replaceComposerDraft(prompt)
                  }}
                >
                  <Text>{prompt}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
      <ChatComposer
        value={composerDraft.value}
        draftRevision={composerDraft.revision}
        placeholder={CHAT_COPY.inputPlaceholder}
        sendLabel={CHAT_COPY.inputPlaceholder}
        stopLabel={CHAT_COPY.stop}
        running={running}
        creating={creating}
        attachments={attachments}
        uploading={uploadingAttachments}
        onChange={handleComposerChange}
        onAddAttachment={handleAddAttachment}
        onRemoveAttachment={idOrUrl =>
          setAttachments(current =>
            current.filter(item => (item.id ? item.id !== idOrUrl : item.url !== idOrUrl)),
          )
        }
        onSubmit={content => handleSend(content)}
        onStop={handleCancel}
        onKeyboardHeightChange={updateKeyboardInset}
        onLayoutChange={chatScroll.scrollToBottom}
      />
      <ChatKeyboardClearance />
      <View
        className={`chat-drawer-dismiss ${drawerPhase !== 'closed' ? 'show' : ''}`}
        role="button"
        ariaRole="button"
        ariaLabel={CHAT_COPY.history}
        onClick={event => {
          event.stopPropagation()
          if (!drawerGesture.suppressClick()) closeDrawer()
        }}
      />
    </DrawerMotionView>
  )
  const sidebar = (
    <ChatDrawer
      visible={drawerPhase !== 'closed'}
      closing={drawerPhase === 'closing'}
      onClose={closeDrawer}
      gesture={drawerGesture}
      conversations={conversations}
      loadingConversations={loadingConversations}
      hasMore={hasMoreConversations}
      onSearch={search => void loadConversations(search)}
      onLoadMore={() => void loadConversations(conversationListRef.current.search, true)}
      onPinned={updated =>
        setConversations(previous =>
          previous
            .map(item => (item.id === updated.id ? updated : item))
            .sort(
              (a, b) =>
                Number(b.isPinned || 0) - Number(a.isPinned || 0) ||
                b.updatedAt.localeCompare(a.updatedAt) ||
                b.id - a.id,
            ),
        )
      }
      loadingUser={!user && !userLoaded && Boolean(tokenStorage.getAccessToken())}
      activeId={activeIdRef.current}
      onSelect={openConversation}
      onNewChat={startNewChat}
      user={user}
    />
  )

  return (
    <View className={`chat-page ${isNativeDrawer ? 'chat-page--native-drawer' : ''}`}>
      {isNativeDrawer ? (
        <NativeChatDrawer
          open={drawerPhase === 'open'}
          active={panelActive}
          sidebar={sidebar}
          onReveal={openDrawer}
          onSettle={open => (open ? openDrawer() : closeDrawer())}
          onDrag={() => {
            nativeSuppressUntil.current = Date.now() + 350
          }}
        >
          {chatSurface}
        </NativeChatDrawer>
      ) : (
        <>
          {chatSurface}
          {sidebar}
        </>
      )}
    </View>
  )
}

/**
 * 一条消息的渲染单元。
 *
 * <p>用 memo 包住是关键：流式回答期间父组件会按时间窗重渲染，
 * 若这里不 memo，每一条历史消息（以及它们的 Markdown 解析）
 * 都会被重新计算一遍。props 全部是原始值或在父层稳定下来的引用，
 * 因此浅比较足以挡住与历史消息无关的重渲染。</p>
 */
const MessagePart = memo(function MessagePart({
  message,
  imageResultUrls,
  open,
  onToggleThought,
  onLayout,
}: {
  message: AgentMessage
  imageResultUrls: Set<string>
  open: boolean
  /** 收 id 而不是闭包：父层因此能用同一个 useCallback 实例，memo 才挡得住。 */
  onToggleThought: (messageId: number) => void
  onLayout: () => void
}) {
  useLocale()
  const toggle = useCallback(() => onToggleThought(message.id), [onToggleThought, message.id])

  if (message.role === 'user' && message.kind === 'message') {
    return (
      <View className="msg-bubble user">
        {message.attachments?.length ? (
          <View className="msg-user-attachments">
            {message.attachments.map(attachment =>
              attachment.contentType.startsWith('image/') ? (
                <Image
                  key={attachment.url}
                  className="msg-user-attachment-image"
                  src={absoluteMediaUrl(attachment.url, API_ORIGIN)}
                  mode="aspectFill"
                />
              ) : (
                <View key={attachment.url} className="msg-user-file">
                  <Icon name="article" />
                  <Text>{attachment.name}</Text>
                </View>
              ),
            )}
          </View>
        ) : null}
        <Text>{message.content}</Text>
      </View>
    )
  }
  if (message.kind === 'thought') {
    return (
      <View
        className="msg-thought"
        role="button"
        ariaRole="button"
        ariaLabel={t('ui.thinking')}
        onClick={toggle}
      >
        <Text className="msg-thought-title">{t('ui.thinking')}</Text>
        <Text>{open ? message.content : truncate(message.content, 120)}</Text>
      </View>
    )
  }
  if (message.kind === 'tool_call') {
    if (isImageTool(message.toolName)) return null
    return (
      <View className="msg-tool">
        <View className="msg-tool-dot" />
        <Text>
          {t('ui.usingTool')}
          {message.toolName || t('ui.internalTool')}
        </Text>
      </View>
    )
  }
  if (message.kind === 'tool_result') {
    const result = parseImageToolResult(message)
    if (result) return <GeneratedImage result={result} onLayout={onLayout} />
    return (
      <View className="msg-tool is-complete">
        <Text>{t('ui.toolCompleted')}</Text>
      </View>
    )
  }
  const parts = splitImageAnswer(message.content || t('ui.emptyResponse'))
  return (
    <>
      {parts.map((part, index) =>
        part.type === 'image' ? (
          [...imageResultUrls].some(url => sameImageResource(url, part.url)) ? null : (
            <GeneratedImage
              key={`${message.id}-${index}`}
              onLayout={onLayout}
              result={{ url: part.url, title: part.title }}
            />
          )
        ) : part.content.trim() ? (
          <View className="msg-answer" key={`${message.id}-${index}`}>
            <Markdown content={part.content} />
          </View>
        ) : null,
      )}
      {message.role === 'assistant' && message.kind === 'answer' && message.content.trim() ? (
        <ReplyActions message={message} />
      ) : null}
    </>
  )
})

function ImageGenerationPanel({
  tool,
  showPlaceholder,
}: {
  tool: StreamToolState
  showPlaceholder: boolean
}) {
  useLocale()
  return (
    <View className="msg-image-generating">
      <View className="msg-image-pattern" />
      <View className="msg-image-generating-title">
        <Text className="msg-image-sparkle">✦</Text>
        <Text>
          {tool.saving ? t('chat.savingGeneratedImage') : tool.message || t('chat.generatingImage')}
        </Text>
        <View className="msg-image-generating-dots">
          <View className="dot" />
          <View className="dot" />
          <View className="dot" />
        </View>
      </View>
      {showPlaceholder && (
        <View className="msg-image-placeholder">
          <View className="msg-image-placeholder-frame" />
          <Text className="msg-image-placeholder-sparkle">✦</Text>
        </View>
      )}
      {tool.progress != null && <Text className="msg-image-progress">{tool.progress}%</Text>}
    </View>
  )
}
