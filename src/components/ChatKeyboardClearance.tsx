import { View } from '@tarojs/components'
import { useChatKeyboard } from '@/store/chatKeyboard'

/** Native keyboard events update this small spacer, never the message tree. */
export function ChatKeyboardClearance() {
  const height = useChatKeyboard(state => state.height)
  return (
    <View
      className="chat-composer-clearance"
      aria-hidden="true"
      style={height ? { height: `${height}px` } : undefined}
    />
  )
}
