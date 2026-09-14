import {
  Image,
  ScrollView,
  Text,
  View,
  type CommonEventFunction,
  type ITouchEvent,
} from '@tarojs/components'
import Taro from '@tarojs/taro'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  agentApi,
  type AgentConversation,
  type AgentMessage,
  type AgentAttachment,
  type ConversationSnapshot,
} from '@/api/agent'
import { connectAgentStream } from '@/api/agentSocket'
import { API_ORIGIN, tokenStorage } from '@/api/http'
import { Markdown } from '@/components/Markdown'
import { NavBar } from '@/components/NavBar'
import { Icon } from '@/components/Icon'
import { usePanelActive } from '@/hooks/usePanelActive'
import { ensureLogin, useUserStore } from '@/store/user'
import { truncate } from '@/utils/markdown'
import { t } from '@/i18n'
import { getTabKeyByPath, type TabKey } from '@/utils/tabBarRoute'
import { ChatComposer } from '@/pages/chat/components/ChatComposer'
import { ChatDrawer } from '@/pages/chat/components/ChatDrawer'
import {
  absoluteMediaUrl,
  IMAGE_TOOL,
  isImageTool,
  parseImageToolResult as parseImageToolResultPayload,
  type ImageToolResult,
} from '@/pages/chat/imageMessage'
import './ChatContent.scss'

const ACTIVE_KEY = 'chat_active_id'

/**
 * 流式回答的合并提交间隔（毫秒）。这是"用户看到下一段文字"的节奏上限：
 * 100ms 在移动端阅读上已经足够连贯，同时把一次长回答的重渲染次数
 * 从 token 数量级降到时间窗数量级。
 */
const STREAM_FLUSH_INTERVAL = 100

const QUICK_PROMPTS = ['写一篇技术博客', '搜索并整理资料', '我有一个问题']
const CHAT_COPY = {
  history: '最近对话',
  inputPlaceholder: '有什么问题，随时问我...',
  stop: '停止',
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
}

type GeneratedImageResult = ImageToolResult

