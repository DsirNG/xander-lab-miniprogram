import Taro from '@tarojs/taro'
import { useSyncExternalStore } from 'react'

export const themeModes = ['system', 'light', 'dark'] as const
export type ThemeMode = (typeof themeModes)[number]
const themeKey = 'dinqor_theme'
let themeMode: ThemeMode | undefined

function getThemeMode(): ThemeMode {
  if (themeMode) return themeMode
  try {
    const stored = Taro.getStorageSync<string>(themeKey)
    themeMode = stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    themeMode = 'system'
  }
  return themeMode
}

export function setThemeMode(mode: ThemeMode) {
  if (mode === getThemeMode()) return
  themeMode = mode
  try { Taro.setStorageSync(themeKey, mode) } catch { /* Keep this session's preference. */ }
  notify()
}

export function useThemeMode() {
  return useSyncExternalStore(subscribe, getThemeMode, getThemeMode)
}

const query = '(prefers-color-scheme: dark)'
const subscribers = new Set<() => void>()
let stopListening: (() => void) | undefined

function mediaQuery() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : undefined
}

function systemDarkMode() {
  const media = mediaQuery()
  if (media) return media.matches
  try {
    return (Taro.getAppBaseInfo?.().theme ?? Taro.getSystemInfoSync?.().theme) === 'dark'
  } catch {
    return false
  }
}

let nativeDark: boolean | undefined
const snapshot = () => {
  const mode = getThemeMode()
  return mode === 'system' ? (nativeDark ?? systemDarkMode()) : mode === 'dark'
}
const notify = () => subscribers.forEach(listener => listener())

function subscribe(listener: () => void) {
  subscribers.add(listener)
  if (subscribers.size === 1) {
    const media = mediaQuery()
    if (media) {
      media.addEventListener?.('change', notify)
      stopListening = () => media.removeEventListener?.('change', notify)
    } else {
      const change = (event: { theme: string }) => {
        nativeDark = event.theme === 'dark'
        notify()
      }
      Taro.onThemeChange?.(change)
      stopListening = () => Taro.offThemeChange?.(change)
    }
  }

  return () => {
    subscribers.delete(listener)
    if (subscribers.size === 0) {
      stopListening?.()
      stopListening = undefined
      nativeDark = undefined
    }
  }
}

export function useDarkMode() {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
