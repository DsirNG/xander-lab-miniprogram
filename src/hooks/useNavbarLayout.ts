import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

export interface NavbarLayout {
  /** 状态栏高度 */
  statusBarHeight: number
  /** 导航内容区顶部（= 状态栏底部） */
  contentTop: number
  /** 导航内容区高度（以胶囊为基准垂直居中的区域） */
  contentHeight: number
  /** 状态栏 + 内容区总高 */
  navBarHeight: number
  /** 标题区最大宽度（不进入胶囊区域） */
  titleMaxWidth: number
  /** 胶囊宽度 */
  capsuleWidth: number
  /** 是否取到了真实胶囊数据（false 为降级值，多发生在 H5 / 开发工具） */
  rightSafeInset: number
  ready: boolean
}

const FALLBACK_STATUS_BAR = 20
const FALLBACK_CONTENT_HEIGHT = 44
const FALLBACK_CAPSULE_WIDTH = 87

interface CapsuleRect {
  top: number
  left: number
  right: number
  width: number
  height: number
}

function buildLayout(): NavbarLayout {
  let windowWidth = 375
  let statusBarHeight = FALLBACK_STATUS_BAR
  try {
    const info = Taro.getWindowInfo()
    console.log('windowInfo', info.safeArea)
    windowWidth = info.windowWidth || windowWidth
    statusBarHeight = info.statusBarHeight || statusBarHeight
  } catch {
    // 忽略，用兜底值
  }

  let capsule: CapsuleRect | undefined
  try {
    capsule = Taro.getMenuButtonBoundingClientRect() as CapsuleRect
  } catch {
    capsule = undefined
  }

  if (capsule && capsule.width > 0 && capsule.height > 0 && capsule.top > 0) {
    // 胶囊上边距 = capsule.top - 状态栏底部，内容区与该边距对称，保证与胶囊同一水平
    const topGap = capsule.top - statusBarHeight
    const contentHeight = capsule.height + topGap * 2
    const contentTop = statusBarHeight
    return {
      statusBarHeight,
      contentTop,
      contentHeight,
      navBarHeight: contentTop + contentHeight,
      capsuleWidth: capsule.width,
      rightSafeInset: Math.max(16, windowWidth - capsule.left + 8),
      // 标题最右不超过胶囊左缘，留 8px 呼吸间距
      titleMaxWidth: capsule.left - 8,
      ready: true,
    }
  }

  return {
    statusBarHeight,
    contentTop: statusBarHeight,
    contentHeight: FALLBACK_CONTENT_HEIGHT,
    navBarHeight: statusBarHeight + FALLBACK_CONTENT_HEIGHT,
    capsuleWidth: FALLBACK_CAPSULE_WIDTH,
    rightSafeInset: 16,
    titleMaxWidth: windowWidth - FALLBACK_CAPSULE_WIDTH - 32,
    ready: false,
  }
}

/** 根据右上角胶囊与设备信息计算顶部导航位置，与胶囊保持同一水平 */
export function useNavbarLayout(): NavbarLayout {
  const [layout, setLayout] = useState<NavbarLayout>(buildLayout)

  useEffect(() => {
    // iOS 屏幕旋转后胶囊会重新落位，等动画结束再取一次
    const onResize = () => {
      setTimeout(() => setLayout(buildLayout()), 150)
    }
    Taro.onWindowResize(onResize)
    return () => {
      Taro.offWindowResize(onResize)
    }
  }, [])

  return layout
}
