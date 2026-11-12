import type Taro from '@tarojs/taro'

type Sheet = { options: Taro.showActionSheet.Option; finish: (index: number | null) => void }
let current: Sheet | null = null
const listeners = new Set<() => void>()
export const subscribeActionSheet = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const getActionSheet = () => current
export const dismissActionSheet = () => current?.finish(null)
export function showThemedActionSheet(options: Taro.showActionSheet.Option): Promise<Taro.showActionSheet.SuccessCallbackResult> {
  dismissActionSheet()
  return new Promise((resolve, reject) => {
    current = { options, finish: index => {
      current = null
      listeners.forEach(listener => listener())
      if (index === null) {
        const error = { errMsg: 'showActionSheet:fail cancel' }
        options.fail?.(error); options.complete?.(error); reject(error)
      } else {
        const result = { tapIndex: index, errMsg: 'showActionSheet:ok' }
        options.success?.(result); options.complete?.(result); resolve(result)
      }
    } }
    listeners.forEach(listener => listener())
  })
}
