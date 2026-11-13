import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  cache: {} as Record<string, unknown>,
  share: vi.fn(),
  write: vi.fn(),
  unlink: vi.fn(),
}))
vi.mock('@/utils/privateCache', () => ({
  getSessionVersion: () => 1,
  privateCacheKeys: { replyReactions: 'reactions' },
  readPrivateCache: () => mocks.cache,
  writePrivateCache: (_key: string, value: Record<string, unknown>) => {
    mocks.cache = value
  },
}))
vi.mock('@tarojs/taro', () => ({
  default: {
    env: { USER_DATA_PATH: '/tmp' },
    shareFileMessage: mocks.share,
    getFileSystemManager: () => ({ writeFile: mocks.write, unlink: mocks.unlink }),
  },
}))
import { readReaction, toggleReaction, shareReply } from './replyActions'
beforeEach(() => {
  mocks.cache = {}
  vi.clearAllMocks()
  mocks.write.mockImplementation(options => options.success())
  mocks.share.mockResolvedValue({})
})
it('reactions are mutually exclusive, cancelable, persistent and keyed by message', () => {
  expect(toggleReaction('7:12', 'like')).toBe('like')
  expect(readReaction('7:12')).toBe('like')
  expect(toggleReaction('7:12', 'dislike')).toBe('dislike')
  expect(readReaction('8:12')).toBeNull()
  expect(toggleReaction('7:12', 'dislike')).toBeNull()
  expect(readReaction('7:12')).toBeNull()
})
it('shares only the selected reply and cleans the file after native sharing', async () => {
  await shareReply('selected answer')
  expect(mocks.write.mock.calls[0][0].data).toBe('selected answer')
  expect(mocks.share).toHaveBeenCalledOnce()
  expect(mocks.unlink).toHaveBeenCalledOnce()
})
it('cleans temporary files after the user cancels sharing', async () => {
  mocks.share.mockRejectedValue({ errMsg: 'cancel' })
  await expect(shareReply('answer')).rejects.toEqual({ errMsg: 'cancel' })
  expect(mocks.unlink).toHaveBeenCalledOnce()
})
