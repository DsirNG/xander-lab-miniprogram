import { useDidShow } from '@tarojs/taro'
import type { TabKey } from '@/utils/tabBarRoute'
import { syncTabBarFromCurrentPage } from '@/utils/tabBar'

/** Keeps the custom tab bar aligned with the platform's current tab page. */
export function useTabBarPage(_active: TabKey) {
  useDidShow(() => {
    syncTabBarFromCurrentPage()
  })
}
