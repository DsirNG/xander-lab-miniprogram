import { useSyncExternalStore } from 'react'
import { Button, Text, View } from '@tarojs/components'
import { getActionSheet, subscribeActionSheet } from '@/utils/actionSheet'
import './ActionSheet.scss'

/** Render within the page theme instead of inheriting the phone's native dialog theme. */
export function ActionSheet() {
  const sheet = useSyncExternalStore(subscribeActionSheet, getActionSheet, getActionSheet)
  if (!sheet) return null
  return <View className="app-action-sheet" catchMove>
    <View className="app-action-sheet-backdrop" onClick={() => sheet.finish(null)} />
    <View className="app-action-sheet-panel">
      {sheet.options.alertText ? <Text className="app-action-sheet-title">{sheet.options.alertText}</Text> : null}
      {sheet.options.itemList.map((label, index) => <Button key={index} className="app-action-sheet-option" hoverClass="app-action-sheet-option--pressed" onClick={() => sheet.finish(index)}>{label}</Button>)}
    </View>
  </View>
}
