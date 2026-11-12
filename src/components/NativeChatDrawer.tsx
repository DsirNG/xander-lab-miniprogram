import { Slot } from '@tarojs/components'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { TabBar } from '@/components/TabBar'
import { getDrawerTravel } from '@/utils/drawerGeometry'
import { useChatKeyboard } from '@/store/chatKeyboard'

export function NativeChatDrawer({
  open, active, children, sidebar, onReveal, onSettle, onDrag,
}: {
  open: boolean; active: boolean; children: ReactNode; sidebar: ReactNode
  onReveal: () => void; onSettle: (open: boolean) => void; onDrag: () => void
}) {
  const keyboard = useChatKeyboard(state => state.height > 0)
  const [travel] = useState(getDrawerTravel)
  return (
    <native-chat-drawer
      className="native-chat-drawer"
      opened={open}
      enabled={active && !keyboard}
      travel={travel}
      onGesturephase={(event: { detail: { phase: 'start' | 'end'; open?: boolean } }) => {
        onDrag()
        // The WXS layer owns the continuous drag. Commit React state only after release.
        if (event.detail.phase === 'end') onSettle(Boolean(event.detail.open))
      }}
    >
      <Slot name="sidebar" className="native-chat-slot-sidebar">{sidebar}</Slot>
      <Slot name="content" className="native-chat-slot-content">{children}</Slot>
      <Slot name="navigation"><TabBar /></Slot>
    </native-chat-drawer>
  )
}
