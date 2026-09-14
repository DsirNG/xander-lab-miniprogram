export const TAB_ITEMS = [
  { key: 'chat', icon: 'chat', label: '对话', url: '/pages/chat/index' },
  { key: 'calendar', icon: 'calendar', label: '计划', url: '/pages/plans/index' },
  { key: 'article', icon: 'article', label: '博客', url: '/pages/blog/index' },
  { key: 'user', icon: 'user', label: '我的', url: '/pages/profile/index' },
] as const

export type TabKey = (typeof TAB_ITEMS)[number]['key']
export type TabItem = (typeof TAB_ITEMS)[number]

/** 将 Taro / 微信返回的页面路径统一成不带查询参数的相对路径。 */
export function normalizeTabPath(path?: string | null): string {
  return String(path ?? '')
    .split(/[?#]/, 1)[0]
    .replace(/^\/+|\/+$/g, '')
}

export function getTabKeyByPath(path?: string | null): TabKey | undefined {
  const normalizedPath = normalizeTabPath(path)
  if (!normalizedPath) return undefined
  return TAB_ITEMS.find(item => normalizeTabPath(item.url) === normalizedPath)?.key
}
