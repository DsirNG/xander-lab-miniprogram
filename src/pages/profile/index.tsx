import Taro, { useLoad } from '@tarojs/taro'

/** Compatibility entry: top-level Profile now lives in MainShell. */
export default function Profile() {
  useLoad(() => {
    void Taro.reLaunch({ url: '/pages/main/index?tab=user' })
  })

  return null
}
