import Taro from '@tarojs/taro'
import { useSyncExternalStore } from 'react'

export const privateCacheKeys = {
  profile: 'xander_user_profile_v1',
  profileSummary: 'xander_profile_summary_v1',
  pointsOverview: 'xander_points_overview_v1',
  pointsLedger: 'xander_points_ledger_v1',
  activeChat: 'chat_active_id',
  publishDraft: 'dinqorai:miniprogram:publish-draft',
  publishRequest: 'dinqorai:miniprogram:publish-request',
} as const

type PrivateCacheKey = (typeof privateCacheKeys)[keyof typeof privateCacheKeys]

let session = 0
const listeners = new Set<() => void>()
const cacheCleanups = new Set<() => void>()
export function onPrivateCacheReset(cleanup: () => void) {
  cacheCleanups.add(cleanup)
  return () => { cacheCleanups.delete(cleanup) }
}

export const getSessionVersion = () => session
export const hasSession = () => Boolean(Taro.getStorageSync('xander_access_token'))

export function useSessionVersion() {
  return useSyncExternalStore(subscribeSession, getSessionVersion, getSessionVersion)
}

function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetPrivateCache(updateCredentials: () => void) {
  session += 1
  cacheCleanups.forEach(cleanup => cleanup())
  for (const key of Object.values(privateCacheKeys)) Taro.removeStorageSync(key)
  updateCredentials()
  listeners.forEach(listener => listener())
}

export function readPrivateCache<T>(key: PrivateCacheKey): T | null {
  try {
    return hasSession() ? Taro.getStorageSync<T>(key) || null : null
  } catch {
    return null
  }
}

export function writePrivateCache<T>(key: PrivateCacheKey, value: T, version: number) {
  try {
    if (version === session && hasSession()) Taro.setStorageSync(key, value)
  } catch {
    // Cache failures do not block the underlying feature.
  }
}
