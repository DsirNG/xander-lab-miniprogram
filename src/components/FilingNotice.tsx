import { Text, View } from '@tarojs/components'
import './FilingNotice.scss'

export const filingNumber = '渝ICP备2024036970号-2X'

export function FilingNotice() {
  return (
    <View className="filing-notice">
      <Text className="filing-number" selectable>{filingNumber}</Text>
    </View>
  )
}
