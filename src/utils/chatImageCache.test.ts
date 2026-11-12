import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getImageInfo: vi.fn(), storage: new Map<string, string>() }))
vi.mock('@tarojs/taro', () => ({ default: {
  getImageInfo: mocks.getImageInfo,
  getStorageSync: (key: string) => mocks.storage.get(key),
  removeStorageSync: (key: string) => mocks.storage.delete(key),
} }))
import { cachedChatImage, chatImageKey, loadChatImage } from './chatImageCache'
import { resetPrivateCache } from './privateCache'
import { useChatKeyboard } from '@/store/chatKeyboard'

beforeEach(() => {
  resetPrivateCache(() => undefined)
  mocks.getImageInfo.mockReset()
  useChatKeyboard.getState().setHeight(0)
})

it('reuses decoded local images when only OSS signatures change', async () => {
  mocks.getImageInfo.mockResolvedValue({ path: 'wxfile://cached.png', width: 400, height: 300 })
  const first = 'https://img.example.com/image.png?x-oss-signature=old&x-oss-date=1'
  const fresh = 'https://img.example.com/image.png?x-oss-signature=new&x-oss-date=2'
  const original = await loadChatImage(first)
  expect(await loadChatImage(fresh)).toBe(original)
  expect(cachedChatImage(fresh)?.src).toBe('wxfile://cached.png')
  expect(mocks.getImageInfo).toHaveBeenCalledOnce()
  expect(chatImageKey(first + '&resize=200')).not.toBe(chatImageKey(first))
})

it('deduplicates in-flight loads and prevents logout responses from repopulating image cache', async () => {
  let resolve!: (result: unknown) => void
  mocks.getImageInfo.mockReturnValue(new Promise(done => { resolve = done }))
  const url = 'https://img.example.com/private.png'
  const first = loadChatImage(url)
  expect(loadChatImage(url)).toBe(first)
  resetPrivateCache(() => undefined)
  resolve({ path: 'wxfile://private.png', width: 100, height: 100 })
  await expect(first).rejects.toThrow('Image session changed')
  expect(cachedChatImage(url)).toBeUndefined()
})

it('notifies keyboard-only subscribers once per distinct height', () => {
  const listener = vi.fn()
  const unsubscribe = useChatKeyboard.subscribe(listener)
  useChatKeyboard.getState().setHeight(300)
  useChatKeyboard.getState().setHeight(300)
  expect(listener).toHaveBeenCalledOnce()
  unsubscribe()
})
