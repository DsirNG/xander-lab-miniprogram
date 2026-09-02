import type { CSSProperties, ReactNode } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useNavbarLayout } from '@/hooks/useNavbarLayout'
import { Icon } from './Icon'
import './NavBar.scss'

/** 无上一级页面时的兜底目的地：对话页 */
const HOME_URL = '/pages/chat/index'

function getCurrentPageCount(): number {
  try {
    return Taro.getCurrentPages().length
  } catch {
    return 1
  }
}

interface NavBarProps {
  title?: string
  showBack?: boolean
  /** 自定义返回行为，默认：有上一级页面时 navigateBack，无上一级页面时兜底回到对话页 */
  onBack?: () => void
  /** 左侧插槽（当没有返回键时展示） */
  left?: ReactNode
  background?: string
  color?: string
}

/**
 * 顶部导航：根据右上角胶囊与设备信息定位，
 * 内容区与胶囊同一水平，标题避开胶囊区域。
 * 胶囊旁不放置任何操作项；无上一级页面（如分享卡片直达）时返回键
 * 使用专属兜底图标，点击回到对话页。
 */
export function NavBar({
  title = '',
  showBack = false,
  onBack,
  left,
  background,
  color,
}: NavBarProps) {
  const { statusBarHeight, contentHeight, navBarHeight, titleMaxWidth, rightSafeInset } =
    useNavbarLayout()

  const canGoBack = getCurrentPageCount() > 1

  const handleDefaultBack = () => {
    if (canGoBack) {
      Taro.navigateBack({
        fail: () => {
          Taro.reLaunch({ url: HOME_URL })
        },
      })
      return
    }
    Taro.reLaunch({ url: HOME_URL })
  }

  const barStyle: CSSProperties = {
    paddingTop: statusBarHeight,
    height: navBarHeight,
    ...(background ? { background } : {}),
    ...(color ? { color } : {}),
  }

  return (
    <>
      {/* 占位：维持文档流，避免内容被固定在顶部的导航遮盖 */}
      <View style={{ height: navBarHeight }} />
      <View className="nav-bar" style={barStyle}>
        <View
          className="nav-bar-body"
          style={{ height: contentHeight, paddingRight: rightSafeInset }}
        >
          <View className="nav-bar-side nav-bar-side-left">
            {showBack ? (
              <View
                className={`nav-bar-back${canGoBack ? '' : ' nav-bar-back--home'}`}
                hoverClass="nav-bar-back--pressed"
                onClick={onBack ?? handleDefaultBack}
              >
                <Icon name={canGoBack ? 'back' : 'home'} />
              </View>
            ) : (
              left
            )}
          </View>
          <Text className="nav-bar-title" style={{ maxWidth: titleMaxWidth }}>
            {title}
          </Text>
        </View>
      </View>
    </>
  )
}
