import { t } from '@/i18n'
export const TAB_ITEMS = [
  {
    key: 'chat',
    icon: 'chat',
    get label() {
      return t('ui.chat')
    },
  },
  {
    key: 'files',
    icon: 'files',
    get label() {
      return t('ui.files')
    },
  },
  {
    key: 'article',
    icon: 'article',
    get label() {
      return t('ui.blogs')
    },
  },
  {
    key: 'user',
    icon: 'user',
    get label() {
      return t('ui.meLabel')
    },
  },
] as const

export type TabKey = (typeof TAB_ITEMS)[number]['key']
export type TabItem = (typeof TAB_ITEMS)[number]
