import Taro, { useLoad } from '@tarojs/taro'

/** Compatibility entry: top-level Chat now lives in MainShell. */
export default function Chat() {
  useLoad(() => {
    void Taro.reLaunch({ url: '/pages/main/index?tab=chat' })
  })

  return null
}
