import Taro, { useLoad } from '@tarojs/taro'

/** Compatibility entry: top-level Plans now lives in MainShell. */
export default function Plans() {
  useLoad(() => {
    void Taro.reLaunch({ url: '/pages/main/index?tab=calendar' })
  })

  return null
}
