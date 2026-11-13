import Taro from '@tarojs/taro'
import {
  getSessionVersion,
  privateCacheKeys,
  readPrivateCache,
  writePrivateCache,
} from '@/utils/privateCache'
export type Reaction = 'like' | 'dislike' | null
export function readReaction(key: string): Reaction {
  const value = readPrivateCache<Record<string, Reaction>>(privateCacheKeys.replyReactions)?.[key]
  return value === 'like' || value === 'dislike' ? value : null
}
export function toggleReaction(key: string, next: Exclude<Reaction, null>): Reaction {
  const records = readPrivateCache<Record<string, Reaction>>(privateCacheKeys.replyReactions) || {}
  const value = records[key] === next ? null : next
  delete records[key]
  if (value) records[key] = value
  writePrivateCache(
    privateCacheKeys.replyReactions,
    Object.fromEntries(Object.entries(records).slice(-500)),
    getSessionVersion(),
  )
  return value
}
let shareId = 0
/** Shares only the selected answer; never publishes the conversation or its attachments. */
export async function shareReply(content: string) {
  if (!Taro.shareFileMessage || !Taro.env?.USER_DATA_PATH) throw new Error('unsupported')
  const fs = Taro.getFileSystemManager()
  const filePath = `${Taro.env.USER_DATA_PATH}/DinQor-reply-${Date.now()}-${++shareId}.txt`
  try {
    await new Promise<void>((resolve, reject) =>
      fs.writeFile({
        filePath,
        data: content,
        encoding: 'utf8',
        success: () => resolve(),
        fail: reject,
      }),
    )
    await Taro.shareFileMessage({ filePath, fileName: 'DinQor.txt' })
  } finally {
    fs.unlink({ filePath, fail: () => undefined })
  }
}
