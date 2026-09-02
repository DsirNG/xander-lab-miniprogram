import Taro from '@tarojs/taro'
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
const supportedLocales = Object.keys(messages) as Locale[]

let currentLocale: Locale | null = null

function parseLocale(value: unknown): Locale | null {
  if (typeof value !== 'string') return null
  const language = value.trim().toLowerCase().replace('_', '-').split('-')[0]
  return supportedLocales.includes(language as Locale) ? (language as Locale) : null
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
  currentLocale = locale
  try {
    Taro.setStorageSync(LOCALE_STORAGE_KEY, locale)
  } catch {
    // The in-memory locale still applies when storage is unavailable.
  }
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
