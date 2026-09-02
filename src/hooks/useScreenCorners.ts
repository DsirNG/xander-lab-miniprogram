import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

interface ScreenCorners {
  /** 左上圆角：胶囊到状态栏底部的间距，即屏幕物理圆角区域高度 */
  topLeft: number
  /** 左下圆角：底部安全区高度，即屏幕物理圆角区域高度 */
  bottomLeft: number
}

/**
 * 根据设备实际参数推导屏幕四角的物理圆角大小，
 * 用于让卡片圆角与不同机型的屏幕圆角对齐。
 */
export function useScreenCorners(): ScreenCorners {
  const [corners, setCorners] = useState<ScreenCorners>({ topLeft: 12, bottomLeft: 0 })

  useEffect(() => {
    try {
      const capsule = Taro.getMenuButtonBoundingClientRect()
      const sysInfo = Taro.getWindowInfo()
      const topRadius = Math.max(0, capsule.top - (sysInfo.statusBarHeight ?? 0))
      setCorners(prev => ({ ...prev, topLeft: topRadius }))
    } catch {
      /* 兜底值 */
    }

    try {
      const sysInfo = Taro.getSystemInfoSync()
      if (sysInfo.safeArea) {
        const bottomRadius = Math.max(0, sysInfo.screenHeight - sysInfo.safeArea.bottom)
        setCorners(prev => ({ ...prev, bottomLeft: bottomRadius }))
      }
    } catch {
      /* 兜底值 */
    }
  }, [])

  return corners
}
