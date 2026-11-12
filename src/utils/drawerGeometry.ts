import Taro from '@tarojs/taro'

export function drawerTravel(windowWidth: number, capsuleLeft?: number) {
  const normal = windowWidth * 0.7
  return Math.round(Math.max(windowWidth * 0.55, Math.min(normal, (capsuleLeft ?? windowWidth) - 16)))
}

export function getDrawerTravel() {
  let windowWidth = 375
  let capsuleLeft: number | undefined
  try { windowWidth = Taro.getWindowInfo().windowWidth || 375 } catch { /* Design fallback. */ }
  try {
    const capsule = Taro.getMenuButtonBoundingClientRect?.()
    if (capsule && capsule.left > 0) capsuleLeft = capsule.left
  } catch { /* Non-WeChat environments have no capsule. */ }
  return drawerTravel(windowWidth, capsuleLeft)
}
