import {
  Image,
  ScrollView,
  Text,
  View,
  type CommonEventFunction,
  type ITouchEvent,
} from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { TabBar } from '@/components/TabBar'
import { NavBar } from '@/components/NavBar'
import { Icon } from '@/components/Icon'
import { ensureLogin, useUserStore } from '@/store/user'
import { truncate } from '@/utils/markdown'
import { t } from '@/i18n'
import { ChatComposer } from './components/ChatComposer'
import { ChatDrawer } from './components/ChatDrawer'
import './index.scss'

const ACTIVE_KEY = 'chat_active_id'
const IMAGE_TOOL = 'image_generate'

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
}

const EMPTY_MESSAGES: AgentMessage[] = []

type StreamToolState = {
  name: string
  message: string
}

type GeneratedImageResult = {
  url: string
  title?: string
}

type ToolEventData = {
  tool?: string
  message?: string
  result?: { url?: string; title?: string }
}

function absoluteMediaUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`
}

function parseImageToolResult(message: AgentMessage): GeneratedImageResult | null {
  if (message.kind !== 'tool_result' || message.toolName !== IMAGE_TOOL) return null
  try {
    const payload = JSON.parse(message.content) as { url?: string; title?: string }
    return payload.url ? { url: absoluteMediaUrl(payload.url), title: payload.title } : null
  } catch {
    return null
  }
}

function groupMessagesIntoTurns(messages: AgentMessage[]): MessageTurn[] {
  return messages.reduce<MessageTurn[]>((turns, message) => {
    if (message.role === 'user') {
      turns.push({
        key: `user-${message.id}`,
        id: `msg-${message.id}`,
        role: 'user',
        messages: [message],
      })
      return turns
    }

    const previous = turns[turns.length - 1]
    if (previous?.role === 'assistant') {
      previous.messages.push(message)
      previous.id = `msg-${message.id}`
      return turns
    }

    turns.push({
      key: `assistant-${message.id}`,
      id: `msg-${message.id}`,
      role: 'assistant',
      messages: [message],
    })
    return turns
  }, [])
}

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

export default function Chat() {
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
  const [streamAnswer, setStreamAnswer] = useState('')
  const [streamThought, setStreamThought] = useState('')
  const [streamTool, setStreamTool] = useState<StreamToolState | null>(null)
  const [streamImageResult, setStreamImageResult] = useState<GeneratedImageResult | null>(null)
  const messages = active?.messages ?? EMPTY_MESSAGES
  const messageTurns = useMemo(() => groupMessagesIntoTurns(messages), [messages])
  const lastMessageId = messages[messages.length - 1]?.id

  const closeStream = () => {
    streamRunRef.current = null
    closeStreamRef.current?.()
    closeStreamRef.current = null
  }

  const clearStreamState = () => {
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
    setStreamAnswer('')
    setStreamThought('')
    setStreamTool(null)
    setStreamImageResult(null)
    streamRunRef.current = runVersion
    // WS 推全量 thought / 增量 answer_delta；终态到达后只读取一次持久化快照。
    const close = connectAgentStream(id, runVersion, {
      onEvent: ev => {
        if (ev.event === 'answer_delta') {
          setStreamAnswer(prev => prev + String(ev.data ?? ''))
        } else if (ev.event === 'answer') {
          setStreamAnswer(String(ev.data ?? ''))
        } else if (ev.event === 'thought') {
          setStreamThought(String(ev.data ?? ''))
        } else if (ev.event === 'tool_start') {
          const data = ev.data as ToolEventData | undefined
          const name = String(data?.tool ?? '内部工具')
          setStreamTool({ name, message: '' })
          if (name === IMAGE_TOOL) setStreamImageResult(null)
        } else if (ev.event === 'tool_progress') {
          const data = ev.data as ToolEventData | undefined
          setStreamTool(previous => ({
            name: String(data?.tool ?? previous?.name ?? '内部工具'),
            message: String(data?.message ?? previous?.message ?? ''),
          }))
        } else if (ev.event === 'tool_end') {
          const data = ev.data as ToolEventData | undefined
          if (data?.tool === IMAGE_TOOL && data.result?.url) {
            setStreamImageResult({
              url: absoluteMediaUrl(data.result.url),
              title: data.result.title,
            })
          }
          setStreamTool(null)
        } else if (ev.event === 'tool_error') {
          setStreamTool(null)
        } else if (ev.event === 'complete' || ev.event === 'error') {
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
    agentApi
      .getConversation(savedId)
      .then(snapshot => {
        if (activeIdRef.current != null && activeIdRef.current !== savedId) return
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

  useEffect(() => {
    refreshUser().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useDidShow(() => {
    if (!user) {
      refreshUser().catch(() => undefined)
    }
    if (tokenStorage.getAccessToken()) {
      loadConversations()
    }
    resumeActive()
  })

  useDidHide(() => {
    // tab 切换只触发 hide 不卸载页面：关闭事件流，回前台后重新读取快照并续接 WS。
    closeStream()
    setStreamAnswer('')
    setStreamThought('')
    setStreamTool(null)
    setStreamImageResult(null)
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
    try {
      const snapshot = await agentApi.getConversation(id)
      closeStream()
      activeIdRef.current = id
      Taro.setStorageSync(ACTIVE_KEY, id)
      setActive(snapshot)
      setStreamAnswer('')
      setStreamThought('')
      setStreamTool(null)
      setStreamImageResult(null)
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
                  {messageTurns.map(turn => {
                    const imageResultUrls = new Set(
                      turn.messages
                        .map(parseImageToolResult)
                        .filter((result): result is GeneratedImageResult => Boolean(result))
                        .map(result => result.url),
                    )
                    return (
                      <View id={turn.id} className={`chat-turn ${turn.role}`} key={turn.key}>
                        {turn.messages.map(message => (
                          <MessagePart
                            key={message.id}
                            message={message}
                            imageResultUrls={imageResultUrls}
                            open={Boolean(thoughtOpen[message.id])}
                            onToggleThought={() =>
                              setThoughtOpen(previous => ({
                                ...previous,
                                [message.id]: !previous[message.id],
                              }))
                            }
                          />
                        ))}
                      </View>
                    )
                  })}
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
        onNavigate={url => Taro.redirectTo({ url })}
        user={user}
      />
      <TabBar active="chat" />
    </View>
  )
}

function MessagePart({
  message,
  imageResultUrls,
  open,
  onToggleThought,
}: {
  message: AgentMessage
  imageResultUrls: Set<string>
  open: boolean
  onToggleThought: () => void
}) {
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
                  src={absoluteMediaUrl(attachment.url)}
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
        onClick={onToggleThought}
      >
        <Text className="msg-thought-title">思考过程</Text>
        <Text>{open ? message.content : truncate(message.content, 120)}</Text>
      </View>
    )
  }
  if (message.kind === 'tool_call') {
    if (message.toolName === IMAGE_TOOL) return null
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
}

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
