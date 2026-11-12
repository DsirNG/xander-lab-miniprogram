import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Image, Text, Textarea, View } from '@tarojs/components'
import { Icon } from '@/components/Icon'
import type { AgentAttachment } from '@/api/agent'

export type ComposerAttachmentItem = AgentAttachment & {
  id?: string
  status?: 'uploading' | 'done' | 'error'
  tempPath?: string
}

export function composerLineCount(lines: number) {
  return Math.min(6, Math.max(1, Number.isFinite(lines) ? Math.floor(lines) : 1))
}

function explicitLines(text: string) {
  return composerLineCount(text.split('\n').length)
}

interface ChatComposerProps {
  value: string
  draftRevision?: number
  placeholder: string
  sendLabel: string
  stopLabel: string
  running: boolean
  creating: boolean
  attachments: ComposerAttachmentItem[]
  uploading: boolean
  home?: boolean
  onChange: (value: string) => void
  onAddAttachment: () => void
  onRemoveAttachment: (idOrUrl: string) => void
  onSubmit: (content?: string) => void
  onStop: () => void
  onLayoutChange?: () => void
  onKeyboardHeightChange?: (height: number) => void
}

export function ChatComposer({
  value,
  draftRevision = 0,
  placeholder,
  sendLabel,
  stopLabel,
  running,
  creating,
  attachments,
  uploading,
  home = false,
  onChange,
  onAddAttachment,
  onRemoveAttachment,
  onSubmit,
  onStop,
  onLayoutChange,
  onKeyboardHeightChange,
}: ChatComposerProps) {
  const [text, setText] = useState(value ?? '')
  const [focused, setFocused] = useState(false)
  const [lines, setLines] = useState(() => explicitLines(value))
  const nativeKeyboardInset = process.env.TARO_ENV === 'weapp'
  const textRef = useRef(value ?? '')
  const measuredLinesRef = useRef(lines)

  useLayoutEffect(() => {
    setText(value ?? '')
    textRef.current = value ?? ''
    measuredLinesRef.current = explicitLines(value)
    setLines(measuredLinesRef.current)
  }, [value, draftRevision])

  const hasUploading = attachments.some(attachment => attachment.status === 'uploading')
  const hasValidAttachments = attachments.some(
    attachment => attachment.status !== 'uploading' && attachment.status !== 'error',
  )
  const canSend = Boolean(text.trim() || hasValidAttachments) && !uploading && !hasUploading
  const isLoading = creating || uploading || hasUploading
  const busy = running || isLoading
  const state = running ? 'streaming' : isLoading ? 'loading' : canSend ? 'ready' : 'idle'

  const handleAction = () => {
    if (running) {
      onStop()
      return
    }
    if (!creating && !uploading && canSend) {
      onSubmit(textRef.current)
    }
  }

  const handleInput = (event: any) => {
    const nextValue = event.detail.value ?? ''
    setText(nextValue)
    textRef.current = nextValue
    if (!nextValue) {
      measuredLinesRef.current = 1
      setLines(1)
    }
    onChange(nextValue)
  }

  const handleLineChange = (event: any) => {
    const nextLines = Number(event.detail?.lineCount)
    if (!Number.isFinite(nextLines)) return
    const next = textRef.current ? composerLineCount(nextLines) : 1
    if (next === measuredLinesRef.current) return
    measuredLinesRef.current = next
    setLines(next)
    onLayoutChange?.()
  }

  return (
    <View className={`chat-composer-dock ${home ? 'is-home' : ''}`} onTouchStart={event => event.stopPropagation()}>
      <View className="chat-composer">
        {attachments.length ? (
          <View className="chat-composer-attachments">
            {attachments.map(attachment => {
              const isItemUploading = attachment.status === 'uploading'
              return (
                <View
                  className={`chat-composer-attachment ${isItemUploading ? 'is-uploading' : ''}`}
                  key={attachment.id || attachment.url}
                >
                  {attachment.contentType.startsWith('image/') ? (
                    <Image
                      className="chat-composer-attachment-image"
                      src={attachment.tempPath || attachment.url}
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="chat-composer-file">
                      <Icon name="article" />
                      <Text>{attachment.name}</Text>
                    </View>
                  )}
                  {isItemUploading ? (
                    <View className="chat-composer-attachment-loading">
                      <View className="chat-attachment-spinner" />
                    </View>
                  ) : (
                    <View
                      className="chat-composer-remove"
                      onClick={() => onRemoveAttachment(attachment.id || attachment.url)}
                    >
                      <Icon name="close" />
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ) : null}

        <View className="chat-composer-row">
          <View
            className={`chat-attach-hitbox ${uploading ? 'is-uploading' : ''}`}
            role="button"
            ariaRole="button"
            ariaLabel={placeholder}
            onClick={onAddAttachment}
          >
            <Icon name="plus" />
          </View>
          <View className="chat-composer-field">
            <Textarea
              className="chat-composer-input"
              value={text}
              maxlength={4000}
              style={{ '--composer-lines': lines } as CSSProperties}
              onLineChange={handleLineChange}
              adjustPosition={!nativeKeyboardInset}
              onKeyboardHeightChange={nativeKeyboardInset && onKeyboardHeightChange
                ? event => onKeyboardHeightChange(event.detail.height)
                : undefined}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={focused ? placeholder : undefined}
              placeholderClass="chat-native-placeholder"
              disableDefaultPadding
              ariaLabel={placeholder}
              onInput={handleInput}
              confirmType="return"
              cursorSpacing={nativeKeyboardInset ? 0 : 24}
              showConfirmBar={false}
            />
            {!focused && !text && (
              <View className="chat-composer-hint" aria-hidden="true"><Text>{placeholder}</Text></View>
            )}

          </View>
          <View
            className="chat-send-hitbox"
            role="button"
            ariaRole="button"
            ariaLabel={running ? stopLabel : sendLabel}
            onClick={handleAction}
          >
            <View className={`chat-send-button ${state} ${busy ? 'busy' : ''}`}>
              <View className={`chat-send-icon-wrap ${!busy ? 'is-visible' : ''}`}>
                <View className="chat-send-arrow" />
              </View>
              <View
                className={`chat-send-spinner ${isLoading ? 'is-visible' : ''} ${running ? 'is-stop-ring' : ''}`}
              />
              <View className={`chat-stop ${running ? 'is-visible' : ''}`} />
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
