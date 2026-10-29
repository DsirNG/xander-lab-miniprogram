import Taro from '@tarojs/taro'
import { useSyncExternalStore } from 'react'
import en from './locales/en'
import fr from './locales/fr'
import ja from './locales/ja'
import ru from './locales/ru'
import vi from './locales/vi'
import zh from './locales/zh'

type TranslationTree<T> = {
  [Key in keyof T]: T[Key] extends string ? string : TranslationTree<T[Key]>
}

const messages = { zh, en, fr, ja, ru, vi } satisfies Record<
  'zh' | 'en' | 'fr' | 'ja' | 'ru' | 'vi',
  TranslationTree<typeof zh>
>

export type Locale = keyof typeof messages
export type TranslationParams = Record<string, string | number>

const DEFAULT_LOCALE: Locale = 'zh'
const LOCALE_STORAGE_KEY = 'dinqor_locale'
export const supportedLocales = ['zh', 'en'] as const
export type ReplyLanguage = 'auto' | 'zh' | 'en'
const REPLY_LANGUAGE_KEY = 'dinqor_reply_language'
const listeners = new Set<() => void>()

let currentLocale: Locale | null = null
let currentReplyLanguage: ReplyLanguage | null = null

function notifyLanguageChange() {
  listeners.forEach(listener => listener())
}

export function subscribeLanguage(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLocale() {
  return useSyncExternalStore(subscribeLanguage, getLocale, getLocale)
}

export function getReplyLanguage(): ReplyLanguage {
  if (currentReplyLanguage) return currentReplyLanguage
  try {
    const value = Taro.getStorageSync<string>(REPLY_LANGUAGE_KEY)
    currentReplyLanguage = value === 'zh' || value === 'en' ? value : 'auto'
  } catch {
    currentReplyLanguage = 'auto'
  }
  return currentReplyLanguage
}

export function useReplyLanguage() {
  return useSyncExternalStore(subscribeLanguage, getReplyLanguage, getReplyLanguage)
}

export function setReplyLanguage(value: ReplyLanguage) {
  if (!['auto', 'zh', 'en'].includes(value)) return
  currentReplyLanguage = value
  try {
    Taro.setStorageSync(REPLY_LANGUAGE_KEY, value)
  } catch {
    /* Keep the in-memory preference. */
  }
  notifyLanguageChange()
}

function parseLocale(value: unknown): Locale | null {
  if (typeof value !== 'string') return null
  const language = value.trim().toLowerCase().replace('_', '-').split('-')[0]
  return supportedLocales.includes(language as 'zh' | 'en') ? (language as Locale) : null
}

function getSystemLocale(): Locale {
  try {
    const systemInfo = Taro.getSystemInfoSync() as { language?: string }
    return parseLocale(systemInfo.language) ?? DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function getLocale(): Locale {
  if (currentLocale) return currentLocale

  try {
    currentLocale =
      parseLocale(Taro.getStorageSync<string>(LOCALE_STORAGE_KEY)) ?? getSystemLocale()
  } catch {
    currentLocale = getSystemLocale()
  }

  return currentLocale
}

export function setLocale(locale: Locale) {
  if (!supportedLocales.includes(locale as 'zh' | 'en')) return
  currentLocale = locale
  try {
    Taro.setStorageSync(LOCALE_STORAGE_KEY, locale)
  } catch {
    // The in-memory locale still applies when storage is unavailable.
  }
  notifyLanguageChange()
}

function readMessage(locale: Locale, key: string): string | undefined {
  let value: unknown = messages[locale]
  for (const segment of key.split('.')) {
    if (!value || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return typeof value === 'string' ? value : undefined
}

export function t(
  key: string,
  params: TranslationParams = {},
  locale: Locale = getLocale(),
): string {
  const template = readMessage(locale, key) ?? readMessage(DEFAULT_LOCALE, key) ?? key
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder,
  )
}
