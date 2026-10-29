import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ storage: new Map<string, string>(), systemLanguage: 'zh_CN' }))
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => mocks.storage.get(key),
    setStorageSync: (key: string, value: string) => mocks.storage.set(key, value),
    getSystemInfoSync: () => ({ language: mocks.systemLanguage }),
  },
}))

beforeEach(() => {
  vi.resetModules()
  mocks.storage.clear()
  mocks.systemLanguage = 'zh_CN'
})

it('supports only Chinese and English and normalizes system languages', async () => {
  mocks.systemLanguage = 'en_US'
  mocks.storage.set('dinqor_locale', 'fr')
  const i18n = await import('./index')
  expect(i18n.supportedLocales).toEqual(['zh', 'en'])
  expect(i18n.getLocale()).toBe('en')
  expect(i18n.t('profile.settings')).toBe('Settings')
})

it('notifies mounted screens and persists the interface language', async () => {
  const i18n = await import('./index')
  const listener = vi.fn()
  const unsubscribe = i18n.subscribeLanguage(listener)
  i18n.setLocale('en')
  expect(listener).toHaveBeenCalledTimes(1)
  expect(mocks.storage.get('dinqor_locale')).toBe('en')
  expect(i18n.t('profile.points')).toBe('My points')
  unsubscribe()
  i18n.setLocale('zh')
  expect(listener).toHaveBeenCalledTimes(1)
})

it('stores reply language independently without modifying chat state', async () => {
  const i18n = await import('./index')
  mocks.storage.set('chat_active_id', '17')
  expect(i18n.getReplyLanguage()).toBe('auto')
  i18n.setReplyLanguage('en')
  i18n.setLocale('zh')
  expect(i18n.getReplyLanguage()).toBe('en')
  expect(mocks.storage.get('chat_active_id')).toBe('17')
  vi.resetModules()
  expect((await import('./index')).getReplyLanguage()).toBe('en')
})

it('keeps all locale key sets aligned and English UI text translated', async () => {
  const locales = await Promise.all([
    import('./locales/zh'),
    import('./locales/en'),
    import('./locales/fr'),
    import('./locales/ja'),
    import('./locales/ru'),
    import('./locales/vi'),
  ])
  const keys = (value: object, prefix = ''): string[] =>
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === 'string' ? [`${prefix}${key}`] : keys(entry, `${prefix}${key}.`),
    )
  const expected = keys(locales[0].default).sort()
  for (const locale of locales) expect(keys(locale.default).sort()).toEqual(expected)
  expect(Object.values(locales[1].default.ui).every(value => !/[\u3400-\u9fff]/.test(value))).toBe(
    true,
  )
})