type ToolEventData = {
  tool?: string
  message?: string
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

type ChatContentProps = {
  panelActive: boolean
  onMainTabNavigate?: (tab: TabKey) => void
}

export function ChatContent({ panelActive, onMainTabNavigate }: ChatContentProps) {
  const user = useUserStore(state => state.user)
  const refreshUser = useUserStore(state => state.refresh)

  const [conversations, setConversations] = useState<AgentConversation[]>([])
  const [active, setActive] = useState<ConversationSnapshot | null>(null)
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<AgentAttachment[]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [running, setRunning] = useState(false)
  const [creating, setCreating] = useState(false)
  const [thoughtOpen, setThoughtOpen] = useState<Record<number, boolean>>({})
  const [scrollTarget, setScrollTarget] = useState('')
  const [drawerPhase, setDrawerPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const drawerPhaseRef = useRef(drawerPhase)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    return { '--chat-shell-top-radius': `${topRadius}px` } as any
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
    setDrawerPhase('open')
  }, [])

  const closeDrawer = useCallback(() => {
    if (drawerPhaseRef.current !== 'open') return
    if (closeTimerRef.current) return
    setDrawerPhase('closing')
    closeTimerRef.current = setTimeout(() => {
      setDrawerPhase('closed')
      closeTimerRef.current = null
    }, 420)
  }, [])

  // 左右滑动手势：右滑打开抽屉，左滑关闭。水平位移占优且超过阈值才算。
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const SWIPE_THRESHOLD = 60

  const onShellTouchStart: CommonEventFunction = useCallback(e => {
    const touch = (e as ITouchEvent).touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const onShellTouchEnd: CommonEventFunction = useCallback(
    e => {
      const start = touchStartRef.current
      touchStartRef.current = null
      if (!start) return
      const end = (e as ITouchEvent).changedTouches[0]
      if (!end) return
      const dx = end.clientX - start.x
      const dy = end.clientY - start.y
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy) * 1.2) return
      if (dx > 0) {
        openDrawer()
      } else {
        closeDrawer()
      }
    },
    [openDrawer, closeDrawer],
  )

  const activeIdRef = useRef<number | null>(null)
  const closeStreamRef = useRef<(() => void) | null>(null)
  const streamRunRef = useRef<number | null>(null)
  const resumeRequestRef = useRef(0)
  const [streamAnswer, setStreamAnswer] = useState('')
  const [streamThought, setStreamThought] = useState('')
  const [streamTool, setStreamTool] = useState<StreamToolState | null>(null)
  const [streamImageResult, setStreamImageResult] = useState<GeneratedImageResult | null>(null)

  // 流式增量的合并缓冲：上游一个 token 一个事件，若每个事件都 setState，
  // 一次回答会触发上百次全量重渲染（历史消息 + Markdown 重解析 + 滚动）。
  // 这里先在 ref 里累积，由下面的定时器按固定间隔统一提交，
  // 把渲染次数从"token 数"压到"时间窗数"，文本本身不丢不乱序。
  const answerBufferRef = useRef('')
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
    setStreamAnswer('')
    setStreamThought('')
    setStreamTool(null)
    setStreamImageResult(null)
  }

  const applyTerminalSnapshot = async (id: number, runVersion: number) => {
    try {
      const snapshot = await agentApi.getConversation(id)
      if (activeIdRef.current !== id || streamRunRef.current !== runVersion) return
      setActive(snapshot)
      setRunning(snapshot.conversation.status === 'running')
      if (snapshot.conversation.status === 'running' && snapshot.conversation.runVersion) {
        openStream(id, snapshot.conversation.runVersion)
        return
      }
      closeStream()
      clearStreamState()
      if (snapshot.conversation.status === 'failed') {
        showToast(snapshot.conversation.errorMessage || '生成失败，请重试')
      }
      void loadConversations()
      void refreshUser().catch(() => undefined)
    } catch (error) {
      if (activeIdRef.current !== id || streamRunRef.current !== runVersion) return
      closeStream()
      setRunning(false)
      showToast(error instanceof Error ? error.message : '对话同步失败')
    }
  }

  const openStream = (id: number, runVersion: number) => {
    closeStream()
    clearStreamState()
    streamRunRef.current = runVersion
    // WS 推全量 thought / 增量 answer_delta；终态到达后只读取一次持久化快照。
    const close = connectAgentStream(id, runVersion, {
      onEvent: ev => {
        if (ev.event === 'answer_delta') {
          // 累积到缓冲里，由定时器统一提交；不再每个 token 触发一次渲染。
          answerBufferRef.current += String(ev.data ?? '')
          scheduleAnswerFlush()
        } else if (ev.event === 'answer') {
          // 全量正文到达：丢弃缓冲（它必然包含在正文里），避免重复拼接。
          if (answerFlushTimerRef.current) {
            clearTimeout(answerFlushTimerRef.current)
            answerFlushTimerRef.current = null
          }
          answerBufferRef.current = ''
          setStreamAnswer(String(ev.data ?? ''))
        } else if (ev.event === 'thought') {
          setStreamThought(String(ev.data ?? ''))
        } else if (ev.event === 'tool_start') {
          const data = ev.data as ToolEventData | undefined
          const name = String(data?.tool ?? '内部工具')
          setStreamTool({ name, message: '' })
          if (isImageTool(name)) setStreamImageResult(null)
        } else if (ev.event === 'tool_progress') {
          const data = ev.data as ToolEventData | undefined
          setStreamTool(previous => ({
            name: String(data?.tool ?? previous?.name ?? '内部工具'),
            message: String(data?.message ?? previous?.message ?? ''),
          }))
        } else if (ev.event === 'tool_end') {
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
        } else if (ev.event === 'complete' || ev.event === 'error') {
          // 终态到达前把缓冲里的正文补上，避免最后一小段文字只存在于缓冲里。
          flushAnswerBuffer()
          void applyTerminalSnapshot(id, runVersion)
        }
      },
    })
    closeStreamRef.current = close
  }

  /**
   * 恢复当前会话：进入页面 / 切 tab 回来 / 打开会话时统一走这里，
   * running 状态恢复 WebSocket 事件流。
   */
  const resumeActive = useCallback(() => {
    const savedId = activeIdRef.current ?? Taro.getStorageSync<number>(ACTIVE_KEY)
    if (!savedId) return
    const requestId = ++resumeRequestRef.current
    console.log('[ChatContent] RESUME_START', { requestId, savedId })
    agentApi
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
  }, [])

  useEffect(() => {
    return () => {
      closeStream()
      // 卸载时清掉未提交的缓冲计时器，避免组件已销毁后仍触发 setState。
      if (answerFlushTimerRef.current) {
        clearTimeout(answerFlushTimerRef.current)
        answerFlushTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadConversations = useCallback(async () => {
    if (!tokenStorage.getAccessToken()) return
    try {
      const list = await agentApi.listConversations()
      setConversations(list)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '会话列表加载失败')
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
    if (!active) return
    const timer = setTimeout(() => {
      setScrollTarget(current =>
        current === 'chat-scroll-bottom-a' ? 'chat-scroll-bottom-b' : 'chat-scroll-bottom-a',
      )
    }, 60)
    return () => clearTimeout(timer)
  }, [
    active?.conversation.id,
    lastMessageId,
    messages.length,
    running,
    streamAnswer.length,
    streamThought.length,
    streamTool,
    streamImageResult?.url,
  ])

  const openConversation = async (id: number) => {
    resumeRequestRef.current += 1
    try {
      const snapshot = await agentApi.getConversation(id)
      closeStream()
      activeIdRef.current = id
      Taro.setStorageSync(ACTIVE_KEY, id)
      setActive(snapshot)
      clearStreamState()
      setRunning(snapshot.conversation.status === 'running')
      if (snapshot.conversation.status === 'running') {
        // 重新进入进行中的会话：恢复 WebSocket 事件流。
        if (snapshot.conversation.runVersion) openStream(id, snapshot.conversation.runVersion)
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '会话加载失败')
    }
  }

  const startNewChat = () => {
    resumeRequestRef.current += 1
    closeStream()
    activeIdRef.current = null
    setActive(null)
    setRunning(false)
    setInput('')
    setAttachments([])
    setScrollTarget('')
    setStreamAnswer('')
    setStreamThought('')
    setStreamTool(null)
    setStreamImageResult(null)
    Taro.removeStorageSync(ACTIVE_KEY)
    closeDrawer()
  }

  const handleAddAttachment = async () => {
    if (running || creating || uploadingAttachments) return
    const remaining = 5 - attachments.length
    if (remaining <= 0) {
      showToast(t('chat.attachmentLimit'))
      return
    }
    try {
      const action = await Taro.showActionSheet({
        itemList: [t('chat.chooseImage'), t('chat.chooseFile')],
      })
      let selected: Array<{ path: string; size: number }> = []
      if (action.tapIndex === 0) {
        const result = await Taro.chooseImage({
          count: remaining,
          sizeType: ['compressed', 'original'],
        })
        selected = result.tempFiles.map(file => ({ path: file.path, size: file.size }))
      } else {
        const result = await Taro.chooseMessageFile({ count: remaining, type: 'file' })
        selected = result.tempFiles.map(file => ({ path: file.path, size: file.size }))
      }
      const valid = selected.filter(file => file.size <= 20 * 1024 * 1024)
      if (valid.length !== selected.length) showToast(t('chat.attachmentTooLarge'))
      if (!valid.length) return
      setUploadingAttachments(true)
      const settled = await Promise.allSettled(
        valid.map(file => agentApi.uploadAttachment(file.path)),
      )
      const uploaded = settled
        .filter(
          (item): item is PromiseFulfilledResult<AgentAttachment> => item.status === 'fulfilled',
        )
        .map(item => item.value)
      if (uploaded.length) setAttachments(current => [...current, ...uploaded].slice(0, 5))
      if (settled.some(item => item.status === 'rejected'))
        showToast(t('chat.attachmentUploadFailed'))
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message && !message.includes('cancel')) showToast(t('chat.attachmentUploadFailed'))
    } finally {
      setUploadingAttachments(false)
    }
  }

  const handleSend = async (forcedContent?: string) => {
    const selectedAttachments = attachments
    const rawContent = (forcedContent ?? input).trim()
    if ((!rawContent && !selectedAttachments.length) || running || creating || uploadingAttachments)
      return
    const content = rawContent || t('chat.analyzeAttachments')
    if (!ensureLogin()) return
    resumeRequestRef.current += 1

    const tempUser: AgentMessage = {
      id: -Date.now(),
      conversationId: 0,
      role: 'user',
      kind: 'message',
      content,
      attachments: selectedAttachments,
      createdAt: new Date().toISOString(),
    }

    let targetId: number
    try {
      setRunning(true)
      if (!active) {
        setCreating(true)
        const snapshot = await agentApi.createConversation(content)
        targetId = snapshot.conversation.id
        activeIdRef.current = targetId
        Taro.setStorageSync(ACTIVE_KEY, targetId)
        setActive({
          conversation: snapshot.conversation,
          messages: [...snapshot.messages, tempUser],
        })
        setCreating(false)
      } else {
        targetId = active.conversation.id
        activeIdRef.current = targetId
        setActive(prev => (prev ? { ...prev, messages: [...prev.messages, tempUser] } : prev))
        Taro.setStorageSync(ACTIVE_KEY, targetId)
      }
      setInput('')
      setAttachments([])
      try {
        const runVersion = await agentApi.sendMessage(targetId, content, selectedAttachments)
        if (runVersion) openStream(targetId, runVersion)
      } catch (e) {
        const message = e instanceof Error ? e.message : ''
        if (message.includes('timeout') || message.includes('超时')) {
          // 请求可能已在服务端启动；读取一次快照拿到 runVersion 后续接 WS。
          const snapshot = await agentApi.getConversation(targetId)
          if (activeIdRef.current !== targetId) return
          setActive(snapshot)
          setRunning(snapshot.conversation.status === 'running')
          if (snapshot.conversation.status === 'running' && snapshot.conversation.runVersion) {
            openStream(targetId, snapshot.conversation.runVersion)
          }
        } else {
          setRunning(false)
          showToast(message || '发送失败')
        }
      }
    } catch (e) {
      setCreating(false)
      setRunning(false)
      showToast(e instanceof Error ? e.message : '发送失败，请重试')
    }
  }

  const handleCancel = async () => {
    if (!active) return
    try {
      await agentApi.cancel(active.conversation.id)
      showToast('已请求停止')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '取消失败')
    }
  }

  const navigateTopLevel = (url: string) => {
    const tab = getTabKeyByPath(url)
    if (tab && onMainTabNavigate) {
      onMainTabNavigate(tab)
      return
    }
    if (tab) {
      void Taro.reLaunch({ url: `/pages/main/index?tab=${tab}` })
      return
    }
    void Taro.navigateTo({ url })
  }

  return (
    <View className="chat-page">
      <View
        className={`chat-main-shell ${
          drawerPhase === 'open'
            ? 'is-drawer-open'
            : drawerPhase === 'closing'
              ? 'is-drawer-closing'
              : ''
        }`}
        style={shellStyle}
        onTouchStart={onShellTouchStart}
        onTouchEnd={onShellTouchEnd}
      >
        {active ? (
          <>
            <NavBar
              title={active.conversation.title || '智能体会话'}
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
            <ScrollView
              scrollY
              className="chat-messages"
              scrollIntoView={scrollTarget}
              scrollWithAnimation
            >
              <View className="chat-messages-inner">
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
                        />
                      ))}
                    </View>
                  ))}
                  {streamTool || streamImageResult || streamThought || streamAnswer || running ? (
                    <View className="chat-turn assistant is-streaming" role="status">
                      {streamTool?.name === IMAGE_TOOL ? (
                        <ImageGenerationPanel message={streamTool.message} />
                      ) : streamTool ? (
                        <View className="msg-tool">
                          <View className="msg-tool-dot" />
                          <Text>正在使用工具：{streamTool.name}</Text>
                        </View>
                      ) : null}
                      {streamImageResult ? <GeneratedImage result={streamImageResult} /> : null}
                      {streamThought ? (
                        <View className="msg-thought">
                          <Text className="msg-thought-title">思考过程</Text>
                          <Text>{truncate(streamThought, 120)}</Text>
                        </View>
                      ) : null}
                      {streamAnswer &&
                      !streamAnswer.includes(streamImageResult?.url || '\u0000') ? (
                        <View className="msg-answer stream">
                          <Markdown content={streamAnswer} />
                          <Text className="msg-stream-cursor">▍</Text>
                        </View>
                      ) : null}
                      {running &&
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
            <ChatComposer
              value={input}
              placeholder={CHAT_COPY.inputPlaceholder}
              sendLabel={CHAT_COPY.inputPlaceholder}
              stopLabel={CHAT_COPY.stop}
              running={running}
              creating={creating}
              attachments={attachments}
              uploading={uploadingAttachments}
              onChange={setInput}
              onAddAttachment={handleAddAttachment}
              onRemoveAttachment={url =>
                setAttachments(current => current.filter(item => item.url !== url))
              }
              onSubmit={() => handleSend()}
              onStop={handleCancel}
            />
          </>
        ) : (
          <>
            <NavBar
              title="DinQor"
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
            <View className="chat-home-empty">
              <Text className="chat-home-title">我们先从哪里开始呢？</Text>
              <View className="chat-home-quick-list">
                {QUICK_PROMPTS.map(prompt => (
                  <View
                    key={prompt}
                    className="chat-home-quick"
                    role="button"
                    ariaRole="button"
                    ariaLabel={prompt}
                    onClick={() => setInput(prompt)}
                  >
                    <Text>{prompt}</Text>
                  </View>
                ))}
              </View>
              <ChatComposer
                home
                value={input}
                placeholder={CHAT_COPY.inputPlaceholder}
                sendLabel={CHAT_COPY.inputPlaceholder}
                stopLabel={CHAT_COPY.stop}
                running={running}
                creating={creating}
                attachments={attachments}
                uploading={uploadingAttachments}
                onChange={setInput}
                onAddAttachment={handleAddAttachment}
                onRemoveAttachment={url =>
                  setAttachments(current => current.filter(item => item.url !== url))
                }
                onSubmit={() => handleSend()}
                onStop={handleCancel}
              />
            </View>
          </>
        )}
        <View
          className={`chat-drawer-dismiss ${drawerPhase !== 'closed' ? 'show' : ''}`}
          role="button"
          ariaRole="button"
          ariaLabel={CHAT_COPY.history}
          catchMove={drawerPhase !== 'closed'}
          onClick={event => {
            event.stopPropagation()
            closeDrawer()
          }}
        />
      </View>
      <ChatDrawer
        visible={drawerPhase !== 'closed'}
        closing={drawerPhase === 'closing'}
        onClose={closeDrawer}
        conversations={conversations}
        activeId={activeIdRef.current}
        onSelect={openConversation}
        onNewChat={startNewChat}
        onNavigate={navigateTopLevel}
        user={user}
      />
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
}: {
  message: AgentMessage
  imageResultUrls: Set<string>
  open: boolean
  /** 收 id 而不是闭包：父层因此能用同一个 useCallback 实例，memo 才挡得住。 */
  onToggleThought: (messageId: number) => void
}) {
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
        ariaLabel="思考过程"
        onClick={toggle}
      >
        <Text className="msg-thought-title">思考过程</Text>
        <Text>{open ? message.content : truncate(message.content, 120)}</Text>
      </View>
    )
  }
  if (message.kind === 'tool_call') {
    if (isImageTool(message.toolName)) return null
    return (
      <View className="msg-tool">
        <View className="msg-tool-dot" />
        <Text>正在使用工具：{message.toolName || '内部工具'}</Text>
      </View>
    )
  }
  if (message.kind === 'tool_result') {
    const result = parseImageToolResult(message)
    if (result) return <GeneratedImage result={result} />
    return (
      <View className="msg-tool is-complete">
        <Text>工具执行完成</Text>
      </View>
    )
  }
  for (const url of imageResultUrls) {
    if (message.content?.includes(url)) return null
  }
  return (
    <View className="msg-answer">
      <Markdown content={message.content || '（空回复）'} />
    </View>
  )
})

function ImageGenerationPanel({ message }: { message?: string }) {
  return (
    <View className="msg-image-generating">
      <View className="msg-image-pattern" />
      <View className="msg-image-generating-title">
        <Text className="msg-image-sparkle">✦</Text>
        <Text>{message || t('chat.generatingImage')}</Text>
        <View className="msg-image-generating-dots">
          <View className="dot" />
          <View className="dot" />
          <View className="dot" />
        </View>
      </View>
      <View className="msg-image-placeholder">
        <View className="msg-image-placeholder-frame" />
        <Text className="msg-image-placeholder-sparkle">✦</Text>
      </View>
    </View>
  )
}

function GeneratedImage({ result }: { result: GeneratedImageResult }) {
  return (
    <View
      className="msg-generated-image"
      role="button"
      ariaRole="button"
      ariaLabel={result.title || t('chat.generatedImage')}
      onClick={() => Taro.previewImage({ current: result.url, urls: [result.url] })}
    >
      <Image className="msg-generated-image-content" src={result.url} mode="widthFix" lazyLoad />
    </View>
  )
}
