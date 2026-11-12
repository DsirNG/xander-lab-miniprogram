import Taro from '@tarojs/taro'
import { getSessionVersion, onPrivateCacheReset } from '@/utils/privateCache'

export type CachedChatImage = { src: string; width: number; height: number }
const images = new Map<string, CachedChatImage>()
const pending = new Map<string, Promise<CachedChatImage>>()

/** OSS signatures rotate for the same object. Keep object identity and other query transforms. */
export function chatImageKey(url: string) {
  const [base, query] = url.split('?', 2)
  const stable = query
    ?.split('&')
    .filter(pair => !/^x-oss-/i.test(pair))
    .sort()
    .join('&')
  return stable ? base + '?' + stable : base
}

onPrivateCacheReset(() => {
  images.clear()
  pending.clear()
})

export function cachedChatImage(url: string) {
  return images.get(chatImageKey(url))
}

export function loadChatImage(url: string): Promise<CachedChatImage> {
  const key = chatImageKey(url)
  const cached = images.get(key)
  if (cached) {
    images.delete(key)
    images.set(key, cached)
    return Promise.resolve(cached)
  }
  const existing = pending.get(key)
  if (existing) return existing
  const session = getSessionVersion()
  const promise = Taro.getImageInfo({ src: url })
    .then(result => {
      const image = { src: result.path || url, width: result.width, height: result.height }
      if (session !== getSessionVersion()) throw new Error('Image session changed')
      images.set(key, image)
      while (images.size > 48) images.delete(images.keys().next().value!)
      return image
    })
    .finally(() => {
      if (pending.get(key) === promise) pending.delete(key)
    })
  pending.set(key, promise)
  return promise
}
