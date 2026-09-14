import Taro from '@tarojs/taro'
import { useTabBarStore } from '@/store/tabBar'
import { getTabKeyByPath, type TabKey } from './tabBarRoute'

type PagePathInfo = {
  route?: string
  __route__?: string
  path?: string
}

function readCurrentTabKey(): TabKey | undefined {
  const current = Taro.getCurrentInstance()
  const page = current.page as PagePathInfo | null
  const pages = Taro.getCurrentPages()
  const currentPage = pages[pages.length - 1] as PagePathInfo | undefined
  const paths = [
    current.router?.path,
    page?.route,
    page?.path,
    page?.__route__,
    currentPage?.route,
    currentPage?.path,
    currentPage?.__route__,
  ]

  return paths.map(getTabKeyByPath).find(Boolean)
}

/** Synchronizes the capsule selection with the platform's current tab page. */
export function syncTabBarFromCurrentPage(): TabKey | undefined {
  try {
    const active = readCurrentTabKey()
    if (active) {
      const state = useTabBarStore.getState()
      if (state.active !== active) state.setActive(active)
    }
    return active
  } catch {
    return undefined
  }
}
