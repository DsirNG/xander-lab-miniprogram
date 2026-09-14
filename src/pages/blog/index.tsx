import Taro, { useLoad, useRouter } from '@tarojs/taro'

/** Compatibility entry: top-level Blog now lives in MainShell. */
export default function Blog() {
  const { params } = useRouter()

  useLoad(() => {
    const query = params.tag ? `&tag=${params.tag}` : ''
    void Taro.reLaunch({ url: `/pages/main/index?tab=article${query}` })
  })

  return null
}
