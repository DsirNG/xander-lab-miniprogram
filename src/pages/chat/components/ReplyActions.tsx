import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import type { AgentMessage } from '@/api/agent'
import { Icon } from '@/components/Icon'
import { t, useLocale } from '@/i18n'
import { readReaction, toggleReaction, shareReply } from '../replyActions'

export function ReplyActions({ message }: { message: AgentMessage }) {
  useLocale()
  const key = `${message.conversationId}:${message.id}`
  const [reaction, setReaction] = useState(() => readReaction(key))
  const [sharing, setSharing] = useState(false)
  const copy = async () => {
    try {
      await Taro.setClipboardData({ data: message.content })
    } catch {
      void Taro.showToast({ title: t('replyActions.copyFailed'), icon: 'none' })
    }
  }
  const share = async () => {
    if (sharing) return
    setSharing(true)
    try {
      await shareReply(message.content)
    } catch (error) {
      if (!/cancel/i.test(String((error as { errMsg?: string })?.errMsg || error))) {
        void Taro.showToast({ title: t('replyActions.shareFailed'), icon: 'none' })
      }
    } finally {
      setSharing(false)
    }
  }
  return (
    <View className="reply-actions">
      <View
        className="reply-action"
        ariaRole="button"
        ariaLabel={t('replyActions.copy')}
        onClick={copy}
      >
        <Icon name="copy" />
      </View>
      <View
        className={`reply-action ${reaction === 'like' ? 'is-selected' : ''}`}
        ariaRole="button"
        ariaLabel={t(reaction === 'like' ? 'replyActions.undoLike' : 'replyActions.like')}
        onClick={() => setReaction(toggleReaction(key, 'like'))}
      >
        <Icon name="thumb-up" />
      </View>
      <View
        className={`reply-action ${reaction === 'dislike' ? 'is-selected' : ''}`}
        ariaRole="button"
        ariaLabel={t(reaction === 'dislike' ? 'replyActions.undoDislike' : 'replyActions.dislike')}
        onClick={() => setReaction(toggleReaction(key, 'dislike'))}
      >
        <Icon name="thumb-down" />
      </View>
      <View
        className={`reply-action ${sharing ? 'is-disabled' : ''}`}
        ariaRole="button"
        ariaLabel={t('replyActions.share')}
        onClick={share}
      >
        <Icon name="share" />
      </View>
    </View>
  )
}
