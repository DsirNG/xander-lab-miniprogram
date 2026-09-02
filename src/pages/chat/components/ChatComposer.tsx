import { Image, Text, Textarea, View } from '@tarojs/components'
import { Icon } from '@/components/Icon'
import type { AgentAttachment } from '@/api/agent'

interface ChatComposerProps {
  value: string
  placeholder: string
  sendLabel: string
  stopLabel: string
  running: boolean
  creating: boolean
  attachments: AgentAttachment[]
  uploading: boolean
  home?: boolean
  onChange: (value: string) => void
  onAddAttachment: () => void
  onRemoveAttachment: (url: string) => void
  onSubmit: () => void
  onStop: () => void
}

export function ChatComposer({
  value,
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
}: ChatComposerProps) {
  const canSend = Boolean(value.trim() || attachments.length) && !uploading
  const busy = running || creating
  const state = busy ? 'busy' : canSend ? 'ready' : 'idle'

  const handleAction = () => {
    if (running) {
      onStop()
      return
    }
    if (!creating && canSend) onSubmit()
  }

  return (
    <View className={`chat-composer-dock ${home ? 'is-home' : ''}`}>
      <View className="chat-composer">
        {attachments.length ? (
          <View className="chat-composer-attachments">
            {attachments.map(attachment => (
              <View className="chat-composer-attachment" key={attachment.url}>
                {attachment.contentType.startsWith('image/') ? (
                  <Image
                    className="chat-composer-attachment-image"
                    src={attachment.url}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="chat-composer-file">
                    <Icon name="article" />
                    <Text>{attachment.name}</Text>
                  </View>
                )}
                <View
                  className="chat-composer-remove"
                  onClick={() => onRemoveAttachment(attachment.url)}
                >
                  <Icon name="close" />
                </View>
              </View>
            ))}
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
            <Icon name={uploading ? 'refresh' : 'plus'} />
          </View>
          <Textarea
            className="chat-composer-input"
            value={value}
            maxlength={4000}
            autoHeight
            adjustPosition
            disableDefaultPadding
            placeholder={placeholder}
            placeholderClass="chat-input-placeholder"
            ariaLabel={placeholder}
            onInput={event => onChange(event.detail.value)}
            confirmType="send"
            onConfirm={() => {
              if (!busy && canSend) onSubmit()
            }}
            cursorSpacing={24}
            showConfirmBar={false}
          />
          <View
            className="chat-send-hitbox"
            role="button"
            ariaRole="button"
            ariaLabel={running ? stopLabel : sendLabel}
            onClick={handleAction}
          >
            <View className={`chat-send-button ${state}`}>
              {running ? <View className="chat-stop" /> : <Icon name="send" />}
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
