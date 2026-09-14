export const TAB_ITEMS = [
  { key: 'chat', icon: 'chat', label: '对话' },
  { key: 'calendar', icon: 'calendar', label: '计划' },
  { key: 'article', icon: 'article', label: '博客' },
  { key: 'user', icon: 'user', label: '我的' },
] as const

export type TabKey = (typeof TAB_ITEMS)[number]['key']
export type TabItem = (typeof TAB_ITEMS)[number]
