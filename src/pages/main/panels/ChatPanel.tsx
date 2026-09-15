import { View } from '@tarojs/components'
import { useEffect, useRef } from 'react'
import { ChatContent } from '@/features/chat/ChatContent'

type ChatPanelProps = {
  active: boolean
}

/** Chat business content hosted inside the persistent MainShell. */
export function ChatPanel({ active }: ChatPanelProps) {
  const renderCountRef = useRef(0)
  renderCountRef.current += 1

  console.log('[ChatPanel] RENDER', {
    active,
    renderCount: renderCountRef.current,
  })

  useEffect(() => {
    console.log('[ChatPanel] MOUNT')

    return () => {
      console.log('[ChatPanel] UNMOUNT')
    }
  }, [])

  useEffect(() => {
    console.log('[ChatPanel] ACTIVE_CHANGE', { active })
  }, [active])

  return (
    <View className={`main-panel main-panel--chat ${active ? 'is-active' : ''}`} hidden={!active}>
      <ChatContent panelActive={active} />
    </View>
  )
}
